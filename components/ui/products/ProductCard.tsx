"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Product } from "@/lib/types";
import Image from "next/image";

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

  return (
    <Link href={`/business/${businessId}/products/${product.id}`}>
      <div
        className={`border font-sans rounded-xl transition-colors  ${onHover === product.id ? "border-primary-500 shadow" : "border-neutral-300"}`}
        onMouseEnter={() => setOnHover(product.id)}
        onMouseLeave={() => setOnHover("")}
      >
        {/* TODO: convert to image */}
        <div className="p-5 border-b border-neutral-300 rounded-t-xl h-36"></div>

        {/* description */}
        <div className="p-4 space-y-2 bg-light rounded-b-xl">
          <div className="space-y-0.5">
            <h1 className="text-xs font-semibold">{product.title}</h1>
            <p className="text-[12px] text-neutral-500">
              {product.description}
            </p>
          </div>
          <div className="flex justify-between">
            <p className="text-sm font-semibold">
              $ {product.price.toFixed(2)}
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
