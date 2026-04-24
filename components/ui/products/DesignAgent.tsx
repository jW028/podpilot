"use client";

import React, { useState, useRef, useEffect } from "react";

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

      // Auto-fill field suggestions from AI
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

      // Fetch Printify products on first message in draft mode
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
    <div className="w-full h-full bg-dark border-l border-neutral-300 p-6 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-xl font-bold text-light">
          Design Agent
        </h2>
        <button
          onClick={handleClearChat}
          className="text-xs text-neutral-400 hover:text-neutral-300 transition-colors"
          title="Clear chat history"
        >
          🔄
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-3 flex flex-col">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                msg.role === "user"
                  ? "bg-primary-500 text-light"
                  : "bg-neutral-700 text-light-muted"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="px-3 py-2 rounded-lg text-sm bg-neutral-700 text-light-muted">
              Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Product Suggestions (draft mode, no product selected yet) */}
      {isDraft && suggestions.length > 0 && !selectedProduct && (
        <div className="mb-4 pb-4 border-b border-neutral-600">
          <p className="text-xs font-semibold text-light-muted mb-2">
            Available Product Types:
          </p>
          <div className="flex flex-col gap-2 max-h-32 overflow-y-auto">
            {suggestions.map((product) => (
              <button
                key={product.id}
                onClick={() => handleSelectProduct(product)}
                disabled={isLoading}
                className="text-left px-3 py-2 bg-neutral-700 hover:bg-primary-500 rounded text-xs text-light transition-colors disabled:opacity-50 truncate"
                title={product.description}
              >
                {product.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected Product Info */}
      {selectedProduct && (
        <div className="mb-4 pb-4 border-b border-neutral-600 bg-green-900 bg-opacity-30 rounded p-3">
          <p className="text-xs font-semibold text-green-300 mb-1">
            ✓ Product Type Selected:
          </p>
          <p className="text-sm font-medium text-light">
            {selectedProduct.title}
          </p>
          <button
            onClick={() => {
              setSelectedProduct(null);
            }}
            className="text-xs text-neutral-400 hover:text-neutral-300 mt-2 underline"
          >
            Change selection
          </button>
        </div>
      )}

      {/* Chat Input */}
      <div className="flex gap-2">
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
          className="flex-1 px-3 py-2 bg-neutral-700 border border-neutral-600 rounded text-light placeholder-neutral-400 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
          disabled={isLoading}
          autoFocus
        />
        <button
          onClick={handleSendMessage}
          disabled={isLoading || !input.trim()}
          className="px-3 py-2 bg-primary-500 text-light rounded text-xs font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors"
        >
          {isLoading ? "..." : "Send"}
        </button>
      </div>

      {/* Confirm Button (draft with product selected) */}
      {isDraft && selectedProduct && onConfirm && (
        <div className="mt-4 pt-4 border-t border-neutral-600">
          <button
            className="w-full px-4 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700 transition-colors text-sm disabled:opacity-50"
            onClick={handleConfirm}
            disabled={isConfirming || isLoading}
          >
            {isConfirming ? "Confirming..." : "✓ Confirm & Mark Ready"}
          </button>
          <p className="text-xs text-neutral-500 mt-2 text-center">
            This will save the product and set its status to ready for launch.
          </p>
        </div>
      )}
    </div>
  );
};

export default DesignAgent;
