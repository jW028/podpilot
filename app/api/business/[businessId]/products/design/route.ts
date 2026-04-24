import { NextResponse } from "next/server";

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

interface DesignSuggestion {
  element: string;
  suggestion: string;
  reasoning: string;
}

interface FieldSuggestion {
  fieldName: string;
  type: string;
  label?: string;
  value: string | number | string[];
  options?: string[];
  placeholder?: string;
}

interface ChatResponsePayload {
  reply: string;
  suggestions?: DesignSuggestion[];
  designGuidance?: string;
  fieldSuggestions?: FieldSuggestion[];
}

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

const fallbackPayload: ChatResponsePayload = {
  reply:
    "I'm your Design Agent. I can help you design your print-on-demand product, suggest product types, and auto-fill fields based on your requirements. What kind of product would you like to create?",
};

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ businessId: string }>;
  },
) {
  try {
    const { businessId } = await params;

    const body = (await request.json()) as {
      messages?: ChatMessage[];
      productContext?: {
        title?: string;
        description?: string;
        attributes?: Record<string, unknown>;
      };
      businessContext?: {
        name?: string;
        niche?: string;
      };
    };

    if (!businessId) {
      return NextResponse.json(
        {
          success: false,
          message: "Business ID is required.",
        },
        { status: 400 },
      );
    }

    if (
      !body.messages ||
      !Array.isArray(body.messages) ||
      !body.messages.length
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Conversation messages are required.",
        },
        { status: 400 },
      );
    }

    const apiKey = process.env.GLM_API_KEY;
    const model = process.env.GLM_MODEL!;
    const baseUrl = process.env.ILMU_BASE_URL!;

    if (!apiKey || !model || !baseUrl) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing GLM API configuration.",
        },
        { status: 500 },
      );
    }

    const businessName = body.businessContext?.name || "Your Business";
    const businessNiche = body.businessContext?.niche || "General";
    const productTitle = body.productContext?.title || "Product";
    const productDescription = body.productContext?.description || "";
    const productAttributes = body.productContext?.attributes;

    const systemPrompt = `You are Design Agent for a POD (Print-on-Demand) application called Podpilot.

Business Context:
- Business: ${businessName}
- Niche: ${businessNiche}

Product Context:
- Product: ${productTitle}
${productDescription ? `- Description: ${productDescription}` : ""}
${productAttributes ? `- Current Attributes: ${JSON.stringify(productAttributes)}` : ""}

Role:
You help users create and design their print-on-demand products. You:
1. Suggest product types based on the user's idea (e.g., t-shirt, hoodie, mug, poster)
2. Guide users through filling in product attributes
3. Auto-fill field values based on the user's description and business context
4. Provide design recommendations and best practices
5. Help with color, typography, and layout choices for print

When you have enough context to suggest specific field values for the product, include them in "fieldSuggestions". Each suggestion should have:
- fieldName: the attribute key (e.g., "color_options", "size_range", "material")
- type: "text", "number", or "selection"
- label: human-readable label
- value: the suggested value (string for text, number for number, string for selection)
- options: array of options for selection type fields
- placeholder: optional placeholder text

Return STRICT JSON with this exact shape:
{
  "reply": "your conversational reply to the user",
  "suggestions": [{ "element": "string", "suggestion": "string", "reasoning": "string" }],
  "fieldSuggestions": [
    {
      "fieldName": "string",
      "type": "text|number|selection",
      "label": "string",
      "value": "string or number",
      "options": ["string"],
      "placeholder": "string"
    }
  ]
}

Be conversational and concise. When the user describes their product idea, suggest appropriate field values.`;

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
          temperature: 0.7,
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

    const parsed = parseModelJson(content) as {
      reply?: unknown;
      suggestions?: unknown;
      designGuidance?: unknown;
      fieldSuggestions?: unknown;
    } | null;

    if (!parsed || typeof parsed.reply !== "string") {
      const payload: ChatResponsePayload = {
        reply: content,
      };
      return NextResponse.json({
        success: true,
        data: payload,
        message: "Design guidance provided.",
      });
    }

    const payload: ChatResponsePayload = {
      reply: parsed.reply,
      suggestions: Array.isArray(parsed.suggestions)
        ? (parsed.suggestions as DesignSuggestion[])
        : undefined,
      designGuidance:
        typeof parsed.designGuidance === "string"
          ? parsed.designGuidance
          : undefined,
      fieldSuggestions: Array.isArray(parsed.fieldSuggestions)
        ? (parsed.fieldSuggestions as FieldSuggestion[])
        : undefined,
    };

    return NextResponse.json({
      success: true,
      data: payload,
      message: "Design guidance provided successfully.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        success: false,
        message: "Unexpected error during design consultation.",
      },
      { status: 500 },
    );
  }
}
