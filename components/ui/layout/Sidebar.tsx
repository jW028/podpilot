"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import Logo from "../shared/Logo";
import { GoWorkflow } from "react-icons/go";
import { MdOutlineAnalytics, MdOutlineLightbulb } from "react-icons/md";
import { TbArrowBackUp, TbCubeSend } from "react-icons/tb";
import { BiSupport } from "react-icons/bi";
import { IoSettingsOutline } from "react-icons/io5";
import { LuBoxes } from "react-icons/lu";
import Button from "../shared/Button";

interface SidebarProps {
  businessId?: string;
}

const sidebarStyles = {
  container:
    "w-60 border-r border-neutral-300 flex flex-col h-full overflow-y-auto fixed",
  header: "px-4 border-b border-neutral-300",
  businessSwitcher: "p-3",
  businessPill:
    "flex items-center justify-between p-2.5 bg-white border border-neutral-300 rounded-xl cursor-pointer hover:bg-light-secondary transition",
  businessAvatar:
    "w-8 h-8 rounded-lg bg-gradient-to-br from-primary-300 to-primary-500 flex items-center justify-center text-[11px] font-bold text-white shrink-0",
  businessName: "text-[12px] text-dark leading-tight text-left",
  businessSubtext: "text-[10px] text-neutral-400 leading-tight",
  businessChevron: "text-neutral-400 shrink-0",
  nav: "flex-1 px-3 pb-3 space-y-4",
  navSection: "space-y-0.5",
  navLabel:
    "text-[10px] tracking-widest uppercase font-semibold text-neutral-400/50 my-2 px-1",
  navRow: {
    base: "flex items-center justify-between px-3 py-3 rounded-lg text-xs transition-colors",
    active: "bg-dark text-white",
    inactive: "text-neutral-500 hover:bg-light-secondary hover:text-dark",
  },
  navRowIcon: {
    base: "shrink-0 text-sm",
    active: "text-white",
    inactive: "hover:text-neutral-500",
  },
  navRowContent: "flex items-center gap-2.5",
  navRowLabel: "font-medium",
  navRowMeta: "flex items-center gap-1.5",
  badge:
    "bg-primary-500 text-white text-[10px] font-semibold h-4 w-4 flex justify-center items-center rounded-full leading-none",
  userFooter: "p-3 border-t border-neutral-300 flex flex-col gap-2",
  userRow:
    "flex items-center justify-between px-2 py-2 rounded-lg cursor-pointer hover:bg-light-secondary transition group",
  userAvatar:
    "w-8 h-8 rounded-full bg-dark flex items-center justify-center text-light text-sm text-white shrink-0",
  userInfo: "min-w-0 flex flex-col gap-1",
  userName:
    "text-[12px] font-semibold text-dark truncate max-w-35 leading-tight",
  userEmail: "text-[10px] text-neutral-400 truncate max-w-35 leading-tight",
};

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
  ai?: boolean;
  businessScoped?: boolean;
}

const BUSINESS_NAV: NavItem[] = [
  {
    label: "Command Centre",
    href: "workflow",
    icon: <GoWorkflow />,
    businessScoped: true,
  },
  {
    label: "Build Your Business",
    href: "onboarding",
    icon: <MdOutlineLightbulb />,
    businessScoped: true,
  },
  {
    label: "Manage Products",
    href: "products",
    icon: <LuBoxes />,
    businessScoped: true,
  },
  {
    label: "Launch & Integrations",
    href: "launch",
    icon: <TbCubeSend />,
    businessScoped: true,
  },
  {
    label: "Customer Support",
    href: "support",
    icon: <BiSupport />,
    businessScoped: true,
    badge: 8,
  },
  {
    label: "Finance & Analytics",
    href: "finance",
    icon: <MdOutlineAnalytics />,
    businessScoped: true,
  },
];

const SYSTEM_NAV: NavItem[] = [
  {
    label: "Settings",
    href: "settings",
    icon: <IoSettingsOutline />,
    businessScoped: true,
  },
  {
    label: "Return to Dashboard",
    href: "dashboard",
    icon: <TbArrowBackUp />,
  },
];

