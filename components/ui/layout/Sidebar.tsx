"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

interface SidebarProps {
  businessId?: string;
}

// ── icons (simple SVG inline, matches the image style) ──────────────────────

const IconOverview = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="shrink-0">
    <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.2" />
    <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

const IconCommand = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="shrink-0">
    <path d="M7.5 1.5L13.5 7.5L7.5 13.5L1.5 7.5L7.5 1.5Z" stroke="currentColor" strokeWidth="1.2" />
    <path d="M7.5 4.5L10.5 7.5L7.5 10.5L4.5 7.5L7.5 4.5Z" fill="currentColor" />
  </svg>
);

const IconProducts = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="shrink-0">
    <rect x="1.5" y="1.5" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
    <rect x="8.5" y="1.5" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
    <rect x="1.5" y="8.5" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
    <rect x="8.5" y="8.5" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

const IconLaunch = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="shrink-0">
    <path d="M2 13L7 2L12 8L8 9.5L2 13Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);

const IconSupport = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="shrink-0">
    <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.2" />
    <circle cx="7.5" cy="7.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

const IconFinance = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="shrink-0">
    <path d="M7.5 1.5L13.5 7.5L7.5 13.5L1.5 7.5L7.5 1.5Z" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

const IconSettings = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="shrink-0">
    <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.2" />
    <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" />
  </svg>
);

const IconAllBusinesses = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="shrink-0">
    <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

// ── nav config ───────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
  ai?: boolean;
  businessScoped?: boolean; // uses /business/[id]/ prefix
}

const BUSINESS_NAV: NavItem[] = [
  { label: "AI Command Center",              href: "overview",   icon: <IconOverview />,  businessScoped: true },
  { label: "Business",     href: "onboarding", icon: <IconCommand />,   businessScoped: true, ai: true },
  { label: "Design",              href: "products",   icon: <IconProducts />,  businessScoped: true, ai: true },
  { label: "Launch", href: "launch",     icon: <IconLaunch />,    businessScoped: true, ai: true },
  { label: "Customer Support",      href: "support",    icon: <IconSupport />,   businessScoped: true, badge: 8 },
  { label: "Finance",               href: "finance",    icon: <IconFinance />,   businessScoped: true, ai: true },
];

const SYSTEM_NAV: NavItem[] = [
  { label: "Settings",        href: "settings",  icon: <IconSettings />,       businessScoped: true },
  { label: "All Businesses",  href: "/business", icon: <IconAllBusinesses /> },
];

// ── component ────────────────────────────────────────────────────────────────

const Sidebar = ({ businessId }: SidebarProps = {}) => {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  const displayName = user?.user_metadata?.full_name || user?.email || "User";
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const resolveHref = (item: NavItem) => {
    if (!item.businessScoped) return item.href;
    if (businessId) return `/business/${businessId}/${item.href}`;
    return "#";
  };

  const isActive = (item: NavItem) => {
    const href = resolveHref(item);
    return pathname === href || pathname.startsWith(href + "/");
  };

  const NavRow = ({ item }: { item: NavItem }) => {
    const href = resolveHref(item);
    const active = isActive(item);

    return (
      <Link
        href={href}
        className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
          active
            ? "bg-[#1a1a18] text-white"
            : "text-[#6B6A64] hover:bg-[#EEEDEA] hover:text-[#141412]"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span className={active ? "text-white" : "text-[#9E9D97]"}>
            {item.icon}
          </span>
          <span className="font-medium">{item.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {item.badge != null && (
            <span className="bg-[#C9A84C] text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none">
              {item.badge}
            </span>
          )}
          {item.ai && (
            <span className={`text-[10px] font-semibold ${active ? "text-[#C9A84C]" : "text-[#C9A84C]"}`}>
              AI
            </span>
          )}
        </div>
      </Link>
    );
  };

  return (
    <aside className="w-60 bg-[#F7F6F2] border-r border-[#E8E7E2] flex flex-col h-full overflow-y-auto">

      {/* Business switcher pill */}
      <div className="p-3">
        <div className="flex items-center justify-between p-2.5 bg-white border border-[#E8E7E2] rounded-xl cursor-pointer hover:bg-[#EEEDEA] transition">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#E8D08A] to-[#C9A84C] flex items-center justify-center text-[11px] font-bold text-white shrink-0">
              MK
            </div>
            <div>
              <div className="text-[13px] font-semibold text-[#141412] leading-tight">MokiPrints</div>
              <div className="text-[11px] text-[#9E9D97] leading-tight">3 agents active</div>
            </div>
          </div>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-[#9E9D97] shrink-0">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 pb-3 space-y-4">

        {/* BUSINESS section */}
        <div>
          <div className="text-[10px] font-semibold tracking-widest uppercase text-[#B0AFA9] px-3 mb-1">
            Business
          </div>
          <div className="space-y-0.5">
            {BUSINESS_NAV.map((item) => (
              <NavRow key={item.href} item={item} />
            ))}
          </div>
        </div>

        {/* SYSTEM section */}
        <div>
          <div className="text-[10px] font-semibold tracking-widest uppercase text-[#B0AFA9] px-3 mb-1">
            System
          </div>
          <div className="space-y-0.5">
            {SYSTEM_NAV.map((item) => (
              <NavRow key={item.href} item={item} />
            ))}
          </div>
        </div>
      </nav>

    </aside>
  );
};

export default Sidebar;
