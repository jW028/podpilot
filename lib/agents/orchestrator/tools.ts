import { createClient } from '@supabase/supabase-js';
import type { AgentState } from '@/lib/types/agent';
import type { WorkflowRow, AgentName } from '@/lib/types/workflow';
import { getAllAgentStates } from '@/lib/agents/shared/agentStateManager';
import { performMarketResearch, inferCategories } from '@/lib/agents/launch/tools';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ─── Tool Executors ──────────────────────────────────────────────────────────

export async function executeGetAgentStates(businessId: string): Promise<AgentState[]> {
  return getAllAgentStates(businessId);
}

export async function executeInvokeAgent(args: {
  businessId: string;
  targetAgent: AgentName;
  type: string;
  payload?: Record<string, unknown>;
}): Promise<{ success: boolean; workflowId?: string; error?: string }> {
  const { businessId, targetAgent, type, payload } = args;

  const { data, error } = await supabase
    .from('workflows')
    .insert({
      business_id: businessId,
      type,
      source_agent: 'orchestrator',
      target_agent: targetAgent,
      state: 'pending',
      payload: payload ?? { prompt: `Orchestrator-requested: ${type}`, timestamp: new Date().toISOString() },
    })
    .select('id')
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, workflowId: data.id };
}

export async function executeGetFinanceSnapshot(businessId: string): Promise<{
  found: boolean;
  snapshot?: {
    period: string;
    snapshot_date: string;
    metrics: Record<string, unknown>;
    insights: string;
    signals?: unknown;
  };
}> {
  const { data, error } = await supabase
    .from('finance_snapshots')
    .select('period, snapshot_date, metrics, insights, signals')
    .eq('business_id', businessId)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return { found: false };
  }

  return {
    found: true,
    snapshot: {
      period: data.period,
      snapshot_date: data.snapshot_date,
      metrics: data.metrics as Record<string, unknown>,
      insights: data.insights,
      signals: data.signals,
    },
  };
}

export async function executeGetRecentWorkflows(businessId: string): Promise<WorkflowRow[]> {
  const { data, error } = await supabase
    .from('workflows')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error || !data) return [];
  return data as WorkflowRow[];
}

export async function executeLogDecision(args: {
  businessId: string;
  decision: string;
  reasoning: string;
  actionsTaken?: string[];
}): Promise<{ success: boolean; workflowId?: string; error?: string }> {
  const { businessId, decision, reasoning, actionsTaken } = args;

  const { data, error } = await supabase
    .from('workflows')
    .insert({
      business_id: businessId,
      type: 'orchestrator_decision',
      source_agent: 'orchestrator',
      target_agent: 'orchestrator',
      state: 'processed',
      payload: {
        decision,
        reasoning,
        actions_taken: actionsTaken ?? [],
        timestamp: new Date().toISOString(),
      },
    })
    .select('id')
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, workflowId: data.id };
}

export async function executeGetMarketResearch(query: string): Promise<{ results: string }> {
  const categories = inferCategories(query);
  const results = await performMarketResearch({ productName: query, categories });
  return { results };
}

export async function executeStartAgentPipeline(args: {
  businessId: string;
  agents: Array<{ targetAgent: AgentName; context: string }>;
  userMessage: string;
}): Promise<{ success: boolean; pipelineIds: string[]; error?: string }> {
  const { businessId, agents, userMessage } = args;
  const pipelineIds: string[] = [];
  let previousId: string | null = null;

  for (const agent of agents) {
    const res = await supabase
      .from('workflows')
      .insert({
        business_id: businessId,
        type: 'agent_pipeline_task',
        source_agent: 'orchestrator',
        target_agent: agent.targetAgent,
        state: 'pending',
        depends_on: previousId,
        payload: {
          context: agent.context,
          userMessage,
          pipelineStep: pipelineIds.length,
        },
      })
      .select('id')
      .single();

    const data = res.data as { id: string } | null;
    const error = res.error;

    if (error || !data) {
      return { success: false, pipelineIds, error: error?.message ?? 'Insert failed' };
    }

    pipelineIds.push(data.id);
    previousId = data.id;
  }

  return { success: true, pipelineIds };
}

