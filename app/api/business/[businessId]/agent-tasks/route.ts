import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await params;
  const url = new URL(request.url);
  const agent = url.searchParams.get('agent');

  if (!agent) {
    return NextResponse.json({ error: 'Missing agent query param' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('workflows')
    .select('id, type, state, payload, result, created_at')
    .eq('business_id', businessId)
    .eq('target_agent', agent)
    .eq('type', 'agent_pipeline_task')
    .in('state', ['awaiting_approval'])
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ task: data?.[0] ?? null });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await params;
  const { workflowId, state, result } = (await request.json()) as {
    workflowId: string;
    state: string;
    result?: Record<string, unknown>;
  };

  const update: Record<string, unknown> = { state };
  if (result) update.result = result;
  if (state === 'processed') update.processed_at = new Date().toISOString();

  const { error } = await supabase
    .from('workflows')
    .update(update)
    .eq('id', workflowId)
    .eq('business_id', businessId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
