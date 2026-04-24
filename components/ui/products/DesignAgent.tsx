"use client";

import React, { useState, useRef, useEffect } from "react";
import { HiOutlineRefresh } from "react-icons/hi";
import { IoSparkles } from "react-icons/io5";
import { RiSendPlaneFill } from "react-icons/ri";
import { MdCheckCircle, MdSwapHoriz } from "react-icons/md";

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

interface ProductSuggestion {
  id: string;
  title: string;
  description?: string;
  printProvider?: string;
  image?: string;
}

interface FieldSuggestion {
  fieldName: string;
  type: string;
  label?: string;
  value: string | number | string[];
  options?: string[];
  placeholder?: string;
}

interface DesignAgentProps {
  businessId: string;
  productId: string;
  businessName?: string;
  businessNiche?: string;
  productTitle?: string;
  productDescription?: string;
  productStatus?: string;
  onProductSelect?: (productId: string, productType: string) => void;
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
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [selectedProduct, setSelectedProduct] =
    useState<ProductSuggestion | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isDraft = productStatus === "draft";

  useEffect(() => {
    const key = STORAGE_KEY(businessId, productId);
    const storedMessages = localStorage.getItem(key);
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
  }, [businessId, productId]);

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

  const initializeMessages = () => {
    const msg = isDraft
      ? "Hi! I'm your Design Agent. Let's create your product! Describe what you'd like to make and I'll suggest product types from our Printify partners. What kind of product are you thinking?"
      : "Hi! I'm your Design Agent. I can help you refine your product design, suggest field values, or answer any questions. What would you like to work on?";

    setMessages([{ role: "assistant", content: msg }]);
  };

  const handleSelectProduct = async (product: ProductSuggestion) => {
    setSelectedProduct(product);
    onProductSelect?.(product.id, product.title);

    try {
      setIsLoading(true);
      const response = await fetch(`/api/printify/blueprints/${product.id}`);
      const data = (await response.json()) as {
        success: boolean;
        attributes?: Record<string, unknown>;
      };

      if (data.success && data.attributes) {
        Object.entries(data.attributes).forEach(([key, attr]) => {
          onFieldUpdate?.(key, attr);
        });

        const msg: ChatMessage = {
          role: "assistant",
          content: `Great choice! I've loaded the ${product.title} attributes onto the canvas. You can fill them in manually, or describe what you want and I'll auto-fill the values for you. What would you like to work on?`,
        };
        setMessages((prev) => [...prev, msg]);
      }
    } catch (error) {
      console.error("Error fetching product attributes:", error);
      const msg: ChatMessage = {
        role: "assistant",
        content: `I selected ${product.title} but had trouble loading its attributes. You can still add fields manually. Want to try again or proceed manually?`,
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
          suggestions?: ProductSuggestion[];
          recommendedProducts?: ProductSuggestion[];
          designGuidance?: string;
          fieldSuggestions?: FieldSuggestion[];
        };
      };

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);

      if (data.fieldSuggestions && data.fieldSuggestions.length > 0) {
        data.fieldSuggestions.forEach((suggestion) => {
          onFieldUpdate?.(suggestion.fieldName, {
            type: suggestion.type,
            label: suggestion.label || suggestion.fieldName,
            value: suggestion.value,
            options: suggestion.options,
            placeholder: suggestion.placeholder,
          });
        });
      }

      if (isDraft && !suggestions.length && !selectedProduct) {
        try {
          const prodResponse = await fetch(`/api/printify/products`);
          const prodData = (await prodResponse.json()) as {
            success: boolean;
            products?: ProductSuggestion[];
          };
          if (prodData.success && prodData.products) {
            setSuggestions(prodData.products);
          }
        } catch (error) {
          console.error("Error fetching product suggestions:", error);
        }
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
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="px-3.5 py-2.5 rounded-xl rounded-bl-sm text-xs bg-neutral-900 text-neutral-500">
              <span className="inline-flex gap-1">
                <span className="animate-bounce [animation-delay:0ms]">·</span>
                <span className="animate-bounce [animation-delay:150ms]">·</span>
                <span className="animate-bounce [animation-delay:300ms]">·</span>
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Product Suggestions ─────────────────────────────── */}
      {isDraft && suggestions.length > 0 && !selectedProduct && (
        <div className="mx-5 mb-3 rounded-lg border border-neutral-900 overflow-hidden flex-shrink-0">
          <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider px-3 pt-2.5 pb-1.5">
            Available Product Types
          </p>
          <div className="flex flex-col max-h-32 overflow-y-auto">
            {suggestions.map((product) => (
              <button
                key={product.id}
                onClick={() => handleSelectProduct(product)}
                disabled={isLoading}
                title={product.description}
                className="text-left px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-900 hover:text-primary-400 transition-colors disabled:opacity-50 truncate border-t border-neutral-900 first:border-t-0"
              >
                {product.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Selected Product Banner ─────────────────────────── */}
      {selectedProduct && (
        <div className="mx-5 mb-3 rounded-lg border border-primary-700 bg-primary-900/20 p-3 flex-shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <MdCheckCircle className="text-primary-500 text-sm flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] text-primary-400 font-semibold uppercase tracking-wider">
                  Product Type Selected
                </p>
                <p className="text-xs font-medium text-light mt-0.5">
                  {selectedProduct.title}
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedProduct(null)}
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
              isDraft && !selectedProduct
                ? "What kind of product? (e.g., 'hoodie with logo')"
                : "Describe what you want or ask for suggestions..."
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
      {isDraft && selectedProduct && onConfirm && (
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
