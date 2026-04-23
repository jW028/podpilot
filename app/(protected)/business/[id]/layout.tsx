"use client";

import React, { useEffect } from "react";
import { useRouter, useParams, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";

const NAV_ITEMS = [
  { label: "Overview", href: "overview", icon: "◇" },
  { label: "AI Command Center", href: "onboarding", icon: "◇" },
  { label: "Products", href: "products", icon: "◇" },
  { label: "Launch & Integrations", href: "launch", icon: "◇" },
  { label: "Customer Support", href: "support", icon: "◎", badge: null },
  { label: "Finance", href: "finance", icon: "◈", ai: true },
  { label: "Settings", href: "settings", icon: "⚙" },
];

export default function BusinessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
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

  // Derive initials from user email or display name
  const displayName = user.user_metadata?.full_name || user.email || "User";
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-screen bg-[#F7F6F2] font-sans text-[14px] text-[#141412] overflow-hidden">
      {/* ── SIDEBAR ── */}
      <aside className="w-[240px] bg-[#FAFAF8] border-r border-[#E8E7E2] flex flex-col shrink-0 h-screen sticky top-0 overflow-y-auto">
        {/* Logo */}
        <div className="p-[20px_20px_16px] border-b border-[#E8E7E2]">
          <Link href="/dashboard" className="font-serif text-[20px] text-[#141412] tracking-[-0.3px]">
            Pod<span className="text-[#C9A84C]">ilot</span>
          </Link>
        </div>

        {/* Business switcher pill */}
        <div className="m-[12px] p-[10px_12px] bg-[#F4F3EF] rounded-[8px] border border-[#E8E7E2] flex items-center justify-between cursor-pointer hover:bg-[#EEEDEA] transition">
          <div className="flex items-center gap-[8px]">
            <div className="w-[28px] h-[28px] rounded-[6px] bg-gradient-to-br from-[#E8D08A] to-[#C9A84C] flex items-center justify-center text-[11px] font-semibold text-[#FAFAF8]">
              MK
            </div>
            <div>
              <div className="text-[12px] font-medium text-[#141412]">MokiPrints</div>
              <div className="text-[10px] text-[#6B6A64]">Active store</div>
            </div>
          </div>
          <div className="text-[10px] text-[#C4C3BC]">▼</div>
        </div>

        {/* Nav */}
        <nav className="p-[8px_12px_4px] flex-1">
          <div className="text-[10px] font-semibold tracking-[0.08em] uppercase text-[#C4C3BC] px-[8px] mb-[4px]">
            Business
          </div>
          {NAV_ITEMS.map((item) => {
            const href = `/business/${businessId}/${item.href}`;
            const isActive = pathname === href || pathname.startsWith(href + "/");

            return (
              <Link
                key={item.href}
                href={href}
                className={`flex items-center justify-between p-[8px_10px] rounded-[8px] text-[13px] cursor-pointer mb-[1px] transition-colors ${
                  isActive
                    ? "bg-[#141412] text-[#FAFAF8]"
                    : "text-[#6B6A64] hover:bg-[#F4F3EF] hover:text-[#141412]"
                }`}
              >
                <div className="flex items-center gap-[10px]">
                  <span
                    className={`text-[14px] w-[16px] text-center ${
                      isActive ? "opacity-100" : "opacity-60"
                    }`}
                  >
                    {item.icon}
                  </span>
                  {item.label}
                </div>
                <div className="flex items-center gap-[4px]">
                  {item.badge && (
                    <span className="bg-[#C9A84C] text-[#FAFAF8] text-[9px] font-semibold px-[6px] py-[2px] rounded-[10px]">
                      {item.badge}
                    </span>
                  )}
                  {item.ai && (
                    <span
                      className={`text-[9px] font-medium ${
                        isActive ? "text-[#9E7A2E]" : "text-[#C9A84C]"
                      }`}
                    >
                      AI
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="p-[12px] border-t border-[#E8E7E2]">
          <div className="flex items-center justify-between gap-[8px] p-[8px_10px] rounded-[8px] cursor-pointer hover:bg-[#F4F3EF] transition group">
            <div className="flex items-center gap-[8px]">
              <div className="w-[28px] h-[28px] rounded-full bg-[#2A2A27] flex items-center justify-center text-[11px] text-[#FAFAF8] font-medium shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <div className="text-[12px] font-medium truncate max-w-[120px]">{displayName}</div>
                <div className="text-[10px] text-[#6B6A64] truncate max-w-[120px]">{user.email}</div>
              </div>
            </div>
            <button
              onClick={() => signOut?.()}
              className="text-[10px] text-[#6B6A64] hover:text-[#C0584A] transition shrink-0 opacity-0 group-hover:opacity-100"
            >
              Out
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN AREA (children render here) ── */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
