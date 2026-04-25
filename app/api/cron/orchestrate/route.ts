import { NextResponse } from 'next/server';
import { runOrchestrator } from '@/lib/agents/orchestrator/orchestrator';
import { runProactiveOrchestrator } from '@/lib/agents/orchestrator/proactiveOrchestrator';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Process pending workflows (existing dispatcher)
    const dispatchResult = await runOrchestrator();

    // 2. Run proactive monitoring (check states, auto-trigger stale agents)
    const proactiveResult = await runProactiveOrchestrator();

    return NextResponse.json({
      dispatch: dispatchResult,
      proactive: proactiveResult,
    }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[Cron] Orchestrator fatal error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
