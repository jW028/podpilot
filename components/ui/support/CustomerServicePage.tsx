"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { useCustomerServiceAgent } from "@/hooks/useCustomerServiceAgent";
import type { CustomerServiceTicket, ConversationPhase, PendingTicketData } from "@/types/customerService";

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
    case "greeting":          return { label: "New", color: "bg-[#E8E7E2] text-[#6B6A64]" };
    case "collecting_details": return { label: "Collecting Details", color: "bg-[#FFF4E5] text-[#9E7A2E]" };
    case "looking_up":        return { label: "Looking Up Order", color: "bg-[#E5EFFF] text-[#3B6FB5]" };
    case "proposing_action":  return { label: "Proposing Action", color: "bg-[#EAF8EE] text-[#2D7A4F]" };
    case "action_confirmed":  return { label: "Action Confirmed", color: "bg-[#EAF8EE] text-[#2D7A4F]" };
    case "action_denied":     return { label: "Action Declined", color: "bg-[#FEECEC] text-[#C0584A]" };
    case "awaiting_finalize": return { label: "Ready to Finalize", color: "bg-[#FFF4E5] text-[#9E7A2E]" };
    case "resolved":          return { label: "Resolved", color: "bg-[#EAF8EE] text-[#2D7A4F]" };
    case "escalated":         return { label: "Escalated", color: "bg-[#FEECEC] text-[#C0584A]" };
    default:                  return { label: "Active", color: "bg-[#E8E7E2] text-[#6B6A64]" };
  }
}

function TicketReview({ ticket, onFinalize, onDiscard, finalizing }: {
  ticket: PendingTicketData;
  onFinalize: () => void;
  onDiscard: () => void;
  finalizing: boolean;
}) {
  const rows: [string, string | null][] = [
    ["Issue", ticket.customerIssue],
    ["Order ID", ticket.orderId],
    ["Product", ticket.orderProductTitle],
    ["Order Status", ticket.orderStatus],
    ["Order Total", ticket.orderTotal != null ? `RM ${ticket.orderTotal.toFixed(2)}` : null],
    ["Shop ID", ticket.shopId],
    ["Product ID", ticket.productId],
    ["Classification", ticket.classification.replace(/_/g, " ")],
    ["Action Taken", ticket.actionType.replace(/_/g, " ")],
    ["Action Summary", ticket.actionSummary],
    ["Priority", ticket.priority],
  ];

  return (
    <div className="border border-[#C9A84C] bg-[#FFFDF5] rounded-[12px] p-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-serif text-[16px] text-[#141412]">Review Ticket</h3>
          <p className="text-[11px] text-[#6B6A64] mt-0.5">
            Check the details below before finalizing. Once confirmed, the ticket is saved and the chat clears.
          </p>
        </div>
        <span className="text-[11px] px-2 py-1 rounded-full bg-[#FFF4E5] text-[#9E7A2E]">
          Pending
        </span>
      </div>

      <div className="bg-white border border-[#E8E7E2] rounded-[8px] divide-y divide-[#F4F3EF] mb-4 text-[12px]">
        {rows.filter(([, v]) => v != null && v !== "none").map(([label, value]) => (
          <div key={label} className="flex px-3 py-2 gap-3">
            <span className="w-32 shrink-0 text-[#6B6A64]">{label}</span>
            <span className="text-[#141412] break-all">{value}</span>
          </div>
        ))}
      </div>

      <div className="bg-[#F4F3EF] rounded-[8px] p-3 mb-4 text-[12px]">
        <p className="text-[#6B6A64] mb-1 font-medium">Agent Response</p>
        <p className="text-[#141412] whitespace-pre-wrap">{ticket.agentReply}</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onFinalize}
          disabled={finalizing}
          className="px-5 py-2 rounded-[8px] bg-[#141412] hover:bg-[#2A2A27] text-[#FAFAF8] text-[13px] font-medium transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {finalizing ? "Finalizing..." : "Finalize & Save Ticket"}
        </button>
        <button
          onClick={onDiscard}
          disabled={finalizing}
          className="px-4 py-2 rounded-[8px] border border-[#E8E7E2] text-[13px] text-[#6B6A64] hover:bg-[#F4F3EF] transition disabled:opacity-60"
        >
          Discard
        </button>
      </div>
    </div>
  );
}

