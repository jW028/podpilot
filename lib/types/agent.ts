export type AgentStatus = 'idle' | 'running' | 'error';

export interface AgentState {
  business_id: string;
  agent_name: string;
  state: AgentStatus;
  current_task: string | null;
  last_updated: string;
  metadata: Record<string, unknown>;
}
