"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Product } from "@/lib/types";
import { MdImage } from "react-icons/md";

interface ProductCardProps {
  product: Product;
  businessId: string;
  onDelete?: (productId: string) => void;
}

const ProductCard = ({ product, businessId, onDelete }: ProductCardProps) => {
  const getStatusColor = (status: string) => {
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
        return "bg-neutral-100 text-neutral-700";
    }
  };

  const [onHover, setOnHover] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  // Fetch product image from Supabase bucket
  useEffect(() => {
    const fetchImage = async () => {
      try {
        const response = await fetch(
          `/api/business/${businessId}/products/${product.id}/image`,
          { cache: "no-store" }
        );
        if (response.ok) {
          const data = await response.json();
          if (data.url) {
            setImageUrl(data.url);
          }
        }
      } catch {
        // No image available, that's OK
      }
    };

    fetchImage();
  }, [businessId, product.id]);

  return (
    <Link href={`/business/${businessId}/products/${product.id}`}>
      <div
        className={`border font-sans rounded-xl transition-colors ${onHover === product.id ? "border-primary-500 shadow" : "border-neutral-300"}`}
        onMouseEnter={() => setOnHover(product.id)}
        onMouseLeave={() => setOnHover("")}
      >
        {/* Product image */}
        <div className="border-b border-neutral-300 rounded-t-xl h-36 overflow-hidden bg-light-secondary">
          {imageUrl && !imageError ? (
            <img
              src={imageUrl}
              alt={product.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <MdImage className="text-3xl text-neutral-300" />
            </div>
          )}
        </div>

        {/* description */}
        <div className="p-4 bg-light rounded-b-xl h-24 flex flex-col justify-between">
          <div className="space-y-0.5">
            <h1 className="text-xs font-semibold">{product.title}</h1>
            <p className="text-[12px] text-neutral-500 line-clamp-1">
              {product.description}
            </p>
          </div>
          <div className="flex justify-between">
            <p className="text-sm font-semibold">
              $ {(product.price / 100).toFixed(2)}
            </p>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-light ${getStatusColor(product.status)}`}
            >
              {product.status}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;
