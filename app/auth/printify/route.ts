import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Initiates Printify OAuth flow
 * Redirects user to Printify authorization
 */
export async function GET(request: NextRequest) {
  const printifyClientId = process.env.NEXT_PUBLIC_PRINTIFY_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/printify/callback`;

  if (!printifyClientId) {
    return NextResponse.json(
      { error: "Printify client ID not configured" },
      { status: 500 },
    );
  }

  const scope = "shops.write products.read"; // Adjust scopes as needed
  const state = Math.random().toString(36).substring(7); // Generate random state for security

  // Store state in cookie temporarily
  const response = NextResponse.redirect(
    `https://app.printify.com/oauth/authorize?client_id=${printifyClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${state}`,
  );

  response.cookies.set("printify_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
  });

  return response;
}
