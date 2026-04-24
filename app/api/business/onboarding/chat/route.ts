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

interface TavilySearchResult {
  title?: string;
  content?: string;
  url?: string;
}

interface TavilySearchResponse {
  results?: TavilySearchResult[];
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

const MAX_TAVILY_CONTEXT_CHARS = 2500;

const normalizeText = (value: string) => value.replace(/\s+/g, " ").trim();

const extractLatestUserMessage = (messages: ChatMessage[]) => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") {
      return normalizeText(messages[index].content || "");
    }
  }

  return "";
};

const buildTavilyQueries = (latestUserMessage: string) => {
  const topic = normalizeText(latestUserMessage).slice(0, 120);
  if (!topic) {
    return [];
  }

  const year = new Date().getFullYear();

  return [
    `${year} market demand trends for ${topic}`,
    `competitor positioning and pricing for ${topic} in Malaysia ecommerce`,
    `target audience pain points and buying behavior for ${topic}`,
    `POD design and brand style trends for ${topic} ${year}`,
    `business risks and challenges for ${topic} in online retail`,
  ];
};

const buildResearchTopic = (
  latestUserMessage: string,
  framework?: BusinessFramework | null,
) => {
  const parts = [
    latestUserMessage,
    framework?.theme,
    framework?.niche,
    framework?.productLane,
    framework?.targetAudience,
  ]
    .filter((value): value is string => Boolean(value && value.trim()))
    .map((value) => normalizeText(value));

  return normalizeText(parts.join(" ")).slice(0, 160);
};

const TAVILY_TIMEOUT_MS = 6000;

const runTavilyResearch = async (apiKey: string, queries: string[]) => {
  const collected: string[] = [];

  for (const query of queries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TAVILY_TIMEOUT_MS);

    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          api_key: apiKey,
          query,
          max_results: 2,
          topic: "general",
          search_depth: "basic",
        }),
      });

      clearTimeout(timer);

      if (!response.ok) {
        const errorText = await response.text();
        collected.push(
          `Query: ${query}\nTavily error (${response.status}): ${normalizeText(errorText).slice(0, 220)}`,
        );
        continue;
      }

      const payload = (await response.json()) as TavilySearchResponse;
      const top = (payload.results || []).slice(0, 3);

      if (!top.length) {
        collected.push(`Query: ${query}\nNo relevant results returned.`);
        continue;
      }

      const block = top
        .map((item, index) => {
          const title = normalizeText(item.title || "Untitled");
          const snippet = normalizeText(item.content || "No snippet").slice(0, 320);
          const link = item.url || "N/A";
          return `${index + 1}. Title: ${title}\nSnippet: ${snippet}\nLink: ${link}`;
        })
        .join("\n");

      collected.push(`Query: ${query}\n${block}`);
    } catch (error) {
      clearTimeout(timer);
      const isTimeout = error instanceof Error && error.name === "AbortError";
      console.error(
        isTimeout
          ? `Tavily timeout (>${TAVILY_TIMEOUT_MS}ms) for query: ${query}`
          : `Tavily search failed for query: ${query}`,
        isTimeout ? "" : error,
      );
      collected.push(
        `Query: ${query}\n${isTimeout ? "Search timed out." : "Search failed due to network/runtime error."}`,
      );
    }
  }

  return collected.join("\n\n").slice(0, MAX_TAVILY_CONTEXT_CHARS);
};

const parseModelJson = (content: string): unknown => {
  // Strip markdown code fences the model sometimes wraps JSON in
  const stripped = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  try {
    return JSON.parse(stripped);
  } catch {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      return null;
    }

    try {
      return JSON.parse(stripped.slice(start, end + 1));
    } catch {
      return null;
    }
  }
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      businessId?: string;
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
    const tavilyApiKey = process.env.TAVILY_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing GLM API key.",
        },
        { status: 500 },
      );
    }

    const latestUserMessage = extractLatestUserMessage(body.messages);
    const researchTopic = buildResearchTopic(latestUserMessage, body.framework);
    const tavilyQueries = buildTavilyQueries(researchTopic).slice(0, 2);
    const tavilyContext =
      tavilyApiKey && tavilyQueries.length
        ? await runTavilyResearch(tavilyApiKey, tavilyQueries)
        : "";

    const externalResearchContext = tavilyContext
      ? `External Tavily research context:\n${tavilyContext}`
      : "External Tavily research context is unavailable for this turn.";

    const today = new Date().toISOString().slice(0, 10);

    const systemPrompt = `You are Business Genesis Agent for a POD app.
Today: ${today}
Goal: converse naturally like ChatGPT to clarify business direction, validate commercial viability, and challenge weak assumptions.

Rules:
- Ask concise follow-up questions when details are missing.
- Focus only on business feeling/theme/vibe, audience, product lane, direction.
- Do not finalize visual design.
- Use external research context to provide current market signals, competitive pressure, and risk notes.
- Do NOT blindly agree with user ideas. Discuss tradeoffs: what is strong, what is risky, and what should be improved.
- If idea quality is weak, suggest a sharper angle and ask if the user still wants to proceed.
- Only set frameworkReady=true when details are complete AND user clearly wants to proceed after discussion.

${externalResearchContext}

OUTPUT RULE — THIS IS MANDATORY:
You MUST respond with ONLY a raw JSON object. No markdown, no code fences, no explanation outside JSON.
Exact shape required:
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
If framework not ready: frameworkReady=false, framework=null.
Start your response with { and end with }. Nothing else.`;

    // Cap history at last 20 messages to avoid context window overflow,
    // which causes the model to produce malformed JSON → fallback fires.
    const MAX_HISTORY = 20;
    const trimmedMessages = body.messages.slice(-MAX_HISTORY);

    const messagesForModel = [
      { role: "system", content: systemPrompt },
      ...trimmedMessages.map((message) => ({
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
          max_tokens: 400,
          messages: messagesForModel,
        }),
      },
    );

    if (!response.ok) {
      console.warn(
        `[chat/route] GLM returned non-ok status: ${response.status} ${response.statusText}`,
      );
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

    console.log("[chat/route] Raw model content:\n", content ?? "(empty)");

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
      console.warn(
        "[chat/route] JSON parse failed or reply field missing.\n",
        "parsed:", parsed,
        "\nraw content was:\n", content,
      );
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
