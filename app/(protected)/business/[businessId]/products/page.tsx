import React from "react";
import ProductsPage from "@/components/ui/products/ProductsPage";

interface PageProps {
  params: Promise<{ businessId: string }>;
}

async function BusinessProducts({ params }: PageProps) {
  const { businessId } = await params;

  return <ProductsPage businessId={businessId} />;
}

export default BusinessProducts;
