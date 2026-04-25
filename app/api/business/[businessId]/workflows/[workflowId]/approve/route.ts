import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runOrchestrator } from '@/lib/agents/orchestrator/orchestrator';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ businessId: string; workflowId: string }> }
) {
  try {
    const { businessId, workflowId } = await params;
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Transition awaiting_approval → pending (CAS: only if still awaiting_approval)
    const { data: updated, error } = await supabase
      .from('workflows')
      .update({ state: 'pending' })
      .eq('id', workflowId)
      .eq('business_id', businessId)
      .eq('state', 'awaiting_approval')
      .select('id, type, target_agent')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!updated) {
      return NextResponse.json({ error: 'Workflow not found or not in awaiting_approval state' }, { status: 404 });
    }

    // Trigger the dispatcher immediately
    runOrchestrator().catch(e => console.error('[Approve API] Background orchestrator failed:', e));

    return NextResponse.json({ success: true, workflowId: updated.id, type: updated.type, targetAgent: updated.target_agent, state: 'pending' });
  } catch (err: unknown) {
    console.error('[Approve API] Error:', err);
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
