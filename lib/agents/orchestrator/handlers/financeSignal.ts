import { createClient } from '@supabase/supabase-js';
import type { WorkflowRow, HandlerResult } from '@/lib/types/workflow';

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
    await supabase.from('workflows').insert({
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
    });

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

  return { status: 'skipped', reason: `Unhandled finance signal type "${row.type}"` };
}
