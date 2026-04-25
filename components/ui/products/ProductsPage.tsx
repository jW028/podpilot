"use client";

import React, { useState, useEffect, useRef } from "react";
import ProductsPageHeader from "./ProductsPageHeader";
import ProductsPageContent from "./ProductsPageContent";
import { Product } from "@/lib/types";
import { useRouter, useSearchParams } from "next/navigation";

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
  const searchParams = useSearchParams();
  const autoCreateFired = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [error, setError] = useState<string | null>(null);

  const handleCreateProduct = async (designPrompt?: string) => {
    try {
      const response = await fetch(`/api/business/${businessId}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled Product" }),
      });

      if (!response.ok) throw new Error("Failed to create product");

      const newProduct = (await response.json()) as Product;
      const dest = designPrompt
        ? `/business/${businessId}/products/${newProduct.id}?creating=true&designPrompt=${encodeURIComponent(designPrompt)}`
        : `/business/${businessId}/products/${newProduct.id}?creating=true`;
      router.push(dest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create product");
    }
  };

  // Auto-create when arriving from orchestrator with a design prompt
  useEffect(() => {
    const prompt = searchParams?.get("designPrompt");
    if (!prompt || autoCreateFired.current) return;
    autoCreateFired.current = true;
    handleCreateProduct(prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
