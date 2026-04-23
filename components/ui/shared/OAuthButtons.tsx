"use client";

import React, { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import Image from "next/image";
import { FaApple } from "react-icons/fa";
import { RiGoogleFill } from "react-icons/ri";

interface OAuthButtonsProps {
  disabled?: boolean;
  onError?: (error: string) => void;
  onLoading?: (loading: boolean) => void;
}

const OAuthButtons = ({
  disabled = false,
  onError,
  onLoading,
}: OAuthButtonsProps) => {
  const { signInWithOAuth, connectWithPrintify } = useAuth();
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  const handleOAuthClick = async (provider: "google" | "apple") => {
    setLoadingProvider(provider);
    onLoading?.(true);

    try {
      await signInWithOAuth(provider);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : `Failed to sign in with ${provider}`;
      onError?.(errorMessage);
      console.error(`OAuth error (${provider}):`, error);
    } finally {
      setLoadingProvider(null);
      onLoading?.(false);
    }
  };

  const handlePrintifyConnect = async () => {
    setLoadingProvider("printify");
    onLoading?.(true);

    try {
      await connectWithPrintify();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to connect Printify";
      onError?.(errorMessage);
      console.error("Printify error:", error);
      setLoadingProvider(null);
      onLoading?.(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Printify Button */}
      <button
        type="button"
        onClick={handlePrintifyConnect}
        disabled={disabled || loadingProvider !== null}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-xs font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Image
          src="/printify-logo-white.svg"
          alt="Printify Logo"
          width={12}
          height={12}
          className="text-white"
        />
        {loadingProvider === "printify"
          ? "Connecting..."
          : "Connect Printify Store"}
      </button>

      {/* Google Button */}
      <button
        type="button"
        onClick={() => handleOAuthClick("google")}
        disabled={disabled || loadingProvider !== null}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-neutral-300 rounded-lg text-xs font-medium text-light-primary hover:bg-neutral-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RiGoogleFill className="h-4 w-4" />
        {loadingProvider === "google"
          ? "Signing in..."
          : "Continue with Google"}
      </button>

      {/* Apple Button */}
      <button
        type="button"
        onClick={() => handleOAuthClick("apple")}
        disabled={disabled || loadingProvider !== null}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-neutral-300 rounded-lg text-xs font-medium text-light-primary hover:bg-neutral-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <FaApple className="h-4 w-4" />
        {loadingProvider === "apple" ? "Signing in..." : "Continue with Apple"}
      </button>
    </div>
  );
};

export default OAuthButtons;
