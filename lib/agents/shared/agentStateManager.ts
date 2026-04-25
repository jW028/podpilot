import { createClient } from '@supabase/supabase-js';
import type { AgentStatus, AgentState } from '@/lib/types/agent';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function setAgentState(
  businessId: string,
  agentName: string,
  state: AgentStatus,
  currentTask?: string | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await supabase.from('agent_states').upsert(
    {
      business_id: businessId,
      agent_name: agentName,
      state,
      current_task: currentTask ?? null,
      last_updated: new Date().toISOString(),
      metadata: metadata ?? {},
    },
    { onConflict: 'business_id,agent_name' },
  );
}

export async function getAgentState(
  businessId: string,
  agentName: string,
): Promise<AgentState | null> {
  const { data } = await supabase
    .from('agent_states')
    .select('*')
    .eq('business_id', businessId)
    .eq('agent_name', agentName)
    .maybeSingle();
  return data as AgentState | null;
}

export async function getAllAgentStates(businessId: string): Promise<AgentState[]> {
  const { data } = await supabase
    .from('agent_states')
    .select('*')
    .eq('business_id', businessId);
  return (data ?? []) as AgentState[];
}
