"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Product } from "@/lib/types";
import type { DesignToLaunchPayload } from "@/lib/types";
import ProductCanvas from "@/components/ui/products/ProductCanvas";
import DesignAgent from "@/components/ui/products/DesignAgent";
import Button from "@/components/ui/shared/Button";
import ConfirmDialog from "@/components/ui/shared/ConfirmDialog";
import type { Block } from "@/components/ui/products/EditableBlock";
import { Dot, ChevronLeft, ChevronDown, PackageX } from "lucide-react";
import { MdCloudUpload } from "react-icons/md";
import LoadingState from "../shared/LoadingState";
import { useLaunchAgent } from "@/hooks/useLaunchAgent";

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

// Fields that are system-managed and should never be user/agent editable
const LOCKED_FIELDS = [
  "blueprint_id",
  "print_provider_id",
  "product_type",
  "variant_ids",
];

// Fields that should always use multi-selection regardless of what type was stored.
// Derived from Printify API: tags[], options[colors/sizes], decoration_methods[], placeholders[positions]
const MULTI_SELECT_FIELDS = [
  // Sizing — variant option dimension
  "sizes",
  "size_range",
  "available_sizes",
  "size",

  // Colours — variant option dimension (both spellings, singular + plural)
  "color",
  "colors",
  "colour",
  "colours",
  "available_colors",
  "colour_options",
  "color_options",

  // Tags — Printify product.tags is string[]
  "tags",
  "product_tags",
  "keywords",

  // Print areas / placements
  "print_areas",
  "print_positions",
  "placeholders",
  "positions",

  // Decoration methods — e.g. ["dtg", "embroidery", "dtf"]
  "decoration_methods",
  "print_methods",

  // Targeting & style attributes
  "target_audience",
  "fit_types",
  "materials",
  "fabric",
  "styles",

  // Shipping
  "countries",
  "shipping_regions",
];

const resolveFieldType = (
  fieldName: string,
  storedType?: string,
): Block["type"] => {
  if (MULTI_SELECT_FIELDS.includes(fieldName.toLowerCase()))
    return "multi-selection";
  return (storedType as Block["type"]) || "text";
};

