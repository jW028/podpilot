"use client";

import React from "react";
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

  return (
    <Link href={`/business/${businessId}/products/${product.id}`}>
      <div className="border rounded-xl border-neutral-300">
        <div className="p-5 border-b border-neutral-300">test</div>
        <div className="p-5 bg-light">
          <h1>{product.title}</h1>
          <p>{product.description}</p>
          <p>${product.price.toFixed(2)}</p>
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;
