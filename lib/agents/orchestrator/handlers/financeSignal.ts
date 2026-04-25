import { createClient } from '@supabase/supabase-js';
import type { WorkflowRow, HandlerResult } from '@/lib/types/workflow';
import { handleCriticalSignalEvent } from '@/lib/agents/orchestrator/eventHandler';
import { runFinanceAgent } from '@/lib/agents/finance/financeAgent';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function handleFinanceSignal(row: WorkflowRow): Promise<HandlerResult> {
  const payload = row.payload as Record<string, unknown>;

  if (row.type === 'product_launched') {
    const { product_id, product_title, listed_price, marketplace, launched_at } = payload;
    console.log(`[Finance] Product launched: "${product_title}" at ${listed_price} on ${marketplace}`);

    // Record a finance snapshot trigger so the finance agent can update metrics on next run
    const { data: inserted } = await supabase.from('workflows').insert({
      business_id: row.business_id,
      type: 'financial_analysis',
      source_agent: 'launch_agent',
      target_agent: 'finance_agent',
      state: 'pending',
      payload: {
        trigger: 'product_launched',
        product_id,
        product_title,
        listed_price,
        marketplace,
        launched_at,
      },
    }).select('id').single();

    // Flag CRITICAL signals for proactive orchestrator prioritization
    if (inserted) {
      const signalPriority = (payload as Record<string, unknown>)?.priority as string | undefined;
      if (signalPriority === 'CRITICAL') {
        await handleCriticalSignalEvent({
          businessId: row.business_id,
          signalType: row.type,
          signalAction: (payload as Record<string, unknown>)?.action as string ?? 'unknown',
          productTitle: (payload as Record<string, unknown>)?.product_title as string ?? 'unknown',
          priority: signalPriority,
          workflowId: inserted.id,
        }).catch(e => console.error('[FinanceSignal] Failed to flag critical signal:', e));
      }
    }

    return {
      status: 'completed',
      data: { product_id: product_id as string, action: 'financial_analysis_queued' },
    };
  }

  if (row.type === 'price_updated') {
    const { product_id, product_title, old_price, new_price } = payload;
    console.log(`[Finance] Price updated: "${product_title}" ${old_price} → ${new_price}`);

    return {
      status: 'completed',
      data: { product_id: product_id as string, action: 'price_change_recorded' },
    };
  }

  if (row.type === 'financial_analysis') {
    const days = typeof payload.days === 'number' ? payload.days : 30;
    const userMessage = typeof payload.prompt === 'string' ? payload.prompt : null;
    console.log(`[Finance] Running financial_analysis for business ${row.business_id} (${days} days)`);
    await runFinanceAgent({ businessId: row.business_id, days, userMessage });
    return { status: 'completed', data: { action: 'financial_analysis_run' } };
  }

  return { status: 'skipped', reason: `Unhandled finance signal type "${row.type}"` };
}
