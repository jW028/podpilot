import React from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number | string;
    trend: "up" | "down";
    label: string;
  };
  icon?: React.ReactNode;
}

const StatCard = ({ title, value, change }: StatCardProps) => {
  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-sm">
      <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-3">
        {title}
      </p>
      <p className="text-3xl font-serif font-bold text-dark mb-2">{value}</p>
      {change && (
        <p
          className={`text-xs font-medium ${
            change.trend === "up" ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {change.trend === "up" ? "↑" : "↓"} {change.value} {change.label}
        </p>
      )}
    </div>
  );
};

export default StatCard;
