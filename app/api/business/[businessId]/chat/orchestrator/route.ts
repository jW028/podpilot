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

    // Detect design intent on the user message so the client can navigate
    const designPattern = /\b(design|create|make|draw|generate)\b.{0,40}\b(shirt|hoodie|mug|poster|hat|tshirt|t-shirt|tee|bag|product|clothing|apparel)\b|\bdesign (a|an|me|for|my)\b/i;
    const action = designPattern.test(message) ? 'navigate_design' : undefined;

    return NextResponse.json({ reply, ...(action ? { action } : {}), businessName: business.name });
  } catch (err: unknown) {
    console.error('[Chat API] Error:', err);
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
