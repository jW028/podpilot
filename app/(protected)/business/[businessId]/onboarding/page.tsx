import BusinessOnboardingPage from "@/components/ui/onboarding/BusinessOnboardingPage";
import React from "react";

const BusinessOnboardingRoute = async ({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) => {
  const { businessId } = await params;

  return <BusinessOnboardingPage businessId={businessId} />;
};

export default BusinessOnboardingRoute;
