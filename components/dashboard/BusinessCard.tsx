"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

interface BusinessCardProps {
  id: string;
  name: string;
  niche?: string;
  status: string;
  revenue?: number;
  products?: number;
  marketplace?: string;
  agentStatus?: {
    status: string;
    icon: string;
  };
  onboardingProgress?: {
    current: number;
    total: number;
  };
}

const BusinessCard = ({
  id,
  name,
  niche,
  status,
  revenue = 0,
  products = 0,
  marketplace,
  agentStatus,
  onboardingProgress,
}: BusinessCardProps) => {
  const getInitials = (text: string) => {
    return text
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (text: string) => {
    return "bg-light-secondary border border-neutral-200 text-dark";
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return {
          bg: "bg-emerald-100",
          text: "text-emerald-700",
          label: "Active",
        };
      case "setting up":
      case "draft":
        return {
          bg: "bg-amber-100",
          text: "text-amber-700",
          label: "Setting up",
        };
      case "paused":
        return {
          bg: "bg-neutral-100",
          text: "text-neutral-700",
          label: "Paused",
        };
      default:
        return {
          bg: "bg-neutral-100",
          text: "text-neutral-700",
          label: status,
        };
    }
  };

  const statusBadge = getStatusBadge(status);

  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 flex-1">
          <div
            className={`w-10 h-10 rounded-lg ${getAvatarColor(name)} flex items-center justify-center font-serif font-bold text-sm`}
          >
            {getInitials(name)}
          </div>
          <div className="flex-1">
            <h3 className="font-serif text-lg font-bold text-dark">{name}</h3>
            {niche && <p className="text-xs text-neutral-500">{niche}</p>}
          </div>
        </div>
        <span
          className={`text-xs font-semibold px-2 py-1 rounded-full ${statusBadge.bg} ${statusBadge.text}`}
        >
          {statusBadge.label}
        </span>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 mb-4 py-4 border-t border-b border-neutral-200">
        <div>
          <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">
            Revenue
          </p>
          <p className="text-lg font-semibold text-dark">
            RM {revenue.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">
            Products
          </p>
          <p className="text-lg font-semibold text-dark">{products}</p>
        </div>
        <div>
          <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">
            Platform
          </p>
          <p className="text-lg font-semibold text-dark">
            {marketplace
              ? marketplace.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
              : "—"}
          </p>
        </div>
      </div>

      {/* Agent Status or Onboarding Progress */}
      <div className="mb-4">
        {onboardingProgress ? (
          <div>
            <p className="text-xs text-neutral-500 mb-2">
              Step {onboardingProgress.current}/{onboardingProgress.total} —{" "}
              {onboardingProgress.current === 3 ? "Platform setup" : "Setup"}
            </p>
            <div className="w-full bg-neutral-200 rounded-full h-2">
              <div
                className="bg-primary-500 h-2 rounded-full transition-all"
                style={{
                  width: `${(onboardingProgress.current / onboardingProgress.total) * 100}%`,
                }}
              ></div>
            </div>
          </div>
        ) : agentStatus ? (
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                agentStatus.icon === "running"
                  ? "bg-amber-400 animate-pulse"
                  : agentStatus.icon === "idle"
                    ? "bg-emerald-400"
                    : "bg-red-400"
              }`}
            />
            <p className="text-sm text-neutral-600">{agentStatus.status}</p>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">No active agents</p>
        )}
      </div>

      {/* Action Button */}
      <Link
        href={`/business/${id}/workflow`}
        className="flex items-center justify-between px-3 py-2 rounded-lg bg-light-secondary hover:bg-neutral-100 transition-colors group text-dark mt-2 border border-transparent hover:border-neutral-200"
      >
        <span className="text-sm font-medium">View Business</span>
        <ArrowRight className="h-4 w-4 text-neutral-400 group-hover:translate-x-1 group-hover:text-dark transition-all" />
      </Link>
    </div>
  );
};

export default BusinessCard;
