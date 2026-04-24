"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import type { CustomerServiceRunResult, CustomerServiceTicket, ConversationState } from "@/types/customerService";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export function useCustomerServiceAgent(businessId: string) {
  const [tickets, setTickets] = useState<CustomerServiceTicket[]>([]);
  const [messages, setMessages] = useState<
    { id: string; role: "user" | "assistant"; content: string; createdAt: string }[]
  >([]);
  const [conversationState, setConversationState] = useState<ConversationState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stateRef = useRef<ConversationState | null>(null);
  stateRef.current = conversationState;

  // Load existing tickets from Supabase on mount
  useEffect(() => {
    if (!businessId) return;

    (async () => {
      try {
        const res = await fetch(`/api/support-tickets?businessId=${businessId}`);
        if (res.ok) {
          const data = await res.json();
          setTickets(data.tickets || []);
        }
      } catch {
        // Silently fail — tickets will just be empty
      }
    })();
  }, [businessId]);

  const submitMessage = useCallback(
    async (customerMessage: string) => {
      if (!businessId || !customerMessage.trim()) return null;

      setLoading(true);
      setError(null);
      const createdAt = new Date().toISOString();
      setMessages((prev) => [
        ...prev,
        {
          id: `u-${Date.now()}`,
          role: "user",
          content: customerMessage.trim(),
          createdAt,
        },
      ]);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const currentState = stateRef.current;

        const response = await fetch("/api/agents/customer-service", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : {}),
          },
          body: JSON.stringify({
            businessId,
            customerMessage,
            conversationState: currentState,
          }),
        });

        const json = (await response.json()) as { error?: string } & Partial<CustomerServiceRunResult>;
        if (!response.ok || json.error || !json.aiReply || !json.conversationState) {
          throw new Error(json.error || "Failed to run customer service agent.");
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: json.aiReply!,
            createdAt: new Date().toISOString(),
          },
        ]);

        setConversationState(json.conversationState);

        if (json.ticketCreated && json.ticket) {
          setTickets((prev) => [json.ticket!, ...prev]);
        }

        return json as CustomerServiceRunResult;
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Unknown customer service error.";
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [businessId],
  );

  const resolveEscalated = useCallback(async (ticketId: string, managerResolution: string) => {
    if (!managerResolution.trim()) return;

    try {
      await fetch("/api/support-tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: ticketId,
          resolutionMessage: managerResolution,
        }),
      });
    } catch {
      // Still update local state even if API call fails
    }

    setTickets((prev) =>
      prev.map((ticket) =>
        ticket.id === ticketId || ticket.dbId === ticketId
          ? {
              ...ticket,
              status: "manager_resolved",
              aiReply: managerResolution,
              resolvedAt: new Date().toISOString(),
            }
          : ticket,
      ),
    );
  }, []);

  const resetConversation = useCallback(() => {
    setConversationState(null);
    setMessages([]);
  }, []);

  return {
    messages,
    tickets,
    conversationState,
    loading,
    error,
    submitMessage,
    resolveEscalated,
    resetConversation,
  };
}
