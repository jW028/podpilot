import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { PendingTicketData } from "@/lib/types/customerService";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function resolveStatus(tier: string): string {
  return tier === "extreme" ? "escalated" : "open";
}

const VALID_ISSUE_TYPES = ["wrong_item", "print_quality", "not_received", "sizing", "refund_request", "review", "feedback", "general"];
function resolveIssueType(issueType: string): string {
  return VALID_ISSUE_TYPES.includes(issueType) ? issueType : "general";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const businessId = body?.businessId as string | undefined;
    const pending = body?.pendingTicket as PendingTicketData | undefined;

    if (!businessId) return NextResponse.json({ error: "businessId is required." }, { status: 400 });
    if (!pending)    return NextResponse.json({ error: "pendingTicket is required." }, { status: 400 });

    const dbStatus  = resolveStatus(pending.tier);
    const issueType = resolveIssueType(pending.issueType);
    const now       = new Date().toISOString();

    const basePayload = {
      business_id: businessId,
      channel:     "manual",
      issue_type:  issueType,
      priority:    pending.priority,
      status:      dbStatus,
      messages: [
        {
          role:      "customer",
          content:   pending.customerIssue,
          timestamp: now,
        },
        {
          role:          "agent",
          content:       pending.agentReply,
          actionType:    pending.actionType,
          actionSummary: pending.actionSummary,
          context: {
            orderId:        pending.orderId,
            orderStatus:    pending.orderStatus,
            orderTotal:     pending.orderTotal,
            productTitle:   pending.orderProductTitle,
            shopId:         pending.shopId,
            productId:      pending.productId,
            classification: pending.classification,
          },
          timestamp: now,
        },
      ],
    };

    // Try with printify_order_ref first; fall back without it if column doesn't exist yet
    let { data: ticketRow, error } = await supabase
      .from("support_tickets")
      .insert({ ...basePayload, printify_order_ref: pending.orderId ?? null })
      .select("id")
      .single();

    if (error?.message?.includes("printify_order_ref")) {
      // Column not yet migrated — insert without it
      ({ data: ticketRow, error } = await supabase
        .from("support_tickets")
        .insert(basePayload)
        .select("id")
        .single());
    }

    if (error) {
      console.error("[Finalize] Failed to save ticket:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Notify finance agent for refunds / replacements
    if (pending.actionType === "process_refund" || pending.actionType === "process_replacement") {
      await supabase.from("workflows").insert({
        business_id:  businessId,
        type:         "refund_processed",
        source_agent: "customer_service_agent",
        target_agent: "finance_agent",
        state:        "pending",
        payload: {
          order_id:      pending.orderId ?? "UNKNOWN",
          product_id:    pending.productId ?? "N/A",
          product_title: pending.orderProductTitle ?? "N/A",
          refund_amount: pending.orderTotal ?? 0,
          reason:        issueType,
          refunded_at:   now,
        },
      });
    }

    return NextResponse.json({ ticketId: ticketRow!.id, status: dbStatus }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("[Finalize] Unexpected error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
