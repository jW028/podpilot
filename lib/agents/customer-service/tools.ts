import { createClient } from "@supabase/supabase-js";
import type {
  CustomerServiceRunResult,
  CustomerServiceTier,
  ClassificationType,
  ConversationState,
} from "@/types/customerService";

export interface OrderData {
  orderId: string;
  dbId: string;
  status: string;
  total: number;
  itemCount: number;
  productTitle: string;
  trackingNumber: string | null;
}

export interface CustomerServiceToolOutput {
  actionType: "none" | "lookup_order" | "process_refund" | "process_resend" | "process_replacement" | "escalate_to_manager";
  actionSummary: string | null;
  contextForReply: string;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function lookupOrderById(orderId: string, businessId: string): Promise<OrderData> {
  let query = supabase
    .from("orders")
    .select("*")
    .eq("business_id", businessId)
    .eq("order_number", orderId)
    .single();

  let { data: row, error } = await query;

  if (error || !row) {
    const fallback = await supabase
      .from("orders")
      .select("*")
      .eq("business_id", businessId)
      .eq("external_order_id", orderId)
      .single();
    row = fallback.data;
    error = fallback.error;
  }

  if (error || !row) {
    throw new Error(`Order not found: ${orderId}`);
  }

  const lineItems = Array.isArray(row.line_items) ? row.line_items : [];
  const firstItem = lineItems[0] as { title?: string } | undefined;

  return {
    orderId: row.order_number || orderId,
    dbId: row.id,
    status: row.status,
    total: Number(row.total_amount) || 0,
    itemCount: lineItems.length || 1,
    productTitle: firstItem?.title || "N/A",
    trackingNumber: row.tracking_number || null,
  };
}

export async function processRefund(order: OrderData) {
  return {
    success: true,
    refundId: `REF-${Date.now()}`,
    amount: order.total,
    orderId: order.orderId,
  };
}

export async function processResend(order: OrderData) {
  return {
    success: true,
    resendId: `RSND-${Date.now()}`,
    orderId: order.orderId,
    newTrackingNumber: `TRK-${Date.now()}`,
    estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  };
}

export async function processReplacement(order: OrderData) {
  return {
    success: true,
    replacementId: `REPL-${Date.now()}`,
    orderId: order.orderId,
    newTrackingNumber: `TRK-${Date.now()}`,
    estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  };
}

export type ActionDecision = "refund" | "resend" | "replacement" | "escalate";

export function decideAction(
  classification: string,
  orderStatus: string | null,
): ActionDecision {
  const normalized = classification.toLowerCase();

  if (normalized.includes("legal_risk")) return "escalate";

  if (normalized.includes("refund")) return "refund";

  if (normalized.includes("resend")) return "resend";

  if (normalized.includes("replacement")) return "replacement";

  if (normalized.includes("damaged")) return "replacement";

  if (normalized.includes("missing")) {
    if (orderStatus === "shipped") return "resend";
    return "refund";
  }

  if (normalized.includes("tracking")) return "resend";

  return "refund";
}

export async function buildMidTierContext(
  classification: string,
  orderId: string,
  businessId: string,
): Promise<CustomerServiceToolOutput> {
  const order = await lookupOrderById(orderId, businessId);
  const action = decideAction(classification, order.status);

  if (action === "refund") {
    const refund = await processRefund(order);
    return {
      actionType: "process_refund",
      actionSummary: `Refund ${refund.refundId} created for ${refund.orderId} (RM ${refund.amount.toFixed(2)}).`,
      contextForReply: `Order ${order.orderId} is ${order.status}. Refund ${refund.refundId} has been initiated for RM ${refund.amount.toFixed(2)}.`,
    };
  }

  if (action === "resend") {
    const resend = await processResend(order);
    return {
      actionType: "process_resend",
      actionSummary: `Resend ${resend.resendId} created for ${resend.orderId}. New tracking: ${resend.newTrackingNumber}.`,
      contextForReply: `A new package has been sent for order ${order.orderId}. New tracking number: ${resend.newTrackingNumber}. Estimated delivery: ${resend.estimatedDelivery}.`,
    };
  }

  if (action === "replacement") {
    const replacement = await processReplacement(order);
    return {
      actionType: "process_replacement",
      actionSummary: `Replacement ${replacement.replacementId} created for ${replacement.orderId}. New tracking: ${replacement.newTrackingNumber}.`,
      contextForReply: `A replacement has been shipped for order ${order.orderId}. New tracking number: ${replacement.newTrackingNumber}. Estimated delivery: ${replacement.estimatedDelivery}.`,
    };
  }

  return {
    actionType: "escalate_to_manager",
    actionSummary: `Escalated order ${order.orderId} to manager.`,
    contextForReply: `Your case regarding order ${order.orderId} has been escalated to our management team. You will hear back within 2 hours.`,
  };
}

export function buildActionProposal(
  classification: string,
  orderId: string,
  orderStatus: string | null,
  orderTotal: number | null,
): { action: ActionDecision; summary: string } {
  const action = decideAction(classification, orderStatus);

  switch (action) {
    case "refund":
      return {
        action,
        summary: `issue a full refund of RM ${(orderTotal ?? 0).toFixed(2)} for order ${orderId}`,
      };
    case "resend":
      return {
        action,
        summary: `resend the items from order ${orderId} with a new tracking number at no extra cost`,
      };
    case "replacement":
      return {
        action,
        summary: `send a replacement for the items in order ${orderId} at no extra cost`,
      };
    case "escalate":
      return {
        action,
        summary: `escalate order ${orderId} to a manager for review`,
      };
  }
}
