"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import Button from "@/components/ui/shared/Button";
import OAuthButtons from "@/components/ui/shared/OAuthButtons";
import { FiEye, FiEyeOff } from "react-icons/fi";

const registerStyles = {
  container: "min-h-screen flex flex-col bg-light",
  main: "flex-1 flex items-center justify-center px-6 py-20",
  formContainer: "w-full max-w-md",
  heading: "font-serif text-3xl font-bold text-light-primary mb-2",
  subtext: "text-neutral-400 text-sm mb-8",
  formGroup: "mb-5",
  label: "block text-xs font-medium text-light-primary mb-2",
  input:
    "w-full px-4 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-light-primary",
  checkbox: "flex items-center gap-2 mb-6",
  checkboxInput: "w-4 h-4 border border-neutral-300 rounded cursor-pointer",
  checkboxLabel: "text-xs text-neutral-500",
  divider: "my-6 text-center text-xs text-neutral-400",
  link: "text-primary-500 hover:text-primary-600 transition",
  errorMessage:
    "mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm",
  successMessage:
    "mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm",
};

const RegisterPage = () => {
  const router = useRouter();
  const { signUp } = useAuth();
  const [fullname, setFullname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validation
    if (!fullname.trim()) {
      setError("Full name is required");
      return;
    }

    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    if (!password) {
      setError("Password is required");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!termsAccepted) {
      setError("You must agree to the Terms of Service and Privacy Policy");
      return;
    }

    setLoading(true);

    try {
      const response = await signUp(email, password);
      const { error: authError } = response as {
        error: { message: string } | null;
      };

      if (authError) {
        setError(
          authError.message || "Failed to create account. Please try again.",
        );
      } else {
        setSuccess(
          "Account created successfully! Check your email to confirm.",
        );
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={registerStyles.container}>
      <div className={registerStyles.main}>
        <div className={registerStyles.formContainer}>
          <div className="mb-8">
            <h1 className={registerStyles.heading}>Create account</h1>
            <p className={registerStyles.subtext}>
              Join Podpilot and start automating your store today
            </p>
          </div>

          {error && <div className={registerStyles.errorMessage}>{error}</div>}
          {success && (
            <div className={registerStyles.successMessage}>{success}</div>
          )}

          {/* OAuth Buttons */}
          <OAuthButtons
            disabled={loading}
            onError={setError}
            onLoading={setLoading}
          />

          <div className={registerStyles.divider}>Or register with email</div>

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
                value={fullname}
                onChange={(e) => setFullname(e.target.value)}
                disabled={loading}
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            {/* Password */}
            <div className={registerStyles.formGroup}>
              <label htmlFor="password" className={registerStyles.label}>
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className={registerStyles.input}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-700 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FiEye size={18} /> : <FiEyeOff size={18} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className={registerStyles.formGroup}>
              <label htmlFor="confirmPassword" className={registerStyles.label}>
                Confirm password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className={registerStyles.input}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-700 transition-colors"
                  aria-label={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
                >
                  {showConfirmPassword ? (
                    <FiEye size={18} />
                  ) : (
                    <FiEyeOff size={18} />
                  )}
                </button>
              </div>
            </div>

            {/* Terms & Conditions */}
            <div className={registerStyles.checkbox}>
              <input
                id="terms"
                type="checkbox"
                className={registerStyles.checkboxInput}
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                disabled={loading}
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
              disabled={loading}
            >
              {loading ? "Creating account..." : "Create account"}
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
