import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { CustomerServiceTicket, TicketMessage } from "@/types/customerService";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const STATUS_MAP: Record<string, CustomerServiceTicket["status"]> = {
  open: "open",
  ai_replied: "ai_resolved",
  escalated: "escalated",
  resolved: "manager_resolved",
  closed: "manager_resolved",
};

function mapTicketRow(row: Record<string, unknown>): CustomerServiceTicket {
  const rawMessages = Array.isArray(row.messages) ? row.messages as Record<string, unknown>[] : [];

  const messages: TicketMessage[] = rawMessages.map((m) => ({
    role: (m.role as TicketMessage["role"]) || "agent",
    content: (m.content as string) || "",
    actionType: m.actionType as string | undefined,
    actionSummary: m.actionSummary as string | undefined,
    context: m.context as TicketMessage["context"] | undefined,
    timestamp: (m.timestamp as string) || new Date().toISOString(),
  }));

  const customerMsg = messages.find((m) => m.role === "customer");
  const agentMsg = messages.find((m) => m.role === "agent");

  return {
    id: (row.id as string) || `${Date.now()}`,
    dbId: row.id as string,
    printifyOrderRef: (row.printify_order_ref as string | null) ?? null,
    customerMessage: customerMsg?.content || "",
    tier: (row.priority as string) === "high" || (row.priority as string) === "urgent" ? "extreme"
      : (row.priority as string) === "normal" ? "mid" : "easy",
    confidence: 1,
    issueType: (row.issue_type as string) || "general",
    classification: "company_follow_up_other",
    status: STATUS_MAP[(row.status as string)] || "open",
    aiReply: agentMsg?.content || "",
    actionType: (agentMsg?.actionType as CustomerServiceTicket["actionType"]) || "none",
    actionSummary: agentMsg?.actionSummary || null,
    ticketSummary: null,
    messages,
    createdAt: (row.created_at as string) || new Date().toISOString(),
    resolvedAt: (row.status as string) === "resolved" || (row.status as string) === "closed"
      ? (row.updated_at as string) || null
      : null,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");

    if (!businessId) {
      return NextResponse.json({ error: "businessId query parameter is required." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const tickets = (data || []).map(mapTicketRow);
    return NextResponse.json({ tickets }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    console.error("[API] Support Tickets GET Error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, message, action = "reply" } = body as {
      id?: string;
      message?: string;
      // "reply" appends a message but keeps ticket open
      // "resolve" appends a message and marks ticket resolved
      action?: "reply" | "resolve";
    };

    if (!id) {
      return NextResponse.json({ error: "Ticket id is required." }, { status: 400 });
    }
    if (!message?.trim() && action === "reply") {
      return NextResponse.json({ error: "message is required for a reply." }, { status: 400 });
    }

    const { data: current, error: fetchError } = await supabase
      .from("support_tickets")
      .select("messages, status")
      .eq("id", id)
      .single();

    if (fetchError || !current) {
      return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
    }

    const existingMessages = Array.isArray(current.messages) ? current.messages : [];
    const updatedMessages = message?.trim()
      ? [
          ...existingMessages,
          {
            role: "manager",
            content: message.trim(),
            timestamp: new Date().toISOString(),
          },
        ]
      : existingMessages;

    const updatePayload: Record<string, unknown> = { messages: updatedMessages };
    if (action === "resolve") {
      updatePayload.status = "resolved";
      updatePayload.resolved_by = "human";
    }

    const { data, error } = await supabase
      .from("support_tickets")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ticket: mapTicketRow(data) }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    console.error("[API] Support Tickets PATCH Error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
