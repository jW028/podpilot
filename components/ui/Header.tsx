"use client";

import Image from "next/image";
import React from "react";
import Button from "./shared/Button";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import ProfileDropdown from "./shared/ProfileDropdown";

const Header = () => {
  const { user, loading } = useAuth();

  return (
    <div className="border-b bg-light border-neutral-300 pt-8 px-10 flex justify-between items-center">
      <Link href="/">
        <Image
          src="/podpilot-logo.svg"
          alt="Podpilot Logo"
          width={75}
          height={25}
          priority
        />
      </Link>
      <div className="flex justify-center items-center gap-4">
        {loading ? (
          <div className="w-10 h-10 bg-neutral-200 rounded-full animate-pulse" />
        ) : user ? (
          // Logged in state
          <div className="flex items-center gap-4">
            <Button variant="primary" size="sm" href="/dashboard">
              Dashboard
            </Button>
            <ProfileDropdown />
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
