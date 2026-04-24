"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { useCustomerServiceAgent } from "@/hooks/useCustomerServiceAgent";
import type { CustomerServiceRunResult, CustomerServiceTicket, ConversationPhase } from "@/types/customerService";

interface CustomerServicePageProps {
  businessId: string;
}

function tierClass(tier: CustomerServiceTicket["tier"]) {
  if (tier === "easy") return "bg-[#EAF8EE] text-[#2D7A4F]";
  if (tier === "mid") return "bg-[#FFF4E5] text-[#9E7A2E]";
  return "bg-[#FEECEC] text-[#C0584A]";
}

function phaseLabel(phase: ConversationPhase): { label: string; color: string } {
  switch (phase) {
    case "greeting":
      return { label: "New", color: "bg-[#E8E7E2] text-[#6B6A64]" };
    case "collecting_details":
      return { label: "Collecting Details", color: "bg-[#FFF4E5] text-[#9E7A2E]" };
    case "looking_up":
      return { label: "Looking Up Order", color: "bg-[#E5EFFF] text-[#3B6FB5]" };
    case "proposing_action":
      return { label: "Proposing Action", color: "bg-[#EAF8EE] text-[#2D7A4F]" };
    case "action_confirmed":
      return { label: "Action Confirmed", color: "bg-[#EAF8EE] text-[#2D7A4F]" };
    case "action_denied":
      return { label: "Action Declined", color: "bg-[#FEECEC] text-[#C0584A]" };
    case "resolved":
      return { label: "Resolved", color: "bg-[#EAF8EE] text-[#2D7A4F]" };
    case "escalated":
      return { label: "Escalated", color: "bg-[#FEECEC] text-[#C0584A]" };
    default:
      return { label: "Active", color: "bg-[#E8E7E2] text-[#6B6A64]" };
  }
}