const ProductDetailPage = ({
  businessId,
  productId,
  businessName,
  businessNiche,
  isCreating = false,
}: ProductDetailPageProps) => {
  const router = useRouter();
  const { runLaunch } = useLaunchAgent(businessId, productId);

  const [product, setProduct] = useState<Product | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProductType, setSelectedProductType] = useState<string | null>(
    null,
  );
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const headerImageInputRef = useRef<HTMLInputElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  const fetchProductImage = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/business/${businessId}/products/${productId}/image`,
        { cache: "no-store" },
      );
      if (response.ok) {
        const data = await response.json();
        if (data.url) {
          setProductImageUrl(data.url);
        }
      }
    } catch (error) {
      // Image not found is OK
    }
  }, [businessId, productId]);

  const initializeBlocksFromProduct = useCallback((product: Product) => {
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

    newBlocks.push({
      id: "price",
      name: "price",
      type: "number",
      label: "Price ($)",
      value: product.price ? product.price / 100 : 0,
      placeholder: "Price in dollars (e.g. 24.99)",
    });

    newBlocks.push({
      id: "product_image",
      name: "product_image",
      type: "image",
      label: "Product Design",
      value: "",
      placeholder: "Upload your product design image",
    });

    if (product.attributes && typeof product.attributes === "object") {
      Object.entries(product.attributes).forEach(([key, attr]) => {
        if (attr && typeof attr === "object") {
          const attributeData = attr as {
            type?: string;
            label?: string;
            value?: unknown;
            placeholder?: string;
            options?: string[];
            locked?: boolean;
            required?: boolean;
          };

          const isLocked =
            attributeData.locked === true || LOCKED_FIELDS.includes(key);

          newBlocks.push({
            id: `attr_${key}`,
            name: key,
            type: resolveFieldType(key, attributeData.type),
            label: attributeData.label || key,
            value:
              (attributeData.value as string | number | string[] | null) || "",
            placeholder: attributeData.placeholder,
            options: attributeData.options,
            locked: isLocked,
            required: attributeData.required,
          });
        }
      });
    }

    setBlocks(newBlocks);
  }, []);

  const initializeBlocksForCreation = useCallback(() => {
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
      {
        id: "price",
        name: "price",
        type: "number",
        label: "Price ($)",
        value: 0,
        placeholder: "Price in dollars (e.g. 24.99)",
      },
      {
        id: "product_image",
        name: "product_image",
        type: "image",
        label: "Product Design",
        value: "",
        placeholder: "Upload your product design image",
      },
    ]);
  }, []);

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

        // Fetch product image from Supabase bucket
        fetchProductImage();
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProduct();
  }, [
    businessId,
    productId,
    isCreating,
    initializeBlocksFromProduct,
    initializeBlocksForCreation,
    fetchProductImage,
  ]);

  const handleBlockUpdate = async (updatedBlock: Block) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === updatedBlock.id ? updatedBlock : b)),
    );
    // Auto-save to DB after block update
    await autoSaveBlocks(
      blocks.map((b) => (b.id === updatedBlock.id ? updatedBlock : b)),
    );
  };

  const handleBlockRemove = (blockId: string) => {
    // Don't allow removing locked blocks
    const block = blocks.find((b) => b.id === blockId);
    if (block?.locked) return;
    setBlocks((prev) => prev.filter((b) => b.id !== blockId));
  };

  const handleBlockReorder = (reorderedBlocks: Block[]) => {
    setBlocks(reorderedBlocks);
  };

  const handleProductSelect = (blueprintId: string, productType: string) => {
    setSelectedProductType(productType);
  };

  const handleFieldUpdate = (fieldName: string, fieldValue: unknown) => {
    const existingBlockIndex = blocks.findIndex(
      (b) => b.name === fieldName || b.id === `attr_${fieldName}`,
    );

    const attrData = fieldValue as {
      type?: string;
      label?: string;
      value?: unknown;
      placeholder?: string;
      options?: string[];
      locked?: boolean;
      required?: boolean;
    };

    const isLocked =
      attrData?.locked === true || LOCKED_FIELDS.includes(fieldName);

    const newBlock: Block = {
      id: `attr_${fieldName}`,
      name: fieldName,
      type: resolveFieldType(fieldName, attrData?.type),
      label: attrData?.label || fieldName,
      value: (attrData?.value as string | number | string[] | null) || "",
      placeholder: attrData?.placeholder,
      options: attrData?.options,
      locked: isLocked,
      required: attrData?.required,
    };

    if (existingBlockIndex >= 0) {
      const updated = [...blocks];
      updated[existingBlockIndex] = newBlock;
      setBlocks(updated);
    } else {
      setBlocks((prev) => [...prev, newBlock]);
    }
  };

  const handleImageUpload = async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `/api/business/${businessId}/products/${productId}/image`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (!response.ok) {
        throw new Error("Failed to upload image");
      }

      const data = await response.json();
      if (data.url) {
        // Append cache-buster so browser doesn't serve stale image
        const freshUrl = `${data.url}?t=${Date.now()}`;
        setProductImageUrl(freshUrl);
        return freshUrl;
      }
      return null;
    } catch (error) {
      console.error("Image upload error:", error);
      setError("Failed to upload image");
      return null;
    }
  };

  const buildPayloadFromBlocks = (overrideBlocks?: Block[]) => {
    const src = overrideBlocks || blocks;
    const attributes: Record<string, unknown> = {};
    const basicFields: Record<string, unknown> = {};

    src.forEach((block) => {
      if (block.name === "title") {
        basicFields.title = block.value;
      } else if (block.name === "description") {
        basicFields.description = block.value;
      } else if (block.name === "price") {
        basicFields.price = block.value;
      } else if (block.name === "product_image") {
        // Image is stored in bucket, not in DB fields
        // Skip — we don't store design_path
      } else {
        // Store attribute with its metadata for the launch agent
        attributes[block.name] = {
          type: block.type,
          label: block.label,
          value: block.value,
          placeholder: block.placeholder,
          options: block.options,
          locked: block.locked || false,
          required: block.required || false,
        };
      }
    });

    return {
      title: basicFields.title || "Untitled Product",
      description: basicFields.description || null,
      price: basicFields.price
        ? Math.round((basicFields.price as number) * 100)
        : 0,
      attributes: Object.keys(attributes).length > 0 ? attributes : null,
    };
  };

  const autoSaveBlocks = async (overrideBlocks?: Block[]) => {
    if (!product) return;
    try {
      setIsSaving(true);
      setError(null);
      const payload = buildPayloadFromBlocks(overrideBlocks);
      const response = await fetch(
        `/api/business/${businessId}/products/${productId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) throw new Error("Failed to save product");
      const updatedProduct = (await response.json()) as Product;
      setProduct(updatedProduct);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: Product["status"]) => {
    if (!product) return;
    // Don't allow changing away from launch-agent-controlled states
    if (["pushed", "published", "retired"].includes(product.status)) return;

    try {
      setIsSaving(true);
      setError(null);
      const payload = buildPayloadFromBlocks();
      const response = await fetch(
        `/api/business/${businessId}/products/${productId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, status: newStatus }),
        },
      );
      if (!response.ok) throw new Error("Failed to update status");
      const updatedProduct = (await response.json()) as Product;
      setProduct(updatedProduct);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setIsSaving(false);
      setIsStatusDropdownOpen(false);
    }
  };

  // Keep handleConfirmProduct for DesignAgent compatibility
  const handleConfirmProduct = async () => {
    await handleStatusChange("ready");
  };

  const handleLaunchFromDesign = async (
    designPayload: DesignToLaunchPayload,
  ) => {
    const payload = buildPayloadFromBlocks();
    await runLaunch({
      productData: {
        name: (payload.title as string) || product?.title || "Product",
        description: (payload.description as string) || "",
        categories: designPayload.categories,
        tags: designPayload.tags,
      },
      designPayload,
    });
    // Update product status to pushed after launch is triggered
    await handleStatusChange("pushed");
  };

  const handleDeleteProduct = async () => {
    try {
      setIsSaving(true);
      setError(null);

      const response = await fetch(
        `/api/business/${businessId}/products/${productId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to delete product");
      }

      router.refresh();
      router.push(`/business/${businessId}/products`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete product");
    } finally {
      setIsSaving(false);
    }
  };

  // Update image block when productImageUrl changes
  useEffect(() => {
    if (productImageUrl) {
      const timer = setTimeout(() => {
        setBlocks((prev) =>
          prev.map((b) =>
            b.id === "product_image" ? { ...b, value: productImageUrl } : b,
          ),
        );
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [productImageUrl]);

  // Close status dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        statusDropdownRef.current &&
        !statusDropdownRef.current.contains(e.target as Node)
      ) {
        setIsStatusDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleHeaderImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await handleImageUpload(file);
    if (url) setProductImageUrl(url);
    // Reset so re-selecting the same file triggers onChange
    if (headerImageInputRef.current) headerImageInputRef.current.value = "";
  };

  // Status options the user can pick from (only draft/designing/ready)
  const USER_STATUSES: {
    value: Product["status"];
    label: string;
    color: string;
  }[] = [
    { value: "draft", label: "Draft", color: "bg-amber-100 text-amber-800" },
    {
      value: "designing",
      label: "Designing",
      color: "bg-blue-100 text-blue-800",
    },
    {
      value: "ready",
      label: "Ready",
      color: "bg-emerald-100 text-emerald-800",
    },
  ];

  const isLaunchControlled = ["pushed", "published", "retired"].includes(
    product?.status || "",
  );

  const formattedBusinessName = businessName
    ?.toLowerCase()
    .replace(/\s+/g, "-");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-light-secondary">
        <LoadingState message="Loading product..." />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex items-center justify-center h-full bg-light-secondary">
        <div className="flex flex-col items-center justify-center gap-4">
          <PackageX className="h-10 w-10 text-neutral-400" />
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
          <div className="flex items-center gap-5">
            {/* Product image thumbnail — clickable to change */}
            <input
              ref={headerImageInputRef}
              type="file"
              accept="image/*"
              onChange={handleHeaderImageUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => headerImageInputRef.current?.click()}
              className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-dashed border-neutral-300 hover:border-primary-400 transition-all group flex-shrink-0 bg-neutral-50"
              title="Change product image"
            >
              {productImageUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={productImageUrl}
                    alt="Product"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                    <MdCloudUpload className="text-white text-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-neutral-400 group-hover:text-primary-500 transition-colors">
                  <MdCloudUpload className="text-lg" />
                  <span className="text-[8px] mt-0.5">Image</span>
                </div>
              )}
            </button>

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
          </div>

          <div className="flex gap-2.5 items-center">
            {/* Auto-save indicator */}
            {isSaving && (
              <span className="text-[10px] text-neutral-400 animate-pulse">
                Saving…
              </span>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(true)}
              className="text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200"
            >
              Delete
            </Button>

            {/* Status dropdown */}
            <div className="relative" ref={statusDropdownRef}>
              <button
                type="button"
                disabled={isLaunchControlled || isSaving}
                onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isLaunchControlled
                    ? `${getStatusColor(product.status)} cursor-not-allowed opacity-80`
                    : `${getStatusColor(product.status)} hover:shadow-md cursor-pointer`
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    product.status === "draft"
                      ? "bg-amber-500"
                      : product.status === "designing"
                        ? "bg-blue-500"
                        : product.status === "ready"
                          ? "bg-emerald-500"
                          : product.status === "published"
                            ? "bg-green-500"
                            : product.status === "retired"
                              ? "bg-gray-500"
                              : "bg-purple-500"
                  }`}
                />
                {product.status.charAt(0).toUpperCase() +
                  product.status.slice(1)}
                {!isLaunchControlled && (
                  <ChevronDown
                    className={`h-3 w-3 transition-transform ${
                      isStatusDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                )}
              </button>

              {isStatusDropdownOpen && !isLaunchControlled && (
                <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-neutral-200 rounded-lg shadow-lg overflow-hidden z-50">
                  {USER_STATUSES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => handleStatusChange(s.value)}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors ${
                        product.status === s.value
                          ? "bg-neutral-100 font-semibold"
                          : "hover:bg-neutral-50"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          s.value === "draft"
                            ? "bg-amber-500"
                            : s.value === "designing"
                              ? "bg-blue-500"
                              : "bg-emerald-500"
                        }`}
                      />
                      {s.label}
                      {product.status === s.value && (
                        <span className="ml-auto text-[10px] text-neutral-400">
                          Current
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
          onImageUpload={handleImageUpload}
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
          onLaunch={handleLaunchFromDesign}
        />
      </div>

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteProduct}
        title="Delete Product"
        description="Are you sure you want to delete this product? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isDestructive={true}
      />
    </div>
  );
};

export default ProductDetailPage;
