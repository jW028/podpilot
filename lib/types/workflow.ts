export type WorkflowState = 'pending' | 'processing' | 'processed' | 'failed';

export type WorkflowRow = {
  id: string;
  business_id: string;
  type: string;
  source_agent: string;
  target_agent: string | null;
  payload: Record<string, unknown>;
  state: WorkflowState;
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
};

export type WorkflowType =
  | 'financial_analysis'
  | 'inter_agent_signal'
  | 'business_creation'
  | 'product_launch_publish'
  | 'design_to_launch';

export type ProductSignalAction = 'reprice' | 'retire' | 'boost';

export type ProductSignal = {
  type: 'product_signal';
  action: ProductSignalAction;
  product_id: string;
  product_title: string;
  reason: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  suggested_price_multiplier?: number;
};

export type Alert = {
  type: 'low_volume_loss' | 'negative_profit';
  severity?: 'CRITICAL';
  message: string;
  product_id?: string;
  product_title?: string;
};

export type AgentName =
  | 'finance_agent'
  | 'launch_agent'
  | 'design_agent'
  | 'product_agent'
  | 'customer_service_agent';

export type HandlerResult =
  | { status: 'completed'; data?: Record<string, unknown> }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; error: string };
