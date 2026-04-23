import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import {
  fetchPrintifyOrders,
  calculateProfitMetrics,
  detectAnomalies,
  TOOL_DEFINITIONS,
} from './tools';
import { handleFinanceSignals } from '../orchestrator/signalHandler';
import { processIncomingMessages } from './receiveHandler';

// GLM uses the OpenAI SDK — just swap the base URL
function getGlmClient(): OpenAI {
  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GLM_API_KEY');
  }

  return new OpenAI({
    apiKey,
    baseURL: process.env.ILMU_BASE_URL || 'https://api.ilmu.ai/v1',
  });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!   // backend uses service role
);

// ─── Main agent entry point ────────────────────────────────────────────────────
export async function runFinanceAgent({ businessId, days = 30, userMessage = null }: any) {
  const glm = getGlmClient();

  // Step 0: Process any incoming messages from other agents
  const incoming = await processIncomingMessages(businessId, supabase);
  if (incoming.processed > 0) {
    console.log(`[FinanceAgent] Processed ${incoming.processed} incoming messages: ${incoming.types.join(', ')}`);
  }

  // 1. Load business context (get Printify token + shop ID from Supabase)
  const { data: business, error } = await supabase
    .from('businesses')
    .select('id, name, printify_shop_id')
    .eq('id', businessId)
    .single();

  if (error || !business) throw new Error('Business not found');

  const shopId = business.printify_shop_id;
  // According to db.md, printify_token is not stored in the database.
  // Using the PRINTIFY_DEV_TOKEN from .env file for integration.
  const printifyToken = process.env.PRINTIFY_DEV_TOKEN;

  // 2. Check cache FIRST — serve cached snapshot even without Printify credentials.
  //    This allows mock/seeded data to load during development without a live Printify token.
  const today = new Date().toISOString().split('T')[0];

  // FIX #5: Use .maybeSingle() instead of .single().
  const { data: cached, error: cacheError } = await supabase
    .from('finance_snapshots')
    .select('*')
    .eq('business_id', businessId)
    .eq('snapshot_date', today)
    .eq('period', `${days}d`)
    .maybeSingle();

  if (cacheError) {
    console.warn('[Finance Agent] Cache lookup failed, running fresh analysis:', cacheError.message);
  }

  // Return cached snapshot if available AND no user-specific question
  if (cached && !cacheError && !userMessage) {
    return {
      metrics: cached.metrics,
      insights: cached.insights,
      signals: cached.signals,
      cached: true,
    };
  }

  // 3. Printify credentials required only for a live run (no cache hit)
  if (!printifyToken || !shopId) {
    throw new Error('Printify not connected for this business. Connect it first in Launch & Integrations.');
  }

  // 4. Build the tool executor — the GLM agent will call these by name
  const toolState: any = {};  // { orders: [...], metrics: { summary, by_product } }
  const toolContext = { printifyToken, shopId, days, toolState };

  async function executeTool(name: string, args: any) {
    try {
      switch (name) {
        case 'fetchPrintifyOrders':
          // GLM may pass a `days` override — respect it, otherwise use run-level default
          return await fetchPrintifyOrders({ ...toolContext, days: args.days || days });
        case 'calculateProfitMetrics':
          return calculateProfitMetrics({ toolState });
        case 'detectAnomalies':
          return detectAnomalies({ toolState });
        default:
          return { error: `Unknown tool: ${name}. Available tools: fetchPrintifyOrders, calculateProfitMetrics, detectAnomalies` };
      }
    } catch (err: any) {
      console.error(`[Finance Agent] Tool ${name} failed:`, err.message);
      return { error: err.message, tool: name, recoverable: true };
    }
  }

  // 4. Build the system prompt for the Finance Agent
  const systemPrompt = `You are the Finance Agent for "${business.name}", an AI-operated print-on-demand business on Podilot.

WORKFLOW — follow these steps in order, no skipping:
1. Call fetchPrintifyOrders to retrieve order data. It returns a count summary only.
2. Call calculateProfitMetrics — takes NO arguments, reads data server-side.
3. Call detectAnomalies — takes NO arguments, reads computed metrics server-side.
4. After all three calls complete, write your final analysis.

IF a tool returns { error: "..." }:
- For "No fulfilled orders": skip calculateProfitMetrics and detectAnomalies, explain no data is available yet.
- For Printify API errors: explain the connection issue and suggest checking the API token.
- For any other error: note it and continue with available data.

FINAL RESPONSE FORMAT:
- One-sentence store health verdict (e.g. "Store is profitable with 34% margin.")
- P&L summary: revenue / costs / profit / margin
- Top performer and bottom performer by margin
- 2-3 concrete, number-backed recommendations
- Under 200 words. No filler. Be direct.

You are READ-ONLY. Produce analysis only — do not attempt to modify listings or execute actions.`;

  // 5. Run the agentic tool-calling loop
  const messages: any[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: userMessage || `Analyse the financial performance of this business for the last ${days} days and provide insights.`,
    },
  ];

  let finalInsights = '';
  let finalMetrics: any = null;
  let finalSignals: any = null;
  const MAX_ITERATIONS = 6;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await glm.chat.completions.create({
      model: process.env.GLM_MODEL || 'glm-4.5',
      messages,
      tools: TOOL_DEFINITIONS as any,
      tool_choice: 'auto',
      max_tokens: 2048,
      temperature: 0.4,
    });

    const msg = response.choices[0].message;
    messages.push(msg);

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      finalInsights = msg.content || '';
      break;
    }

    for (const toolCall of msg.tool_calls) {
      if (toolCall.type !== 'function') continue;
      const name = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments || '{}');

      console.log(`[Finance Agent] Calling tool: ${name}`);
      const result = await executeTool(name, args);

      if (name === 'calculateProfitMetrics') finalMetrics = result;
      if (name === 'detectAnomalies') finalSignals = result;

      messages.push({
        role: 'tool',
        content: JSON.stringify(result),
        tool_call_id: toolCall.id,
      });
    }
  }

  // 6. Save snapshot to Supabase
  if (toolState.metrics) {
    const upsertData: any = {
      business_id: businessId,
      snapshot_date: today,
      period: `${days}d`,
      metrics: toolState.metrics,
      insights: finalInsights,
    };
    if (toolState.signals) upsertData.signals = toolState.signals;
    else if (finalSignals) upsertData.signals = finalSignals;

    await supabase.from('finance_snapshots').upsert(upsertData, { onConflict: 'business_id, snapshot_date, period' });

    // 7. Log to workflows table for the Orchestrator
    await supabase.from('workflows').insert({
      business_id: businessId,
      type: 'financial_analysis',
      source_agent: 'finance_agent',
      state: 'completed',
      payload: {
        run_at: new Date().toISOString(),
        period_days: days,
        signals_count: finalSignals?.signals?.length || 0,
        alerts_count: finalSignals?.alerts?.length || 0,
      },
    });

    if (finalSignals?.signals?.length > 0) {
       await handleFinanceSignals({ businessId, signals: finalSignals.signals, supabase });
    }
  }

  return {
    metrics: toolState.metrics || finalMetrics,
    insights: finalInsights,
    signals: toolState.signals || finalSignals,
    cached: false,
  };
}