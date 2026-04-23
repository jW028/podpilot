"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<unknown>;
  signIn: (email: string, password: string) => Promise<unknown>;
  signOut: () => Promise<void>;
  signInWithOAuth: (provider: "google" | "apple") => Promise<unknown>;
  signInWithMagicLink: (email: string) => Promise<unknown>;
  signInWithOTP: (email: string) => Promise<unknown>;
  verifyOTP: (email: string, token: string) => Promise<unknown>;
  connectWithPrintify: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const signUp = async (email: string, password: string) => {
    return await supabase.auth.signUp({ email, password });
  };

  const signIn = async (email: string, password: string) => {
    return await supabase.auth.signInWithPassword({ email, password });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const signInWithOAuth = async (provider: "google" | "apple") => {
    if (typeof window === "undefined") {
      throw new Error("OAuth sign-in can only be used in the browser");
    }

    try {
      const result = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/oauth/callback`,
          skipBrowserRedirect: false,
        },
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      return result;
    } catch (error) {
      console.error(`OAuth sign-in error (${provider}):`, error);
      throw error;
    }
  };

  const signInWithMagicLink = async (email: string) => {
    return await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/email/callback`,
      },
    });
  };

  const signInWithOTP = async (email: string) => {
    // Send OTP for verification
    return await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/email/callback`,
      },
    });
  };

  const verifyOTP = async (email: string, token: string) => {
    return await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });
  };

  const connectWithPrintify = async () => {
    if (typeof window === "undefined") {
      throw new Error("Printify connection can only be used in the browser");
    }

    try {
      // Redirect to custom Printify OAuth endpoint
      window.location.href = `${window.location.origin}/auth/printify`;
    } catch (error) {
      console.error("Printify connection error:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signUp,
        signIn,
        signOut,
        signInWithOAuth,
        signInWithMagicLink,
        signInWithOTP,
        verifyOTP,
        connectWithPrintify,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
