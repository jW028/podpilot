"use client";

import React, { useState } from "react";
import Button from "@/components/ui/shared/Button";
import { Product } from "@/lib/types";

interface ProductFormProps {
  product?: Product;
  businessId: string;
  onSubmit: (data: Record<string, string | null>) => Promise<void>;
  isLoading?: boolean;
}

const ProductForm = ({
  product,
  businessId,
  onSubmit,
  isLoading = false,
}: ProductFormProps) => {
  const [formData, setFormData] = useState({
    title: product?.title || "",
    description: product?.description || "",
    niche: product?.niche || "",
    design_prompt: product?.design_prompt || "",
    design_url: product?.design_url || "",
    status: (product?.status || "draft") as "draft" | "published" | "archived",
  });

  const [error, setError] = useState("");

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value || null,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.title.trim()) {
      setError("Product title is required");
      return;
    }

    try {
      await onSubmit(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-dark mb-1">
          Product Title *
        </label>
        <input
          type="text"
          name="title"
          value={formData.title}
          onChange={handleChange}
          placeholder="e.g., Minimalist Tote Bag"
          className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-dark mb-1">
          Description
        </label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Describe your product..."
          rows={4}
          className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-dark mb-1">
            Niche
          </label>
          <input
            type="text"
            name="niche"
            value={formData.niche}
            onChange={handleChange}
            placeholder="e.g., Fashion, Home Decor"
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-dark mb-1">
            Status
          </label>
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-dark mb-1">
          Design Prompt
        </label>
        <textarea
          name="design_prompt"
          value={formData.design_prompt}
          onChange={handleChange}
          placeholder="Description for design generation..."
          rows={3}
          className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-dark mb-1">
          Design URL
        </label>
        <input
          type="url"
          name="design_url"
          value={formData.design_url}
          onChange={handleChange}
          placeholder="https://example.com/image.png"
          className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div className="flex gap-3 pt-4">
        <Button
          type="submit"
          variant="primary"
          disabled={isLoading}
          className="flex-1"
        >
          {isLoading
            ? "Saving..."
            : product
              ? "Update Product"
              : "Create Product"}
        </Button>
      </div>
    </form>
  );
};

export default ProductForm;
