"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { HiOutlineRefresh } from "react-icons/hi";
import { IoSparkles } from "react-icons/io5";
import { RiSendPlaneFill } from "react-icons/ri";
import { MdCheckCircle, MdSwapHoriz, MdTrendingUp } from "react-icons/md";

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

interface BlueprintSuggestion {
  id: string;
  title: string;
  description?: string;
  brand?: string;
  image?: string;
}

interface FieldSuggestion {
  fieldName: string;
  type: string;
  label?: string;
  value: string | number | string[];
  options?: string[];
  placeholder?: string;
  locked?: boolean;
}

interface DesignAgentProps {
  businessId: string;
  productId: string;
  businessName?: string;
  businessNiche?: string;
  productTitle?: string;
  productDescription?: string;
  productStatus?: string;
  onProductSelect?: (blueprintId: string, productType: string) => void;
  onFieldUpdate?: (fieldName: string, value: unknown) => void;
  onConfirm?: () => Promise<void>;
}

const STORAGE_KEY = (businessId: string, productId: string) =>
  `design-agent-${businessId}-${productId}`;

const DesignAgent = ({
  businessId,
  productId,
  businessName,
  businessNiche,
  productTitle,
  productDescription,
  productStatus,
  onProductSelect,
  onFieldUpdate,
  onConfirm,
}: DesignAgentProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [blueprintSuggestions, setBlueprintSuggestions] = useState<
    BlueprintSuggestion[]
  >([]);
  const [selectedBlueprint, setSelectedBlueprint] =
    useState<BlueprintSuggestion | null>(null);
  const [marketTrends, setMarketTrends] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isDraft = productStatus === "draft";

  const initializeMessages = useCallback(() => {
    const msg = isDraft
      ? `Hi! I'm your Design Agent. I'll help you design your product using current market trends and your brand identity${businessName ? ` for **${businessName}**` : ""}.\n\nDescribe your product idea — even a vague concept works! I'll research trends, analyze your brand, and suggest 3 real product types from Printify.`
      : `Hi! I'm your Design Agent. I can help you refine your product design, suggest field values, or research current market trends. What would you like to work on?`;

    setMessages([{ role: "assistant", content: msg }]);
  }, [isDraft, businessName]);

  useEffect(() => {
    const key = STORAGE_KEY(businessId, productId);
    const storedMessages = localStorage.getItem(key);
    
    const timer = setTimeout(() => {
      if (storedMessages) {
        try {
          setMessages(JSON.parse(storedMessages));
        } catch {
          initializeMessages();
        }
      } else {
        initializeMessages();
      }
      setIsMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [businessId, productId, initializeMessages]);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem(
        STORAGE_KEY(businessId, productId),
        JSON.stringify(messages),
      );
    }
  }, [messages, businessId, productId, isMounted]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSelectBlueprint = async (blueprint: BlueprintSuggestion) => {
    setSelectedBlueprint(blueprint);
    onProductSelect?.(blueprint.id, blueprint.title);

    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/printify/blueprints/${blueprint.id}`,
      );
      const data = (await response.json()) as {
        success: boolean;
        attributes?: Record<string, unknown>;
        productTitle?: string;
      };

      if (data.success && data.attributes) {
        Object.entries(data.attributes).forEach(([key, attr]) => {
          onFieldUpdate?.(key, attr);
        });

        const msg: ChatMessage = {
          role: "assistant",
          content: `Great choice! I've loaded **${blueprint.title}** onto the canvas with its attributes.\n\nThe locked fields (Blueprint ID, Print Provider, Product Type) are fixed for Printify compatibility. You can edit the other fields manually, or describe what you want and I'll auto-fill values for you.\n\nWhat style, colors, or design direction are you thinking?`,
        };
        setMessages((prev) => [...prev, msg]);
      }
    } catch (error) {
      console.error("Error fetching blueprint attributes:", error);
      const msg: ChatMessage = {
        role: "assistant",
        content: `I selected **${blueprint.title}** but had trouble loading its attributes. You can still describe what you want and I'll help fill in the details.`,
      };
      setMessages((prev) => [...prev, msg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !isMounted) return;

    const userMessage: ChatMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/business/${businessId}/products/design`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...messages, userMessage],
            businessContext: { name: businessName, niche: businessNiche },
            productContext: {
              title: productTitle,
              description: productDescription,
            },
            userIdea: input,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to get design guidance");
      }

      const { data } = (await response.json()) as {
        success: boolean;
        data: {
          reply: string;
          blueprintSuggestions?: BlueprintSuggestion[];
          fieldSuggestions?: FieldSuggestion[];
          marketTrends?: string;
        };
      };

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);

      // Handle field suggestions from the agent
      if (data.fieldSuggestions && data.fieldSuggestions.length > 0) {
        data.fieldSuggestions.forEach((suggestion) => {
          onFieldUpdate?.(suggestion.fieldName, {
            type: suggestion.type,
            label: suggestion.label || suggestion.fieldName,
            value: suggestion.value,
            options: suggestion.options,
            placeholder: suggestion.placeholder,
            locked: suggestion.locked || false,
          });
        });
      }

      // Handle blueprint suggestions (3 real Printify product types)
      if (
        data.blueprintSuggestions &&
        data.blueprintSuggestions.length > 0 &&
        !selectedBlueprint
      ) {
        setBlueprintSuggestions(data.blueprintSuggestions);
      }

      // Store market trends
      if (data.marketTrends) {
        setMarketTrends(data.marketTrends);
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        role: "assistant",
        content:
          "Sorry, I encountered an error. " +
          (error instanceof Error ? error.message : "Please try again."),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!onConfirm) return;
    try {
      setIsConfirming(true);
      await onConfirm();
    } catch (error) {
      const msg: ChatMessage = {
        role: "assistant",
        content:
          "Something went wrong confirming the product. Please try again.",
      };
      setMessages((prev) => [...prev, msg]);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleClearChat = () => {
    if (
      confirm(
        "Are you sure you want to clear the chat history? This cannot be undone.",
      )
    ) {
      initializeMessages();
      setBlueprintSuggestions([]);
      setSelectedBlueprint(null);
      setMarketTrends(null);
      localStorage.removeItem(STORAGE_KEY(businessId, productId));
    }
  };

  if (!isMounted) return null;

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-dark">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-900 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-primary-500 flex items-center justify-center">
            <IoSparkles className="text-dark text-sm" />
          </div>
          <h2 className="font-serif text-base font-bold text-light tracking-wide">
            Design Agent
          </h2>
        </div>
        <button
          onClick={handleClearChat}
          title="Clear chat history"
          className="p-1.5 rounded-md text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900 transition-colors"
        >
          <HiOutlineRefresh className="text-base" />
        </button>
      </div>

      {/* ── Market Trends Banner ─────────────────────────────── */}
      {marketTrends && (
        <div className="mx-5 mt-3 rounded-lg border border-neutral-800 bg-neutral-900/50 p-3 flex-shrink-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            <MdTrendingUp className="text-primary-500 text-sm flex-shrink-0" />
            <p className="text-[10px] text-primary-400 font-semibold uppercase tracking-wider">
              Market Trends
            </p>
          </div>
          <p className="text-[11px] text-neutral-400 leading-relaxed line-clamp-3">
            {marketTrends}
          </p>
        </div>
      )}

      {/* ── Messages ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 flex flex-col">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] px-3.5 py-2.5 rounded-xl text-xs leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary-500 text-dark font-medium rounded-br-sm"
                  : "bg-neutral-900 text-neutral-300 rounded-bl-sm"
              }`}
            >
              {msg.content.split("\n").map((line, lineIdx) => (
                <span key={lineIdx}>
                  {line.split(/(\*\*.*?\*\*)/).map((part, partIdx) =>
                    part.startsWith("**") && part.endsWith("**") ? (
                      <strong key={partIdx} className="font-semibold">
                        {part.slice(2, -2)}
                      </strong>
                    ) : (
                      <span key={partIdx}>{part}</span>
                    ),
                  )}
                  {lineIdx < msg.content.split("\n").length - 1 && <br />}
                </span>
              ))}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="px-3.5 py-2.5 rounded-xl rounded-bl-sm text-xs bg-neutral-900 text-neutral-500">
              <span className="inline-flex gap-1">
                <span className="animate-bounce [animation-delay:0ms]">·</span>
                <span className="animate-bounce [animation-delay:150ms]">
                  ·
                </span>
                <span className="animate-bounce [animation-delay:300ms]">
                  ·
                </span>
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Blueprint Suggestions (3 real Printify product types) ── */}
      {isDraft && blueprintSuggestions.length > 0 && !selectedBlueprint && (
        <div className="mx-5 mb-3 rounded-lg border border-neutral-900 overflow-hidden flex-shrink-0">
          <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider px-3 pt-2.5 pb-1.5">
            Suggested Product Types from Printify
          </p>
          <div className="flex flex-col max-h-40 overflow-y-auto">
            {blueprintSuggestions.map((bp) => (
              <button
                key={bp.id}
                onClick={() => handleSelectBlueprint(bp)}
                disabled={isLoading}
                className="text-left px-3 py-2.5 text-xs text-neutral-300 hover:bg-neutral-900 hover:text-primary-400 transition-colors disabled:opacity-50 border-t border-neutral-900 first:border-t-0 group"
              >
                <p className="font-medium truncate group-hover:text-primary-400">
                  {bp.title}
                </p>
                {bp.brand && (
                  <p className="text-[10px] text-neutral-600 mt-0.5">
                    by {bp.brand}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Selected Blueprint Banner ─────────────────────────── */}
      {selectedBlueprint && (
        <div className="mx-5 mb-3 rounded-lg border border-primary-700 bg-primary-900/20 p-3 flex-shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <MdCheckCircle className="text-primary-500 text-sm flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] text-primary-400 font-semibold uppercase tracking-wider">
                  Product Type Selected
                </p>
                <p className="text-xs font-medium text-light mt-0.5">
                  {selectedBlueprint.title}
                </p>
                {selectedBlueprint.brand && (
                  <p className="text-[10px] text-neutral-500 mt-0.5">
                    by {selectedBlueprint.brand}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => setSelectedBlueprint(null)}
              className="flex items-center gap-1 text-[10px] text-neutral-500 hover:text-neutral-300 transition-colors mt-0.5"
            >
              <MdSwapHoriz className="text-sm" />
              Change
            </button>
          </div>
        </div>
      )}

      {/* ── Chat Input ──────────────────────────────────────── */}
      <div className="px-5 pb-4 flex-shrink-0">
        <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 focus-within:border-primary-600 transition-colors">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isLoading) {
                handleSendMessage();
              }
            }}
            placeholder={
              isDraft && !selectedBlueprint
                ? "Describe your product idea (e.g., 'minimalist cat hoodie')..."
                : "Ask for design help or describe what you want..."
            }
            className="flex-1 bg-transparent text-light placeholder-neutral-600 text-xs focus:outline-none disabled:opacity-50"
            disabled={isLoading}
            autoFocus
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !input.trim()}
            className="p-1.5 rounded-lg bg-primary-500 text-dark hover:bg-primary-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            <RiSendPlaneFill className="text-sm" />
          </button>
        </div>
      </div>

      {/* ── Confirm Button ──────────────────────────────────── */}
      {isDraft && selectedBlueprint && onConfirm && (
        <div className="px-5 pb-5 pt-0 flex-shrink-0">
          <button
            className="w-full px-4 py-2.5 bg-primary-500 text-dark rounded-xl font-semibold text-xs hover:bg-primary-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            onClick={handleConfirm}
            disabled={isConfirming || isLoading}
          >
            <IoSparkles className="text-sm" />
            {isConfirming ? "Confirming..." : "Confirm & Mark Ready"}
          </button>
          <p className="text-[10px] text-neutral-600 mt-2 text-center">
            Saves the product and sets status to ready for launch.
          </p>
        </div>
      )}
    </div>
  );
};

export default DesignAgent;
