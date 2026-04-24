import React from "react";
import ProductDetailPage from "@/components/ui/products/ProductDetailPage";
import { createClient } from "@supabase/supabase-js";

interface PageProps {
  params: Promise<{ businessId: string; productId: string }>;
  searchParams: Promise<{ creating?: string }>;
}

async function BusinessProductDetail({ params, searchParams }: PageProps) {
  const { businessId, productId } = await params;
  const { creating } = await searchParams;
  const isCreating = creating === "true";

  // Fetch business context for the product brainstormer
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseServiceRole);

  const { data: business } = await supabase
    .from("businesses")
    .select("name, niche")
    .eq("id", businessId)
    .single();

  return (
    <ProductDetailPage
      businessId={businessId}
      productId={productId}
      businessName={business?.name}
      businessNiche={business?.niche}
      isCreating={isCreating}
    />
  );
}

export default BusinessProductDetail;
