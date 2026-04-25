"use client";

import React, { useState } from "react";
import ProductsPageHeader from "./ProductsPageHeader";
import ProductsPageContent from "./ProductsPageContent";
import { Product } from "@/lib/types";
import { useRouter } from "next/navigation";

interface ProductsPageProps {
  businessId: string;
  businessName?: string;
  totalProducts: number;
}

const ProductsPage = ({
  businessId,
  businessName,
  totalProducts,
}: ProductsPageProps) => {
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [error, setError] = useState<string | null>(null);

  const handleCreateProduct = async () => {
    try {
      const response = await fetch(`/api/business/${businessId}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Untitled Product",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create product");
      }

      const newProduct = (await response.json()) as Product;
      router.push(
        `/business/${businessId}/products/${newProduct.id}?creating=true`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create product");
    }
  };

  return (
    <>
      <ProductsPageHeader
        totalProducts={totalProducts}
        businessName={businessName}
        businessId={businessId}
        handleCreateProduct={handleCreateProduct}
      />
      <ProductsPageContent
        businessId={businessId}
        handleCreateProduct={handleCreateProduct}
      />
    </>
  );
};

export default ProductsPage;
