import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

interface FieldSuggestion {
  fieldName: string;
  type: string;
  label?: string;
  value: string | number | string[];
  options?: string[];
  placeholder?: string;
  locked?: boolean;
}

interface BlueprintSuggestion {
  id: string;
  title: string;
  description?: string;
  brand?: string;
  image?: string;
}

interface ChatResponsePayload {
  reply: string;
  fieldSuggestions?: FieldSuggestion[];
  blueprintSuggestions?: BlueprintSuggestion[];
  marketTrends?: string;
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
    "I'm your Design Agent. I can help you design your print-on-demand product based on current market trends, your brand identity, and your creative ideas. What kind of product would you like to create?",
};

/**
 * Fetch market trend designs via Tavily web search
 */
async function fetchMarketTrends(
  query: string,
  niche: string,
): Promise<string> {
  const tavilyApiKey = process.env.TAVILY_API_KEY;
  if (!tavilyApiKey) {
    return "Market trend data unavailable (API key not configured).";
  }

  const searchQueries = [
    `${query} ${niche} design trends 2025`,
    `${query} print on demand popular designs`,
    `${niche} product design inspiration trending`,
  ];

  let results = "";
  for (const q of searchQueries) {
    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: tavilyApiKey,
          query: q,
          max_results: 3,
          topic: "general",
          search_depth: "basic",
        }),
      });

      if (!response.ok) continue;

      const payload = (await response.json()) as {
        results?: Array<{
          title?: string;
          content?: string;
          url?: string;
        }>;
      };

      const top = (payload.results || []).slice(0, 3);
      results +=
        top
          .map(
            (r) =>
              `• ${r.title}: ${r.content?.substring(0, 200)}`,
          )
          .join("\n") + "\n";
    } catch (error) {
      console.error(`Tavily search failed for "${q}":`, error);
    }
  }

  return results || "No market trend data found.";
}

/**
 * Search Printify catalog for relevant blueprints
 */
