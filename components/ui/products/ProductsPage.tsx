"use client";

import React, { useEffect, useState } from "react";
import { Product } from "@/lib/types";
import ProductCard from "@/components/ui/products/ProductCard";
import ProductForm from "@/components/ui/products/ProductForm";
import Button from "@/components/ui/shared/Button";

interface ProductsPageProps {
  businessId: string;
}

type FilterStatus = "all" | "published" | "draft" | "archived";

const ProductsPage = ({ businessId }: ProductsPageProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch products
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

  const handleCreateProduct = async (
    formData: Record<string, string | null>,
  ) => {
    try {
      setIsSubmitting(true);
      const response = await fetch(`/api/business/${businessId}/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to create product");
      }

      const newProduct = await response.json();
      setProducts((prev) => [newProduct, ...prev]);
      setShowCreateForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create product");
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm("Are you sure you want to delete this product?")) {
      return;
    }

    try {
      const response = await fetch(
        `/api/business/${businessId}/products/${productId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to delete product");
      }

      setProducts((prev) => prev.filter((p) => p.id !== productId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete product");
    }
  };

  const filteredProducts = products;

  return (
    <div className="flex h-full bg-light-secondary">
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <h1 className="font-serif text-4xl font-bold text-dark">
                Products
              </h1>
              <Button
                variant="primary"
                onClick={() => setShowCreateForm(!showCreateForm)}
              >
                + New Product
              </Button>
            </div>

            {/* Status Filters */}
            <div className="flex gap-2">
              {(
                [
                  { label: "All", value: "all" },
                  { label: "Published", value: "published" },
                  { label: "Draft", value: "draft" },
                  { label: "Archived", value: "archived" },
                ] as { label: string; value: FilterStatus }[]
              ).map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setFilterStatus(filter.value)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    filterStatus === filter.value
                      ? "bg-dark text-light"
                      : "bg-neutral-200 text-dark hover:bg-neutral-300"
                  }`}
                >
                  {filter.label} (
                  {
                    products.filter(
                      (p) =>
                        filter.value === "all" || p.status === filter.value,
                    ).length
                  }
                  )
                </button>
              ))}
            </div>
          </div>

          {/* Create Form */}
          {showCreateForm && (
            <div className="mb-8 bg-white p-6 rounded-lg shadow-md">
              <h2 className="font-serif text-xl font-bold text-dark mb-4">
                Create New Product
              </h2>
              <ProductForm
                businessId={businessId}
                onSubmit={handleCreateProduct}
                isLoading={isSubmitting}
              />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Products Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="text-4xl mb-3">⏳</div>
                <p className="text-neutral-500">Loading products...</p>
              </div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="text-4xl mb-3">📦</div>
                <p className="text-neutral-500 mb-4">No products yet</p>
                <Button
                  variant="primary"
                  onClick={() => setShowCreateForm(true)}
                >
                  Create your first product
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  businessId={businessId}
                  onDelete={handleDeleteProduct}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - AI Agent Insights */}
      <div className="w-80 bg-dark border-l border-neutral-300 p-6 flex flex-col">
        <h2 className="font-serif text-xl font-bold text-light mb-4">
          AI Insights
        </h2>
        <div className="flex-1 flex items-center justify-center text-center">
          <div>
            <div className="text-4xl mb-3">🤖</div>
            <p className="text-light-muted text-sm">
              Product Agent analysis will appear here
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductsPage;
