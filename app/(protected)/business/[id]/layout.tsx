"use client";

import React, { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import Sidebar from "@/components/ui/layout/Sidebar";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const businessId = params.id as string;

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <></> // TODO: implement loading state component
    );
  }

  return (
    <div className="flex h-screen">
      {/* Header spans full width at the top */}
      <Sidebar businessId={businessId} />
      <div className="p-6 w-10/12">
        <div className=""></div>
        {children}
      </div>
    </div>
  );
}
