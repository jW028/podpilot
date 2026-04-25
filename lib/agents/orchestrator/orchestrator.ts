import { createClient } from '@supabase/supabase-js';
import type { WorkflowRow, WorkflowState, HandlerResult, AgentName } from '@/lib/types/workflow';
import { handleInterAgentSignal } from './handlers/interAgentSignal';
import { handleProductLaunchPublish } from './handlers/productLaunchPublish';
import { handleDesignToLaunch } from './handlers/designToLaunch';
import { handleFinanceSignal } from './handlers/financeSignal';
import { getAllAgentStates } from '@/lib/agents/shared/agentStateManager';
export type { AgentState } from '@/lib/types/agent';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const UNIMPLEMENTED_AGENTS: Set<AgentName> = new Set([
  'product_agent',
  'customer_service_agent',
]);

const HANDLERS: Record<string, (row: WorkflowRow) => Promise<HandlerResult>> = {
  launch_agent: handleInterAgentSignal,
  product_agent: handleInterAgentSignal,
  design_agent: handleInterAgentSignal,
  finance_agent: handleFinanceSignal,
  product_launch_publish: handleProductLaunchPublish,
  design_to_launch: handleDesignToLaunch,
  product_launched: handleFinanceSignal,
  price_updated: handleFinanceSignal,
};

export async function runOrchestrator(): Promise<{
  processed: number;
  skipped: number;
  failed: number;
}> {
  console.log('[Orchestrator] Polling for pending workflows...');

  const { data: rows, error } = await supabase
    .from('workflows')
    .select('*')
    .eq('state', 'pending')
    .order('created_at', { ascending: true })
    .limit(20);

  // Note: 'awaiting_approval' rows are excluded — only 'pending' rows are dispatched.

  if (error) {
    console.error('[Orchestrator] Failed to fetch pending workflows:', error.message);
    return { processed: 0, skipped: 0, failed: 0 };
  }

  if (!rows || rows.length === 0) {
    return { processed: 0, skipped: 0, failed: 0 };
  }

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows as WorkflowRow[]) {
    // CAS-style claim: only update if still pending (prevents double-pickup)
    const { data: claimed } = await supabase
      .from('workflows')
      .update({
        state: 'processing',
        processed_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('state', 'pending')
      .select('id');

    if (!claimed || claimed.length === 0) {
      console.log(`[Orchestrator] Row ${row.id} already claimed, skipping.`);
      continue;
    }

    try {
      const targetAgent = row.target_agent as AgentName | null;
      const typeRoutedHandlers = ['product_launch_publish', 'design_to_launch', 'product_launched', 'price_updated'];
      const handlerKey = typeRoutedHandlers.includes(row.type) ? row.type : targetAgent;

      if (targetAgent && UNIMPLEMENTED_AGENTS.has(targetAgent)) {
        await transitionState(row.id, 'processed', `Agent "${targetAgent}" is not implemented yet`);
        skipped++;
        console.log(`[Orchestrator] Skipped row ${row.id}: ${targetAgent} not implemented.`);
        continue;
      }

      if (!handlerKey || !HANDLERS[handlerKey]) {
        await transitionState(row.id, 'processed', `No handler for target_agent="${targetAgent}" type="${row.type}"`);
        skipped++;
        console.warn(`[Orchestrator] No handler for row ${row.id} (target=${targetAgent}, type=${row.type}).`);
        continue;
      }

      const result = await HANDLERS[handlerKey](row);

      if (result.status === 'completed') {
        await transitionState(row.id, 'processed');
        processed++;
        console.log(`[Orchestrator] Completed row ${row.id} (${row.type}).`);
      } else if (result.status === 'skipped') {
        await transitionState(row.id, 'processed', result.reason);
        skipped++;
        console.log(`[Orchestrator] Skipped row ${row.id}: ${result.reason}.`);
      } else {
        await transitionState(row.id, 'failed', result.error);
        failed++;
        console.error(`[Orchestrator] Failed row ${row.id}: ${result.error}.`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unexpected error';
      await transitionState(row.id, 'failed', message);
      failed++;
      console.error(`[Orchestrator] Unhandled error for row ${row.id}:`, message);
    }
  }

  console.log(`[Orchestrator] Run complete: ${processed} processed, ${skipped} skipped, ${failed} failed.`);
  return { processed, skipped, failed };
}

export async function getAgentStates(businessId: string) {
  return getAllAgentStates(businessId);
}

async function transitionState(id: string, state: WorkflowState, errorMessage?: string) {
  const update: Record<string, unknown> = { state };
  if (errorMessage) update.error_message = errorMessage;
  if (state === 'processed' || state === 'failed') {
    update.processed_at = new Date().toISOString();
  }
  await supabase.from('workflows').update(update).eq('id', id);
}
