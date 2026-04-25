import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { decryptPrintifyToken, normalizePrintifyTokenInput } from "@/lib/printify/credentials";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface PrintifyShipment {
  carrier?: string;
  number?: string;
}

interface PrintifyLineItem {
  title?: string;
  quantity?: number;
  variant_label?: string;
}

interface PrintifyOrder {
  id: string;
  label?: string;
  status: string;
  total_price?: number;
  currency?: string;
  created_at?: string;
  line_items?: PrintifyLineItem[];
  shipments?: PrintifyShipment[];
  customer_name?: string;
  address_to?: { first_name?: string; last_name?: string };
}

async function resolveCredentials(businessId: string) {
  const { data: business } = await supabase
    .from("businesses")
    .select("printify_shop_id, printify_pat_hint")
    .eq("id", businessId)
    .maybeSingle();

  const shopId =
    (business?.printify_shop_id as string | null) ??
    process.env.PRINTIFY_SHOP_ID ??
    null;

  const hint = typeof business?.printify_pat_hint === "string" ? business.printify_pat_hint : "";
  const decrypted = hint ? decryptPrintifyToken(hint) : null;
  const token = decrypted
    ? normalizePrintifyTokenInput(decrypted)
    : (process.env.PRINTIFY_DEV_TOKEN ?? null);

  return { shopId, token };
}

// ── GET: list orders ─────────────────────────────────────────────────────────
export async function GET(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);

    const { shopId, token } = await resolveCredentials(businessId);

    if (!shopId) return NextResponse.json({ error: "No Printify shop connected." }, { status: 400 });
    if (!token) return NextResponse.json({ error: "No Printify token configured." }, { status: 400 });

    const res = await fetch(
      `https://api.printify.com/v1/shops/${shopId}/orders.json?limit=${limit}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Printify API error ${res.status}: ${text}` }, { status: res.status });
    }

    const json = (await res.json()) as { data?: PrintifyOrder[]; total?: number };
    const orders = (json.data ?? []).map((o) => {
      const rawLabel = (o.label ?? "").replace(/^#/, "").replace(/^ORD-/i, "") || o.id;
      const fullName = `${o.address_to?.first_name ?? ""} ${o.address_to?.last_name ?? ""}`.trim();
      const name = o.customer_name ?? (fullName || "—");

      return {
        orderId: `ORD-${rawLabel}`,
        printifyId: o.id,
        label: `ORD-${rawLabel}`,
        status: o.status,
        total: (o.total_price ?? 0) / 100,
        currency: o.currency ?? "USD",
        customerName: name,
        trackingNumber: o.shipments?.[0]?.number ?? null,
        carrier: o.shipments?.[0]?.carrier ?? null,
        itemCount: o.line_items?.length ?? 0,
        items: (o.line_items ?? []).map((li) => ({
          title: li.title ?? "Item",
          quantity: li.quantity ?? 1,
          variant: li.variant_label ?? "",
        })),
        createdAt: o.created_at ?? null,
      };
    });

    return NextResponse.json({ orders, total: json.total ?? orders.length }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── POST: create a test order ────────────────────────────────────────────────
export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const { shopId, token } = await resolveCredentials(businessId);

    if (!shopId) return NextResponse.json({ error: "No Printify shop connected." }, { status: 400 });
    if (!token) return NextResponse.json({ error: "No Printify token configured." }, { status: 400 });

    const productsRes = await fetch(
      `https://api.printify.com/v1/shops/${shopId}/products.json?limit=10`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!productsRes.ok) {
      return NextResponse.json({ error: "Failed to fetch products from Printify." }, { status: 400 });
    }

    const productsJson = (await productsRes.json()) as {
      data?: Array<{
        id: string;
        title: string;
        variants: Array<{ id: number; is_enabled: boolean }>;
      }>;
    };

    const product = productsJson.data?.find((p) => p.variants.some((v) => v.is_enabled));

    if (!product) {
      return NextResponse.json(
        { error: "No published products found in your Printify shop. Publish a product first." },
        { status: 400 },
      );
    }

    const variant = product.variants.find((v) => v.is_enabled)!;

    const orderPayload = {
      external_id: `test-${Date.now()}`,
      label: `Test Order ${new Date().toLocaleDateString("en-MY")}`,
      line_items: [{ product_id: product.id, variant_id: variant.id, quantity: 1 }],
      shipping_method: 1,
      send_shipping_notification: false,
      address_to: {
        first_name: "Test",
        last_name: "Customer",
        email: "test@podpilot.dev",
        phone: "0123456789",
        country: "MY",
        region: "KL",
        address1: "123 Jalan Test",
        address2: "",
        city: "Kuala Lumpur",
        zip: "50450",
      },
    };

    const createRes = await fetch(
      `https://api.printify.com/v1/shops/${shopId}/orders.json`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      },
    );

    const createJson = (await createRes.json()) as PrintifyOrder & { errors?: unknown };

    if (!createRes.ok) {
      return NextResponse.json(
        { error: `Printify rejected the order: ${JSON.stringify(createJson)}` },
        { status: createRes.status },
      );
    }

    const rawLabel = (createJson.label ?? "").replace(/^#/, "").replace(/^ORD-/i, "") || createJson.id;

    return NextResponse.json({
      success: true,
      orderId: `ORD-${rawLabel}`,
      printifyId: createJson.id,
      productTitle: product.title,
      status: createJson.status,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
