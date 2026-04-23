"use client";

import React, { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import Sidebar from "@/components/ui/layout/Sidebar";
import Header from "@/components/ui/layout/Header";

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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header spans full width at the top */}
      <Header />

      {/* Below header: sidebar + main content side by side */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar businessId={businessId} />
        <main className="flex-1 overflow-y-auto bg-[#F7F6F2]">
          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
