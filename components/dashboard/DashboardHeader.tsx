import React from "react";
import Logo from "../ui/shared/Logo";
import ProfileDropdown from "../ui/shared/ProfileDropdown";
import Button from "../ui/shared/Button";

const numberOfBusinesses = 0;

const DashboardHeader = () => {
  return (
    <div className="flex justify-between items-center px-6 py-4 border border-neutral-300">
      <div className="flex justify-center items-center gap-4">
        <div>
          <Logo />
        </div>

        <div className="border-l border-0 border-neutral-300 h-6"></div>

        <div>
          <h1 className="font-serif font-bold">Your Businesses</h1>
          <p className="font-sans text-xs text-neutral-500">
            {numberOfBusinesses} active stores
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ProfileDropdown />
        <Button variant="primary" size="sm">
          + New Business
        </Button>
      </div>
    </div>
  );
};

export default DashboardHeader;
