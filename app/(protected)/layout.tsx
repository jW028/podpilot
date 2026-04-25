import { ProtectedLayoutClient } from "@/components/providers/ProtectedLayoutClient";
import React from "react";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProtectedLayoutClient>{children}</ProtectedLayoutClient>;
}
