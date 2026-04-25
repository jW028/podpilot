import type { ClassificationType, TicketSummary, CollectedDetails, ConversationState } from "@/types/customerService";

interface ClassificationPattern {
  type: ClassificationType;
  patterns: RegExp[];
  keywords: string[];
  confidence: number;
}

interface MissingDetails {
  orderNumber: boolean;
  trackingNumber: boolean;
  description: string[];
}

const CLASSIFICATION_PATTERNS: ClassificationPattern[] = [
  {
    type: "company_follow_up_refund",
    patterns: [
      /\b(refund|money\s+back|reimburse|return\s+money|get\s+money)\b/i,
      /\b(i want|i need|can i get|please give|i'd like)\s+(my\s+)?(money|refund)/i,
    ],
    keywords: ["refund", "money back", "reimburse", "return money"],
    confidence: 0.95,
  },
  {
    type: "company_follow_up_resend",
    patterns: [
      /\b(resend|send\s+again|send\s+another|re-ship|ship\s+again)\b/i,
      /\b(can you|please|i need|send me)\s+(another|a new|the)\s+(one|package|item)/i,
    ],
    keywords: ["resend", "send again", "re-ship", "ship again"],
    confidence: 0.92,
  },
  {
    type: "company_follow_up_missing",
    patterns: [
      /\b(never\s+arrived|didn't\s+arrive|did not arrive|missing|didn't\s+receive|did not receive|not\s+received)\b/i,
      /\b(where is|where's|track|still not here|haven't received|not received)\b/i,
      /\b(lost\s+package|package\s+lost|lost\s+parcel|parcel\s+lost)\b/i,
    ],
    keywords: [
      "never arrived",
      "didn't arrive",
      "missing",
      "lost package",
      "not received",
      "lost parcel",
    ],
    confidence: 0.93,
  },
  {
    type: "company_follow_up_damaged",
    patterns: [
      /\b(damaged|broken|cracked|defective|not\s+working|doesn't\s+work|does not work)\b/i,
      /\b(arrived\s+damaged|came\s+damaged|received\s+damaged|damaged\s+on\s+arrival)\b/i,
    ],
    keywords: ["damaged", "broken", "cracked", "defective", "not working"],
    confidence: 0.91,
  },
  {
    type: "company_follow_up_replacement",
    patterns: [
      /\b(replace|replacement|swap|exchange|get\s+another)\b/i,
      /\b(can i|can you|please|i need)\s+(get|have|swap|exchange)\s+(a\s+)?(replacement|new one|different one)/i,
    ],
    keywords: ["replace", "replacement", "swap", "exchange"],
    confidence: 0.90,
  },
  {
    type: "company_follow_up_tracking",
    patterns: [
      /\b(track|tracking|where\s+is|where's|status|update)\b/i,
      /\b(where is (my|the)\s+(order|package|parcel)|can i track|track my)\b/i,
    ],
    keywords: ["track", "tracking", "where is", "status"],
    confidence: 0.88,
  },
  {
    type: "legal_risk",
    patterns: [
      /\b(sue|lawsuit|legal|fraud|chargeback|dispute|police)\b/i,
      /\b(report|report.*police|going.*court|taking.*legal)\b/i,
    ],
    keywords: ["sue", "lawsuit", "legal", "fraud", "chargeback"],
    confidence: 0.96,
  },
];

export function extractDetailsFromMessage(message: string): CollectedDetails {
  const result: CollectedDetails = {};

  // Printify app_order_id format: #27277753.1 or 27277753.1 (shopId.sequence)
  const appOrderMatch = message.match(/#?(\d{6,10}\.\d+)/);
  if (appOrderMatch) {
    result.orderNumber = appOrderMatch[1];
  } else {
    // ORD-[hex24] e.g. ORD-69ec4b722466999ddf001590 (Printify internal hex ID)
    const ordHexMatch = message.match(/\b(ORD-[0-9a-f]{20,})\b/i);
    if (ordHexMatch) {
      result.orderNumber = ordHexMatch[1].toUpperCase();
    } else {
      // Plain Printify hex ID without prefix (24 lowercase hex chars)
      const hexMatch = message.match(/\b([0-9a-f]{24})\b/i);
      if (hexMatch) {
        result.orderNumber = `ORD-${hexMatch[1].toLowerCase()}`;
      } else {
        // ORD-#### or plain numeric
        const orderMatch =
          message.match(/(?:order\s*(?:#|number|id|no\.?|#?\s*:?))\s*[:#]?\s*(ORD-\d+|\d{3,12})/i) ||
          message.match(/\b(ORD-\d+)\b/i) ||
          message.match(/#(\d{4,12})/) ||
          message.match(/\b(\d{5,12})\b/);
        if (orderMatch) {
          const raw = orderMatch[1].toUpperCase();
          result.orderNumber = raw.startsWith("ORD-") ? raw : `ORD-${raw}`;
        }
      }
    }
  }

  const trackingMatch =
    message.match(/(?:tracking\s*(?:#|number|id|code|no\.?|#?\s*:?))\s*:?-?\s*([A-Z0-9]{6,})/i) ||
    message.match(/(?:trk-?)([A-Z0-9]{6,})/i) ||
    message.match(/(?:my\s+tracking\s+(?:is|was|:\s*))([A-Z0-9]{6,})/i) ||
    message.match(/\b(1Z[A-Z0-9]{6,})\b/i);
  if (trackingMatch) {
    result.trackingNumber = trackingMatch[1].toUpperCase();
  }

  const amountMatch = message.match(
    /(?:RM|rm|\$)\s*(\d+(?:\.\d{2})?)|(\d+(?:\.\d{2})?)\s*(?:dollars|usd|ringgit)/i,
  );
  if (amountMatch) {
    result.refundAmount = parseFloat(amountMatch[1] || amountMatch[2]);
  }

  const itemMatch = message.match(
    /(?:item|product|got|received|for)\s+(?:the\s+)?([a-z\s]+?)(?:\.|,|and|\?|$)/i,
  );
  if (itemMatch) {
    result.itemDescription = itemMatch[1].trim();
  }

  return result;
}

export function extractDetailsIncremental(
  message: string,
  existing: CollectedDetails,
): CollectedDetails {
  const newlyExtracted = extractDetailsFromMessage(message);
  return {
    ...existing,
    orderNumber: newlyExtracted.orderNumber ?? existing.orderNumber,
    trackingNumber: newlyExtracted.trackingNumber ?? existing.trackingNumber,
    refundAmount: newlyExtracted.refundAmount ?? existing.refundAmount,
    itemDescription: newlyExtracted.itemDescription ?? existing.itemDescription,
  };
}

export function classifyMessageWithPatterns(message: string): {
  classification: ClassificationType;
  confidence: number;
  extractedDetails: CollectedDetails;
} {
  const normalizedMessage = message.toLowerCase().trim();
  let bestMatch: ClassificationPattern | null = null;
  let bestScore = 0;

  for (const pattern of CLASSIFICATION_PATTERNS) {
    let patternScore = 0;

    for (const regex of pattern.patterns) {
      if (regex.test(normalizedMessage)) {
        patternScore = Math.max(patternScore, 1.0);
        break;
      }
    }

    if (patternScore === 0) {
      for (const keyword of pattern.keywords) {
        if (normalizedMessage.includes(keyword)) {
          patternScore = 0.7;
          break;
        }
      }
    }

    if (patternScore > bestScore) {
      bestScore = patternScore;
      bestMatch = pattern;
    }
  }

  const extractedDetails = extractDetailsFromMessage(message);

  if (bestMatch && bestScore > 0) {
    const finalConfidence = bestMatch.confidence * bestScore;
    if (finalConfidence < 0.5) {
      return {
        classification: "none",
        confidence: finalConfidence,
        extractedDetails,
      };
    }
    return {
      classification: bestMatch.type,
      confidence: finalConfidence,
      extractedDetails,
    };
  }

  return {
    classification: "none",
    confidence: 0,
    extractedDetails,
  };
}

export function generateTicketSummary(
  message: string,
  classification: ClassificationType,
): TicketSummary {
  const extractedDetails = extractDetailsFromMessage(message);

  let reason = classification.replace(/company_follow_up_/, "");

  // order number extraction is now handled by extractDetailsFromMessage

  const parts: string[] = [];
  parts.push(`Classification: ${classification.replace(/_/g, " ")}`);
  parts.push(`Customer Issue: ${message.substring(0, 100)}${message.length > 100 ? "..." : ""}`);

  if (extractedDetails.orderNumber) parts.push(`Order Number: ${extractedDetails.orderNumber}`);
  if (extractedDetails.trackingNumber) parts.push(`Tracking Number: ${extractedDetails.trackingNumber}`);
  if (extractedDetails.refundAmount !== undefined) parts.push(`Refund Amount: RM ${extractedDetails.refundAmount.toFixed(2)}`);
  if (extractedDetails.itemDescription) parts.push(`Item: ${extractedDetails.itemDescription}`);

  return {
    classification,
    extractedDetails: {
      ...extractedDetails,
      reason,
    },
    conversationSummary: parts.join("\n"),
  };
}

export function checkMissingDetails(
  state: ConversationState,
): MissingDetails {
  const hasOrderNumber = !!state.collectedDetails.orderNumber;

  const missing: MissingDetails = {
    orderNumber: !hasOrderNumber,
    trackingNumber: false,
    description: [],
  };

  if (state.classification.includes("company_follow_up") || state.classification === "legal_risk") {
    if (!hasOrderNumber) {
      missing.description.push("order ID");
    }
  }

  return missing;
}

export function generateMissingDetailsPrompt(missing: MissingDetails): string {
  if (missing.description.length === 0) {
    return "";
  }

  const items = missing.description.join(" and ");
  return `To help you further, could you please provide your ${items}? This will help me look up your order and resolve the issue.`;
}

export function hasRequiredDetails(state: ConversationState): boolean {
  if (state.classification.includes("company_follow_up") || state.classification === "legal_risk") {
    return !!state.collectedDetails.orderNumber;
  }
  return true;
}

export function isConfirmation(message: string): boolean {
  const m = message.toLowerCase().trim();
  return (
    m === "yes" ||
    m === "yeah" ||
    m === "yep" ||
    m === "sure" ||
    m === "ok" ||
    m === "okay" ||
    m === "go ahead" ||
    m === "please" ||
    m === "do it" ||
    m === "confirm" ||
    m === "confirmed" ||
    m.startsWith("yes") ||
    m.startsWith("please go")
  );
}

export function isDenial(message: string): boolean {
  const m = message.toLowerCase().trim();
  if (m === "no" || m === "nope" || m === "nah" || m === "cancel" || m === "stop") return true;
  if (m === "don't" || m === "dont" || m === "no thanks" || m === "not interested") return true;
  if (/^(no,?\s+i\s+don't|no,?\s+please\s+don't|no,?\s+don't)/i.test(m)) return true;
  if (/^(i\s+don't\s+want|i\s+refuse|i\s+decline)/i.test(m)) return true;
  return false;
}
