import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { runLlmOrchestrator } from '@/lib/agents/orchestrator/llmOrchestrator';
import { runOrchestrator } from '@/lib/agents/orchestrator/orchestrator';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const body = await request.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const supabase = await getServerSupabase();

    // Resolve business UUID if the 'businessId' is a slug
    const { data: business, error: bError } = await supabase
      .from('businesses')
      .select('id, name')
      .or(`id.eq.${businessId},name.ilike.${businessId}`)
      .maybeSingle();

    if (!business || bError) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const businessUuid = business.id;

    // Check if business has completed onboarding (brand_profiles record exists)
    const { data: brandProfile } = await supabase
      .from('brand_profiles')
      .select('business_id')
      .eq('business_id', businessUuid)
      .maybeSingle();

    const businessReady = !!brandProfile;

    // Run the LLM-based orchestrator — it decides which tools to call
    const { reply } = await runLlmOrchestrator({ businessId: businessUuid, message, businessReady });

    // Process any pending workflows inserted by the LLM (design/launch pipelines).
    // Awaited here so workflows reach 'processing' state before the client's refreshData fires.
    // runOrchestrator only processes the fast initial steps (design_agent stub creation);
    // the full launch agent runs as a follow-on inside the same pass.
    await runOrchestrator().catch(e => console.error('[Chat API] Orchestrator error after LLM:', e));

    return NextResponse.json({ reply, businessReady, businessName: business.name });
  } catch (err: unknown) {
    console.error('[Chat API] Error:', err);
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