const Sidebar = ({ businessId }: SidebarProps = {}) => {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  const [businesses, setBusinesses] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchBusinesses = async () => {
      try {
        const res = await fetch("/api/businesses");
        if (res.ok) {
          const data = await res.json();
          setBusinesses(data);
        }
      } catch (err) {
        console.error("Failed to fetch businesses", err);
      }
    };
    fetchBusinesses();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentBusiness =
    businesses.find((b) => b.id === businessId) || businesses[0];
  const businessName =
    currentBusiness?.name || (businessId ? "Loading..." : "Select Business");
  const businessInitials = currentBusiness?.name
    ? currentBusiness.name.slice(0, 2).toUpperCase()
    : "??";

  const displayName = user?.user_metadata?.full_name || user?.email || "User";
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const resolveHref = (item: NavItem) => {
    if (!item.businessScoped) return `/${item.href}`;
    if (businessId) return `/business/${businessId}/${item.href}`;
    return "#";
  };

  const isActive = (item: NavItem) => {
    const href = resolveHref(item);
    return pathname === href;
  };

  const NavRow = ({ item }: { item: NavItem }) => {
    const href = resolveHref(item);
    const active = isActive(item);

    return (
      <Link
        href={href}
        className={`${sidebarStyles.navRow.base} ${
          active ? sidebarStyles.navRow.active : sidebarStyles.navRow.inactive
        }`}
      >
        <div className={sidebarStyles.navRowContent}>
          <span
            className={`${sidebarStyles.navRowIcon.base} ${
              active
                ? sidebarStyles.navRowIcon.active
                : sidebarStyles.navRowIcon.inactive
            }`}
          >
            {item.icon}
          </span>
          <span className={sidebarStyles.navRowLabel}>{item.label}</span>
        </div>
        <div className={sidebarStyles.navRowMeta}>
          {item.badge != null && (
            <span className={sidebarStyles.badge}>{item.badge}</span>
          )}
        </div>
      </Link>
    );
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const numberOfActiveAgents = 3;

  return (
    <aside className={sidebarStyles.container}>
      {/* Business switcher pill */}
      <div className={sidebarStyles.header}>
        <Logo />
      </div>
      <div
        className={`${sidebarStyles.businessSwitcher} relative`}
        ref={dropdownRef}
      >
        <button
          className="w-full text-left"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        >
          <div className={sidebarStyles.businessPill}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={sidebarStyles.businessAvatar}>
                {businessInitials}
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <div className={`${sidebarStyles.businessName} truncate`}>
                  {businessName}
                </div>
                <div className={sidebarStyles.businessSubtext}>
                  {numberOfActiveAgents} agents active
                </div>
              </div>
            </div>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              className={`${sidebarStyles.businessChevron} transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
            >
              <path
                d="M3 4.5L6 7.5L9 4.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </button>

        {isDropdownOpen && (
          <div className="absolute top-full left-3 right-3 mt-1 bg-white border border-neutral-200 rounded-xl shadow-lg z-50 overflow-hidden">
            <div className="p-1 max-h-48 overflow-y-auto">
              {businesses.length === 0 ? (
                <div className="px-3 py-2 text-xs text-neutral-500 text-center">
                  Loading...
                </div>
              ) : (
                businesses.map((b) => (
                  <Link
                    key={b.id}
                    href={`/business/${b.id}/workflow`}
                    onClick={() => setIsDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-light-secondary transition-colors"
                  >
                    <div className="w-6 h-6 rounded bg-gradient-to-br from-primary-300 to-primary-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                      {b.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="text-xs font-medium text-dark truncate flex-1">
                      {b.name}
                    </div>
                    {b.id === businessId && (
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    )}
                  </Link>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className={sidebarStyles.nav}>
        {/* BUSINESS section */}
        <div>
          <div className={sidebarStyles.navLabel}>Business</div>
          <div className={sidebarStyles.navSection}>
            {BUSINESS_NAV.map((item) => (
              <NavRow key={item.href} item={item} />
            ))}
          </div>
        </div>

        {/* SYSTEM section */}
        <div>
          <div className={sidebarStyles.navLabel}>System</div>
          <div className={sidebarStyles.navSection}>
            {SYSTEM_NAV.map((item) => (
              <NavRow key={item.href} item={item} />
            ))}
          </div>
        </div>
      </nav>

      {/* User footer */}
      <div className={sidebarStyles.userFooter}>
        {/* profile btn */}
        <div className={sidebarStyles.userRow}>
          <div className="flex items-center gap-2.5">
            <div className={sidebarStyles.userAvatar}>{initials}</div>
            <div className={sidebarStyles.userInfo}>
              <div className={sidebarStyles.userName}>{displayName}</div>
              <div className={sidebarStyles.userEmail}>{user?.email}</div>
            </div>
          </div>
        </div>

        {/* logout btn */}
        <Button
          variant="outline"
          className="w-full"
          size="sm"
          onClick={handleLogout}
        >
          Sign Out
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;
