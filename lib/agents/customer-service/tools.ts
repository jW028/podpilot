import { createClient } from "@supabase/supabase-js";
import { decryptPrintifyToken, normalizePrintifyTokenInput } from "@/lib/printify/credentials";

export interface OrderData {
  orderId: string;       // canonical display ID, e.g. "#27277753.1" or "ORD-12846"
  dbId: string;          // Printify hex ID or Supabase UUID
  shopId: string | null; // Printify shop ID extracted from app_order_id
  productId: string | null; // Printify product ID from line_items
  status: string;
  total: number;
  itemCount: number;
  productTitle: string;
  trackingNumber: string | null;
}

export interface CustomerServiceToolOutput {
  actionType: "none" | "lookup_order" | "process_refund" | "process_resend" | "process_replacement" | "escalate_to_manager";
  actionSummary: string | null;
  contextForReply: string;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ── app_order_id helpers ─────────────────────────────────────────────────────
// Printify's app_order_id format: "27277753.1" (shopId.sequence), shown as "#27277753.1"

function isAppOrderId(id: string): boolean {
  return /^\d{6,10}\.\d+$/.test(id.replace(/^#/, ""));
}

function extractShopIdFromAppOrderId(appOrderId: string): string {
  return appOrderId.replace(/^#/, "").split(".")[0];
}

function normaliseOrderId(raw: string): string {
  const stripped = raw.replace(/^#/, "").trim();
  if (isAppOrderId(stripped)) return stripped; // "27277753.1"
  if (stripped.toUpperCase().startsWith("ORD-")) return stripped.toUpperCase();
  return `ORD-${stripped}`;
}

// ── Printify status → internal status ───────────────────────────────────────
function mapPrintifyStatus(status: string): string {
  switch (status) {
    case "fulfilled":          return "delivered";
    case "partially-fulfilled": return "shipped";
    case "sent-to-production": return "shipped";
    case "cancelled":          return "cancelled";
    default:                   return "pending";
  }
}

// ── Printify response types ──────────────────────────────────────────────────
interface PrintifyLineItem {
  product_id?: string;
  metadata?: { title?: string };
  quantity?: number;
}

interface PrintifyShipment {
  number?: string;
  carrier?: string;
}

interface PrintifyOrderFull {
  id: string;
  app_order_id?: string;
  shop_id?: number;
  label?: string;
  status: string;
  total_price?: number;
  line_items?: PrintifyLineItem[];
  shipments?: PrintifyShipment[];
  metadata?: { shop_order_label?: string };
}

// ── Resolve Printify credentials for a business ──────────────────────────────
async function resolvePrintifyCreds(
  businessId: string,
): Promise<{ shopId: string; token: string } | null> {
  const { data: biz } = await supabase
    .from("businesses")
    .select("printify_shop_id, printify_pat_hint")
    .eq("id", businessId)
    .maybeSingle();

  const shopId =
    (biz?.printify_shop_id as string | null) ??
    process.env.PRINTIFY_SHOP_ID ??
    null;
  if (!shopId) return null;

  const hint = typeof biz?.printify_pat_hint === "string" ? biz.printify_pat_hint : "";
  const decrypted = hint ? decryptPrintifyToken(hint) : null;
  const token = decrypted
    ? normalizePrintifyTokenInput(decrypted)
    : (process.env.PRINTIFY_DEV_TOKEN ?? null);
  if (!token) return null;

  return { shopId, token };
}

// ── Get shop ID from an order ID ────────────────────────────────────────────
// If the order ID is in app_order_id format (#27277753.1), the shop ID is
// directly encoded — no API call needed. Otherwise falls back to the
// business's stored printify_shop_id or the env var.
export async function getShopIdFromOrderId(
  orderId: string,
  businessId: string,
): Promise<string | null> {
  const normalised = normaliseOrderId(orderId);

  // Fast path: shop ID is encoded in the app_order_id itself
  if (isAppOrderId(normalised)) {
    return extractShopIdFromAppOrderId(normalised);
  }

  // Slow path: look up from business record / env
  const creds = await resolvePrintifyCreds(businessId);
  return creds?.shopId ?? null;
}

// ── Get product ID from an order ID (via Printify API) ──────────────────────
// Fetches the Printify order and returns the product_id from the first
// line item. Also returns shop_id and product title as a bonus.
export interface OrderProductInfo {
  shopId: string;
  productId: string;
  productTitle: string;
  variantId: number | null;
  printifyOrderId: string; // Printify internal hex ID
}

export async function getProductIdFromOrderId(
  orderId: string,
  businessId: string,
): Promise<OrderProductInfo | null> {
  const creds = await resolvePrintifyCreds(businessId);
  if (!creds) return null;

  const normalised = normaliseOrderId(orderId);

  // Derive the shop ID — may differ from business's default shop
  let shopId = creds.shopId;
  if (isAppOrderId(normalised)) {
    shopId = extractShopIdFromAppOrderId(normalised);
  }

  const { token } = creds;
  const searchTerm = normalised.replace(/^#/, "").replace(/^ORD-/i, "");

  let order: PrintifyOrderFull | null = null;

  // 1. Try direct fetch by Printify hex ID
  if (/^[0-9a-f]{24}$/.test(searchTerm)) {
    const res = await fetch(
      `https://api.printify.com/v1/shops/${shopId}/orders/${searchTerm}.json`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (res.ok) order = (await res.json()) as PrintifyOrderFull;
  }

  // 2. Search by app_order_id / label
  if (!order) {
    const res = await fetch(
      `https://api.printify.com/v1/shops/${shopId}/orders.json?limit=10&search=${encodeURIComponent(searchTerm)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (res.ok) {
      const json = (await res.json()) as { data?: PrintifyOrderFull[] };
      order = (json.data ?? []).find((o) => {
        const appId = (o.app_order_id ?? "").replace(/^#/, "");
        const label = (o.label ?? "").replace(/^#/, "").replace(/^ORD-/i, "");
        return appId === searchTerm || label === searchTerm || o.id === searchTerm;
      }) ?? null;
    }
  }

  if (!order) return null;

  const firstItem = order.line_items?.[0];
  if (!firstItem?.product_id) return null;

  return {
    shopId: order.shop_id?.toString() ?? shopId,
    productId: firstItem.product_id,
    productTitle: firstItem.metadata?.title ?? "N/A",
    variantId: (firstItem as { variant_id?: number }).variant_id ?? null,
    printifyOrderId: order.id,
  };
}

// ── Map a raw Printify order to OrderData ────────────────────────────────────
function mapPrintifyOrder(o: PrintifyOrderFull): Omit<OrderData, "dbId"> {
  const appOrderId = o.app_order_id ?? o.id;
  const shopId = o.shop_id?.toString() ?? extractShopIdFromAppOrderId(appOrderId);
  const lineItems = o.line_items ?? [];
  const firstItem = lineItems[0];

  return {
    orderId: `#${appOrderId}`,
    shopId,
    productId: firstItem?.product_id ?? null,
    status: mapPrintifyStatus(o.status),
    total: (o.total_price ?? 0) / 100,
    itemCount: lineItems.length || 1,
    productTitle: firstItem?.metadata?.title ?? "N/A",
    trackingNumber: o.shipments?.[0]?.number ?? null,
  };
}

// ── Lookup from Printify API ─────────────────────────────────────────────────
async function lookupOrderFromPrintify(
  rawOrderId: string,
  businessId: string,
): Promise<OrderData | null> {
  const creds = await resolvePrintifyCreds(businessId);
  if (!creds) return null;

  let { shopId, token } = creds;
  const normalised = normaliseOrderId(rawOrderId);

  // If the ID is an app_order_id, the shopId is encoded in it — use that directly
  if (isAppOrderId(normalised)) {
    const embeddedShopId = extractShopIdFromAppOrderId(normalised);
    if (embeddedShopId !== shopId) shopId = embeddedShopId;
  }

  let match: PrintifyOrderFull | null = null;

  // Strip ORD- prefix and lowercase to get the raw search term
  const searchTerm = normalised.replace(/^ORD-/i, "").replace(/^#/, "").toLowerCase();

  // 1. Direct fetch by Printify hex ID (ORD-[hex24] or plain hex24)
  if (/^[0-9a-f]{24}$/.test(searchTerm)) {
    const res = await fetch(
      `https://api.printify.com/v1/shops/${shopId}/orders/${searchTerm}.json`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (res.ok) match = (await res.json()) as PrintifyOrderFull;
  }

  // 2. Search by app_order_id / label / number
  if (!match) {
    const res = await fetch(
      `https://api.printify.com/v1/shops/${shopId}/orders.json?limit=10&search=${encodeURIComponent(searchTerm)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (res.ok) {
      const json = (await res.json()) as { data?: PrintifyOrderFull[] };
      match = (json.data ?? []).find((o) => {
        const appId = (o.app_order_id ?? "").replace(/^#/, "").toLowerCase();
        const label = (o.label ?? "").replace(/^#/, "").replace(/^ORD-/i, "").toLowerCase();
        return (
          appId === searchTerm ||
          label === searchTerm ||
          o.id.toLowerCase() === searchTerm
        );
      }) ?? null;
    }
  }

  if (!match) return null;

  const mapped = mapPrintifyOrder(match);

  // Sync to local orders table for instant future lookups
  await supabase.from("orders").upsert(
    {
      business_id: businessId,
      order_number: mapped.orderId,           // "#27277753.1"
      external_order_id: match.id,
      status: mapped.status,
      total_amount: mapped.total,
      currency: "MYR",
      channel: "printify",
      tracking_number: mapped.trackingNumber,
      line_items: match.line_items ?? [],
      subtotal: mapped.total,
    },
    { onConflict: "order_number,business_id", ignoreDuplicates: false },
  );

  return { ...mapped, dbId: match.id };
}

// ── Main public lookup: local DB first, then Printify ───────────────────────
export async function lookupOrderById(rawOrderId: string, businessId: string): Promise<OrderData> {
  const normalised = normaliseOrderId(rawOrderId);

  // 1. Local Supabase — try order_number and external_order_id
  let { data: row, error } = await supabase
    .from("orders")
    .select("*")
    .eq("business_id", businessId)
    .eq("order_number", normalised)
    .maybeSingle();

  if (!row) {
    const fb = await supabase
      .from("orders")
      .select("*")
      .eq("business_id", businessId)
      .eq("external_order_id", rawOrderId)
      .maybeSingle();
    row = fb.data;
    error = fb.error;
  }

  if (!error && row) {
    const lineItems = Array.isArray(row.line_items) ? row.line_items : [];
    const first = lineItems[0] as { title?: string; product_id?: string } | undefined;
    return {
      orderId: row.order_number || normalised,
      dbId: row.id,
      shopId: null,
      productId: first?.product_id ?? null,
      status: row.status,
      total: Number(row.total_amount) || 0,
      itemCount: lineItems.length || 1,
      productTitle: first?.title ?? "N/A",
      trackingNumber: row.tracking_number ?? null,
    };
  }

  // 2. Printify API fallback
  const printifyOrder = await lookupOrderFromPrintify(rawOrderId, businessId);
  if (printifyOrder) return printifyOrder;

  throw new Error(`Order not found: ${rawOrderId}`);
}

export async function processRefund(order: OrderData) {
  return {
    success: true,
    refundId: `REF-${Date.now()}`,
    amount: order.total,
    orderId: order.orderId,
  };
}

export async function processResend(order: OrderData) {
  return {
    success: true,
    resendId: `RSND-${Date.now()}`,
    orderId: order.orderId,
    newTrackingNumber: `TRK-${Date.now()}`,
    estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  };
}

export async function processReplacement(order: OrderData) {
  return {
    success: true,
    replacementId: `REPL-${Date.now()}`,
    orderId: order.orderId,
    newTrackingNumber: `TRK-${Date.now()}`,
    estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  };
}

export type ActionDecision = "refund" | "resend" | "replacement" | "escalate";

export function decideAction(classification: string, orderStatus: string | null): ActionDecision {
  const n = classification.toLowerCase();
  if (n.includes("legal_risk"))  return "escalate";
  if (n.includes("refund"))      return "refund";
  if (n.includes("resend"))      return "resend";
  if (n.includes("replacement")) return "replacement";
  if (n.includes("damaged"))     return "replacement";
  if (n.includes("missing"))     return orderStatus === "shipped" ? "resend" : "refund";
  if (n.includes("tracking"))    return "resend";
  return "refund";
}

export async function buildMidTierContext(
  classification: string,
  orderId: string,
  businessId: string,
): Promise<CustomerServiceToolOutput> {
  const order = await lookupOrderById(orderId, businessId);
  const action = decideAction(classification, order.status);

  if (action === "refund") {
    const refund = await processRefund(order);
    return {
      actionType: "process_refund",
      actionSummary: `Refund ${refund.refundId} created for ${refund.orderId} (RM ${refund.amount.toFixed(2)}).`,
      contextForReply: `Order ${order.orderId} is ${order.status}. Refund ${refund.refundId} has been initiated for RM ${refund.amount.toFixed(2)}.`,
    };
  }
  if (action === "resend") {
    const resend = await processResend(order);
    return {
      actionType: "process_resend",
      actionSummary: `Resend ${resend.resendId} created for ${resend.orderId}. New tracking: ${resend.newTrackingNumber}.`,
      contextForReply: `A new package has been sent for order ${order.orderId}. New tracking: ${resend.newTrackingNumber}. Estimated delivery: ${resend.estimatedDelivery}.`,
    };
  }
  if (action === "replacement") {
    const replacement = await processReplacement(order);
    return {
      actionType: "process_replacement",
      actionSummary: `Replacement ${replacement.replacementId} created for ${replacement.orderId}. New tracking: ${replacement.newTrackingNumber}.`,
      contextForReply: `A replacement has been shipped for order ${order.orderId}. New tracking: ${replacement.newTrackingNumber}. Estimated delivery: ${replacement.estimatedDelivery}.`,
    };
  }
  return {
    actionType: "escalate_to_manager",
    actionSummary: `Escalated order ${order.orderId} to manager.`,
    contextForReply: `Your case for order ${order.orderId} has been escalated to our management team. You will hear back within 2 hours.`,
  };
}

export function buildActionProposal(
  classification: string,
  orderId: string,
  orderStatus: string | null,
  orderTotal: number | null,
): { action: ActionDecision; summary: string } {
  const action = decideAction(classification, orderStatus);
  switch (action) {
    case "refund":      return { action, summary: `issue a full refund of RM ${(orderTotal ?? 0).toFixed(2)} for order ${orderId}` };
    case "resend":      return { action, summary: `resend the items from order ${orderId} with a new tracking number at no extra cost` };
    case "replacement": return { action, summary: `send a replacement for the items in order ${orderId} at no extra cost` };
    case "escalate":    return { action, summary: `escalate order ${orderId} to a manager for review` };
  }
}
