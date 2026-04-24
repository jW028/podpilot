import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function generateOrderNumber(): string {
  return `ORD-${Math.floor(10000 + Math.random() * 90000)}`;
}

async function ensureProductLaunch(businessId: string): Promise<string> {
  // Check for any existing product_launch for this business
  const { data: existing } = await supabase
    .from("product_launches")
    .select("id")
    .eq("business_id", businessId)
    .limit(1)
    .maybeSingle();

  if (existing) return existing.id;

  // Create a placeholder product
  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({
      business_id: businessId,
      title: "Sample Product",
      description: "Auto-created placeholder for test orders",
      status: "ready",
    })
    .select("id")
    .single();

  if (productError || !product) {
    throw new Error(`Failed to create placeholder product: ${productError?.message}`);
  }

  // Create a placeholder product_launch
  const { data: launch, error: launchError } = await supabase
    .from("product_launches")
    .insert({
      business_id: businessId,
      product_id: product.id,
      status: "created",
    })
    .select("id")
    .single();

  if (launchError || !launch) {
    throw new Error(`Failed to create placeholder product_launch: ${launchError?.message}`);
  }

  return launch.id;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, productLaunchId, customerName, customerEmail, lineItems, totalAmount } = body as {
      businessId?: string;
      productLaunchId?: string;
      customerName?: string;
      customerEmail?: string;
      lineItems?: Array<{ title: string; quantity: number; price: number }>;
      totalAmount?: number;
    };

    if (!businessId) {
      return NextResponse.json({ error: "businessId is required." }, { status: 400 });
    }

    // Auto-create a placeholder product_launch if none provided
    const launchId = productLaunchId || await ensureProductLaunch(businessId);

    const items = Array.isArray(lineItems) && lineItems.length > 0
      ? lineItems
      : [{ title: "Sample Product", quantity: 1, price: totalAmount || 0 }];

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const total = totalAmount || subtotal;

    let orderNumber = generateOrderNumber();
    let inserted = false;
    let orderRow = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await supabase
        .from("orders")
        .insert({
          business_id: businessId,
          product_launch_id: launchId,
          order_number: orderNumber,
          channel: "manual",
          customer_name: customerName || "Test Customer",
          customer_email: customerEmail || "test@example.com",
          line_items: items,
          subtotal,
          total_amount: total,
          currency: "MYR",
          status: "pending",
        })
        .select()
        .single();

      if (error?.code === "23505") {
        orderNumber = generateOrderNumber();
        continue;
      }

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      orderRow = data;
      inserted = true;
      break;
    }

    if (!inserted) {
      return NextResponse.json({ error: "Failed to generate unique order number." }, { status: 500 });
    }

    return NextResponse.json({ order: orderRow }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    console.error("[API] Orders POST Error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");

    if (!businessId) {
      return NextResponse.json({ error: "businessId query parameter is required." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ orders: data }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    console.error("[API] Orders GET Error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
