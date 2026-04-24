"use client";

import React from "react";
import Link from "next/link";
import { Product } from "@/lib/types";

interface ProductCardProps {
  product: Product;
  businessId: string;
  onDelete?: (productId: string) => void;
}

const ProductCard = ({ product, businessId, onDelete }: ProductCardProps) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "published":
        return "bg-emerald-100 text-emerald-800";
      case "draft":
        return "bg-amber-100 text-amber-800";
      case "archived":
        return "bg-neutral-200 text-neutral-700";
      default:
        return "bg-neutral-100 text-neutral-700";
    }
  };

  return (
    <Link href={`/business/${businessId}/products/${product.id}`}>
      <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden cursor-pointer h-full flex flex-col group">
        {/* Image Container */}
        <div className="relative w-full bg-neutral-100 aspect-square flex items-center justify-center overflow-hidden">
          {product.design_url ? (
            <img
              src={product.design_url}
              alt={product.title}
              width={300}
              height={300}
              style={{ width: "auto", height: "auto" }}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl mb-2">📦</div>
                <span className="text-neutral-400 text-sm">No image</span>
              </div>
            </div>
          )}
          {/* Status Badge */}
          <div className="absolute top-2 right-2">
            <span
              className={`text-xs font-semibold px-2 py-1 rounded-full ${getStatusColor(
                product.status,
              )}`}
            >
              {product.status.charAt(0).toUpperCase() + product.status.slice(1)}
            </span>
          </div>
        </div>

        {/* Content Container */}
        <div className="p-4 flex flex-col flex-grow">
          {/* Title */}
          <h3 className="font-serif text-lg font-semibold text-dark mb-2 line-clamp-2">
            {product.title}
          </h3>

          {/* Description */}
          {product.description && (
            <p className="text-sm text-neutral-500 line-clamp-2 mb-3">
              {product.description}
            </p>
          )}

          {/* Niche Badge */}
          {product.niche && (
            <div className="mb-3">
              <span className="inline-block bg-light-secondary text-dark text-xs px-2 py-1 rounded">
                {product.niche}
              </span>
            </div>
          )}

          {/* Footer */}
          <div className="mt-auto pt-3 border-t border-neutral-200 flex items-center justify-between">
            <span className="text-xs text-neutral-400">
              {new Date(product.created_at).toLocaleDateString()}
            </span>
            {onDelete && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onDelete(product.id);
                }}
                className="text-xs text-red-500 hover:text-red-700 transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;