export default function CustomerServicePage({ businessId }: CustomerServicePageProps) {
  const [message, setMessage] = useState("");
  const [lastResult, setLastResult] = useState<CustomerServiceRunResult | null>(null);
  const [managerDrafts, setManagerDrafts] = useState<Record<string, string>>({});
  const { messages, tickets, conversationState, loading, error, submitMessage, resolveEscalated, resetConversation } =
    useCustomerServiceAgent(businessId);

  const escalated = useMemo(
    () => tickets.filter((ticket) => ticket.status === "escalated"),
    [tickets],
  );

  async function handleSubmit() {
    if (!message.trim() || loading) return;
    const result = await submitMessage(message);
    setLastResult(result);
    setMessage("");
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (!message.trim() || loading) return;
    void handleSubmit();
  }

  const phase = conversationState ? phaseLabel(conversationState.phase) : null;

  return (
    <div className="p-[24px_28px] max-w-6xl w-full">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-[24px] text-[#141412]">Customer Service</h1>
          <p className="text-[12px] text-[#6B6A64] mt-1">
            Chat with AI support. The agent will ask for order details, look up your order, and propose an action.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {phase && (
            <span className={`text-[11px] px-2 py-1 rounded-full ${phase.color}`}>
              {phase.label}
            </span>
          )}
          {conversationState && conversationState.phase === "resolved" && (
            <button
              onClick={resetConversation}
              className="px-3 py-1 rounded-[8px] border border-[#E8E7E2] text-[12px] text-[#141412] hover:bg-[#F4F3EF]"
            >
              New Conversation
            </button>
          )}
        </div>
      </div>

      {/* Conversation state detail strip */}
      {conversationState && conversationState.classification !== "none" && (
        <div className="mb-4 bg-[#F4F3EF] border border-[#E8E7E2] rounded-[8px] px-3 py-2 flex flex-wrap gap-3 text-[11px] text-[#6B6A64]">
          <span>
            <strong className="text-[#2A2A27]">Issue:</strong>{" "}
            {conversationState.classification.replace(/_/g, " ")}
          </span>
          {conversationState.collectedDetails.orderNumber && (
            <span>
              <strong className="text-[#2A2A27]">Order:</strong>{" "}
              {conversationState.collectedDetails.orderNumber}
            </span>
          )}
          {conversationState.collectedDetails.trackingNumber && (
            <span>
              <strong className="text-[#2A2A27]">Tracking:</strong>{" "}
              {conversationState.collectedDetails.trackingNumber}
            </span>
          )}
          {conversationState.orderStatus && (
            <span>
              <strong className="text-[#2A2A27]">Status:</strong>{" "}
              {conversationState.orderStatus}
            </span>
          )}
          {conversationState.proposedActionSummary && (
            <span>
              <strong className="text-[#2A2A27]">Proposed:</strong>{" "}
              {conversationState.proposedActionSummary}
            </span>
          )}
        </div>
      )}

      <div className="bg-[#FAFAF8] border border-[#E8E7E2] rounded-[12px] p-4 mb-5">
        <div className="text-[12px] text-[#6B6A64] mb-2">Chat</div>
        <div className="bg-white border border-[#E8E7E2] rounded-[8px] p-3 h-[300px] overflow-y-auto space-y-2">
          {messages.length === 0 && (
            <p className="text-[12px] text-[#6B6A64]">
              Describe your issue and the agent will ask for order details, look it up, and propose an action (refund, resend, replacement, etc.).
            </p>
          )}
          {messages.map((item) => (
            <div key={item.id} className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-[10px] px-3 py-2 text-[13px] whitespace-pre-wrap ${
                  item.role === "user"
                    ? "bg-[#141412] text-[#FAFAF8]"
                    : "bg-[#F4F3EF] text-[#141412] border border-[#E8E7E2]"
                }`}
              >
                {item.content}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-end gap-3">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            className="flex-1 min-h-[88px] resize-y rounded-[8px] border border-[#E8E7E2] p-3 text-[14px] text-[#141412] bg-white outline-none focus:border-[#C9A84C]"
            placeholder={
              conversationState?.phase === "proposing_action"
                ? "Type 'yes' to confirm or 'no' to decline..."
                : "Type your message..."
            }
          />
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 rounded-[8px] border-none bg-[#C9A84C] hover:bg-[#9E7A2E] text-[#FAFAF8] text-[13px] font-medium transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Sending..." : "Send"}
          </button>
        </div>
        {error && <span className="text-[12px] text-[#C0584A] mt-2 block">{error}</span>}
        {lastResult && !error && lastResult.ticket && (
          <div className="text-[12px] text-[#6B6A64] mt-2 block space-y-1">
            <p>
              Action: {lastResult.ticket.actionType?.replace(/_/g, " ")}
              {lastResult.ticket.actionSummary && ` — ${lastResult.ticket.actionSummary}`}
            </p>
            {lastResult.ticket.ticketSummary && (
              <div className="bg-white rounded p-2 border border-[#E8E7E2] text-[11px]">
                <p className="font-medium text-[#141412]">Ticket Summary:</p>
                <p className="whitespace-pre-wrap text-[#6B6A64]">
                  {lastResult.ticket.ticketSummary.conversationSummary}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#FAFAF8] border border-[#E8E7E2] rounded-[12px] p-4">
          <h2 className="font-serif text-[18px] text-[#141412] mb-3">Company Ticket Queue</h2>
          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-2">
            {tickets.length === 0 && (
              <p className="text-[12px] text-[#6B6A64]">No company tickets yet.</p>
            )}
            {tickets.map((ticket) => (
              <div key={ticket.id} className="bg-white border border-[#E8E7E2] rounded-[10px] p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className={`text-[11px] px-2 py-1 rounded-full ${tierClass(ticket.tier)}`}>
                    {ticket.tier.toUpperCase()}
                  </span>
                  <span className="text-[11px] text-[#6B6A64]">{ticket.status}</span>
                </div>
                {ticket.classification && (
                  <p className="text-[11px] font-medium text-[#2A2A27] mb-1">
                    Classification: {ticket.classification.replace(/_/g, " ")}
                  </p>
                )}
                <p className="text-[13px] text-[#141412] mb-2">{ticket.customerMessage}</p>
                <p className="text-[12px] text-[#2A2A27] whitespace-pre-wrap">{ticket.aiReply}</p>
                {ticket.actionType && ticket.actionType !== "none" && (
                  <div className="mt-2 bg-[#EAF8EE] border border-[#C5E6CF] rounded-[6px] px-2 py-1 text-[11px] text-[#2D7A4F]">
                    Action: {ticket.actionType.replace(/_/g, " ")}
                    {ticket.actionSummary && ` — ${ticket.actionSummary}`}
                  </div>
                )}
                {ticket.ticketSummary && (
                  <div className="text-[11px] text-[#6B6A64] mt-2 bg-[#F4F3EF] p-2 rounded border border-[#E8E7E2]">
                    <p className="font-medium text-[#2A2A27] mb-1">Summary:</p>
                    <p className="whitespace-pre-wrap">{ticket.ticketSummary.conversationSummary}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#FAFAF8] border border-[#E8E7E2] rounded-[12px] p-4">
          <h2 className="font-serif text-[18px] text-[#141412] mb-3">Manager Escalation Queue</h2>
          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-2">
            {escalated.length === 0 && (
              <p className="text-[12px] text-[#6B6A64]">No escalated tickets currently.</p>
            )}
            {escalated.map((ticket) => (
              <div key={ticket.id} className="bg-white border border-[#E8E7E2] rounded-[10px] p-3">
                {ticket.classification && (
                  <p className="text-[11px] font-medium text-[#C0584A] mb-2">
                    Classification: {ticket.classification.replace(/_/g, " ")}
                  </p>
                )}
                <p className="text-[13px] text-[#141412] mb-2">{ticket.customerMessage}</p>
                {ticket.ticketSummary && (
                  <div className="text-[11px] text-[#6B6A64] mb-2 bg-[#FEECEC] p-2 rounded border border-[#E8E7E2]">
                    <p className="font-medium text-[#2A2A27] mb-1">Summary:</p>
                    <p className="whitespace-pre-wrap">{ticket.ticketSummary.conversationSummary}</p>
                  </div>
                )}
                <textarea
                  value={managerDrafts[ticket.id] ?? ""}
                  onChange={(event) =>
                    setManagerDrafts((prev) => ({
                      ...prev,
                      [ticket.id]: event.target.value,
                    }))
                  }
                  className="w-full min-h-[80px] resize-y rounded-[8px] border border-[#E8E7E2] p-2 text-[12px] text-[#141412] bg-white outline-none focus:border-[#C9A84C]"
                  placeholder="Write resolution for customer..."
                />
                <button
                  className="mt-2 px-3 py-2 rounded-[8px] border border-[#E8E7E2] text-[12px] text-[#141412] hover:bg-[#F4F3EF]"
                  onClick={() => resolveEscalated(ticket.id, managerDrafts[ticket.id] ?? "")}
                >
                  Resolve escalated ticket
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
