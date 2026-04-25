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
  executeStartAgentPipeline,
  executeStartConcurrentPipelines,
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
      case 'startAgentPipeline': {
        return await executeStartAgentPipeline({
          businessId,
          agents: args.agents as Array<{ targetAgent: import('@/lib/types/workflow').AgentName; context: string }>,
          userMessage: args.userMessage as string,
        });
      }
      case 'startConcurrentPipelines': {
        return await executeStartConcurrentPipelines({
          businessId,
          pipelines: args.pipelines as Array<Array<{ targetAgent: import('@/lib/types/workflow').AgentName; context: string }>>,
          userMessage: args.userMessage as string,
        });
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
  businessReady = true,
}: {
  businessId: string;
  message: string;
  businessReady?: boolean;
}): Promise<{ reply: string }> {
  const glm = getGlmClient();

  const { data: business } = await supabase
    .from('businesses')
    .select('name')
    .eq('id', businessId)
    .maybeSingle();

  const businessName = business?.name ?? 'your business';

  const systemPrompt = businessReady
    ? `You are the Orchestrator for "${businessName}", an AI-operated print-on-demand business on Podilot.

You coordinate specialized agents by using the tools provided. You do NOT answer from your own knowledge — always use tools to get real data.

AGENTS YOU CAN COORDINATE:
- business_agent: Guides the user through clarifying their business idea, niche, and brand direction via the onboarding chat
- design_agent: Autonomously generates a product concept (title, description, category) and creates a draft product record
- launch_agent: Creates products on Printify and publishes them to sales channels (autonomous)
- finance_agent: Analyzes profit margins, detects anomalies, reprices or retires underperforming products

AVAILABLE TOOLS:
- startAgentPipeline: Activate multiple agents in sequence for a SINGLE product/task. Each agent waits for the previous to finish.
- startConcurrentPipelines: Activate multiple INDEPENDENT pipelines for MULTIPLE products/tasks simultaneously. Each pipeline is sequential internally but all pipelines run in parallel. Use when the user wants to work on 2+ products at the same time.
- invokeAgent: Queue a single task for one agent. Use for targeted single-agent requests.
- getAgentStates: Check which agents are idle, running, or in error state.
- getFinanceSnapshot: Get the latest cached financial metrics. Use for quick financial questions.
- getRecentWorkflows: See recent activity across all agents.
- getReadyProducts: See products ready to launch.
- getMarketResearch: Search real-time prices and trends on Etsy, Shopee, TikTok Shop. Returns immediately — no agent invoked.
- logDecision: Log a notable decision to the activity log.

DECISION GUIDELINES:
- Single product from scratch: use startAgentPipeline with [design_agent, launch_agent]
- Multiple products at once (e.g. "create two products", "design and launch A and B"): use startConcurrentPipelines — one pipeline per product, each with [design_agent, launch_agent]
- Financial questions: call getFinanceSnapshot first. If stale (>7 days), invokeAgent finance_agent with type "financial_analysis".
- Product launch requests (product already designed): invokeAgent launch_agent with type "product_launch_publish".
- Market research: call getMarketResearch directly — do NOT invoke an agent.
- If unsure what the user wants, ask a clarifying question — do NOT guess.
- Always be concise. Keep responses under 150 words.`
    : `You are the Orchestrator for a new business on Podilot that has not yet completed its setup.

CRITICAL CONSTRAINT: The business setup (onboarding) is NOT complete. You MUST NOT invoke any agents or take any actions other than redirecting the user to complete onboarding.

For EVERY message the user sends, regardless of content, respond with a short, friendly message explaining:
1. Their business setup is not complete yet
2. They need to go to the Onboarding page to define their business idea, niche, and brand strategy
3. Once onboarding is complete, all agents will be unlocked

Do NOT call any tools. Do NOT discuss business operations, products, or marketing. Keep responses under 60 words.`;

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
