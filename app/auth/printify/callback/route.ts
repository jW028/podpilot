import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { encryptPrintifyToken } from "@/lib/printify/credentials";

type PrintifyShop = {
  id: string | number;
  title?: string;
  sales_channel?: string;
};

type PrintifyChannel = {
  shop_id: string;
  title: string;
  channel: string;
};

/**
 * Handles Printify OAuth callback
 * Exchanges authorization code for access token and user shops
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const error_description = searchParams.get("error_description");

  const cookieStore = await cookies();
  const storedState = cookieStore.get("printify_oauth_state")?.value;

  // Validate state for security
  if (!state || state !== storedState) {
    return NextResponse.redirect(
      new URL("/login?error=invalid_state", request.url),
    );
  }

  // Handle authorization errors
  if (error) {
    console.error("Printify OAuth error:", error_description);
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error)}`, request.url),
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=missing_code", request.url),
    );
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch("https://api.printify.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.NEXT_PUBLIC_PRINTIFY_CLIENT_ID,
        client_secret: process.env.PRINTIFY_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri:
          process.env.NEXT_PUBLIC_APP_URL ||
          "http://localhost:3000" + "/auth/printify/callback",
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error("Token exchange failed:", errorData);
      return NextResponse.redirect(
        new URL("/login?error=token_exchange_failed", request.url),
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return NextResponse.redirect(
        new URL("/login?error=no_access_token", request.url),
      );
    }

    // Get Printify account info (shops)
    const shopsResponse = await fetch(
      "https://api.printify.com/v1/shops.json",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!shopsResponse.ok) {
      throw new Error("Failed to fetch Printify shops");
    }

    const shopsData = await shopsResponse.json() as { data?: PrintifyShop[] };
    const shops = shopsData.data || [];

    if (shops.length === 0) {
      return NextResponse.redirect(
        new URL("/login?error=no_printify_shops", request.url),
      );
    }

    // Use the first shop or you could implement shop selection
    const primaryShop = shops[0];

    // Build sales_channels array from all shops
    const salesChannels: PrintifyChannel[] = shops.map((shop) => ({
      shop_id: String(shop.id),
      title: shop.title || '',
      channel: shop.sales_channel || 'disconnected',
    }));

    // Create/update user in Supabase with Printify info
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

    // Get or create user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // Sign up with temporary Printify email
      const printifyEmail = `printify-${primaryShop.id}-${Date.now()}@podpilot.local`;

      const { error: signUpError } =
        await supabase.auth.signUp({
          email: printifyEmail,
          password: Math.random().toString(36).substring(16), // Random password (OAuth only)
          options: {
            data: {
              printify_connected: true,
              printify_shop_id: primaryShop.id,
              printify_shop_title: primaryShop.title,
              printify_sales_channels: salesChannels,
            },
          },
        });

      if (signUpError) {
        console.error("Signup error:", signUpError);
        return NextResponse.redirect(
          new URL("/login?error=signup_failed", request.url),
        );
      }

      // Token is now persisted per-business when a business exists.
    } else {
      // Update existing user with Printify info
      await supabase.auth.updateUser({
        data: {
          printify_connected: true,
          printify_shop_id: primaryShop.id,
          printify_shop_title: primaryShop.title,
          printify_sales_channels: salesChannels,
        },
      });

      // Update sales_channels + encrypted token on the user's business
      const { data: businesses } = await supabase
        .from("businesses")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);

      if (businesses && businesses.length > 0) {
        await supabase
          .from("businesses")
          .update({
            printify_pat_hint: encryptPrintifyToken(accessToken),
            sales_channels: salesChannels,
            printify_shop_id: String(primaryShop.id),
            marketplace: primaryShop.sales_channel || primaryShop.title,
          })
          .eq("id", businesses[0].id);
      }
    }

    // Clean up state cookie
    cookieStore.delete("printify_oauth_state");

    return NextResponse.redirect(
      new URL("/dashboard?printify=connected", request.url),
    );
  } catch (error) {
    console.error("Printify OAuth callback error:", error);
    return NextResponse.redirect(
      new URL("/login?error=callback_failed", request.url),
    );
  }
}
