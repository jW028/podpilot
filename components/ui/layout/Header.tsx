"use client";

import React from "react";
import Button from "../shared/Button";
import { useAuth } from "@/hooks/useAuth";
import ProfileDropdown from "../shared/ProfileDropdown";
import Logo from "../shared/Logo";
import LoadingState from "../shared/LoadingState";

const Header = () => {
  const { user, loading } = useAuth();

  const containerClass = user
    ? "flex justify-between items-center px-6 py-4 border-b border-neutral-300 bg-light"
    : "flex justify-between items-center px-8 py-5 bg-neutral-50";

  if (loading) {
    return (
      <div className="fixed bg-inherit z-10 h-screen w-screen flex justify-center items-center">
        <LoadingState message="Loading..." />
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <div className="flex justify-center items-center">
        <Logo />
      </div>
      <div className="flex justify-center items-center">
        {user ? (
          // Logged in state
          <div className="flex items-center gap-2">
            <ProfileDropdown />
            <Button variant="primary" size="sm" href="/dashboard">
              Dashboard
            </Button>
          </div>
        ) : (
          // Not logged in state
          <div className="flex justify-center items-center gap-4">
            <Button variant="outline" size="sm" href="/login">
              Log In
            </Button>
            <Button variant="primary" size="sm" href="/register">
              Get started
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Header;
