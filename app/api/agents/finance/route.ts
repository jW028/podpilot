import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runFinanceAgent } from '@/lib/agents/finance/financeAgent';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, days = 30, userMessage = null } = body;

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required.' }, { status: 400 });
    }

    // ── Fetch business name + marketplace for the frontend ────────────────
    const { data: business } = await supabase
      .from('businesses')
      .select('name, marketplace')
      .eq('id', businessId)
      .single();

    // ── Fetch last 7 monthly snapshots for the revenue chart ─────────────
    // Each row is a month-end snapshot (period = '30d'), ordered ascending.
    const { data: historicalSnapshots } = await supabase
      .from('finance_snapshots')
      .select('snapshot_date, metrics')
      .eq('business_id', businessId)
      .eq('period', '30d')
      .order('snapshot_date', { ascending: true })
      .limit(7);

    interface SnapshotRow {
      snapshot_date: string;
      metrics?: { summary?: { total_revenue?: string } };
    }

    // Shape: [{ month: 'Oct', revenue: 312, isCurrent: false }, ...]
    const chartData = (historicalSnapshots ?? []).map((row: SnapshotRow, idx: number, arr: unknown[]) => {
      const date = new Date(row.snapshot_date);
      const month = date.toLocaleString('en-MY', { month: 'short' });
      const revenue = parseFloat(row.metrics?.summary?.total_revenue ?? '0');
      return {
        month,
        revenue,
        isCurrent: idx === arr.length - 1,
      };
    });

    // ── Run the finance agent (returns cached snapshot if available) ──────
    const result = await runFinanceAgent({ businessId, days, userMessage });

    return NextResponse.json({
      ...result,
      businessName: business?.name ?? null,
      marketplace:  business?.marketplace ?? null,
      chartData,
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('[API] Finance Agent Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}
