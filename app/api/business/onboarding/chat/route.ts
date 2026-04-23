import { NextResponse } from "next/server";

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
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

interface ChatResponsePayload {
  reply: string;
  frameworkReady: boolean;
  framework?: BusinessFramework;
}

const isFrameworkShapeValid = (payload: unknown): payload is BusinessFramework => {
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

const fallbackPayload: ChatResponsePayload = {
  reply:
    "I need a bit more detail. Tell me your target audience, desired vibe, and product category direction so I can finalize your business direction.",
  frameworkReady: false,
};

const parseModelJson = (content: string): unknown => {
  try {
    return JSON.parse(content);
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      return null;
    }

    try {
      return JSON.parse(content.slice(start, end + 1));
    } catch {
      return null;
    }
  }
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      messages?: ChatMessage[];
      framework?: BusinessFramework | null;
    };

    if (!body.messages || !Array.isArray(body.messages) || !body.messages.length) {
      return NextResponse.json(
        {
          success: false,
          message: "Conversation messages are required.",
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

    const systemPrompt = `You are Business Genesis Agent for a POD app.
Goal: converse naturally like ChatGPT to clarify business direction.

Rules:
- Ask concise follow-up questions when details are missing.
- Focus only on business feeling/theme/vibe, audience, product lane, direction.
- Do not finalize visual design.
- When enough details are confirmed and user shows proceed confidence, set frameworkReady=true and return framework.

Return STRICT JSON with this exact shape:
{
  "reply": "string",
  "frameworkReady": boolean,
  "framework": {
    "niche": "string",
    "theme": "string",
    "vibeKeywords": ["string"],
    "brandVoice": "string",
    "targetAudience": "string",
    "productLane": "string",
    "valueProposition": "string",
    "malaysiaTrendNote": "string",
    "risks": ["string"],
    "next30Days": ["string"]
  }
}

If not ready, set frameworkReady=false and framework=null.`;

    const messagesForModel = [
      { role: "system", content: systemPrompt },
      ...body.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ];

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
          temperature: 0.35,
          messages: messagesForModel,
        }),
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        {
          success: true,
          data: fallbackPayload,
          message: "Model unavailable. Returning fallback guidance.",
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
          data: fallbackPayload,
          message: "Model returned empty response.",
        },
        { status: 200 },
      );
    }

    const parsed = parseModelJson(content) as
      | {
          reply?: unknown;
          frameworkReady?: unknown;
          framework?: unknown;
        }
      | null;

    if (!parsed || typeof parsed.reply !== "string") {
      return NextResponse.json(
        {
          success: true,
          data: fallbackPayload,
          message: "Model response format invalid, using fallback.",
        },
        { status: 200 },
      );
    }

    const frameworkReady = Boolean(parsed.frameworkReady);
    const framework = frameworkReady && isFrameworkShapeValid(parsed.framework)
      ? parsed.framework
      : undefined;

    const payload: ChatResponsePayload = {
      reply: parsed.reply,
      frameworkReady: frameworkReady && Boolean(framework),
      framework,
    };

    return NextResponse.json({
      success: true,
      data: payload,
      message: "Conversation advanced successfully.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        success: false,
        message: "Unexpected error while running onboarding chat.",
      },
      { status: 500 },
    );
  }
}