export async function executeGetReadyProducts(businessId: string): Promise<Array<{ id: string; title: string; hasPrices: boolean }>> {
  const { data, error } = await supabase
    .from('products')
    .select('id, title, attributes')
    .eq('business_id', businessId)
    .eq('status', 'ready');

  if (error || !data) return [];

  return data.map((p) => {
    const attrs = p.attributes as Record<string, { value: unknown }> | null ?? {};
    const hasPrices = Object.keys(attrs).some(
      (k) => k.startsWith('price_') && typeof attrs[k]?.value === 'number',
    );
    return { id: p.id, title: p.title, hasPrices };
  });
}

// ─── Tool Definitions (OpenAI function-calling format) ───────────────────────

export const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'getAgentStates',
      description:
        'Fetch the current state of all agents for this business. Returns each agent\'s status (idle/running/error), current task, and metadata. Use this to check availability before invoking an agent.',
      strict: true,
      parameters: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'invokeAgent',
      description:
        'Queue a task for a specific agent by inserting a pending workflow row. The agent will pick it up and process it. Use this to trigger agent actions like financial analysis, product launches, etc.',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          targetAgent: {
            type: 'string',
            enum: ['finance_agent', 'launch_agent', 'product_agent', 'customer_service_agent'],
            description: 'The agent to invoke.',
          },
          type: {
            type: 'string',
            description: 'The workflow type (e.g. "financial_analysis", "product_launch_publish", "design_to_launch").',
          },
          payload: {
            type: 'object',
            description: 'Optional payload with details for the agent task.',
            properties: {
              prompt: { type: 'string', description: 'User instruction for the agent' },
              days: { type: 'number', description: 'For finance_agent: number of days to analyze' },
              productId: { type: 'string', description: 'Product ID for launch/design operations' },
            },
            required: [],
            additionalProperties: true,
          },
        },
        required: ['targetAgent', 'type'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getFinanceSnapshot',
      description:
        'Retrieve the most recent financial snapshot for this business. Returns metrics (revenue, profit, margins, top products), insights, and signals. Use this to answer financial questions directly without running the finance agent. If no snapshot exists or it\'s stale, consider invoking the finance_agent.',
      strict: true,
      parameters: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getRecentWorkflows',
      description:
        'Fetch the 10 most recent workflows for this business. Shows what agents have been doing, what\'s pending, and what completed or failed. Useful for reporting activity to the user.',
      strict: true,
      parameters: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'logDecision',
      description:
        'Log a proactive decision to the workflow history so the user can see it in the Command Center. Always call this when you take a proactive action so there is an audit trail.',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          decision: {
            type: 'string',
            description: 'Short label for the decision (e.g. "triggered_finance_analysis", "flagged_critical_signal").',
          },
          reasoning: {
            type: 'string',
            description: 'Why this action was taken.',
          },
          actionsTaken: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of actions taken (e.g. ["invoked finance_agent", "inserted workflow row"]).',
          },
        },
        required: ['decision', 'reasoning'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getReadyProducts',
      description:
        'Fetch products with "ready" status that could be launched. Returns product ID, title, and whether they have pricing set. Useful for detecting products that should be auto-launched.',
      strict: true,
      parameters: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'startAgentPipeline',
      description:
        'Start a sequential pipeline of agents. Each agent waits for the previous one to complete before activating. Use this when the user wants multiple things done in sequence (e.g., clarify business idea → design a product → launch it). The user will see a task banner on each agent\'s page guiding them through each step.',
      strict: false,
      parameters: {
        type: 'object',
        properties: {
          agents: {
            type: 'array',
            description: 'Ordered list of agents to activate in sequence.',
            items: {
              type: 'object',
              properties: {
                targetAgent: {
                  type: 'string',
                  enum: ['business_agent', 'design_agent', 'launch_agent', 'finance_agent'],
                  description: 'Which agent to activate at this step.',
                },
                context: {
                  type: 'string',
                  description: 'Instructions or context for this agent (e.g. "Help user find a niche for a sustainable fashion brand").',
                },
              },
              required: ['targetAgent', 'context'],
            },
          },
          userMessage: {
            type: 'string',
            description: 'The original user message that triggered this pipeline.',
          },
        },
        required: ['agents', 'userMessage'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getMarketResearch',
      description:
        'Search real-time market prices and trends for a product using web search (Etsy, Shopee, TikTok Shop). Returns results immediately without invoking a background agent. Use this for any market research or pricing research requests.',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Product name or niche to research (e.g. "scuba dancing shirt", "cat lover mug hoodie").',
          },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
];
