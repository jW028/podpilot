import OpenAI from 'openai';
import { TOOL_DEFINITIONS, executeGetAgentStates, executeGetFinanceSnapshot, executeGetRecentWorkflows, executeGetReadyProducts, executeInvokeAgent, executeLogDecision } from './tools';
import { getGlmClient, supabase, executeTool } from './llmOrchestrator';
import { runOrchestrator } from './orchestrator';

const PROACTIVE_SYSTEM_PROMPT = `You are the Orchestrator running in PROACTIVE mode. No user asked you to do anything — you are autonomously monitoring the business.

Your job is to review the current state and decide if any action is needed. You must be conservative — only act when there is a clear, actionable reason.

AVAILABLE TOOLS:
- getAgentStates: Check agent statuses
- invokeAgent: Queue a task for an agent
- getFinanceSnapshot: Check latest financial data and staleness
- getRecentWorkflows: See recent activity, especially pending/failed workflows
- getReadyProducts: Check for products ready to launch
- logDecision: ALWAYS call this when you take an action, so the user sees it in the Command Center

RULES FOR PROACTIVE ACTIONS:
1. Finance snapshot stale (>7 days old) → invokeAgent for finance_agent with type "financial_analysis", then logDecision
2. CRITICAL signal pending >1 hour → logDecision to flag it (the dispatcher will process it when ready)
3. Agent in "error" state → logDecision to flag it for the user
4. Products ready with prices but no launch workflow → invokeAgent for launch_agent with type "design_to_launch", then logDecision
5. If everything looks fine → respond with just "NO_ACTION" and nothing else

IMPORTANT:
- Do NOT trigger duplicate workflows. Check getRecentWorkflows first to avoid re-invoking an agent that is already running or was recently invoked.
- Always call getAgentStates and getRecentWorkflows BEFORE taking any action.
- Always call logDecision AFTER taking any action.
- Keep your final response under 50 words. Either state what you did or say NO_ACTION.`;

export async function runProactiveOrchestrator(): Promise<{
  businessesChecked: number;
  actionsTaken: number;
}> {
  console.log('[Proactive Orchestrator] Starting proactive sweep...');

  const { data: businesses, error } = await supabase
    .from('businesses')
    .select('id, name')
    .limit(50);

  if (error || !businesses || businesses.length === 0) {
    console.log('[Proactive Orchestrator] No businesses found or error:', error?.message);
    return { businessesChecked: 0, actionsTaken: 0 };
  }

  let actionsTaken = 0;

  for (const business of businesses) {
    try {
      const actionTaken = await assessBusiness(business.id, business.name);
      if (actionTaken) actionsTaken++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Proactive Orchestrator] Error assessing business ${business.id}:`, msg);
    }
  }

  console.log(`[Proactive Orchestrator] Sweep complete: ${businesses.length} businesses checked, ${actionsTaken} actions taken.`);
  return { businessesChecked: businesses.length, actionsTaken };
}

async function assessBusiness(businessId: string, businessName: string): Promise<boolean> {
  const glm = getGlmClient();

  // Pre-gather context so the LLM has it upfront (reduces tool calls)
  const [agentStates, financeSnapshot, recentWorkflows, readyProducts] = await Promise.all([
    executeGetAgentStates(businessId),
    executeGetFinanceSnapshot(businessId),
    executeGetRecentWorkflows(businessId),
    executeGetReadyProducts(businessId),
  ]);

  // Build a state summary for the LLM
  const stateSummary = buildStateSummary(businessName, agentStates, financeSnapshot, recentWorkflows, readyProducts);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: PROACTIVE_SYSTEM_PROMPT },
    { role: 'user', content: stateSummary },
  ];

  const MAX_ITERATIONS = 4;
  let tookAction = false;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await glm.chat.completions.create({
      model: process.env.GLM_MODEL || 'ilmu-glm-5.1',
      messages,
      tools: TOOL_DEFINITIONS as OpenAI.Chat.ChatCompletionTool[],
      tool_choice: 'auto',
      max_tokens: 512,
      temperature: 0.3,
    });

    const msg = response.choices[0].message;
    messages.push(msg);

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      const content = msg.content?.trim() ?? '';
      if (content !== 'NO_ACTION' && content.length > 0) {
        console.log(`[Proactive Orchestrator] ${businessName}: ${content}`);
      }
      break;
    }

    for (const toolCall of msg.tool_calls) {
      if (toolCall.type !== 'function') continue;
      const name = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments || '{}');

      console.log(`[Proactive Orchestrator] ${businessName}: Calling tool ${name}`);
      const result = await executeTool(name, args, businessId);

      // Track if any non-read action was taken
      if (name === 'invokeAgent' || name === 'logDecision') {
        tookAction = true;
      }

      messages.push({
        role: 'tool',
        content: JSON.stringify(result),
        tool_call_id: toolCall.id,
      });
    }
  }

  return tookAction;
}

function buildStateSummary(
  businessName: string,
  agentStates: Array<{ agent_name: string; state: string; current_task: string | null; last_updated: string }>,
  financeSnapshot: { found: boolean; snapshot?: { snapshot_date: string; period: string; metrics?: Record<string, unknown>; signals?: unknown } },
  recentWorkflows: Array<{ type: string; state: string; target_agent: string | null; created_at: string; payload?: Record<string, unknown> }>,
  readyProducts: Array<{ id: string; title: string; hasPrices: boolean }>,
): string {
  const now = new Date();

  // Agent states
  const agentSummary = agentStates.length > 0
    ? agentStates.map(a => `${a.agent_name}: ${a.state}${a.current_task ? ` (${a.current_task})` : ''}`).join(', ')
    : 'No agent states recorded';

  // Finance staleness
  let financeStaleness = 'No snapshot exists';
  if (financeSnapshot.found && financeSnapshot.snapshot) {
    const snapshotDate = new Date(financeSnapshot.snapshot.snapshot_date);
    const daysSince = Math.floor((now.getTime() - snapshotDate.getTime()) / (1000 * 60 * 60 * 24));
    financeStaleness = `Last snapshot: ${financeSnapshot.snapshot.snapshot_date} (${daysSince} days old, period: ${financeSnapshot.snapshot.period})`;

    const signals = financeSnapshot.snapshot.signals as Array<{ action?: string; priority?: string; product_title?: string }> | undefined;
    if (signals && Array.isArray(signals) && signals.length > 0) {
      const criticalSignals = signals.filter(s => s.priority === 'CRITICAL');
      if (criticalSignals.length > 0) {
        financeStaleness += ` | CRITICAL signals: ${criticalSignals.map(s => `${s.action} ${s.product_title}`).join(', ')}`;
      }
    }
  }

  // Pending workflows
  const pendingWorkflows = recentWorkflows.filter(w => w.state === 'pending' || w.state === 'awaiting_approval');
  const pendingSummary = pendingWorkflows.length > 0
    ? pendingWorkflows.map(w => `${w.type} → ${w.target_agent} (${w.state}, created ${w.created_at})`).join('; ')
    : 'None';

  // Ready products
  const readySummary = readyProducts.length > 0
    ? readyProducts.map(p => `${p.title} (prices: ${p.hasPrices})`).join(', ')
    : 'None';

  return `Business: ${businessName}

Agent States: ${agentSummary}

Finance: ${financeStaleness}

Pending/Awaiting Workflows: ${pendingSummary}

Ready Products: ${readySummary}

Review this state and take action if needed. If everything is fine, respond with NO_ACTION.`;
}
