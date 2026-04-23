"use client";

import React from "react";
import Button from "@/components/ui/Button";

const loginStyles = {
  container: "min-h-screen flex flex-col bg-light",
  main: "flex-1 flex items-center justify-center px-6 py-20",
  formContainer: "w-full max-w-md",
  heading: "font-serif text-3xl font-bold text-light-primary mb-2",
  subtext: "text-neutral-400 text-sm mb-8",
  formGroup: "mb-5",
  label: "block text-sm font-medium text-light-primary mb-2",
  input:
    "w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-light-primary",
  checkbox: "flex items-center gap-2 mb-6",
  checkboxInput: "w-4 h-4 border border-neutral-300 rounded cursor-pointer",
  checkboxLabel: "text-sm text-neutral-500",
  divider: "my-6 text-center text-xs text-neutral-400",
  link: "text-primary-500 hover:text-primary-600 transition",
};

const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  // TODO: login backend
};

const LoginPage = () => {
  return (
    <div className={loginStyles.container}>
      <main className={loginStyles.main}>
        <div className={loginStyles.formContainer}>
          <div className="mb-8">
            <h1 className={loginStyles.heading}>Welcome back</h1>
            <p className={loginStyles.subtext}>
              Sign in to your Podpilot account to continue
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className={loginStyles.formGroup}>
              <label htmlFor="email" className={loginStyles.label}>
                Email address
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                className={loginStyles.input}
                required
              />
            </div>

            {/* Password */}
            <div className={loginStyles.formGroup}>
              <label htmlFor="password" className={loginStyles.label}>
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                className={loginStyles.input}
                required
              />
            </div>

            {/* Remember me */}
            <div className={loginStyles.checkbox}>
              <input
                id="remember"
                type="checkbox"
                className={loginStyles.checkboxInput}
              />
              <label htmlFor="remember" className={loginStyles.checkboxLabel}>
                Remember me for 30 days
              </label>
            </div>

            {/* Sign in button */}
            <Button
              variant="primary"
              size="md"
              className="w-full"
              type="submit"
            >
              Sign in
            </Button>
          </form>

          {/* Divider */}
          <div className={loginStyles.divider}>
            Don&apos;t have an account?{" "}
            <a href="/register" className={loginStyles.link}>
              Create one
            </a>
          </div>

          {/* Forgot password link */}
          <div className="text-center">
            <a href="#" className={`text-sm ${loginStyles.link}`}>
              Forgot your password?
            </a>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