function TestOrderBar({ businessId }: { businessId: string }) {
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ orderId: string; productTitle: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCreate() {
    setCreating(true);
    setErr(null);
    setResult(null);
    try {
      const res = await fetch(`/api/businesses/${businessId}/printify-orders`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Failed to create order."); return; }
      setResult({ orderId: data.orderId, productTitle: data.productTitle });
    } catch {
      setErr("Network error.");
    } finally {
      setCreating(false);
    }
  }

  function handleCopy() {
    if (!result) return;
    navigator.clipboard.writeText(result.orderId).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mb-4 bg-[#F4F3EF] border border-[#E8E7E2] rounded-[8px] px-3 py-2 flex flex-wrap items-center gap-3 text-[12px]">
      <span className="text-[#6B6A64] font-medium">Test:</span>
      <button
        onClick={handleCreate}
        disabled={creating}
        className="px-3 py-1 rounded-[6px] bg-[#141412] hover:bg-[#2A2A27] text-[#FAFAF8] text-[11px] font-medium disabled:opacity-50 transition"
      >
        {creating ? "Creating..." : "+ Create Printify Test Order"}
      </button>

      {result && (
        <div className="flex items-center gap-2">
          <span className="text-[#6B6A64]">
            <span className="font-medium text-[#2A2A27]">{result.orderId}</span>
            {" "}· {result.productTitle}
          </span>
          <button
            onClick={handleCopy}
            className="px-2 py-0.5 rounded text-[11px] border border-[#E8E7E2] hover:bg-white text-[#6B6A64] transition"
          >
            {copied ? "✓ Copied" : "Copy ID"}
          </button>
        </div>
      )}

      {err && <span className="text-[#C0584A]">{err}</span>}
    </div>
  );
}

export default function CustomerServicePage({ businessId }: CustomerServicePageProps) {
  const [message, setMessage] = useState("");
  const [managerDrafts, setManagerDrafts] = useState<Record<string, string>>({});

  const {
    messages,
    tickets,
    conversationState,
    loading,
    finalizing,
    error,
    submitMessage,
    finalizeSession,
    resolveEscalated,
    resetConversation,
  } = useCustomerServiceAgent(businessId);

  const escalated = useMemo(
    () => tickets.filter((t) => t.status === "escalated"),
    [tickets],
  );

  async function handleSubmit() {
    if (!message.trim() || loading) return;
    await submitMessage(message);
    setMessage("");
  }

  function handleComposerKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    if (!message.trim() || loading) return;
    void handleSubmit();
  }

  const phase = conversationState ? phaseLabel(conversationState.phase) : null;
  const isAwaitingFinalize = conversationState?.phase === "awaiting_finalize";
  const isResolved = conversationState?.phase === "resolved";
  const chatDisabled = loading || isAwaitingFinalize || isResolved;

  return (
    <div className="p-[24px_28px] max-w-6xl w-full">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-[24px] text-[#141412]">Customer Service</h1>
          <p className="text-[12px] text-[#6B6A64] mt-1">
            Chat with AI support. The agent will ask for your order ID, look it up, and propose an action.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {phase && (
            <span className={`text-[11px] px-2 py-1 rounded-full ${phase.color}`}>
              {phase.label}
            </span>
          )}
          {(isAwaitingFinalize || isResolved) && (
            <button
              onClick={resetConversation}
              className="px-3 py-1 rounded-[8px] border border-[#E8E7E2] text-[12px] text-[#141412] hover:bg-[#F4F3EF]"
            >
              New Conversation
            </button>
          )}
        </div>
      </div>

      {/* Context strip */}
      {conversationState && conversationState.classification !== "none" && !isAwaitingFinalize && (
        <div className="mb-4 bg-[#F4F3EF] border border-[#E8E7E2] rounded-[8px] px-3 py-2 flex flex-wrap gap-3 text-[11px] text-[#6B6A64]">
          <span><strong className="text-[#2A2A27]">Issue:</strong> {conversationState.classification.replace(/_/g, " ")}</span>
          {conversationState.collectedDetails.orderNumber && (
            <span><strong className="text-[#2A2A27]">Order:</strong> {conversationState.collectedDetails.orderNumber}</span>
          )}
          {conversationState.orderStatus && (
            <span><strong className="text-[#2A2A27]">Status:</strong> {conversationState.orderStatus}</span>
          )}
          {conversationState.proposedActionSummary && (
            <span><strong className="text-[#2A2A27]">Proposed:</strong> {conversationState.proposedActionSummary}</span>
          )}
        </div>
      )}

      {/* Ticket review panel — shown before finalize */}
      {isAwaitingFinalize && conversationState.pendingTicket && (
        <TicketReview
          ticket={conversationState.pendingTicket}
          finalizing={finalizing}
          onFinalize={finalizeSession}
          onDiscard={resetConversation}
        />
      )}

      {/* Test order bar */}
      <TestOrderBar businessId={businessId} />

      {/* Chat */}
      <div className="bg-[#FAFAF8] border border-[#E8E7E2] rounded-[12px] p-4 mb-5">
        <div className="text-[12px] text-[#6B6A64] mb-2">Chat</div>
        <div className="bg-white border border-[#E8E7E2] rounded-[8px] p-3 h-[300px] overflow-y-auto space-y-2">
          {messages.length === 0 && (
            <p className="text-[12px] text-[#6B6A64]">
              Describe your issue and the agent will ask for your order ID, look it up, and propose an action.
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
          {isAwaitingFinalize && (
            <p className="text-[11px] text-[#9E7A2E] text-center pt-2">
              Review the ticket above and click Finalize to save it.
            </p>
          )}
        </div>

        <div className="mt-3 flex items-end gap-3">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleComposerKeyDown}
            disabled={chatDisabled}
            className="flex-1 min-h-[88px] resize-y rounded-[8px] border border-[#E8E7E2] p-3 text-[14px] text-[#141412] bg-white outline-none focus:border-[#C9A84C] disabled:bg-[#F4F3EF] disabled:text-[#6B6A64] disabled:cursor-not-allowed"
            placeholder={
              isAwaitingFinalize ? "Review and finalize the ticket above..."
              : conversationState?.phase === "proposing_action" ? "Type 'yes' to confirm or 'no' to decline..."
              : "Type your message..."
            }
          />
          <button
            onClick={handleSubmit}
            disabled={chatDisabled}
            className="px-4 py-2 rounded-[8px] border-none bg-[#C9A84C] hover:bg-[#9E7A2E] text-[#FAFAF8] text-[13px] font-medium transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Sending..." : "Send"}
          </button>
        </div>

        {error && <span className="text-[12px] text-[#C0584A] mt-2 block">{error}</span>}
      </div>

      {/* Ticket queues */}
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
                    {ticket.classification.replace(/_/g, " ")}
                  </p>
                )}
                <p className="text-[13px] text-[#141412] mb-2">{ticket.customerMessage}</p>
                <p className="text-[12px] text-[#2A2A27] whitespace-pre-wrap">{ticket.aiReply}</p>
                {ticket.actionType && ticket.actionType !== "none" && (
                  <div className="mt-2 bg-[#EAF8EE] border border-[#C5E6CF] rounded-[6px] px-2 py-1 text-[11px] text-[#2D7A4F]">
                    {ticket.actionType.replace(/_/g, " ")}
                    {ticket.actionSummary && ` — ${ticket.actionSummary}`}
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
                    {ticket.classification.replace(/_/g, " ")}
                  </p>
                )}
                <p className="text-[13px] text-[#141412] mb-2">{ticket.customerMessage}</p>
                <textarea
                  value={managerDrafts[ticket.id] ?? ""}
                  onChange={(e) => setManagerDrafts((prev) => ({ ...prev, [ticket.id]: e.target.value }))}
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
