"use client";

import React from "react";
import Link from "next/link";
import Button from "../shared/Button";
import { useAuth } from "@/hooks/useAuth";
import ProfileDropdown from "../shared/ProfileDropdown";
import Logo from "../shared/Logo";

const Header = () => {
  const { user, loading } = useAuth();

  const containerClass = user
    ? "flex justify-between items-center px-6 py-4 border-b border-neutral-300 bg-light"
    : "flex justify-between items-center px-8 py-5 bg-neutral-50";

  return (
    <div className={containerClass}>
      <div className="flex justify-center items-center">
        <Logo />
      </div>
      <div className="flex justify-center items-center">
        {loading ? (
          <div className="w-10 h-10 bg-neutral-200 rounded-full animate-pulse" />
        ) : user ? (
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
            <Link
              href="/login"
              className="text-neutral-900 hover:text-primary-500 transition text-sm font-medium"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="bg-neutral-900 text-white hover:bg-neutral-700 px-5 py-2 text-sm font-medium rounded-full transition"
            >
              Get started
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default Header;
