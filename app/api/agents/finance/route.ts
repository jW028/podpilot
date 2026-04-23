import { NextResponse } from 'next/server';
import { runFinanceAgent } from '@/lib/agents/finance/financeAgent';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, days = 30, userMessage = null } = body;

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required.' }, { status: 400 });
    }

    /* 
      Authentication (Optional, depending on your auth layer): 
      If you need to strictly verify user permissions before running the agent, 
      you can do it here using Supabase Server Client.
    */

    const result = await runFinanceAgent({ businessId, days, userMessage });
    
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('[API] Finance Agent Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
