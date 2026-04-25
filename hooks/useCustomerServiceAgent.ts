"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  CustomerServiceRunResult,
  CustomerServiceTicket,
  ConversationState,
} from "@/types/customerService";

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface PersistedSession {
  messages: { id: string; role: "user" | "assistant"; content: string; createdAt: string }[];
  conversationState: ConversationState;
  savedAt: string;
}

function sessionKey(businessId: string) {
  return `cs_session_${businessId}`;
}

function loadSession(businessId: string): PersistedSession | null {
  try {
    const raw = localStorage.getItem(sessionKey(businessId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSession;
    const age = Date.now() - new Date(parsed.savedAt).getTime();
    if (age > SESSION_TTL_MS) {
      localStorage.removeItem(sessionKey(businessId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveSession(
  businessId: string,
  messages: PersistedSession["messages"],
  conversationState: ConversationState,
) {
  try {
    const session: PersistedSession = {
      messages,
      conversationState,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(sessionKey(businessId), JSON.stringify(session));
  } catch {
    // localStorage may be unavailable — silently ignore
  }
}

function clearSession(businessId: string) {
  try {
    localStorage.removeItem(sessionKey(businessId));
  } catch {}
}

export function useCustomerServiceAgent(businessId: string) {
  const [tickets, setTickets] = useState<CustomerServiceTicket[]>([]);
  const [messages, setMessages] = useState<
    { id: string; role: "user" | "assistant"; content: string; createdAt: string }[]
  >([]);
  const [conversationState, setConversationState] = useState<ConversationState | null>(null);
  const [loading, setLoading] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stateRef = useRef<ConversationState | null>(null);
  stateRef.current = conversationState;

  // Restore session from localStorage on mount
  useEffect(() => {
    if (!businessId) return;
    const saved = loadSession(businessId);
    if (saved) {
      setMessages(saved.messages);
      setConversationState(saved.conversationState);
    }
  }, [businessId]);

  // Load persisted tickets from Supabase on mount
  useEffect(() => {
    if (!businessId) return;
    (async () => {
      try {
        const res = await fetch(`/api/support-tickets?businessId=${businessId}`);
        if (res.ok) {
          const data = await res.json();
          setTickets(data.tickets || []);
        }
      } catch {}
    })();
  }, [businessId]);

  const submitMessage = useCallback(
    async (customerMessage: string) => {
      if (!businessId || !customerMessage.trim()) return null;

      setLoading(true);
      setError(null);
      const createdAt = new Date().toISOString();

      const newUserMsg = {
        id: `u-${Date.now()}`,
        role: "user" as const,
        content: customerMessage.trim(),
        createdAt,
      };
      setMessages((prev) => {
        const next = [...prev, newUserMsg];
        return next;
      });

      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        const response = await fetch("/api/agents/customer-service", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({
            businessId,
            customerMessage,
            conversationState: stateRef.current,
          }),
        });

        const json = (await response.json()) as { error?: string } & Partial<CustomerServiceRunResult>;
        if (!response.ok || json.error || !json.aiReply || !json.conversationState) {
          throw new Error(json.error || "Failed to run customer service agent.");
        }

        const newAssistantMsg = {
          id: `a-${Date.now()}`,
          role: "assistant" as const,
          content: json.aiReply,
          createdAt: new Date().toISOString(),
        };

        setMessages((prev) => {
          const next = [...prev, newAssistantMsg];
          // Persist to localStorage after every turn
          saveSession(businessId, next, json.conversationState!);
          return next;
        });

        setConversationState(json.conversationState);

        if (json.ticketCreated && json.ticket) {
          setTickets((prev) => [json.ticket!, ...prev]);
        }

        return json as CustomerServiceRunResult;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown customer service error.";
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [businessId],
  );

  // Save the pending ticket and end the session
  const finalizeSession = useCallback(async () => {
    const state = stateRef.current;
    if (!state?.pendingTicket) return null;

    setFinalizing(true);
    setError(null);

    try {
      const res = await fetch("/api/agents/customer-service/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, pendingTicket: state.pendingTicket }),
      });

      const json = await res.json() as { error?: string; ticketId?: string; status?: string };
      if (!res.ok || json.error) throw new Error(json.error || "Failed to finalize ticket.");

      // Add finalized ticket to local queue
      const pending = state.pendingTicket;
      const newTicket: CustomerServiceTicket = {
        id: json.ticketId || `${Date.now()}`,
        dbId: json.ticketId,
        printifyOrderRef: pending.orderId ?? null,
        customerMessage: pending.customerIssue,
        tier: pending.tier,
        confidence: 1,
        issueType: pending.issueType,
        classification: pending.classification,
        status: json.status as CustomerServiceTicket["status"] ?? "open",
        aiReply: pending.agentReply,
        actionType: pending.actionType,
        actionSummary: pending.actionSummary,
        ticketSummary: null,
        messages: [
          { role: "customer", content: pending.customerIssue, timestamp: new Date().toISOString() },
          { role: "agent", content: pending.agentReply, actionType: pending.actionType, actionSummary: pending.actionSummary ?? undefined, timestamp: new Date().toISOString() },
        ],
        createdAt: new Date().toISOString(),
        resolvedAt: null,
      };
      setTickets((prev) => [newTicket, ...prev]);

      // Clear session — conversation is done
      clearSession(businessId);
      setMessages([]);
      setConversationState(null);

      return json.ticketId ?? null;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to finalize.";
      setError(message);
      return null;
    } finally {
      setFinalizing(false);
    }
  }, [businessId]);

  const resolveEscalated = useCallback(async (ticketId: string, managerResolution: string) => {
    if (!managerResolution.trim()) return;
    try {
      await fetch("/api/support-tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ticketId, resolutionMessage: managerResolution }),
      });
    } catch {}
    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId || t.dbId === ticketId
          ? { ...t, status: "manager_resolved", aiReply: managerResolution, resolvedAt: new Date().toISOString() }
          : t,
      ),
    );
  }, []);

  const resetConversation = useCallback(() => {
    clearSession(businessId);
    setConversationState(null);
    setMessages([]);
    setError(null);
  }, [businessId]);

  return {
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
  };
}
