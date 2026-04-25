import { NextResponse } from 'next/server';
import { initAgentStates } from '@/lib/agents/shared/agentStateManager';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await params;
  await initAgentStates(businessId);
  return NextResponse.json({ ok: true });
}
