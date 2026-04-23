"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import Button from "@/components/ui/shared/Button";
import OAuthButtons from "@/components/ui/shared/OAuthButtons";
import { FiEye, FiEyeOff } from "react-icons/fi";

const loginStyles = {
  container: "min-h-screen flex flex-col bg-light",
  main: "flex-1 flex items-center justify-center px-6 py-20",
  formContainer: "w-full max-w-md",
  heading: "font-serif text-3xl font-bold text-light-primary mb-2",
  subtext: "text-neutral-400 text-sm mb-8",
  formGroup: "mb-5",
  label: "block text-xs font-medium text-light-primary mb-2",
  input:
    "w-full px-4 py-2 border text-sm border-neutral-300 rounded-lg focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-light-primary",
  checkbox: "flex items-center gap-2 mb-6",
  checkboxInput:
    "w-4 h-4 accent-black border border-neutral-300 rounded cursor-pointer",
  checkboxLabel: "text-sm text-neutral-500 text-xs",
  divider: "my-6 text-center text-xs text-neutral-400",
  link: "text-primary-500 hover:text-primary-600 transition",
  errorMessage:
    "mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm",
  successMessage:
    "mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm",
};

const LoginPage = () => {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validation
    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    if (!password) {
      setError("Password is required");
      return;
    }

    setLoading(true);

    try {
      const response = await signIn(email, password);
      const { error: authError } = response as {
        error: { message: string } | null;
      };

      if (authError) {
        setError(authError.message || "Failed to sign in. Please try again.");
      } else {
        setSuccess("Signed in successfully! Redirecting...");
        setTimeout(() => {
          router.push("/dashboard");
        }, 1500);
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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

          {error && <div className={loginStyles.errorMessage}>{error}</div>}
          {success && (
            <div className={loginStyles.successMessage}>{success}</div>
          )}

          {/* OAuth Buttons */}
          <OAuthButtons
            disabled={loading}
            onError={setError}
            onLoading={setLoading}
          />

          <div className={loginStyles.divider}>Or continue with email</div>

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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            {/* Password */}
            <div className={loginStyles.formGroup}>
              <label htmlFor="password" className={loginStyles.label}>
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className={loginStyles.input}
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

            {/* Remember me */}
            <div className={loginStyles.checkbox}>
              <input
                id="remember"
                type="checkbox"
                className={loginStyles.checkboxInput}
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={loading}
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
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign in"}
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
            <a href="#" className={`text-xs ${loginStyles.link}`}>
              Forgot your password?
            </a>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
