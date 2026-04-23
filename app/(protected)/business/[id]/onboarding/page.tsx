import BusinessOnboardingPage from "@/components/ui/onboarding/BusinessOnboardingPage";
import React from "react";

const BusinessOnboardingRoute = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;

  return <BusinessOnboardingPage businessId={id} />;
};

export default BusinessOnboardingRoute;
