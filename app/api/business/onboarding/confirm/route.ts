import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

interface OnboardingInput {
  businessName: string;
  vibe: string;
  targetAudience: string;
  purpose: string;
  productDirection: string;
  confidence: number;
}

interface BusinessFramework {
  niche: string;
  theme: string;
  vibeKeywords: string[];
  brandVoice: string;
  targetAudience: string;
  productLane: string;
  valueProposition: string;
  malaysiaTrendNote: string;
  risks: string[];
  next30Days: string[];
}

const hasProceedIntent = (message: string) => {
  const normalized = message.toLowerCase().trim();

  const positiveSignals = [
    "proceed",
    "go ahead",
    "continue",
    "sounds good",
    "let's do it",
    "yes",
    "confirm",
    "i'm confident",
    "im confident",
    "move forward",
  ];

  const negativeSignals = [
    "not ready",
    "don't",
    "do not",
    "stop",
    "wait",
    "not sure",
    "uncertain",
    "change this",
    "revise",
  ];

  const hasNegative = negativeSignals.some((signal) =>
    normalized.includes(signal),
  );
  if (hasNegative) {
    return false;
  }

  return positiveSignals.some((signal) => normalized.includes(signal));
};

export async function POST(request: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !anonKey || !serviceRoleKey) {
      return NextResponse.json(
        {
          success: false,
          message: "Supabase environment variables are not configured.",
        },
        { status: 500 },
      );
    }

    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing auth token.",
        },
        { status: 401 },
      );
    }

    const authClient = createClient(url, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid user session.",
        },
        { status: 401 },
      );
    }

    const body = (await request.json()) as {
      businessId?: string;
      input?: OnboardingInput;
      framework?: BusinessFramework;
      confirmationMessage?: string;
    };

    const { businessId, input, framework, confirmationMessage } = body;

    if (!businessId || !input || !framework || !confirmationMessage) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing required confirmation payload.",
        },
        { status: 400 },
      );
    }

    if (!hasProceedIntent(confirmationMessage)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Your message does not clearly indicate confirmation to proceed. Please confirm in clear terms.",
        },
        { status: 400 },
      );
    }

    const serviceClient = createClient(url, serviceRoleKey);

    const { error: businessError } = await serviceClient.from("businesses").upsert(
      {
        id: businessId,
        user_id: user.id,
        name: input.businessName || framework.theme,
        niche: framework.niche,
        status: "active",
      },
      {
        onConflict: "id",
      },
    );

    if (businessError) {
      return NextResponse.json(
        {
          success: false,
          message: `Could not save business record: ${businessError.message}`,
        },
        { status: 500 },
      );
    }

    const { error: brandError } = await serviceClient.from("brand_profiles").upsert(
      {
        business_id: businessId,
        brand_name: input.businessName || framework.theme,
        tagline: framework.valueProposition,
        brand_voice: framework.brandVoice,
        target_audience: framework.targetAudience,
        color_palette: {
          theme: framework.theme,
          vibeKeywords: framework.vibeKeywords,
        },
        printify_setup_status: "pending",
      },
      {
        onConflict: "business_id",
      },
    );

    if (brandError) {
      return NextResponse.json(
        {
          success: false,
          message: `Could not save brand profile: ${brandError.message}`,
        },
        { status: 500 },
      );
    }

    const { error: workflowError } = await serviceClient.from("workflows").insert({
      business_id: businessId,
      type: "business_creation",
      source_agent: "business_prompting_agent",
      target_agent: "design_agent",
      payload: {
        businessInput: input,
        confirmedFramework: framework,
        confirmationMessage,
      },
      state: "processed",
      processed_at: new Date().toISOString(),
    });

    if (workflowError) {
      return NextResponse.json(
        {
          success: false,
          message: `Could not write workflow handoff: ${workflowError.message}`,
        },
        { status: 500 },
      );
    }

    // ── Finance agent event: business_created ──────────────────────────────────
    // Non-blocking: a failure here should not interrupt the user's confirm flow.
    const { error: financeEventError } = await serviceClient
      .from("workflows")
      .insert({
        business_id: businessId,
        type: "business_created",
        source_agent: "business_prompting_agent",
        target_agent: "finance_agent",
        payload: {
          business_id: businessId,
          business_name: input.businessName || framework.theme,
          niche: framework.niche,
          target_margin_percent: 30, // Finance default; override if business specifies one
        },
        state: "pending",
      });

    if (financeEventError) {
      console.error(
        "[confirm/route] Failed to emit business_created event to finance_agent:",
        financeEventError.message,
      );
    }

    return NextResponse.json({
      success: true,
      message: "Business direction confirmed.",
      redirectTo: `/business/${businessId}/workflow`,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        success: false,
        message: "Unexpected error while confirming onboarding.",
      },
      { status: 500 },
    );
  }
}
