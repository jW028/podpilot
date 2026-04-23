import type { SupabaseClient } from '@supabase/supabase-js';

type WorkflowState = 'pending' | 'processed' | 'failed';

interface WorkflowRow {
  id: string;
  business_id: string;
  source_agent: string;
  target_agent: string;
  type: string;
  payload: Record<string, unknown>;
  state: WorkflowState;
  created_at: string;
  processed_at: string | null;
}

interface ProductLaunchedPayload {
  product_id: string;
  product_title: string;
  base_cost: number;
  listed_price: number;
  marketplace: string;
  launched_at: string;
}

interface PriceUpdatedPayload {
  product_id: string;
  product_title: string;
  old_price: number;
  new_price: number;
  updated_at: string;
}

interface RefundProcessedPayload {
  order_id: string;
  product_id: string;
  product_title: string;
  refund_amount: number;
  reason: string;
  refunded_at: string;
}

interface BusinessCreatedPayload {
  business_id: string;
  business_name: string;
  niche: string;
  target_margin_percent?: number;
}

interface DesignCompletedPayload {
  product_id: string;
  product_title: string;
  design_cost: number;
  completed_at: string;
}

export interface ProcessIncomingMessagesResult {
  processed: number;
  types: string[];
}

export async function processIncomingMessages(
  businessId: string,
  supabase: SupabaseClient
): Promise<ProcessIncomingMessagesResult> {
  const result: ProcessIncomingMessagesResult = { processed: 0, types: [] };

  try {
    const { data, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('target_agent', 'finance_agent')
      .eq('state', 'pending')
      .eq('business_id', businessId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[FinanceAgent:receive] Failed to query workflows:', error.message);
      return result;
    }

    const rows = (data ?? []) as WorkflowRow[];

    for (const row of rows) {
      try {
        switch (row.type) {
          case 'product_launched': {
            const p = row.payload as unknown as ProductLaunchedPayload;
            const margin =
              p.listed_price > 0
                ? ((p.listed_price - p.base_cost) / p.listed_price) * 100
                : 0;
            console.log(
              `[FinanceAgent:receive] New product launched: ${p.product_title}, listed at RM ${p.listed_price}, cost RM ${p.base_cost}`
            );
            console.log(
              `[FinanceAgent:receive] Projected margin: ${margin.toFixed(2)}%`
            );
            break;
          }

          case 'price_updated': {
            const p = row.payload as unknown as PriceUpdatedPayload;
            console.log(
              `[FinanceAgent:receive] Price updated for ${p.product_title}: RM ${p.old_price} → RM ${p.new_price}`
            );
            break;
          }

          case 'refund_processed': {
            const p = row.payload as unknown as RefundProcessedPayload;
            console.log(
              `[FinanceAgent:receive] Refund of RM ${p.refund_amount} processed for ${p.product_title} (order ${p.order_id})`
            );
            if (p.reason === 'damaged' || p.reason === 'wrong item') {
              console.warn(
                `[FinanceAgent:receive] WARNING: refund reason "${p.reason}" for ${p.product_title} — product quality should be reviewed`
              );
            }
            break;
          }

          case 'business_created': {
            const p = row.payload as unknown as BusinessCreatedPayload;
            console.log(
              `[FinanceAgent:receive] New business onboarded: ${p.business_name}, niche: ${p.niche}`
            );

            const { data: existing, error: existingErr } = await supabase
              .from('finance_snapshots')
              .select('id')
              .eq('business_id', row.business_id)
              .limit(1)
              .maybeSingle();

            if (existingErr) {
              console.error(
                '[FinanceAgent:receive] Failed to check existing snapshot:',
                existingErr.message
              );
            } else if (!existing) {
              const today = new Date().toISOString().split('T')[0];
              const { error: insertErr } = await supabase
                .from('finance_snapshots')
                .insert({
                  business_id: row.business_id,
                  snapshot_date: today,
                  period: '30d',
                  metrics: {},
                  insights: '',
                  signals: {},
                });
              if (insertErr) {
                console.error(
                  '[FinanceAgent:receive] Failed to insert baseline snapshot:',
                  insertErr.message
                );
              }
            }
            break;
          }

          case 'design_completed': {
            const p = row.payload as unknown as DesignCompletedPayload;
            console.log(
              `[FinanceAgent:receive] Design completed for ${p.product_title}, design cost: RM ${p.design_cost}`
            );
            break;
          }

          default: {
            console.log(
              `[FinanceAgent:receive] Unhandled workflow type: ${row.type}`
            );
          }
        }

        const { error: updateErr } = await supabase
          .from('workflows')
          .update({ state: 'processed', processed_at: new Date().toISOString() })
          .eq('id', row.id);

        if (updateErr) {
          console.error(
            `[FinanceAgent:receive] Failed to mark workflow ${row.id} processed:`,
            updateErr.message
          );
          continue;
        }

        result.processed += 1;
        if (!result.types.includes(row.type)) result.types.push(row.type);
      } catch (rowErr: any) {
        console.error(
          `[FinanceAgent:receive] Error handling workflow ${row.id} (${row.type}):`,
          rowErr?.message ?? rowErr
        );
      }
    }
  } catch (err: any) {
    console.error(
      '[FinanceAgent:receive] Unexpected error in processIncomingMessages:',
      err?.message ?? err
    );
  }

  return result;
}
