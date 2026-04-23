"use client";

import Image from "next/image";
import React from "react";
import Button from "../shared/Button";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import ProfileDropdown from "../shared/ProfileDropdown";
import Logo from "../shared/Logo";

const Header = () => {
  const { user, loading } = useAuth();

  return (
    <div className="flex justify-between items-center px-6 py-4 border-b border-neutral-300 bg-light">
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
          <div className="flex justify-center items-center gap-2">
            <Button variant="outline" size="sm" href="/login">
              Log in
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
