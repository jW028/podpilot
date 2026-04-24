"use client";

import { useParams } from "next/navigation";
import PlaceOrderPage from "@/components/ui/orders/PlaceOrderPage";

const BusinessProducts = () => {
  const params = useParams();
  const businessId = params.id as string;
  return <PlaceOrderPage businessId={businessId} />;
};

export default BusinessProducts;
