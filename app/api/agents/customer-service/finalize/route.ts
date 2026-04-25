import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { PendingTicketData } from "@/types/customerService";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

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

    const dbStatus = pending.tier === "extreme" ? "escalated" : "open";
    const now = new Date().toISOString();

    const { data: ticketRow, error } = await supabase
      .from("support_tickets")
      .insert({
        business_id: businessId,
        order_id: pending.orderId || null,
        shop_id: pending.shopId || null,
        product_id: pending.productId || null,
        channel: "chat",
        issue_type: pending.issueType,
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
            timestamp: now,
          },
        ],
        metadata: {
          order_id: pending.orderId,
          order_status: pending.orderStatus,
          order_total: pending.orderTotal,
          product_title: pending.orderProductTitle,
          shop_id: pending.shopId,
          product_id: pending.productId,
          classification: pending.classification,
          action_taken: pending.actionType,
          action_summary: pending.actionSummary,
        },
      })
      .select("id")
      .single();
    
    if (error) {
      console.error("[Finalize] Failed to save ticket:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    function shouldNotifyFinance(actionType: string) {
      return actionType === "process_refund" || actionType === "process_replacement";
    }

    async function sendFinanceWorkflow(params: {
      businessId: string;
      pending: PendingTicketData;
    }) {
      const { businessId, pending } = params;

      await supabase.from("workflows").insert({
        business_id: businessId,
        type: "refund_processed",
        source_agent: "customer_service_agent",
        target_agent: "finance_agent",
        state: "completed",
        payload: {
          order_id: pending.orderId ?? "ORD-UNKNOWN",
          product_id: pending.productId ?? "N/A",
          product_title: pending.orderProductTitle ?? "N/A",
          refund_amount: pending.orderTotal ?? 0,
          reason: pending.issueType || "customer_request",
          refunded_at: new Date().toISOString(),
        },
      });
    }
    if (shouldNotifyFinance(pending.actionType)) {
      await sendFinanceWorkflow({ businessId, pending });
    }
    return NextResponse.json({ ticketId: ticketRow.id, status: dbStatus }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
