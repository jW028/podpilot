import React from "react";
import Sidebar from "@/components/ui/layout/Sidebar";

export default async function ProtectedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  return (
    <div className="flex h-screen">
      {/* Header spans full width at the top */}
      <Sidebar businessId={businessId} />
      <div className="p-6 w-10/12">{children}</div>
    </div>
  );
}
