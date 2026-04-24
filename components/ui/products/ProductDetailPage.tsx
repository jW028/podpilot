"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Product } from "@/lib/types";
import ProductForm from "@/components/ui/products/ProductForm";
import Button from "@/components/ui/shared/Button";

interface ProductDetailPageProps {
  businessId: string;
  productId: string;
}

const ProductDetailPage = ({
  businessId,
  productId,
}: ProductDetailPageProps) => {
  const router = useRouter();

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch product details
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(
          `/api/business/${businessId}/products/${productId}`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch product");
        }

        const data = await response.json();
        setProduct(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProduct();
  }, [businessId, productId]);

  const handleUpdateProduct = async (
    formData: Record<string, string | null>,
  ) => {
    try {
      setIsSubmitting(true);
      const response = await fetch(
        `/api/business/${businessId}/products/${productId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to update product");
      }

      const updatedProduct = await response.json();
      setProduct(updatedProduct);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update product");
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this product? This action cannot be undone.",
      )
    ) {
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

      router.push(`/business/${businessId}/products`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete product");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-light">
        <div className="text-center">
          <div className="text-4xl mb-3">⏳</div>
          <p className="text-neutral-500">Loading product...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex h-full items-center justify-center bg-light">
        <div className="text-center">
          <div className="text-4xl mb-3">❌</div>
          <p className="text-neutral-500 mb-4">Product not found</p>
          <Link href={`/business/${businessId}/products`}>
            <Button variant="primary">Back to Products</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-light-secondary">
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-4xl">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <Link href={`/business/${businessId}/products`}>
              <Button variant="outline">← Back</Button>
            </Link>
            <div className="flex gap-2">
              {!isEditing && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => setIsEditing(true)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleDeleteProduct}
                    className="text-red-500 hover:text-red-700"
                  >
                    Delete
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Content */}
          <div className="bg-white rounded-lg shadow-md p-8">
            {isEditing ? (
              <>
                <h1 className="font-serif text-3xl font-bold text-dark mb-6">
                  Edit Product
                </h1>
                <ProductForm
                  product={product}
                  businessId={businessId}
                  onSubmit={handleUpdateProduct}
                  isLoading={isSubmitting}
                />
                <div className="mt-4">
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* Product Image */}
                {product.design_url && (
                  <div className="mb-8">
                    <img
                      src={product.design_url}
                      alt={product.title}
                      width={500}
                      height={500}
                      style={{ width: "auto", height: "auto" }}
                      className="w-full max-w-md h-auto rounded-lg shadow-md"
                    />
                  </div>
                )}

                {/* Product Details */}
                <h1 className="font-serif text-4xl font-bold text-dark mb-4">
                  {product.title}
                </h1>

                <div className="flex gap-2 mb-6">
                  <span
                    className={`text-sm font-semibold px-3 py-1 rounded-full ${
                      product.status === "published"
                        ? "bg-emerald-100 text-emerald-800"
                        : product.status === "draft"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-neutral-200 text-neutral-700"
                    }`}
                  >
                    {product.status.charAt(0).toUpperCase() +
                      product.status.slice(1)}
                  </span>
                  {product.niche && (
                    <span className="bg-light-secondary text-dark text-sm px-3 py-1 rounded">
                      {product.niche}
                    </span>
                  )}
                </div>

                {/* Description */}
                {product.description && (
                  <div className="mb-8">
                    <h2 className="font-serif text-xl font-bold text-dark mb-3">
                      Description
                    </h2>
                    <p className="text-neutral-600 whitespace-pre-wrap">
                      {product.description}
                    </p>
                  </div>
                )}

                {/* Design Prompt */}
                {product.design_prompt && (
                  <div className="mb-8">
                    <h2 className="font-serif text-xl font-bold text-dark mb-3">
                      Design Prompt
                    </h2>
                    <p className="text-neutral-600 whitespace-pre-wrap bg-light-secondary p-4 rounded">
                      {product.design_prompt}
                    </p>
                  </div>
                )}

                {/* Metadata */}
                <div className="border-t border-neutral-200 pt-6 mt-8">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm text-neutral-500 mb-1">Created</p>
                      <p className="text-lg font-semibold text-dark">
                        {new Date(product.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-neutral-500 mb-1">
                        Last Updated
                      </p>
                      <p className="text-lg font-semibold text-dark">
                        {new Date(product.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Printify Info */}
                {product.printify_product_id && (
                  <div className="mt-6 p-4 bg-blue-50 rounded border border-blue-200">
                    <p className="text-sm text-blue-700">
                      <strong>Printify Product ID:</strong>{" "}
                      {product.printify_product_id}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
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
              Product Agent analysis and recommendations will appear here
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;
