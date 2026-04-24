"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export function ProtectedLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-light flex items-center justify-center px-6">
        <div className="w-full max-w-sm bg-white border border-neutral-300 rounded-xl p-6 text-center">
          <div className="h-10 w-10 mx-auto rounded-full border-2 border-neutral-300 border-t-primary-500 animate-spin" />
          <h2 className="mt-4 font-serif text-xl text-light-primary">
            Preparing your workspace
          </h2>
          <p className="mt-2 text-sm text-neutral-500">
            Verifying account session and loading your protected pages.
          </p>
        </div>
      </div>
    );
  }

  return <div>{children}</div>;
}
