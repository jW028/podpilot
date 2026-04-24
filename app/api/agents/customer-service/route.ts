import { NextResponse } from "next/server";
import { runCustomerServiceAgent } from "@/lib/agents/customer-service/customerServiceAgent";
import type { ConversationState } from "@/types/customerService";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const businessId = body?.businessId as string | undefined;
    const customerMessage = body?.customerMessage as string | undefined;
    const conversationState = body?.conversationState as ConversationState | undefined | null;

    if (!businessId) {
      return NextResponse.json({ error: "businessId is required." }, { status: 400 });
    }

    if (!customerMessage || !customerMessage.trim()) {
      return NextResponse.json({ error: "customerMessage is required." }, { status: 400 });
    }

    const result = await runCustomerServiceAgent({
      businessId,
      customerMessage,
      conversationState: conversationState ?? null,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    console.error("[API] Customer Service Agent Error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
