"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { FiLogOut } from "react-icons/fi";
import { BiUser } from "react-icons/bi";

const ProfileDropdown = () => {
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen]);

  if (!user) return null;

  // Get user initials for avatar
  const getInitials = () => {
    const email = user.email || "";
    const parts = email.split("@")[0].split(".");
    return parts
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleLogout = async () => {
    try {
      await signOut();
      setIsOpen(false);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Profile Avatar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center text-sm justify-center gap-2 w-8 h-8 rounded-full bg-dark text-light hover:bg-neutral-700 transition-colors"
        aria-label="User profile menu"
      >
        {getInitials()}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 bg-light border border-neutral-200 rounded-lg shadow-lg z-50">
          {/* User Email */}
          <div className="px-4 py-3 flex items-center gap-2 border-neutral-200">
            <BiUser size={12} />
            <p className="text-xs text-neutral-900 truncate">{user.email}</p>
          </div>

          <div className="flex justify-center items-center">
            <hr className="border-neutral-300 w-11/12" />
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="w-full px-1.5 py-1.5 text-xs text-neutral-700"
          >
            <div className="flex px-2.5 rounded py-1.5 items-center gap-2 hover:bg-neutral-100 transition-colors">
              <FiLogOut size={12} />
              <p>Logout</p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};

export default ProfileDropdown;
