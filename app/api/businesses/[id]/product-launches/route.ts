import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: businessId } = await params;

    const { data, error } = await supabase
      .from("product_launches")
      .select("id, product_id, business_id, status, products(title, description)")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ launches: data || [] }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    console.error("[API] Product Launches GET Error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
