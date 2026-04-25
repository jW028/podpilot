import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { PendingTicketData } from "@/types/customerService";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Map our tier to the schema's valid status values
function resolveStatus(tier: string): string {
  return tier === "extreme" ? "escalated" : "open";
}

// Validate against schema enum — fall back to 'general'
const VALID_ISSUE_TYPES = ["wrong_item", "print_quality", "not_received", "sizing", "refund_request", "review", "feedback", "general"];
function resolveIssueType(issueType: string): string {
  return VALID_ISSUE_TYPES.includes(issueType) ? issueType : "general";
}

// Look up a local order UUID from order_number (needed for the FK)
async function resolveLocalOrderId(businessId: string, orderLabel: string | null): Promise<string | null> {
  if (!orderLabel) return null;
  const { data } = await supabase
    .from("orders")
    .select("id")
    .eq("business_id", businessId)
    .eq("order_number", orderLabel)
    .maybeSingle();
  return data?.id ?? null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const businessId = body?.businessId as string | undefined;
    const pending = body?.pendingTicket as PendingTicketData | undefined;

    if (!businessId) {
      return NextResponse.json({ error: "businessId is required." }, { status: 400 });
    }
    if (!pending) {
      return NextResponse.json({ error: "pendingTicket is required." }, { status: 400 });
    }

    const dbStatus = resolveStatus(pending.tier);
    const issueType = resolveIssueType(pending.issueType);
    const now = new Date().toISOString();

    // Resolve local order UUID for the FK (may be null if order was only in Printify)
    const localOrderId = await resolveLocalOrderId(businessId, pending.orderId);

    const { data: ticketRow, error } = await supabase
      .from("support_tickets")
      .insert({
        business_id: businessId,
        order_id: localOrderId,          // UUID FK or null
        channel: "manual",               // closest valid value
        issue_type: issueType,
        priority: pending.priority,
        status: dbStatus,
        messages: [
          {
            role: "customer",
            content: pending.customerIssue,
            timestamp: now,
          },
          {
            role: "agent",
            content: pending.agentReply,
            actionType: pending.actionType,
            actionSummary: pending.actionSummary,
            // Store order/product info here since there are no dedicated columns
            context: {
              orderId: pending.orderId,
              orderStatus: pending.orderStatus,
              orderTotal: pending.orderTotal,
              productTitle: pending.orderProductTitle,
              shopId: pending.shopId,
              productId: pending.productId,
              classification: pending.classification,
            },
            timestamp: now,
          },
        ],
      })
      .select("id")
      .single();

    if (error) {
      console.error("[Finalize] Failed to save ticket:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Notify finance agent for refunds / replacements
    if (pending.actionType === "process_refund" || pending.actionType === "process_replacement") {
      await supabase.from("workflows").insert({
        business_id: businessId,
        type: "refund_processed",
        source_agent: "customer_service_agent",
        target_agent: "finance_agent",
        state: "pending",
        payload: {
          order_id: pending.orderId ?? "UNKNOWN",
          product_id: pending.productId ?? "N/A",
          product_title: pending.orderProductTitle ?? "N/A",
          refund_amount: pending.orderTotal ?? 0,
          reason: issueType,
          refunded_at: now,
        },
      });
    }

    return NextResponse.json({ ticketId: ticketRow.id, status: dbStatus }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("[Finalize] Unexpected error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
