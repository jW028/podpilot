import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

/**
 * Handles OAuth callback for Google and Apple authentication
 * Exchanges authorization code for session
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/dashboard";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          },
        },
      },
    );

    try {
      await supabase.auth.exchangeCodeForSession(code);
      return NextResponse.redirect(new URL(next, request.url));
    } catch (error) {
      console.error("OAuth callback error:", error);
      return NextResponse.redirect(
        new URL("/login?error=auth_failed", request.url),
      );
    }
  }

  return NextResponse.redirect(new URL("/login", request.url));
}
