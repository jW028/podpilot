"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import { useCustomerServiceAgent } from "@/hooks/useCustomerServiceAgent";
import type {
  CustomerServiceTicket,
  ConversationPhase,
  PendingTicketData,
  TicketMessage,
} from "@/lib/types/customerService";

interface CustomerServicePageProps {
  businessId: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function tierClass(tier: CustomerServiceTicket["tier"]) {
  if (tier === "easy") return "bg-[#EAF8EE] text-[#2D7A4F]";
  if (tier === "mid")  return "bg-[#FFF4E5] text-[#9E7A2E]";
  return "bg-[#FEECEC] text-[#C0584A]";
}

function tierLabel(tier: CustomerServiceTicket["tier"]) {
  if (tier === "easy") return "Resolved";
  if (tier === "mid")  return "Follow Up";
  return "Action Required";
}

function statusLabel(status: string) {
  switch (status) {
    case "open":             return "Open";
    case "escalated":        return "Escalated";
    case "ai_resolved":      return "AI Resolved";
    case "manager_resolved": return "Resolved";
    default:                 return status;
  }
}

function phaseLabel(phase: ConversationPhase): { label: string; color: string } {
  switch (phase) {
    case "greeting":          return { label: "New", color: "bg-[#E8E7E2] text-[#6B6A64]" };
    case "collecting_details": return { label: "Collecting Details", color: "bg-[#FFF4E5] text-[#9E7A2E]" };
    case "looking_up":        return { label: "Looking Up Order", color: "bg-[#E5EFFF] text-[#3B6FB5]" };
    case "proposing_action":  return { label: "Proposing Action", color: "bg-[#EAF8EE] text-[#2D7A4F]" };
    case "awaiting_finalize": return { label: "Ready to Finalize", color: "bg-[#FFF4E5] text-[#9E7A2E]" };
    case "resolved":          return { label: "Resolved", color: "bg-[#EAF8EE] text-[#2D7A4F]" };
    default:                  return { label: "Active", color: "bg-[#E8E7E2] text-[#6B6A64]" };
  }
}

function actionLabel(a: string) {
  switch (a) {
    case "process_refund":      return "Refund Issued";
    case "process_resend":      return "Order Resent";
    case "process_replacement": return "Replacement Sent";
    case "escalate_to_manager": return "Escalated";
    default:                    return a.replace(/_/g, " ");
  }
}

// ── TicketReview (finalize panel) ─────────────────────────────────────────────

function TicketReview({ ticket, onFinalize, onDiscard, finalizing, finalizeError }: {
  ticket: PendingTicketData;
  onFinalize: () => void;
  onDiscard: () => void;
  finalizing: boolean;
  finalizeError: string | null;
}) {
  return (
    <div className="mb-5 rounded-[14px] border-2 border-[#C9A84C] bg-[#FFFDF5] overflow-hidden">
      <div className="bg-[#C9A84C] px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[#FAFAF8] text-[15px] font-serif font-medium">Case Ready to Submit</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/20 text-white font-medium">
            {actionLabel(ticket.actionType)}
          </span>
        </div>
        <span className="text-[#FFFDF5] text-[11px] opacity-80">Review before finalizing</span>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { label: "Customer Issue", value: ticket.customerIssue },
            { label: "Order ID",       value: ticket.orderId },
            { label: "Product",        value: ticket.orderProductTitle },
            { label: "Order Status",   value: ticket.orderStatus },
            { label: "Order Total",    value: ticket.orderTotal != null ? `RM ${ticket.orderTotal.toFixed(2)}` : null },
            { label: "Action",         value: ticket.actionSummary },
            { label: "Priority",       value: ticket.priority },
            { label: "Type",           value: ticket.issueType.replace(/_/g, " ") },
          ].filter(({ value }) => value != null && value !== "none").map(({ label, value }) => (
            <div key={label} className="bg-white border border-[#E8E7E2] rounded-[8px] px-3 py-2">
              <p className="text-[10px] text-[#6B6A64] mb-0.5">{label}</p>
              <p className="text-[12px] text-[#141412] font-medium break-all">{value}</p>
            </div>
          ))}
        </div>
        <div className="bg-[#F4F3EF] border border-[#E8E7E2] rounded-[8px] px-4 py-3 mb-4">
          <p className="text-[10px] text-[#6B6A64] mb-1">AI Response sent to customer</p>
          <p className="text-[12px] text-[#141412] whitespace-pre-wrap leading-relaxed">{ticket.agentReply}</p>
        </div>
        {finalizeError && (
          <p className="text-[12px] text-[#C0584A] mb-3 bg-[#FEECEC] border border-[#F5C6C2] rounded-[8px] px-3 py-2 text-center">
            {finalizeError}
          </p>
        )}
        <div className="flex gap-2">
          <button onClick={onFinalize} disabled={finalizing}
            className="flex-1 py-3 rounded-[10px] bg-[#141412] hover:bg-[#2A2A27] text-[#FAFAF8] text-[14px] font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed">
            {finalizing ? "Saving ticket..." : "Finalize & Submit Ticket to Shop"}
          </button>
          <button onClick={onDiscard} disabled={finalizing}
            className="px-5 py-3 rounded-[10px] border border-[#E8E7E2] text-[13px] text-[#6B6A64] hover:bg-[#F4F3EF] transition disabled:opacity-50">
            Discard
          </button>
        </div>
        <p className="text-[11px] text-[#6B6A64] text-center mt-3">
          Clicking Finalize saves this ticket to the shop's queue and ends this chat session.
        </p>
      </div>
    </div>
  );
}

