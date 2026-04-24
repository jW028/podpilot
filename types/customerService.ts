export type CustomerServiceTier = "easy" | "mid" | "extreme";

export type CustomerServiceTicketStatus =
  | "open"
  | "ai_resolved"
  | "escalated"
  | "manager_resolved";

export type CustomerServiceActionType =
  | "none"
  | "lookup_order"
  | "process_refund"
  | "process_resend"
  | "process_replacement"
  | "escalate_to_manager";

export type ClassificationType =
  | "none"
  | "company_follow_up_refund"
  | "company_follow_up_resend"
  | "company_follow_up_replacement"
  | "company_follow_up_missing"
  | "company_follow_up_damaged"
  | "company_follow_up_tracking"
  | "company_follow_up_other"
  | "legal_risk";

export type ConversationPhase =
  | "greeting"
  | "collecting_details"
  | "looking_up"
  | "proposing_action"
  | "action_confirmed"
  | "action_denied"
  | "resolved"
  | "escalated";

export interface CollectedDetails {
  orderNumber?: string;
  trackingNumber?: string;
  itemDescription?: string;
  issueDescription?: string;
  refundAmount?: number;
}

export interface ConversationState {
  phase: ConversationPhase;
  classification: ClassificationType;
  tier: CustomerServiceTier;
  collectedDetails: CollectedDetails;
  proposedAction: CustomerServiceActionType | null;
  proposedActionSummary: string | null;
  orderId: string | null;
  orderStatus: string | null;
  orderTotal: number | null;
  turnCount: number;
}

export interface TicketSummary {
  classification: ClassificationType;
  extractedDetails: {
    refundAmount?: number;
    orderNumber?: string;
    trackingNumber?: string;
    itemDescription?: string;
    reason: string;
  };
  conversationSummary: string;
}

export interface CustomerServiceTicket {
  id: string;
  dbId?: string;
  customerMessage: string;
  tier: CustomerServiceTier;
  confidence: number;
  issueType: string;
  classification: ClassificationType;
  status: CustomerServiceTicketStatus;
  aiReply: string;
  actionType: CustomerServiceActionType;
  actionSummary: string | null;
  ticketSummary: TicketSummary | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface CustomerServiceRunResult {
  requiresCompany: boolean;
  aiReply: string;
  ticketCreated: boolean;
  ticket: CustomerServiceTicket | null;
  conversationState: ConversationState;
}
