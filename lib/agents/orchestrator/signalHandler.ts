import { SupabaseClient } from '@supabase/supabase-js';

export async function handleFinanceSignals({ businessId, signals, supabase }: { businessId: string; signals: Record<string, unknown>[]; supabase: SupabaseClient }) {
  const rows = signals
    .filter((s: Record<string, unknown>) => s.type === 'product_signal')
    .map((signal: Record<string, unknown>) => ({
      business_id: businessId,
      type: 'inter_agent_signal',
      source_agent: 'finance_agent',
      target_agent:
        signal.action === 'reprice' || signal.action === 'retire'
          ? 'launch_agent' // launch agent handles listing modifications
          : 'product_agent', // product agent handles new listings/boosts
      state: 'pending',    // Launch / Product Agent polls for state='pending'
      payload: {
        signal,
      },
    }));

  if (rows.length > 0) {
    const { error } = await supabase.from('workflows').insert(rows);
    if (error) console.error('[SignalHandler] Failed to insert signals:', error.message);
    else console.log(`[SignalHandler] Forwarded ${rows.length} signals to workflows table`);
  }
}