// ── Ticket message thread ─────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: TicketMessage }) {
  const isCustomer = msg.role === "customer";
  const isSeller   = msg.role === "manager";

  return (
    <div className={`flex ${isCustomer ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[80%] space-y-1">
        <p className={`text-[10px] ${isCustomer ? "text-right text-[#6B6A64]" : "text-[#6B6A64]"}`}>
          {isCustomer ? "Customer" : isSeller ? "You (Seller)" : "AI Agent"}
        </p>
        <div className={`rounded-[10px] px-3 py-2 text-[12px] whitespace-pre-wrap ${
          isCustomer
            ? "bg-[#141412] text-[#FAFAF8]"
            : isSeller
            ? "bg-[#C9A84C] text-[#FAFAF8]"
            : "bg-[#F4F3EF] text-[#141412] border border-[#E8E7E2]"
        }`}>
          {msg.content}
        </div>
        {msg.actionSummary && (
          <div className="bg-[#EAF8EE] border border-[#C5E6CF] rounded-[6px] px-2 py-1 text-[10px] text-[#2D7A4F]">
            {msg.actionSummary}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Ticket detail panel ───────────────────────────────────────────────────────

// Suggested quick questions sellers can send based on issue type
const QUICK_REPLIES: Record<string, string[]> = {
  process_refund: [
    "Could you please provide your bank account number and bank name for the refund?",
    "Can you share a photo of the item to verify the issue?",
    "Your refund has been processed. Please allow 3–5 business days for it to reflect.",
  ],
  process_resend: [
    "Could you confirm your delivery address so we can resend your order?",
    "We've dispatched a replacement. You'll receive a new tracking number shortly.",
  ],
  process_replacement: [
    "Could you share a photo of the damaged item so we can verify before sending a replacement?",
    "Your replacement has been shipped. You'll receive a tracking number within 24 hours.",
  ],
  escalate_to_manager: [
    "Thank you for your patience. Could you describe the issue in more detail?",
    "We've reviewed your case and are escalating it to our senior team.",
  ],
  default: [
    "Could you provide more details about your issue?",
    "Can you share a photo or screenshot to help us understand better?",
    "Thank you for the information. We're looking into this now.",
    "We've resolved this on our end. Is there anything else we can help you with?",
  ],
};

function TicketDetail({ ticket, onClose, onSendReply, onResolve }: {
  ticket: CustomerServiceTicket;
  onClose: () => void;
  onSendReply: (ticketId: string, message: string) => Promise<void>;
  onResolve: (ticketId: string, message: string) => Promise<void>;
}) {
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const isResolved = ticket.status === "manager_resolved";

  const quickReplies = QUICK_REPLIES[ticket.actionType] ?? QUICK_REPLIES.default;
  const ctx = ticket.messages.find((m) => m.role === "agent")?.context;
  const displayOrderId = ticket.printifyOrderRef ?? ctx?.orderId ?? null;

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [ticket.messages]);

  async function handleSend() {
    if (!reply.trim() || sending) return;
    setSending(true);
    setReplyError(null);
    try {
      await onSendReply(ticket.dbId || ticket.id, reply.trim());
      setReply("");
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : "Failed to send.");
    } finally {
      setSending(false);
    }
  }

  async function handleResolve() {
    setResolving(true);
    setReplyError(null);
    try {
      await onResolve(ticket.dbId || ticket.id, reply.trim());
      setReply("");
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : "Failed to resolve.");
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${tierClass(ticket.tier)}`}>
              {tierLabel(ticket.tier)}
            </span>
            <span className="text-[10px] text-[#6B6A64]">{statusLabel(ticket.status)}</span>
            <span className="text-[10px] text-[#6B6A64]">·</span>
            <span className="text-[10px] text-[#6B6A64]">
              {new Date(ticket.createdAt).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>
          {displayOrderId && (
            <p className="text-[11px] text-[#6B6A64] mt-1">
              Order: <span className="font-mono font-medium text-[#141412]">{displayOrderId}</span>
              {ctx?.productTitle && <span className="ml-2">· {ctx.productTitle}</span>}
              {ctx?.orderTotal != null && <span className="ml-2">· RM {ctx.orderTotal.toFixed(2)}</span>}
            </p>
          )}
        </div>
        <button onClick={onClose} className="text-[11px] text-[#6B6A64] hover:text-[#141412] shrink-0">✕</button>
      </div>

      {/* Thread */}
      <div ref={threadRef} className="overflow-y-auto bg-white border border-[#E8E7E2] rounded-[8px] p-3 space-y-3 mb-3 min-h-[180px] max-h-[280px]">
        {ticket.messages.length === 0 ? (
          <p className="text-[12px] text-[#6B6A64]">No messages yet.</p>
        ) : (
          ticket.messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)
        )}
      </div>

      {!isResolved ? (
        <>
          {/* Quick reply suggestions */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {quickReplies.map((q) => (
              <button
                key={q}
                onClick={() => setReply(q)}
                className="text-[10px] px-2 py-1 rounded-full border border-[#E8E7E2] text-[#6B6A64] hover:border-[#C9A84C] hover:text-[#141412] transition text-left"
              >
                {q.length > 50 ? q.slice(0, 50) + "…" : q}
              </button>
            ))}
          </div>

          {/* Composer */}
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) void handleSend(); }}
            rows={3}
            placeholder="Type a message to the customer… (Ctrl+Enter to send)"
            className="w-full resize-none rounded-[8px] border border-[#E8E7E2] p-2 text-[12px] text-[#141412] bg-white outline-none focus:border-[#C9A84C] mb-2"
          />

          {replyError && (
            <p className="text-[11px] text-[#C0584A] mb-2">{replyError}</p>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleSend}
              disabled={!reply.trim() || sending || resolving}
              className="flex-1 py-2 rounded-[8px] border border-[#E8E7E2] text-[12px] text-[#141412] hover:bg-[#F4F3EF] disabled:opacity-40 disabled:cursor-not-allowed transition font-medium"
            >
              {sending ? "Sending…" : "Send Message"}
            </button>
            <button
              onClick={handleResolve}
              disabled={resolving || sending}
              className="flex-1 py-2 rounded-[8px] bg-[#141412] hover:bg-[#2A2A27] text-[#FAFAF8] text-[12px] font-medium disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {resolving ? "Resolving…" : reply.trim() ? "Send & Mark Resolved" : "Mark as Resolved"}
            </button>
          </div>
          <p className="text-[10px] text-[#6B6A64] mt-1.5 text-center">
            Use <strong>Send Message</strong> to ask questions. Click <strong>Mark as Resolved</strong> only when the issue is fully handled.
          </p>
        </>
      ) : (
        <div className="text-center py-3 text-[12px] text-[#2D7A4F] bg-[#EAF8EE] rounded-[8px]">
          This ticket has been resolved.
        </div>
      )}
    </div>
  );
}

