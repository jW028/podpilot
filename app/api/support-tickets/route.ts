import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { CustomerServiceTicket } from "@/types/customerService";

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
  const messages = Array.isArray(row.messages) ? row.messages : [];
  const lastMessage = messages[messages.length - 1] as Record<string, unknown> | undefined;

  return {
    id: (row.id as string) || `${Date.now()}`,
    dbId: row.id as string,
    customerMessage: "",
    tier: (row.priority as string) === "high" || (row.priority as string) === "urgent" ? "extreme"
      : (row.priority as string) === "normal" ? "mid" : "easy",
    confidence: 1,
    issueType: (row.issue_type as string) || "general",
    classification: "company_follow_up_other",
    status: STATUS_MAP[(row.status as string)] || "open",
    aiReply: (lastMessage?.content as string) || "",
    actionType: (lastMessage?.actionType as CustomerServiceTicket["actionType"]) || "none",
    actionSummary: (lastMessage?.actionSummary as string) || null,
    ticketSummary: null,
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
    const { id, resolutionMessage } = body as {
      id?: string;
      resolutionMessage?: string;
    };

    if (!id) {
      return NextResponse.json({ error: "Ticket id is required." }, { status: 400 });
    }

    // Fetch current ticket to append to messages
    const { data: current, error: fetchError } = await supabase
      .from("support_tickets")
      .select("messages")
      .eq("id", id)
      .single();

    if (fetchError || !current) {
      return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
    }

    const existingMessages = Array.isArray(current.messages) ? current.messages : [];
    const updatedMessages = [
      ...existingMessages,
      {
        role: "manager",
        content: resolutionMessage || "",
        timestamp: new Date().toISOString(),
      },
    ];

    const { data, error } = await supabase
      .from("support_tickets")
      .update({
        status: "resolved",
        resolved_by: "human",
        messages: updatedMessages,
      })
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
