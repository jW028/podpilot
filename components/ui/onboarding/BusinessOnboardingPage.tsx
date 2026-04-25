"use client";

import Button from "@/components/ui/shared/Button";
import MarkdownText from "@/components/ui/shared/MarkdownText";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";

interface BusinessOnboardingPageProps {
  businessId: string;
}

interface BusinessFramework {
  niche: string;
  theme: string;
  vibeKeywords: string[];
  brandVoice: string;
  targetAudience: string;
  productLane: string;
  valueProposition: string;
  malaysiaTrendNote: string;
  risks: string[];
  next30Days: string[];
}

interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
}

const hasProceedIntent = (message: string) => {
  const normalized = message.toLowerCase().trim();
  const positiveSignals = [
    "proceed",
    "go ahead",
    "continue",
    "sounds good",
    "yes",
    "confirm",
    "i'm confident",
    "im confident",
    "move forward",
    "let's do it",
  ];

  const negativeSignals = ["not sure", "wait", "revise", "change this"];
  const hasNegative = negativeSignals.some((signal) =>
    normalized.includes(signal),
  );

  if (hasNegative) {
    return false;
  }

  return positiveSignals.some((signal) => normalized.includes(signal));
};

const randomId = () => Math.random().toString(36).slice(2, 10);

const styles = {
  container: "max-w-4xl mx-auto p-8",
  heading: "font-serif text-3xl font-bold text-light-primary mb-2",
  subtext: "text-neutral-500 text-sm mb-8",
  panel: "bg-white border border-neutral-300 rounded-xl overflow-hidden",
  panelHeader: "bg-dark text-light px-6 py-4 flex items-center justify-between",
  panelTitle: "font-semibold",
  panelSub: "text-xs text-neutral-300 mt-1",
  chatBody: "p-5 space-y-4 max-h-[65vh] overflow-y-auto bg-light-secondary",
  messageRow: "flex items-start gap-3",
  avatar:
    "h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold",
  aiAvatar: "bg-dark text-light",
  userAvatar: "bg-primary-500 text-light",
  bubble: "rounded-xl px-4 py-3 text-sm leading-relaxed",
  aiBubble: "bg-neutral-100 text-dark max-w-[85%]",
  userBubble: "bg-dark text-light max-w-[80%] ml-auto whitespace-pre-wrap",
  frameworkCard: "bg-white border border-primary-300 rounded-xl p-4",
  frameworkTitle:
    "text-xs uppercase tracking-wide text-primary-700 font-semibold",
  chatFooter: "p-4 border-t border-neutral-300 bg-white",
  textarea:
    "w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-light-primary bg-light min-h-24",
  alertError:
    "mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm",
  alertSuccess:
    "mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm",
};