// ── Test order bar ────────────────────────────────────────────────────────────

function TestOrderBar({ businessId }: { businessId: string }) {
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ orderId: string; productTitle: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCreate() {
    setCreating(true); setErr(null); setResult(null);
    try {
      const res = await fetch(`/api/businesses/${businessId}/printify-orders`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Failed to create order."); return; }
      setResult({ orderId: data.orderId, productTitle: data.productTitle });
    } catch { setErr("Network error."); } finally { setCreating(false); }
  }

  return (
    <div className="mb-4 bg-[#F4F3EF] border border-[#E8E7E2] rounded-[8px] px-3 py-2 flex flex-wrap items-center gap-3 text-[12px]">
      <span className="text-[#6B6A64] font-medium">Test:</span>
      <button onClick={handleCreate} disabled={creating}
        className="px-3 py-1 rounded-[6px] bg-[#141412] hover:bg-[#2A2A27] text-[#FAFAF8] text-[11px] font-medium disabled:opacity-50 transition">
        {creating ? "Creating..." : "+ Create Printify Test Order"}
      </button>
      {result && (
        <div className="flex items-center gap-2">
          <span className="text-[#6B6A64]">
            <span className="font-medium text-[#2A2A27]">{result.orderId}</span> · {result.productTitle}
          </span>
          <button onClick={() => { navigator.clipboard.writeText(result.orderId).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="px-2 py-0.5 rounded text-[11px] border border-[#E8E7E2] hover:bg-white text-[#6B6A64] transition">
            {copied ? "✓ Copied" : "Copy ID"}
          </button>
        </div>
      )}
      {err && <span className="text-[#C0584A]">{err}</span>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type FilterTab = "all" | "open" | "escalated" | "resolved";

export default function CustomerServicePage({ businessId }: CustomerServicePageProps) {
  const [message, setMessage]             = useState("");
  const [finalizeSuccessId, setFinalizeSuccessId] = useState<string | null>(null);
  const [selectedTicketId, setSelectedTicketId]   = useState<string | null>(null);
  const [filterTab, setFilterTab]         = useState<FilterTab>("all");
  const [showAiChat, setShowAiChat]       = useState(false);
  // Optimistic seller messages appended locally before DB re-fetch
  const [optimisticMessages, setOptimisticMessages] = useState<
    Record<string, TicketMessage[]>
  >({});

  const {
    messages, tickets, conversationState,
    loading, finalizing, error,
    submitMessage, finalizeSession, resolveEscalated, resetConversation,
  } = useCustomerServiceAgent(businessId);

  // Filter tickets by tab
  const filteredTickets = useMemo(() => {
    if (filterTab === "all")       return tickets;
    if (filterTab === "open")      return tickets.filter((t) => t.status === "open" || t.status === "escalated");
    if (filterTab === "escalated") return tickets.filter((t) => t.status === "escalated");
    return tickets.filter((t) => t.status === "manager_resolved" || t.status === "ai_resolved");
  }, [tickets, filterTab]);

  const selectedTicket = useMemo(() => {
    const base = tickets.find((t) => t.id === selectedTicketId);
    if (!base) return null;
    const extra = optimisticMessages[base.id] ?? [];
    return extra.length > 0 ? { ...base, messages: [...base.messages, ...extra] } : base;
  }, [tickets, selectedTicketId, optimisticMessages]);

  const phase = conversationState ? phaseLabel(conversationState.phase) : null;
  const isAwaitingFinalize = conversationState?.phase === "awaiting_finalize";
  const chatDisabled = loading || isAwaitingFinalize;

  async function handleSubmit() {
    if (!message.trim() || loading) return;
    await submitMessage(message);
    setMessage("");
  }

  async function handleFinalize() {
    const ticketId = await finalizeSession();
    if (ticketId) { setFinalizeSuccessId(ticketId); setSelectedTicketId(ticketId); }
  }

  async function patchTicket(ticketId: string, msg: string, action: "reply" | "resolve") {
    const res = await fetch("/api/support-tickets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ticketId, message: msg, action }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to update ticket.");
    }

    const newMsg: TicketMessage = {
      role: "manager",
      content: msg,
      timestamp: new Date().toISOString(),
    };

    // Append message to optimistic thread immediately
    if (msg.trim()) {
      setOptimisticMessages((prev) => ({
        ...prev,
        [ticketId]: [...(prev[ticketId] ?? []), newMsg],
      }));
    }

    // For resolve: also mark ticket as resolved in local tickets state
    if (action === "resolve") {
      resolveEscalated(ticketId, msg);
      // Clear optimistic messages for this ticket — resolveEscalated rebuilds from DB on reload
      setOptimisticMessages((prev) => {
        const next = { ...prev };
        delete next[ticketId];
        return next;
      });
    }
  }

  async function handleSendReply(ticketId: string, msg: string) {
    await patchTicket(ticketId, msg, "reply");
  }

  async function handleResolve(ticketId: string, msg: string) {
    await patchTicket(ticketId, msg, "resolve");
  }

  const TABS: { key: FilterTab; label: string }[] = [
    { key: "all",       label: "All" },
    { key: "open",      label: "Open" },
    { key: "escalated", label: "Action Required" },
    { key: "resolved",  label: "Resolved" },
  ];

  return (
    <div className="p-[24px_28px] max-w-6xl w-full space-y-5">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-[24px] text-[#141412]">Customer Service</h1>
          <p className="text-[12px] text-[#6B6A64] mt-0.5">
            View and respond to customer tickets for your shop.
          </p>
        </div>
        <button
          onClick={() => setShowAiChat((v) => !v)}
          className="px-3 py-1.5 rounded-[8px] border border-[#E8E7E2] text-[12px] text-[#141412] hover:bg-[#F4F3EF] transition"
        >
          {showAiChat ? "Hide AI Chat" : "AI Test Chat"}
        </button>
      </div>

      {/* ── AI Test Chat (collapsible) ── */}
      {showAiChat && (
        <div className="bg-[#FAFAF8] border border-[#E8E7E2] rounded-[12px] p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[12px] font-medium text-[#2A2A27]">AI Customer Service Chat</p>
            <div className="flex items-center gap-2">
              {phase && <span className={`text-[11px] px-2 py-0.5 rounded-full ${phase.color}`}>{phase.label}</span>}
              {isAwaitingFinalize && (
                <button onClick={resetConversation} className="text-[11px] text-[#6B6A64] hover:text-[#141412] border border-[#E8E7E2] rounded px-2 py-0.5">
                  New
                </button>
              )}
            </div>
          </div>

          {finalizeSuccessId && !isAwaitingFinalize && (
            <div className="mb-3 rounded-[8px] bg-[#EAF8EE] border border-[#C5E6CF] px-4 py-2 flex items-center justify-between">
              <p className="text-[12px] text-[#2D7A4F]">
                Ticket submitted — <span className="font-mono text-[11px]">{finalizeSuccessId}</span>
              </p>
              <button onClick={() => setFinalizeSuccessId(null)} className="text-[11px] text-[#2D7A4F] hover:underline ml-3">
                Dismiss
              </button>
            </div>
          )}

          {isAwaitingFinalize && conversationState?.pendingTicket && (
            <TicketReview
              ticket={conversationState.pendingTicket}
              finalizing={finalizing}
              finalizeError={error}
              onFinalize={handleFinalize}
              onDiscard={resetConversation}
            />
          )}

          <TestOrderBar businessId={businessId} />

          {/* Context strip */}
          {conversationState && conversationState.classification !== "none" && !isAwaitingFinalize && (
            <div className="mb-3 bg-[#F4F3EF] border border-[#E8E7E2] rounded-[8px] px-3 py-2 flex flex-wrap gap-3 text-[11px] text-[#6B6A64]">
              <span><strong className="text-[#2A2A27]">Issue:</strong> {conversationState.classification.replace(/_/g, " ")}</span>
              {conversationState.collectedDetails.orderNumber && (
                <span><strong className="text-[#2A2A27]">Order:</strong> {conversationState.collectedDetails.orderNumber}</span>
              )}
              {conversationState.orderStatus && (
                <span><strong className="text-[#2A2A27]">Status:</strong> {conversationState.orderStatus}</span>
              )}
            </div>
          )}

          {/* Chat bubbles */}
          <div className="bg-white border border-[#E8E7E2] rounded-[8px] p-3 h-[220px] overflow-y-auto space-y-2 mb-3">
            {messages.length === 0 && (
              <p className="text-[12px] text-[#6B6A64]">
                Describe your issue — the agent will ask for your order ID, look it up, and propose an action.
              </p>
            )}
            {messages.map((item) => (
              <div key={item.id} className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-[10px] px-3 py-2 text-[12px] whitespace-pre-wrap ${
                  item.role === "user"
                    ? "bg-[#141412] text-[#FAFAF8]"
                    : "bg-[#F4F3EF] text-[#141412] border border-[#E8E7E2]"
                }`}>
                  {item.content}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || e.shiftKey) return;
                e.preventDefault();
                if (!message.trim() || loading) return;
                void handleSubmit();
              }}
              disabled={chatDisabled}
              rows={2}
              className="flex-1 resize-none rounded-[8px] border border-[#E8E7E2] p-2 text-[13px] text-[#141412] bg-white outline-none focus:border-[#C9A84C] disabled:bg-[#F4F3EF] disabled:cursor-not-allowed"
              placeholder={
                isAwaitingFinalize ? "Review and finalize the ticket above..."
                : conversationState?.phase === "proposing_action" ? "Type 'yes' to confirm or 'no' to decline..."
                : "Type your message..."
              }
            />
            <button onClick={handleSubmit} disabled={chatDisabled}
              className="px-4 rounded-[8px] bg-[#C9A84C] hover:bg-[#9E7A2E] text-[#FAFAF8] text-[13px] font-medium transition disabled:opacity-60 disabled:cursor-not-allowed">
              {loading ? "..." : "Send"}
            </button>
          </div>
          {error && !isAwaitingFinalize && (
            <p className="text-[12px] text-[#C0584A] mt-2">{error}</p>
          )}
        </div>
      )}

      {/* ── Seller Ticket Queue ── */}
      <div className="bg-[#FAFAF8] border border-[#E8E7E2] rounded-[12px] overflow-hidden">
        {/* Filter tabs */}
        <div className="flex border-b border-[#E8E7E2] px-4 pt-4 pb-0 gap-1">
          <h2 className="font-serif text-[18px] text-[#141412] mr-4 pb-3">Ticket Queue</h2>
          {TABS.map((tab) => (
            <button key={tab.key} onClick={() => setFilterTab(tab.key)}
              className={`px-3 pb-3 text-[12px] font-medium border-b-2 transition ${
                filterTab === tab.key
                  ? "border-[#C9A84C] text-[#141412]"
                  : "border-transparent text-[#6B6A64] hover:text-[#141412]"
              }`}>
              {tab.label}
              {tab.key === "all" && tickets.length > 0 && (
                <span className="ml-1.5 bg-[#E8E7E2] text-[#6B6A64] text-[10px] px-1.5 py-0.5 rounded-full">
                  {tickets.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#E8E7E2]">
          {/* Left: ticket list */}
          <div className="p-4 space-y-2 max-h-[520px] overflow-y-auto">
            {filteredTickets.length === 0 && (
              <p className="text-[12px] text-[#6B6A64]">No tickets in this category.</p>
            )}
            {filteredTickets.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => setSelectedTicketId(ticket.id)}
                className={`w-full text-left bg-white border rounded-[10px] p-3 transition hover:border-[#C9A84C] hover:shadow-sm ${
                  selectedTicketId === ticket.id
                    ? "border-[#C9A84C] ring-1 ring-[#C9A84C]"
                    : "border-[#E8E7E2]"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${tierClass(ticket.tier)}`}>
                    {tierLabel(ticket.tier)}
                  </span>
                  <span className="text-[10px] text-[#6B6A64]">
                    {statusLabel(ticket.status)} · {new Date(ticket.createdAt).toLocaleDateString("en-MY")}
                  </span>
                </div>
                <p className="text-[12px] text-[#141412] line-clamp-2">
                  {ticket.customerMessage || ticket.issueType?.replace(/_/g, " ")}
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {ticket.printifyOrderRef && (
                    <span className="text-[10px] font-mono text-[#6B6A64] bg-[#F4F3EF] px-1.5 py-0.5 rounded">
                      {ticket.printifyOrderRef}
                    </span>
                  )}
                  {ticket.actionType && ticket.actionType !== "none" && (
                    <span className="text-[10px] text-[#2D7A4F]">{actionLabel(ticket.actionType)}</span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Right: ticket detail */}
          <div className="p-4 flex flex-col min-h-[300px]">
            {!selectedTicket ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-[12px] text-[#6B6A64]">Select a ticket to view the conversation and reply.</p>
              </div>
            ) : (
              <TicketDetail
                ticket={selectedTicket}
                onClose={() => setSelectedTicketId(null)}
                onSendReply={handleSendReply}
                onResolve={handleResolve}
              />
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