async function searchPrintifyBlueprints(
  query: string,
): Promise<BlueprintSuggestion[]> {
  const printifyToken = process.env.PRINTIFY_DEV_TOKEN;
  if (!printifyToken) return [];

  try {
    const response = await fetch(
      "https://api.printify.com/v1/catalog/blueprints.json",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${printifyToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) return [];

    const blueprints = (await response.json()) as Array<{
      id: number;
      title: string;
      description: string;
      brand: string;
      images: string[];
    }>;

    const q = query.toLowerCase();
    const keywords = q.split(/\s+/).filter((w) => w.length > 2);

    // Score-based matching
    const scored = blueprints.map((bp) => {
      const title = bp.title?.toLowerCase() || "";
      const desc = bp.description?.toLowerCase() || "";
      let score = 0;
      for (const kw of keywords) {
        if (title.includes(kw)) score += 3;
        if (desc.includes(kw)) score += 1;
      }
      return { bp, score };
    });

    const filtered = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    // If no matches, return popular defaults
    if (filtered.length === 0) {
      return blueprints.slice(0, 3).map((bp) => ({
        id: String(bp.id),
        title: bp.title,
        description: bp.description,
        brand: bp.brand,
        image: bp.images?.[0] || undefined,
      }));
    }

    return filtered.map((s) => ({
      id: String(s.bp.id),
      title: s.bp.title,
      description: s.bp.description,
      brand: s.bp.brand,
      image: s.bp.images?.[0] || undefined,
    }));
  } catch (error) {
    console.error("Printify catalog search error:", error);
    return [];
  }
}

/**
 * Fetch brand profile from Supabase
 */
async function fetchBrandProfile(businessId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceRole) return null;

  const supabase = createClient(supabaseUrl, supabaseServiceRole);

  const { data } = await supabase
    .from("brand_profiles")
    .select("brand_name, tagline, brand_voice, target_audience, color_palette")
    .eq("business_id", businessId)
    .maybeSingle();

  return data;
}

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
      action?: "scrape_trends" | "suggest_products" | "chat";
      userIdea?: string;
    };

    if (!businessId) {
      return NextResponse.json(
        { success: false, message: "Business ID is required." },
        { status: 400 },
      );
    }

    if (
      !body.messages ||
      !Array.isArray(body.messages) ||
      !body.messages.length
    ) {
      return NextResponse.json(
        { success: false, message: "Conversation messages are required." },
        { status: 400 },
      );
    }

    const apiKey = process.env.GLM_API_KEY;
    const model = process.env.GLM_MODEL!;
    const baseUrl = process.env.ILMU_BASE_URL!;

    if (!apiKey || !model || !baseUrl) {
      return NextResponse.json(
        { success: false, message: "Missing GLM API configuration." },
        { status: 500 },
      );
    }

    const businessName = body.businessContext?.name || "Your Business";
    const businessNiche = body.businessContext?.niche || "General";
    const productTitle = body.productContext?.title || "Product";
    const productDescription = body.productContext?.description || "";
    const productAttributes = body.productContext?.attributes;
    const userIdea = body.userIdea || "";

    // Fetch brand profile for richer context
    const brandProfile = await fetchBrandProfile(businessId);

    // Fetch market trends via web scraping
    const lastUserMessage =
      body.messages.filter((m) => m.role === "user").pop()?.content || userIdea;
    const trendQuery = lastUserMessage || businessNiche;
    const marketTrends = await fetchMarketTrends(trendQuery, businessNiche);

    // Search Printify catalog for relevant blueprints
    const blueprintSuggestions = await searchPrintifyBlueprints(
      lastUserMessage || businessNiche,
    );

    // Build brand context string
    let brandContext = "";
    if (brandProfile) {
      brandContext = `
Brand Profile:
- Brand Name: ${brandProfile.brand_name || businessName}
- Tagline: ${brandProfile.tagline || "N/A"}
- Brand Voice: ${brandProfile.brand_voice || "N/A"}
- Target Audience: ${brandProfile.target_audience || "N/A"}
- Color Palette: ${brandProfile.color_palette ? JSON.stringify(brandProfile.color_palette) : "N/A"}`;
    }

    const systemPrompt = `You are Design Agent for a POD (Print-on-Demand) application called Podpilot.

Business Context:
- Business: ${businessName}
- Niche: ${businessNiche}
${brandContext}

Product Context:
- Product: ${productTitle}
${productDescription ? `- Description: ${productDescription}` : ""}
${productAttributes ? `- Current Attributes: ${JSON.stringify(productAttributes)}` : ""}

Current Market Trends (web-scraped):
${marketTrends}

Available Printify Product Types:
${blueprintSuggestions.map((bp) => `- ${bp.title} (ID: ${bp.id}) — ${bp.brand || ""}`).join("\n")}

Role:
You help users create and design their print-on-demand products. You:
1. Analyze current market trends from the web-scraped data above
2. Consider the business brand identity, voice, and target audience
3. Take the user's vague product idea and suggest specific designs
4. Suggest exactly 3 relevant product types from the Printify catalog listed above
5. Help fill in product attributes based on the selected product type
6. Provide design recommendations considering brand colors and identity

When suggesting Printify product types, include them in "blueprintSuggestions" with the exact IDs from the list above.

When you have enough context to suggest specific field values for the product, include them in "fieldSuggestions". Each suggestion should have:
- fieldName: the attribute key (e.g., "colors", "sizes", "tags")
- type: "text", "textarea", "number", or "selection"
- label: human-readable label
- value: the suggested value
- options: array of options for selection type fields
- placeholder: optional placeholder text
- locked: true for fields that should not be user-editable (like blueprint_id, print_provider_id)

Return STRICT JSON with this exact shape:
{
  "reply": "your conversational reply to the user",
  "blueprintSuggestions": [{ "id": "string", "title": "string", "description": "string", "brand": "string" }],
  "fieldSuggestions": [
    {
      "fieldName": "string",
      "type": "text|textarea|number|selection",
      "label": "string",
      "value": "string or number or array",
      "options": ["string"],
      "placeholder": "string",
      "locked": false
    }
  ],
  "marketTrends": "brief summary of relevant trends you found"
}

Be conversational and concise. When the user first describes their idea, reference the market trends and brand identity to provide informed suggestions. Always suggest 3 Printify product types from the available list when the user describes a product idea.`;

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
      // If LLM fails, still return blueprint suggestions
      return NextResponse.json(
        {
          success: true,
          data: {
            ...fallbackPayload,
            blueprintSuggestions:
              blueprintSuggestions.length > 0
                ? blueprintSuggestions
                : undefined,
            marketTrends,
          },
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
          data: {
            ...fallbackPayload,
            blueprintSuggestions:
              blueprintSuggestions.length > 0
                ? blueprintSuggestions
                : undefined,
          },
          message: "Model returned empty response.",
        },
        { status: 200 },
      );
    }

    const parsed = parseModelJson(content) as {
      reply?: unknown;
      blueprintSuggestions?: unknown;
      fieldSuggestions?: unknown;
      marketTrends?: unknown;
    } | null;

    if (!parsed || typeof parsed.reply !== "string") {
      const payload: ChatResponsePayload = {
        reply: content,
        blueprintSuggestions:
          blueprintSuggestions.length > 0 ? blueprintSuggestions : undefined,
      };
      return NextResponse.json({
        success: true,
        data: payload,
        message: "Design guidance provided.",
      });
    }

    const payload: ChatResponsePayload = {
      reply: parsed.reply,
      blueprintSuggestions: Array.isArray(parsed.blueprintSuggestions)
        ? (parsed.blueprintSuggestions as BlueprintSuggestion[])
        : blueprintSuggestions.length > 0
          ? blueprintSuggestions
          : undefined,
      fieldSuggestions: Array.isArray(parsed.fieldSuggestions)
        ? (parsed.fieldSuggestions as FieldSuggestion[])
        : undefined,
      marketTrends:
        typeof parsed.marketTrends === "string"
          ? parsed.marketTrends
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
