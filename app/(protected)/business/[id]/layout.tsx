"use client";

import React, { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import Sidebar from "@/components/ui/layout/Sidebar";

export default function BusinessLayout({
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
      <div className="min-h-screen bg-[#F7F6F2] flex items-center justify-center">
        <div className="text-center">
          <div className="w-[24px] h-[24px] border-[2px] border-[#C9A84C] border-t-transparent rounded-full animate-spin mx-auto mb-[12px]" />
          <p className="text-[13px] text-[#6B6A64]">Loading workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F7F6F2] font-sans text-[14px] text-[#141412] overflow-hidden">
      <Sidebar businessId={businessId} />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
