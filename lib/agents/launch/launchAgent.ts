import 'dotenv/config';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import type { LaunchProductInput, SuggestedPrices, PrintifyResult } from '@/lib/types';
import {
  performMarketResearch,
  createPrintifyProduct,
  publishProductToSalesChannel,
  TOOL_DEFINITIONS,
} from './tools';

function getGlmClient(): OpenAI {
  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GLM_API_KEY');
  }

  const baseURL = (process.env.ILMU_BASE_URL || 'https://api.ilmu.ai/v1').trim();
  const timeoutMsRaw = Number(process.env.GLM_TIMEOUT_MS || 30_000);
  const timeout = Number.isFinite(timeoutMsRaw) && timeoutMsRaw > 0 ? timeoutMsRaw : 30_000;

  return new OpenAI({
    apiKey,
    baseURL,
    timeout,
    maxRetries: 1,
  });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // backend uses service role
);

export async function runLaunchAgent({
  businessId,
  productId,
  productData,
  userMessage = null,
}: {
  businessId: string;
  productId: string;
  productData: LaunchProductInput;
  userMessage?: string | null;
}) {
  const glm = getGlmClient();

  // 1. Load business context (get printify_shop_id)
  const { data: business, error } = await supabase
    .from('businesses')
    .select('id, name, printify_shop_id')
    .eq('id', businessId)
    .single();

  if (error || !business) {
    throw new Error('Business not found');
  }

  const shopId = business.printify_shop_id;
  const printifyToken = process.env.PRINTIFY_DEV_TOKEN;

  if (!printifyToken || !shopId) {
    console.warn('[Launch Agent] Printify credentials missing, mock creation will be used.');
  }

  // 2. Insert pending launch state in the database
  const { data: launchRecord, error: launchError } = await supabase
    .from('product_launches')
    .insert({
      business_id: businessId,
      product_id: productId,
      status: 'in_progress',
    })
    .select()
    .single();

  if (launchError) {
    throw new Error(`Failed to create product_launches record: ${launchError.message}`);
  }

  const launchId = launchRecord.id;

  // 3. Build the tool executor
  const toolState: any = { marketResearchSummary: '', printifyResult: null, publishResult: null, prices: null, reasoning: '' };
  
  async function executeTool(name: string, args: any) {
    try {
      switch (name) {
        case 'performMarketResearch': {
          const res = await performMarketResearch({ productName: args.productName, categories: args.categories });
          toolState.marketResearchSummary = res;
          
          await supabase.from('product_launches').update({
            market_research_summary: res.substring(0, 800) + '...',
            updated_at: new Date().toISOString()
          }).eq('id', launchId);
          
          return { marketData: res };
        }
        case 'createPrintifyProduct': {
          const res = await createPrintifyProduct({
            productData,
            prices: args.prices,
            printifyToken: printifyToken!,
            shopId: shopId!,
          });
          toolState.printifyResult = res;
          toolState.prices = args.prices;
          toolState.reasoning = args.reasoning;
          
          await supabase.from('product_launches').update({
            printify_product_id: res.product_id,
            optimal_prices: args.prices,
            pricing_reasoning: args.reasoning,
            pricing_confidence: args.confidence || 0.85,
            status: 'created',
            updated_at: new Date().toISOString()
          }).eq('id', launchId);

          return res;
        }
        case 'publishProductToSalesChannel': {
          const res = await publishProductToSalesChannel({
            productId: args.productId,
            printifyToken: printifyToken!,
            shopId: shopId!,
            waitForPublish: false,
          });
          toolState.publishResult = res;
          
          await supabase.from('product_launches').update({
            publish_status: res.publish_status,
            status: res.published ? 'published' : 'created',
            launched_at: res.published ? new Date().toISOString() : null,
            updated_at: new Date().toISOString()
          }).eq('id', launchId);

          if (!res.published && res.publish_status === 'publishing') {
            await supabase.from('workflows').insert({
              business_id: businessId,
              type: 'product_launch_publish',
              source_agent: 'launch_agent',
              state: 'pending',
              payload: {
                launch_id: launchId,
                product_id: productId,
                printify_product_id: toolState.printifyResult?.product_id ?? args.productId,
                publish_status: res.publish_status,
              },
            });
          }

          if (res.published && res.external_product_id) {
            await supabase.from('product_launches').update({
              external_product_id: res.external_product_id,
            }).eq('id', launchId);
          }

          return res;
        }
        default:
          return { error: `Unknown tool: ${name}` };
      }
    } catch (err: any) {
      console.error(`[Launch Agent] Tool ${name} failed:`, err.message);
      return { error: err.message, tool: name, recoverable: true };
    }
  }

  // 4. Build the system prompt
  const systemPrompt = `You are the Launch Agent for "${business.name}", an AI-operated print-on-demand business.

WORKFLOW — follow these steps in order:
1. Call performMarketResearch to fetch live data about the product's market and pricing in Malaysia.
2. Call createPrintifyProduct using the returned market data to determine profitable, realistic prices (suggested margins 30-50% over base cost).
3. Call publishProductToSalesChannel using the returned productId (from step 2) to push the product live.
4. After all calls complete, give a concise summary message. You must exclusively use the tools provided.`;

  // 5. Run the agentic tools loop
  const messages: any[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: userMessage || `Launch the product "${productData.name}" belonging to categories: ${productData.categories.join(', ')}. Description: ${productData.description}`,
    },
  ];

  let finalInsights = '';
  const MAX_ITERATIONS = 6;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await glm.chat.completions.create({
      model: (process.env.GLM_MODEL || 'ilmu-glm-5.1').trim(),
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

      console.log(`[Launch Agent] Calling tool: ${name}`);
      const result = await executeTool(name, args);

      messages.push({
        role: 'tool',
        content: JSON.stringify(result),
        tool_call_id: toolCall.id,
      });
    }
  }

  return {
    launch_id: launchId,
    product_name: productData.name,
    optimal_prices: toolState.prices || {},
    pricing_reasoning: toolState.reasoning,
    printify_result: toolState.printifyResult,
    publish_result: toolState.publishResult,
    timestamp: new Date().toISOString(),
    final_message: finalInsights,
  };
}

// ====================== TEST / MOCK (run with ts-node or in API route) ======================
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('launchAgent.ts')) {
  runLaunchAgent({
    businessId: '123e4567-e89b-12d3-a456-426614174000', // Dummy ID
    productId: 'aaaaaaaa-0001-0001-0001-000000000001', // Dummy ID
    productData: {
      name: 'Malaysian Cyber Cat Hoodie',
      description: 'Futuristic cyber-y2k cat wearing songkok and batik pattern.',
      categories: ['hoodie', 'tshirt', 'mug'],
      tags: ['malaysia', 'cyber', 'cat'],
    }
  })
    .then((result) => console.log('LAUNCH RESULT:\n', JSON.stringify(result, null, 2)))
    .catch(console.error);
}
// lib/agents/launchAgent.ts
