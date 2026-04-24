import React from "react";
import ProductDetailPage from "@/components/ui/products/ProductDetailPage";

interface PageProps {
  params: Promise<{ businessId: string; productId: string }>;
}

async function BusinessProductDetail({ params }: PageProps) {
  const { businessId, productId } = await params;

  return <ProductDetailPage businessId={businessId} productId={productId} />;
}

export default BusinessProductDetail;
