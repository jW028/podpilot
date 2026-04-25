import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { runLlmOrchestrator } from '@/lib/agents/orchestrator/llmOrchestrator';

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

    // Run the LLM-based orchestrator — it decides which tools to call
    const { reply } = await runLlmOrchestrator({ businessId: businessUuid, message });

    return NextResponse.json({ reply, businessName: business.name });
  } catch (err: unknown) {
    console.error('[Chat API] Error:', err);
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
