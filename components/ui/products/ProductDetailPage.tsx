"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Product } from "@/lib/types";
import ProductCanvas from "@/components/ui/products/ProductCanvas";
import DesignAgent from "@/components/ui/products/DesignAgent";
import Button from "@/components/ui/shared/Button";
import type { Block } from "@/components/ui/products/EditableBlock";
import { Dot, ChevronLeft } from "lucide-react";
import { IoSparkles } from "react-icons/io5";

interface ProductDetailPageProps {
  businessId: string;
  productId: string;
  businessName?: string;
  businessNiche?: string;
  isCreating?: boolean;
}

const getStatusColor = (status: string): string => {
  switch (status) {
    case "draft":
      return "bg-amber-100 text-amber-800";
    case "designing":
      return "bg-blue-100 text-blue-800";
    case "ready":
      return "bg-emerald-100 text-emerald-800";
    case "pushed":
      return "bg-purple-100 text-purple-800";
    case "published":
      return "bg-green-100 text-green-800";
    case "retired":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-neutral-100 text-neutral-800";
  }
};

const ProductDetailPage = ({
  businessId,
  productId,
  businessName,
  businessNiche,
  isCreating = false,
}: ProductDetailPageProps) => {
  const router = useRouter();

  const [product, setProduct] = useState<Product | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProductType, setSelectedProductType] = useState<string | null>(
    null,
  );

  // Fetch product details
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setIsLoading(true);
        setError(null);

        if (!isCreating) {
          const response = await fetch(
            `/api/business/${businessId}/products/${productId}`,
          );
          if (!response.ok) {
            throw new Error("Failed to fetch product");
          }
          const data = (await response.json()) as Product;
          setProduct(data);
          initializeBlocksFromProduct(data);
        } else {
          setProduct({
            id: productId,
            business_id: businessId,
            title: "",
            description: null,
            attributes: null,
            design_path: null,
            status: "draft",
            price: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          initializeBlocksForCreation();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProduct();
  }, [businessId, productId, isCreating]);

  const initializeBlocksFromProduct = (product: Product) => {
    const newBlocks: Block[] = [];

    newBlocks.push({
      id: "title",
      name: "title",
      type: "text",
      label: "Product Title",
      value: product.title || "",
      placeholder: "Enter product title...",
      required: true,
    });

    newBlocks.push({
      id: "description",
      name: "description",
      type: "textarea",
      label: "Description",
      value: product.description || "",
      placeholder: "Enter product description...",
    });

    if (product.design_path) {
      newBlocks.push({
        id: "design_path",
        name: "design_path",
        type: "image",
        label: "Product Image",
        value: product.design_path,
        placeholder: "Supabase image URL...",
      });
    }

    // Break down attributes JSONB into individual blocks
    if (product.attributes && typeof product.attributes === "object") {
      Object.entries(product.attributes).forEach(([key, attr]) => {
        if (attr && typeof attr === "object") {
          const attributeData = attr as {
            type?: string;
            label?: string;
            value?: unknown;
            placeholder?: string;
            options?: string[];
          };
          newBlocks.push({
            id: `attr_${key}`,
            name: key,
            type: (attributeData.type as Block["type"]) || "text",
            label: attributeData.label || key,
            value:
              (attributeData.value as string | number | string[] | null) || "",
            placeholder: attributeData.placeholder,
            options: attributeData.options,
          });
        }
      });
    }

    setBlocks(newBlocks);
  };

  const initializeBlocksForCreation = () => {
    setBlocks([
      {
        id: "title",
        name: "title",
        type: "text",
        label: "Product Title",
        value: "",
        placeholder: "Enter product title...",
        required: true,
      },
      {
        id: "description",
        name: "description",
        type: "textarea",
        label: "Description",
        value: "",
        placeholder: "Enter product description...",
      },
    ]);
  };

  const handleBlockUpdate = (updatedBlock: Block) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === updatedBlock.id ? updatedBlock : b)),
    );
  };

  const handleBlockRemove = (blockId: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== blockId));
  };

  const handleBlockReorder = (reorderedBlocks: Block[]) => {
    setBlocks(reorderedBlocks);
  };

  const handleBlockAdd = (newBlock: Block) => {
    setBlocks((prev) => [...prev, newBlock]);
  };

  const handleProductSelect = (
    printifyProductId: string,
    productType: string,
  ) => {
    setSelectedProductType(productType);
  };

  const handleFieldUpdate = (fieldName: string, fieldValue: unknown) => {
    const existingBlockIndex = blocks.findIndex(
      (b) => b.name === fieldName || b.id === `attr_${fieldName}`,
    );

    const newBlock: Block = {
      id: `attr_${fieldName}`,
      name: fieldName,
      type: (fieldValue as any)?.type || "text",
      label: (fieldValue as any)?.label || fieldName,
      value: (fieldValue as any)?.value || "",
      placeholder: (fieldValue as any)?.placeholder,
      options: (fieldValue as any)?.options,
    };

    if (existingBlockIndex >= 0) {
      const updated = [...blocks];
      updated[existingBlockIndex] = newBlock;
      setBlocks(updated);
    } else {
      setBlocks((prev) => [...prev, newBlock]);
    }
  };

  const buildPayloadFromBlocks = () => {
    const attributes: Record<string, unknown> = {};
    const basicFields: Record<string, unknown> = {};

    blocks.forEach((block) => {
      if (block.name === "title") {
        basicFields.title = block.value;
      } else if (block.name === "description") {
        basicFields.description = block.value;
      } else if (block.name === "design_path") {
        basicFields.design_path = block.value;
      } else {
        attributes[block.name] = {
          type: block.type,
          label: block.label,
          value: block.value,
          placeholder: block.placeholder,
          options: block.options,
        };
      }
    });

    return {
      title: basicFields.title || "Untitled Product",
      description: basicFields.description || null,
      design_path: basicFields.design_path || null,
      attributes: Object.keys(attributes).length > 0 ? attributes : null,
    };
  };

  const handleSaveProduct = async () => {
    if (!product) return;

    try {
      setIsSaving(true);
      setError(null);

      const payload = buildPayloadFromBlocks();

      const response = await fetch(
        `/api/business/${businessId}/products/${productId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to save product");
      }

      const updatedProduct = (await response.json()) as Product;
      setProduct(updatedProduct);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmProduct = async () => {
    if (!product) return;

    try {
      setIsSaving(true);
      setError(null);

      const payload = buildPayloadFromBlocks();

      const response = await fetch(
        `/api/business/${businessId}/products/${productId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, status: "ready" }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to confirm product");
      }

      router.push(`/business/${businessId}/products`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to confirm product",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const formattedBusinessName = businessName
    ?.toLowerCase()
    .replace(/\s+/g, "-");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-light-secondary">
        <div className="text-center">
          <div className="text-4xl mb-3">⏳</div>
          <p className="text-neutral-500 text-sm">Loading product...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex items-center justify-center h-full bg-light-secondary">
        <div className="text-center space-y-3">
          <div className="text-4xl">❌</div>
          <p className="text-neutral-500 text-sm">Product not found</p>
          <Button
            variant="outline"
            size="sm"
            href={`/business/${businessId}/products`}
          >
            Back to Products
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-light-secondary">
      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header — matches ProductsPageHeader style */}
        <div className="border-b border-neutral-300 flex justify-between items-center py-6 px-8 bg-white">
          <div className="space-y-2">
            {/* Breadcrumb back link */}
            <Link
              href={`/business/${businessId}/products`}
              className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-dark transition-colors"
            >
              <ChevronLeft className="h-3 w-3" />
              Products
            </Link>
            {/* Title row */}
            <div className="flex items-center gap-3">
              <h1 className="font-serif text-xl font-bold">
                {isCreating ? "New Product" : product.title || "Edit Product"}
              </h1>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-light ${getStatusColor(product.status)}`}
              >
                {product.status.charAt(0).toUpperCase() +
                  product.status.slice(1)}
              </span>
            </div>
            {/* Sub-info row */}
            <div className="text-xs text-neutral-500 flex items-center gap-2">
              {selectedProductType && (
                <>
                  <p>{selectedProductType}</p>
                  <Dot className="h-2 w-2" />
                </>
              )}
              <p>
                /business/{formattedBusinessName}/products/
                {productId.slice(0, 8)}…
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/business/${businessId}/products`)}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="space-x-1.5"
              onClick={handleConfirmProduct}
              disabled={isSaving}
            >
              <IoSparkles />
              <p>Confirm & Publish</p>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveProduct}
              disabled={isSaving}
            >
              {isSaving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="bg-red-50 border-b border-red-300 px-8 py-3 text-red-700 text-xs">
            {error}
          </div>
        )}

        {/* Canvas Editor */}
        <ProductCanvas
          blocks={blocks}
          onBlockUpdate={handleBlockUpdate}
          onBlockRemove={handleBlockRemove}
          onBlockReorder={handleBlockReorder}
        />
      </div>

      {/* Right Panel — Design Agent (matches bg-dark side panel) */}
      <div className="w-96 hidden lg:flex bg-dark border-l border-neutral-300 overflow-hidden">
        <DesignAgent
          businessId={businessId}
          productId={productId}
          businessName={businessName}
          businessNiche={businessNiche}
          productTitle={blocks.find((b) => b.name === "title")?.value as string}
          productDescription={
            blocks.find((b) => b.name === "description")?.value as string
          }
          productStatus={product.status}
          onProductSelect={handleProductSelect}
          onFieldUpdate={handleFieldUpdate}
          onConfirm={handleConfirmProduct}
        />
      </div>
    </div>
  );
};

export default ProductDetailPage;
