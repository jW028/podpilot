import React from "react";
import Logo from "../ui/shared/Logo";
import ProfileDropdown from "../ui/shared/ProfileDropdown";
import Button from "../ui/shared/Button";

interface DashboardHeaderProps {
  businessCount?: number;
  onCreateClick?: () => void;
}

const DashboardHeader = ({
  businessCount = 0,
  onCreateClick,
}: DashboardHeaderProps) => {
  return (
    <div className="flex justify-between items-center px-6 py-4 border border-neutral-300 bg-white">
      <div className="flex justify-center items-center gap-4">
        <div>
          <Logo />
        </div>

        <div className="border-l border-0 border-neutral-300 h-6"></div>

        <div className="flex flex-col justify-center">
          <h1 className="font-serif font-bold text-dark leading-none mb-1.5">
            Your Businesses
          </h1>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <p className="font-sans text-xs text-neutral-500 leading-none">
              {businessCount} active store{businessCount !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ProfileDropdown />
        <Button variant="primary" size="sm" onClick={onCreateClick}>
          + New Business
        </Button>
      </div>
    </div>
  );
};

export default DashboardHeader;
