import React from "react";
import { createClient } from "@supabase/supabase-js";
import ProductsPage from "@/components/ui/products/ProductsPage";

interface PageProps {
  params: Promise<{ businessId: string }>;
}

async function BusinessProducts({ params }: PageProps) {
  const { businessId } = await params;

  // Fetch business context for the product brainstormer
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseServiceRole);

  const { data: business } = await supabase
    .from("businesses")
    .select("name")
    .eq("id", businessId)
    .single();

  const products = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId);

  return (
    <ProductsPage
      businessId={businessId}
      businessName={business?.name}
      totalProducts={products.count || 0}
    />
  );
}

export default BusinessProducts;
