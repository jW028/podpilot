"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Product } from "@/lib/types";
import ProductCard from "@/components/ui/products/ProductCard";
import Button from "@/components/ui/shared/Button";
import LoadingState from "@/components/ui/shared/LoadingState";
import { Box, Sparkles, ChevronDown } from "lucide-react";

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
          { cache: "no-store" },
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
    <div className="flex min-h-[calc(100vh-80px)]">
      {/* main products panel */}
      <div className="bg-light-secondary w-8/12 p-8">
        <div>
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

        {isLoading ? (
          <LoadingState message="Loading products..." />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
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
      <div className="w-4/12 bg-[#F9F9F8] border-l border-[#E8E7E2] p-[24px]">
        {/* AI Insights */}
        <div className="bg-[#1C1C1A] rounded-[16px] p-[20px] mb-[24px] text-[#FAFAF8] shadow-sm">
          <div className="flex items-start gap-[8px] mb-[20px]">
            <Sparkles className="h-5 w-5 text-[#FAFAF8] shrink-0 mt-[2px]" />
            <div>
              <h2 className="font-serif font-bold text-[18px] leading-tight">
                AI Insights
              </h2>
              <p className="text-[12px] text-[#FAFAF8]/60 mt-[2px]">
                Product Agent analysis
              </p>
            </div>
          </div>

          <div className="space-y-[12px] mb-[24px]">
            <div className="bg-[#2A2A27] border border-[#FAFAF8]/5 rounded-[10px] p-[14px] text-[13px] leading-relaxed relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#C9A84C]"></div>
              <span className="text-[#C9A84C] font-semibold">Trending:</span>{" "}
              Minimalist bags are up 34% on Shopee this week. Consider creating
              2-3 more tote variations.
            </div>

            <div className="bg-[#2A2A27] border border-[#FAFAF8]/5 rounded-[10px] p-[14px] text-[13px] leading-relaxed relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#C9A84C]"></div>
              <span className="text-[#C9A84C] font-semibold">
                Underperforming:
              </span>{" "}
              "Grid Phone Case" has low CTR. Suggest refreshing the title for
              SEO.
            </div>

            <div className="bg-[#2A2A27] border border-[#FAFAF8]/5 rounded-[10px] p-[14px] text-[13px] leading-relaxed relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#C9A84C]"></div>
              <span className="text-[#C9A84C] font-semibold">Opportunity:</span>{" "}
              You have no products in the RM 80-120 range. Premium items convert
              well for your audience.
            </div>
          </div>

          <div className="flex gap-[12px]">
            <button className="flex-1 bg-[#C9A84C] hover:bg-[#b5953e] text-[#141412] font-semibold text-[13px] py-[10px] rounded-[8px] transition-colors">
              Generate now
            </button>
            <button className="flex-1 bg-transparent hover:bg-[#2A2A27] border border-[#FAFAF8]/20 text-[#FAFAF8] font-semibold text-[13px] py-[10px] rounded-[8px] transition-colors">
              See all
            </button>
          </div>
        </div>

        {/* Quick Generate */}
        <div className="bg-white border border-[#E8E7E2] rounded-[16px] p-[24px] shadow-sm">
          <h2 className="font-serif font-bold text-[20px] text-[#141412] mb-[24px]">
            Quick Generate
          </h2>

          <div className="space-y-[20px]">
            <div>
              <label className="block text-[11px] font-semibold text-[#6B6A64] tracking-[0.06em] uppercase mb-[8px]">
                Product Type
              </label>
              <div className="relative">
                <select className="w-full appearance-none bg-transparent border border-[#E8E7E2] rounded-[8px] px-[16px] py-[12px] text-[14px] text-[#141412] outline-none focus:border-[#C9A84C] transition-colors">
                  <option>Phone Case</option>
                  <option>Tote Bag</option>
                  <option>T-Shirt</option>
                  <option>Mug</option>
                </select>
                <ChevronDown className="absolute right-[16px] top-[14px] h-4 w-4 text-[#6B6A64] pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#6B6A64] tracking-[0.06em] uppercase mb-[8px]">
                Describe your idea
              </label>
              <textarea
                className="w-full bg-transparent border border-[#E8E7E2] rounded-[8px] px-[16px] py-[12px] text-[14px] text-[#141412] outline-none focus:border-[#C9A84C] transition-colors resize-none placeholder:text-[#9E9D97]"
                rows={4}
                placeholder="e.g. minimalist mountain landscape with thin lines..."
              ></textarea>
            </div>

            <button className="w-full bg-[#C9A84C] hover:bg-[#b5953e] text-[#141412] font-semibold text-[14px] py-[12px] rounded-[8px] transition-colors flex items-center justify-center gap-[8px]">
              <Sparkles className="h-4 w-4" />
              Generate with AI
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductsPageContent;