const BusinessOnboardingPage = ({
  businessId,
}: BusinessOnboardingPageProps) => {
  const router = useRouter();
  const { user, session } = useAuth();

  const [framework, setFramework] = useState<BusinessFramework | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: randomId(),
      role: "assistant",
      content:
        "I am your Business Genesis Agent. Tell me your business idea, desired vibe, target audience, and product direction. I will help you shape a clear business direction before we hand off to design.",
    },
  ]);
  const [draftMessage, setDraftMessage] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom whenever messages update or thinking state changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  const simplifiedMessages = useMemo(
    () => messages.map(({ role, content }) => ({ role, content })),
    [messages],
  );

  const pushAssistantMessage = (content: string) => {
    setMessages((previous) => [
      ...previous,
      {
        id: randomId(),
        role: "assistant",
        content,
      },
    ]);
  };

  const submitConfirmation = async (confirmationMessage: string) => {
    setError("");
    setSuccess("");

    if (!user || !session?.access_token) {
      setError("Please sign in again before confirming this onboarding step.");
      return;
    }

    if (!framework) {
      setError("Please continue chatting until the framework is ready.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/business/onboarding/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          businessId,
          input: {
            businessName: framework.theme,
            vibe: framework.vibeKeywords.join(", "),
            targetAudience: framework.targetAudience,
            purpose: framework.valueProposition,
            productDirection: framework.productLane,
            confidence: 8,
          },
          framework,
          confirmationMessage,
        }),
      });

      const result = (await response.json()) as {
        success: boolean;
        message: string;
        redirectTo?: string;
      };

      if (!response.ok || !result.success) {
        setError(
          result.message || "Could not confirm the business direction yet.",
        );
        return;
      }

      setSuccess("Business direction confirmed. Redirecting to workflow...");
      router.push(result.redirectTo || `/business/${businessId}/workflow`);
    } catch (submitError) {
      console.error(submitError);
      setError("Failed to save your onboarding result.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendMessage = async () => {
    setError("");
    setSuccess("");

    const trimmed = draftMessage.trim();
    if (!trimmed) {
      return;
    }

    const userMessage: ChatMessage = {
      id: randomId(),
      role: "user",
      content: trimmed,
    };

    setMessages((previous) => [...previous, userMessage]);
    setDraftMessage("");
    setIsThinking(true);

    try {
      const response = await fetch("/api/business/onboarding/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId,
          messages: [...simplifiedMessages, { role: "user", content: trimmed }],
          framework,
        }),
      });

      const result = (await response.json()) as {
        success: boolean;
        message?: string;
        data?: {
          reply: string;
          frameworkReady: boolean;
          framework?: BusinessFramework;
        };
      };

      if (!response.ok || !result.success || !result.data) {
        setError(result.message || "Could not continue the conversation.");
        return;
      }

      pushAssistantMessage(result.data.reply);

      const latestFramework =
        result.data.framework && result.data.frameworkReady
          ? result.data.framework
          : framework;

      if (result.data.framework && result.data.frameworkReady) {
        setFramework(result.data.framework);
      }

      if (latestFramework && hasProceedIntent(trimmed)) {
        await submitConfirmation(trimmed);
      }
    } catch (chatError) {
      console.error(chatError);
      setError("Conversation failed. Please try again.");
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <section className={styles.container}>
      <div className="mb-8">
        <h1 className={styles.heading}>Business Onboarding</h1>
        <p className={styles.subtext}>
          Chat with Business Genesis Agent to confirm the business feeling,
          theme, vibe, and direction before moving to workflow.
        </p>
      </div>

      {error && <div className={styles.alertError}>{error}</div>}
      {success && <div className={styles.alertSuccess}>{success}</div>}

      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.panelTitle}>Business Genesis Agent</p>
            <p className={styles.panelSub}>Building your brand identity</p>
          </div>
          <p className="text-xs text-primary-300">
            {isThinking ? "Thinking..." : "Connected"}
          </p>
        </div>

        <div className={styles.chatBody}>
          {messages.map((message) => (
            <div
              key={message.id}
              className={`${styles.messageRow} ${
                message.role === "user" ? "justify-end" : ""
              }`}
            >
              {message.role === "assistant" && (
                <div className={`${styles.avatar} ${styles.aiAvatar}`}>AI</div>
              )}
              <div
                className={`${styles.bubble} ${
                  message.role === "assistant"
                    ? styles.aiBubble
                    : styles.userBubble
                }`}
              >
                {message.role === "assistant" ? (
                  <MarkdownText content={message.content} />
                ) : (
                  message.content
                )}
              </div>
              {message.role === "user" && (
                <div className={`${styles.avatar} ${styles.userAvatar}`}>
                  You
                </div>
              )}
            </div>
          ))}

          {framework && (
            <div className={styles.frameworkCard}>
              <p className={styles.frameworkTitle}>
                Confirmed Business Direction
              </p>
              <div className="mt-3 text-sm text-neutral-700 space-y-2">
                <p>
                  <span className="font-semibold text-dark">Theme:</span>{" "}
                  {framework.theme}
                </p>
                <p>
                  <span className="font-semibold text-dark">Niche:</span>{" "}
                  {framework.niche}
                </p>
                <p>
                  <span className="font-semibold text-dark">Audience:</span>{" "}
                  {framework.targetAudience}
                </p>
                <p>
                  <span className="font-semibold text-dark">Product Lane:</span>{" "}
                  {framework.productLane}
                </p>
                <p>
                  <span className="font-semibold text-dark">Vibe:</span>{" "}
                  {framework.vibeKeywords.join(", ")}
                </p>
                <p>
                  <span className="font-semibold text-dark">
                    Malaysia Trend:
                  </span>{" "}
                  {framework.malaysiaTrendNote}
                </p>
                <div className="pt-2 flex flex-wrap gap-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      submitConfirmation(
                        "Yes, proceed with this business direction",
                      )
                    }
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Confirming..." : "Confirm and Continue"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {isThinking && (
            <div className="text-xs text-primary-700 border border-primary-300 rounded-lg px-3 py-2 bg-primary-50 inline-block">
              Brainstorming ideas...
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={bottomRef} />
        </div>

        <div className={styles.chatFooter}>
          <div className="flex gap-3 items-end">
            <textarea
              className={styles.textarea}
              placeholder="Reply to Genesis Agent..."
              value={draftMessage}
              onChange={(event) => setDraftMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (!isThinking && draftMessage.trim()) {
                    void handleSendMessage();
                  }
                }
              }}
            />
            <Button
              variant="primary"
              size="sm"
              onClick={handleSendMessage}
              disabled={isThinking || !draftMessage.trim()}
            >
              Send
            </Button>
          </div>
          {/* <p className="text-xs text-neutral-500 mt-2">
            Tip: once the direction looks good, reply naturally with
            confirmation intent, for example &quot;yes, proceed with this
            business direction&quot;.
          </p> */}
        </div>
      </div>
    </section>
  );
};

export default BusinessOnboardingPage;
