"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Product } from "@/lib/types";
import ProductCard from "@/components/ui/products/ProductCard";
import Button from "@/components/ui/shared/Button";
import { Box } from "lucide-react";

interface ProductsPageProps {
  businessId: string;
  businessName?: string;
  handleCreateProduct: () => Promise<void>;
}

type FilterStatus =
  | "all"
  | "draft"
  | "designing"
  | "ready"
  | "published"
  | "retired";

const ProductsPageContent = ({
  businessId,
  handleCreateProduct,
}: ProductsPageProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const query = filterStatus !== "all" ? `?status=${filterStatus}` : "";
        const response = await fetch(
          `/api/business/${businessId}/products${query}`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch products");
        }

        const data = await response.json();
        setProducts(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, [businessId, filterStatus]);

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm("Are you sure you want to delete this product?")) {
      return;
    }

    try {
      const response = await fetch(
        `/api/business/${businessId}/products/${productId}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        throw new Error("Failed to delete product");
      }

      setProducts((prev) => prev.filter((p) => p.id !== productId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete product");
    }
  };

  return (
    <div className="flex">
      <div className="bg-light-secondary h-screen overflow-y-auto w-8/12">
        <div className="p-8">
          {/* Status Filters */}
          <div className="flex gap-2 flex-wrap">
            {(
              [
                { label: "All", value: "all" },
                { label: "Draft", value: "draft" },
                { label: "Designing", value: "designing" },
                { label: "Ready", value: "ready" },
                { label: "Published", value: "published" },
                { label: "Retired", value: "retired" },
              ] as { label: string; value: FilterStatus }[]
            ).map((filter) => (
              <Button
                key={filter.value}
                onClick={() => setFilterStatus(filter.value)}
                variant={filterStatus === filter.value ? "primary" : "outline"}
                size="sm"
                className="py-1.5!"
              >
                {filter.label} (
                {products.filter((p) => p.status === filter.value).length})
              </Button>
            ))}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* TODO: use loading state component */}
        {isLoading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="text-4xl mb-3">⏳</div>
              <p className="text-neutral-500">Loading products...</p>
            </div>
          </div>
        ) : products.length == 0 ? (
          <div className="flex flex-col gap-4 items-center justify-center h-96">
            <div className="flex flex-col items-center justify-center gap-4">
              <Box className="h-10 w-10" />
              <p className="text-neutral-500 text-[12px]">No products yet</p>
              <Button size="sm" variant="primary" onClick={handleCreateProduct}>
                Create your first product
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 px-8">
            {products.map((product) => (
              <div key={product.id} className="relative group">
                <ProductCard
                  product={product}
                  businessId={businessId}
                  onDelete={handleDeleteProduct}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* right panel design agent */}
      <div className="w-4/12 flex justify-center items-center text-xs text-neutral-500">
        to implement ai chatbot
      </div>
    </div>
  );
};

export default ProductsPageContent;
