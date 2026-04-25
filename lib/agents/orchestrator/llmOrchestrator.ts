import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import {
  TOOL_DEFINITIONS,
  executeGetAgentStates,
  executeInvokeAgent,
  executeGetFinanceSnapshot,
  executeGetRecentWorkflows,
  executeLogDecision,
  executeGetReadyProducts,
  executeGetMarketResearch,
} from './tools';
import { runOrchestrator } from './orchestrator';
import type { AgentName } from '@/lib/types/workflow';

export function getGlmClient(): OpenAI {
  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GLM_API_KEY');
  }

  return new OpenAI({
    apiKey,
    baseURL: process.env.ILMU_BASE_URL || 'https://api.ilmu.ai/v1',
  });
}

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ─── Shared tool executor ────────────────────────────────────────────────────

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  businessId: string,
): Promise<unknown> {
  try {
    switch (name) {
      case 'getAgentStates': {
        return await executeGetAgentStates(businessId);
      }
      case 'invokeAgent': {
        const result = await executeInvokeAgent({
          businessId,
          targetAgent: args.targetAgent as AgentName,
          type: args.type as string,
          payload: args.payload as Record<string, unknown> | undefined,
        });
        runOrchestrator().catch(e => console.error('[LLM Orchestrator] Background orchestrator trigger failed:', e));
        return result;
      }
      case 'getFinanceSnapshot': {
        return await executeGetFinanceSnapshot(businessId);
      }
      case 'getRecentWorkflows': {
        return await executeGetRecentWorkflows(businessId);
      }
      case 'logDecision': {
        return await executeLogDecision({
          businessId,
          decision: args.decision as string,
          reasoning: args.reasoning as string,
          actionsTaken: args.actionsTaken as string[] | undefined,
        });
      }
      case 'getReadyProducts': {
        return await executeGetReadyProducts(businessId);
      }
      case 'getMarketResearch': {
        return await executeGetMarketResearch(args.query as string);
      }
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[LLM Orchestrator] Tool ${name} failed:`, errorMessage);
    return { error: errorMessage, tool: name };
  }
}

// ─── Reactive orchestrator (chat mode) ───────────────────────────────────────

export async function runLlmOrchestrator({
  businessId,
  message,
}: {
  businessId: string;
  message: string;
}): Promise<{ reply: string }> {
  const glm = getGlmClient();

  const { data: business } = await supabase
    .from('businesses')
    .select('name')
    .eq('id', businessId)
    .maybeSingle();

  const businessName = business?.name ?? 'your business';

  const systemPrompt = `You are the Orchestrator for "${businessName}", an AI-operated print-on-demand business on Podilot.

You coordinate specialized agents by using the tools provided. You do NOT answer from your own knowledge — always use tools to get real data.

AGENTS YOU CAN COORDINATE:
- finance_agent: Analyzes profit margins, detects anomalies, can reprice or retire underperforming products, provides financial insights
- launch_agent: Creates products on Printify and publishes them to sales channels
- customer_service_agent: Handles customer support tickets (refunds, replacements, order issues)

AVAILABLE TOOLS:
- getAgentStates: Check which agents are idle, running, or in error state. Always call this before invoking an agent.
- invokeAgent: Queue a task for an agent. Requires targetAgent and type. The agent will process it asynchronously.
- getFinanceSnapshot: Get the latest cached financial metrics without running the finance agent. Use this for quick financial questions.
- getRecentWorkflows: See recent activity across all agents. Useful for status reports.
- getReadyProducts: See products that are ready to launch.
- getMarketResearch: Search real-time prices and trends on Etsy, Shopee, and TikTok Shop for a product. Returns results immediately — no agent invoked.
- logDecision: Log a decision to the Command Center activity log. Use this when you take a notable action.

DECISION GUIDELINES:
- For financial questions: call getFinanceSnapshot first. If no snapshot exists or it's stale (>7 days), invokeAgent for finance_agent with type "financial_analysis".
- For product launch/publish requests: invokeAgent with targetAgent "launch_agent" and type "product_launch_publish".
- For repricing/retiring products: invokeAgent with targetAgent "finance_agent" and type "financial_analysis" (it will detect and signal repricing).
- For market research or pricing research on a product: call getMarketResearch directly — do NOT invoke an agent.
- For product design requests (designing a new product from scratch): do NOT invoke any agent. Tell the user to use the Design tab in the dashboard — it provides an interactive AI-powered design experience.
- If an agent is already running, tell the user and offer to queue the task.
- For multi-step requests, call tools in sequence (e.g., get finance data then invoke agent).
- If unsure what the user wants, ask a clarifying question — do NOT guess.
- Always be concise. Reference specific numbers when available. Keep responses under 150 words.`;

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: message },
  ];

  const MAX_ITERATIONS = 5;
  let finalReply = '';

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await glm.chat.completions.create({
      model: process.env.GLM_MODEL || 'ilmu-glm-5.1',
      messages,
      tools: TOOL_DEFINITIONS as OpenAI.Chat.ChatCompletionTool[],
      tool_choice: 'auto',
      max_tokens: 1024,
      temperature: 0.4,
    });

    const msg = response.choices[0].message;
    messages.push(msg);

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      finalReply = msg.content || 'I wasn\'t able to process that request. Could you try rephrasing?';
      break;
    }

    for (const toolCall of msg.tool_calls) {
      if (toolCall.type !== 'function') continue;
      const name = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments || '{}');

      console.log(`[LLM Orchestrator] Calling tool: ${name}`);
      const result = await executeTool(name, args, businessId);

      messages.push({
        role: 'tool',
        content: JSON.stringify(result),
        tool_call_id: toolCall.id,
      });
    }
  }

  if (!finalReply) {
    finalReply = 'I\'ve processed your request. Check the Command Center for agent activity updates.';
  }

  return { reply: finalReply };
}
