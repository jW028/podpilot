"use client";

import { useParams } from "next/navigation";
import CustomerServicePage from "@/components/ui/support/CustomerServicePage";

const BusinessSupport = () => {
  const params = useParams();
  const businessId = params.id as string;
  return <CustomerServicePage businessId={businessId} />;
};

export default BusinessSupport;
