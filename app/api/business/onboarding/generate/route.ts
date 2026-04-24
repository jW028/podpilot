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

const fallbackFramework = (input: OnboardingInput): BusinessFramework => ({
  niche: input.productDirection,
  theme: input.vibe,
  vibeKeywords: input.vibe
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .slice(0, 5),
  brandVoice: "Friendly, confident, and practical",
  targetAudience: input.targetAudience,
  productLane: input.productDirection,
  valueProposition:
    "A focused POD brand direction that can launch quickly and iterate with customer feedback.",
  malaysiaTrendNote:
    "Malaysia trend signal not available, using foundational POD direction from your inputs.",
  risks: [
    "Initial product-market fit may need 2-3 iterations.",
    "Listing quality and consistency will affect early traction.",
  ],
  next30Days: [
    "Finalize brand direction and handoff to design agent.",
    "Prepare first product lane listing strategy.",
    "Track first customer feedback and adjust messaging.",
  ],
});

const isFrameworkShapeValid = (
  payload: unknown,
): payload is BusinessFramework => {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Record<string, unknown>;

  const hasStrings =
    typeof candidate.niche === "string" &&
    typeof candidate.theme === "string" &&
    typeof candidate.brandVoice === "string" &&
    typeof candidate.targetAudience === "string" &&
    typeof candidate.productLane === "string" &&
    typeof candidate.valueProposition === "string" &&
    typeof candidate.malaysiaTrendNote === "string";

  const hasArrays =
    Array.isArray(candidate.vibeKeywords) &&
    Array.isArray(candidate.risks) &&
    Array.isArray(candidate.next30Days);

  return hasStrings && hasArrays;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { input?: OnboardingInput };
    const input = body.input;

    if (!input) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing onboarding input.",
        },
        { status: 400 },
      );
    }

    const apiKey = process.env.GLM_API_KEY;
    const model = process.env.GLM_MODEL || "ilmu-glm-5.1";
    const baseUrl = process.env.ILMU_BASE_URL || "https://api.ilmu.ai/v1";

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing GLM API key.",
        },
        { status: 500 },
      );
    }

    const prompt = `You are a business prompting agent for a POD startup workflow.
Return strict JSON only with the exact schema below and no markdown.
Schema:
{
  "niche": string,
  "theme": string,
  "vibeKeywords": string[],
  "brandVoice": string,
  "targetAudience": string,
  "productLane": string,
  "valueProposition": string,
  "malaysiaTrendNote": string,
  "risks": string[],
  "next30Days": string[]
}

Constraints:
- This is business direction only.
- Do not include any visual design instructions.
- Keep trend note grounded for Malaysia context.

User context:
${JSON.stringify(input)}`;

    const response = await fetch(
      `${baseUrl.replace(/\/+$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.4,
          messages: [{ role: "user", content: prompt }],
        }),
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        {
          success: true,
          data: fallbackFramework(input),
          message: "Model request failed, using fallback business framework.",
        },
        { status: 200 },
      );
    }

    const completion = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = completion.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        {
          success: true,
          data: fallbackFramework(input),
          message: "Model returned empty content, using fallback.",
        },
        { status: 200 },
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json(
        {
          success: true,
          data: fallbackFramework(input),
          message: "Model returned non-JSON response, using fallback.",
        },
        { status: 200 },
      );
    }

    if (!isFrameworkShapeValid(parsed)) {
      return NextResponse.json(
        {
          success: true,
          data: fallbackFramework(input),
          message: "Model returned invalid shape, using fallback.",
        },
        { status: 200 },
      );
    }

    return NextResponse.json({
      success: true,
      data: parsed,
      message: "Business framework generated successfully.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        success: false,
        message: "Unexpected error while generating business framework.",
      },
      { status: 500 },
    );
  }
}
