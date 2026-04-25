import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { runOrchestrator } from '@/lib/agents/orchestrator/orchestrator';

// This is a minimal LLM router to process user intent and insert a workflow row
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

    // 1. Resolve business UUID if the 'businessId' is a slug
    // (If businessId is already a UUID, .eq('id', businessId) still works)
    const { data: business, error: bError } = await supabase
      .from('businesses')
      .select('id, name')
      .or(`id.eq.${businessId},name.ilike.${businessId}`)
      .maybeSingle();

    if (!business || bError) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const businessUuid = business.id;
    
    // 2. Intent matching
    const lowercaseMsg = message.toLowerCase();
    let targetAgent = 'product_agent';
    let type = 'product_creation';
    let reply = "On it. I've routed this to the Product Agent.";
    
    if (lowercaseMsg.includes('publish') || lowercaseMsg.includes('launch')) {
      targetAgent = 'launch_agent';
      type = 'product_launch_publish';
      reply = "Got it. I've routed this to the Launch Agent to handle publishing.";
    } else if (lowercaseMsg.includes('finance') || lowercaseMsg.includes('profit')) {
      targetAgent = 'finance_agent';
      type = 'financial_analysis';
      reply = "Understood. The Finance Agent is now analyzing your metrics.";
    }

    // 3. Insert the pending job into the workflows queue
    const { error: wError } = await supabase.from('workflows').insert({
      business_id: businessUuid,
      type: type,
      source_agent: 'finance_agent',
      target_agent: targetAgent,
      state: 'pending',
      payload: {
        prompt: message,
        timestamp: new Date().toISOString()
      }
    });

    if (wError) throw wError;

    // 4. TRIGGER ORCHESTRATOR IMMEDIATELY (Local dev hack for instant feedback)
    // We don't await this so the chat response is fast, 
    // but the background run will update the DB and trigger Realtime UI.
    runOrchestrator().catch(e => console.error('[Chat API] Background orchestrator failed:', e));

    return NextResponse.json({ reply, targetAgent, businessName: business.name });
  } catch (err: unknown) {
    console.error('[Chat API] Error:', err);
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
