"use client";

import React from "react";
import Button from "@/components/ui/shared/Button";

const registerStyles = {
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
  // TODO: registration backend
};

const RegisterPage = () => {
  return (
    <main className={registerStyles.container}>
      <div className={registerStyles.main}>
        <div className={registerStyles.formContainer}>
          <div className="mb-8">
            <h1 className={registerStyles.heading}>Create account</h1>
            <p className={registerStyles.subtext}>
              Join Potpilot and start automating your store today
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name */}
            <div className={registerStyles.formGroup}>
              <label htmlFor="fullname" className={registerStyles.label}>
                Full name
              </label>
              <input
                id="fullname"
                type="text"
                placeholder="John Doe"
                className={registerStyles.input}
                required
              />
            </div>

            {/* Email */}
            <div className={registerStyles.formGroup}>
              <label htmlFor="email" className={registerStyles.label}>
                Email address
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                className={registerStyles.input}
                required
              />
            </div>

            {/* Password */}
            <div className={registerStyles.formGroup}>
              <label htmlFor="password" className={registerStyles.label}>
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                className={registerStyles.input}
                required
              />
            </div>

            {/* Confirm Password */}
            <div className={registerStyles.formGroup}>
              <label htmlFor="confirmPassword" className={registerStyles.label}>
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                className={registerStyles.input}
                required
              />
            </div>

            {/* Terms & Conditions */}
            <div className={registerStyles.checkbox}>
              <input
                id="terms"
                type="checkbox"
                className={registerStyles.checkboxInput}
                required
              />
              <label htmlFor="terms" className={registerStyles.checkboxLabel}>
                I agree to the{" "}
                <a href="#" className={registerStyles.link}>
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="#" className={registerStyles.link}>
                  Privacy Policy
                </a>
              </label>
            </div>

            {/* Sign up button */}
            <Button
              variant="primary"
              size="md"
              className="w-full"
              type="submit"
            >
              Create account
            </Button>
          </form>

          {/* Divider */}
          <div className={registerStyles.divider}>
            Already have an account?{" "}
            <a href="/login" className={registerStyles.link}>
              Sign in
            </a>
          </div>
        </div>
      </div>
    </main>
  );
};

export default RegisterPage;
