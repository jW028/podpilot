import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import type {
  LaunchProductInput,
  SuggestedPrices,
  PrintifyResult,
} from "@/lib/types";

type TavilySearchResult = {
  title?: string;
  content?: string;
  url?: string | null;
};

const printifyBase = "https://api.printify.com/v1";

const CATEGORY_KEYWORDS: [string, string[]][] = [
  ["hoodie",  ["hoodie", "sweatshirt", "pullover", "zip-up", "zip up"]],
  ["tshirt",  ["t-shirt", "tshirt", "tee", "unisex tee", "crew neck tee"]],
  ["longsleeve", ["long sleeve", "longsleeve", "long-sleeve"]],
  ["mug",     ["mug", "cup", "tumbler", "drinkware"]],
  ["poster",  ["poster", "print", "canvas", "art print", "wall art"]],
  ["hat",     ["hat", "cap", "beanie", "snapback", "dad hat"]],
  ["bag",     ["bag", "tote", "backpack", "drawstring"]],
  ["phone",   ["phone case", "iphone", "samsung"]],
  ["sticker", ["sticker", "decal"]],
];

/** Derive product category names from a product type string or title. */
export function inferCategories(text: string): string[] {
  if (!text) return ["product"];
  const lower = text.toLowerCase();
  const matched: string[] = [];
  for (const [cat, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) {
      matched.push(cat);
    }
  }
  return matched.length > 0 ? matched : [lower.replace(/[^a-z0-9]+/g, "_").slice(0, 30)];
}
const defaultSafetyInformation =
  "GPSR information: John Doe, test@example.com, 123 Main St, Apt 1, New York, NY, 10001, US Product information: Gildan, 5000, 2 year warranty in EU and UK as per Directive 1999/44/EC Warnings, Hazard: No warranty, US Care instructions: Machine wash: warm (max 40C or 105F), Non-chlorine: bleach as needed, Tumble dry: medium, Do not iron, Do not dryclean";

export const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "performMarketResearch",
      description:
        "Fetches real-time price info and market trends for the intended product.",
      parameters: {
        type: "object",
        properties: {
          productName: { type: "string", description: "Name of the product" },
          categories: {
            type: "array",
            items: { type: "string" },
            description: "List of categories e.g. hoodie, mug",
          },
        },
        required: ["productName", "categories"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createPrintifyProduct",
      description:
        "Creates a new product on Printify with the selected prices.",
      parameters: {
        type: "object",
        properties: {
          prices: {
            type: "object",
            description:
              "The optimal suggested prices to use for each category.",
            additionalProperties: { type: "number" },
          },
          reasoning: {
            type: "string",
            description:
              "The reasoning used to determine these prices based on market research.",
          },
        },
        required: ["prices", "reasoning"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "publishProductToSalesChannel",
      description:
        "Publishes a created Printify product to the connected sales channel (e.g. Etsy).",
      parameters: {
        type: "object",
        properties: {
          productId: {
            type: "string",
            description: "The ID of the printify product to publish.",
          },
        },
        required: ["productId"],
      },
    },
  },
];

async function printifyRequest<T>(
  method: string,
  path: string,
  token: string,
  body?: unknown,
  timeoutMs = 30_000,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${printifyBase}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "PODCoPilot-Hackathon",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Printify request failed (${response.status}): ${errorText}`,
      );
    }

    return response.json() as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
}

export async function performMarketResearch({
  productName,
  categories,
}: {
  productName: string;
  categories: string[];
}) {
  const tavilyApiKey = process.env.TAVILY_API_KEY;
  if (!tavilyApiKey) {
    console.warn("Missing TAVILY_API_KEY, market research skipped.");
    return "Market research skipped: Missing TAVILY_API_KEY";
  }

  const queries = [
    `${productName} ${categories.join(" ")} price Etsy`,
    `${productName} ${categories.join(" ")} price Shopee Malaysia`,
    `${productName} ${categories.join(" ")} price TikTok Shop`,
  ];

  let results = "";
  for (const q of queries) {
    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: tavilyApiKey,
          query: q,
          max_results: 4,
          topic: "general",
          search_depth: "basic",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Tavily request failed (${response.status}): ${errorText}`,
        );
      }

      const payload = (await response.json()) as {
        results?: TavilySearchResult[];
      };
      const top = (payload.results || []).slice(0, 4);
      results += `Query: ${q}\n${top
        .map(
          (r: TavilySearchResult) =>
            `Title: ${r.title}\nSnippet: ${r.content}\nLink: ${r.url ?? "N/A"}\n`,
        )
        .join("\n")}\n\n`;
    } catch (error) {
      console.error(`Tavily search failed for query "${q}":`, error);
      results += `Search failed for ${q}\n`;
    }
  }
  return results;
}

function parseVariantIds(
  raw: string | undefined,
  fallback: number[],
): number[] {
  if (!raw) return fallback;
  const parsed = raw
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);
  return parsed.length > 0 ? parsed : fallback;
}

async function fetchVariantIds(
  token: string,
  blueprintId: number,
  printProviderId: number,
): Promise<{ providerId: number; variantIds: number[] }> {
  // Try the requested print provider first
  try {
    const data = await printifyRequest<{
      variants?: Array<{ id: number; is_available?: boolean }>;
    }>(
      "GET",
      `/catalog/blueprints/${blueprintId}/print_providers/${printProviderId}/variants.json`,
      token,
    );
    const available = (data.variants ?? [])
      .filter((v) => v.is_available !== false)
      .slice(0, 4)
      .map((v) => v.id);
    if (available.length > 0) {
      console.log(`Fetched ${available.length} variants for blueprint ${blueprintId} / provider ${printProviderId}:`, available);
      return { providerId: printProviderId, variantIds: available };
    }
  } catch {
    console.warn(`Provider ${printProviderId} not valid for blueprint ${blueprintId} — auto-discovering valid provider...`);
  }

  // Auto-discover a valid print provider for this blueprint
  try {
    const providers = await printifyRequest<Array<{ id: number; title: string }>>(
      "GET",
      `/catalog/blueprints/${blueprintId}/print_providers.json`,
      token,
    );
    for (const provider of (providers ?? []).slice(0, 5)) {
      try {
        const data = await printifyRequest<{
          variants?: Array<{ id: number; is_available?: boolean }>;
        }>(
          "GET",
          `/catalog/blueprints/${blueprintId}/print_providers/${provider.id}/variants.json`,
          token,
        );
        const available = (data.variants ?? [])
          .filter((v) => v.is_available !== false)
          .slice(0, 4)
          .map((v) => v.id);
        if (available.length > 0) {
          console.log(`Auto-selected provider ${provider.id} (${provider.title}) for blueprint ${blueprintId}:`, available);
          return { providerId: provider.id, variantIds: available };
        }
      } catch { /* try next provider */ }
    }
  } catch (e) {
    console.warn(`Failed to fetch print providers for blueprint ${blueprintId}:`, e);
  }

  return { providerId: printProviderId, variantIds: [] };
}

async function uploadPlaceholderImageToPrintify(
  token: string,
): Promise<string> {
  // 1. Pre-uploaded image ID (fastest — set once from Printify dashboard)
  if (process.env.PRINTIFY_IMAGE_ID) {
    console.log("Using PRINTIFY_IMAGE_ID from env.");
    return process.env.PRINTIFY_IMAGE_ID;
  }

  // 2. URL-based upload (no file system required — works in serverless)
  const imageUrl = process.env.PRINTIFY_IMAGE_URL;
  if (imageUrl) {
    console.log(`Uploading image via URL: ${imageUrl}`);
    const data = await printifyRequest<{ id?: string | number }>(
      "POST",
      "/uploads/images.json",
      token,
      { file_name: "placeholder.png", url: imageUrl },
    );
    const uploadId = data?.id;
    if (!uploadId) throw new Error("Printify upload response missing image id.");
    return String(uploadId);
  }

  // 3. Local file upload (dev only)
  const imagePath =
    process.env.PRINTIFY_PLACEHOLDER_IMAGE ||
    "assets/printify-placeholders/image.png";
  const absoluteImagePath = resolve(process.cwd(), imagePath);
  console.log(`Uploading placeholder image from file: ${absoluteImagePath}`);
  const fileBuffer = await readFile(absoluteImagePath);
  const fileName = basename(absoluteImagePath);
  const base64Contents = fileBuffer.toString("base64");

  const data = await printifyRequest<{ id?: string | number }>(
    "POST",
    "/uploads/images.json",
    token,
    { file_name: fileName, contents: base64Contents },
  );

  const uploadId = data?.id;
  if (!uploadId) {
    throw new Error("Printify upload response missing image id.");
  }
  return String(uploadId);
}

function mockPrintifyCreation(
  _productData: LaunchProductInput,
  prices: SuggestedPrices,
): PrintifyResult {
  return {
    success: true,
    product_id: `mock-pf-${Date.now()}`,
    status: "created (mock)",
    printify_url: "https://printify.com/demo-product",
    prices_used: prices,
    note: "Mock response — real API would return live product",
  };
}

export async function createPrintifyProduct({
  productData,
  prices,
  printifyToken,
  shopId,
  blueprintId: blueprintIdOverride,
  printProviderId: printProviderIdOverride,
  variantIds: variantIdsOverride,
  designImageBase64,
  designImageFileName,
}: {
  productData: LaunchProductInput;
  prices: SuggestedPrices;
  printifyToken: string;
  shopId: string;
  blueprintId?: number;
  printProviderId?: number;
  variantIds?: number[];
  designImageBase64?: string;
  designImageFileName?: string;
}): Promise<PrintifyResult> {
  if (!printifyToken || !shopId) {
    console.log("⚠️ No Printify credentials → returning mock");
    return mockPrintifyCreation(productData, prices);
  }

  const blueprintId = blueprintIdOverride ?? Number(process.env.PRINTIFY_BLUEPRINT_ID || 384);
  const requestedProviderId = printProviderIdOverride ?? Number(process.env.PRINTIFY_PROVIDER_ID || 1);

  let printProviderId = requestedProviderId;
  let variantIds: number[];

  if (variantIdsOverride) {
    variantIds = variantIdsOverride;
  } else if (process.env.PRINTIFY_VARIANT_IDS) {
    variantIds = parseVariantIds(process.env.PRINTIFY_VARIANT_IDS, []);
  } else {
    const resolved = await fetchVariantIds(printifyToken, blueprintId, requestedProviderId);
    printProviderId = resolved.providerId;
    variantIds = resolved.variantIds;
  }

  if (variantIds.length === 0) {
    console.error(`No valid variants found for blueprint ${blueprintId} — aborting product creation.`);
    return mockPrintifyCreation(productData, prices);
  }

  try {
    console.log("Creating product on Printify...", {
      blueprintId,
      printProviderId,
      variantIds,
    });

    // Use product's own design image if provided, otherwise fall back to placeholder
    let designImageId: string;
    if (designImageBase64 && designImageFileName) {
      console.log(`Uploading product design image: ${designImageFileName}`);
      const data = await printifyRequest<{ id?: string | number }>(
        "POST",
        "/uploads/images.json",
        printifyToken,
        { file_name: designImageFileName, contents: designImageBase64 },
      );
      const uploadId = data?.id;
      if (!uploadId) throw new Error("Printify upload response missing image id.");
      designImageId = String(uploadId);
    } else {
      designImageId = await uploadPlaceholderImageToPrintify(printifyToken);
    }
    console.log(`Design image ID: ${designImageId}`);

    const basePrice =
      Number.isFinite(prices?.hoodie) && prices.hoodie > 0
        ? prices.hoodie
        : Number.isFinite(prices?.tshirt) && prices.tshirt > 0
          ? prices.tshirt
          : Number.isFinite(prices?.mug) && prices.mug > 0
            ? prices.mug
            : 400;

    const payload = {
      title: productData.name,
      description: productData.description,
      safety_information:
        process.env.PRINTIFY_SAFETY_INFORMATION || defaultSafetyInformation,
      tags: productData.tags || ["pod", "custom"],
      blueprint_id: blueprintId,
      print_provider_id: printProviderId,
      variants: variantIds.map((id, index) => ({
        id,
        price: Math.max(100, Math.round(basePrice)),
        is_enabled: index < 2,
      })),
      print_areas: [
        {
          variant_ids: variantIds,
          placeholders: [
            {
              position: "front",
              images: [
                { id: designImageId, x: 0.5, y: 0.5, scale: 1, angle: 0 },
              ],
            },
          ],
        },
      ],
    };

    const respData = await printifyRequest<
      { id: string } & Record<string, unknown>
    >("POST", `/shops/${shopId}/products.json`, printifyToken, payload);

    console.log(`Printify product created: ${respData.id}`);
    return { success: true, product_id: respData.id, ...respData };
  } catch (e: unknown) {
    const err = e as { message?: string };
    console.error(
      "Printify error:",
      err.message,
      "Set PRINTIFY_PLACEHOLDER_IMAGE to a valid local file path or use PRINTIFY_IMAGE_ID.",
    );
    return mockPrintifyCreation(productData, prices);
  }
}

export async function publishProductToSalesChannel({
  productId,
  printifyToken,
  shopId,
  waitForPublish = true,
}: {
  productId: string;
  printifyToken: string;
  shopId: string;
  waitForPublish?: boolean;
}): Promise<{
  published: boolean;
  publish_status: string;
  external_product_id?: string;
}> {
  if (!printifyToken || !shopId) {
    return { published: false, publish_status: "skipped" };
  }

  if (productId.startsWith("mock-pf-")) {
    return { published: true, publish_status: "published (mock)" };
  }

  if (process.env.PRINTIFY_PUBLISH_ENABLED === "false") {
    return { published: false, publish_status: "disabled" };
  }

  try {
    console.log(`Publishing product ${productId} to sales channel...`);
    await printifyRequest(
      "POST",
      `/shops/${shopId}/products/${productId}/publish.json`,
      printifyToken,
      {
        title: true,
        description: true,
        images: true,
        variants: true,
        tags: true,
        keyFeatures: true,
        shipping_template: true,
      },
    );

    if (!waitForPublish) {
      return { published: false, publish_status: "publishing" };
    }

    const maxAttempts = Number(process.env.PRINTIFY_PUBLISH_MAX_ATTEMPTS || 40);
    const intervalMs = Number(process.env.PRINTIFY_PUBLISH_INTERVAL_MS || 3000);
    const safeMaxAttempts =
      Number.isFinite(maxAttempts) && maxAttempts > 0 ? maxAttempts : 40;
    const safeIntervalMs =
      Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 3000;

    let lastKnownStatus: string | undefined;
    for (let attempt = 0; attempt < safeMaxAttempts; attempt++) {
      await new Promise((r) => setTimeout(r, safeIntervalMs));
      console.log(`Publish poll attempt ${attempt + 1}/${safeMaxAttempts}...`);

      const data = await printifyRequest<Record<string, unknown>>(
        "GET",
        `/shops/${shopId}/products/${productId}.json`,
        printifyToken,
        undefined,
        15_000,
      );

      const isPublished = data?.is_published;
      const publishingStatus =
        data?.publishing_status ||
        (data?.publishing as Record<string, unknown>)?.status ||
        data?.publishing ||
        data?.status;

      if (
        typeof publishingStatus === "string" &&
        publishingStatus.trim().length > 0
      ) {
        lastKnownStatus = publishingStatus;
      }

      if (isPublished) {
        return {
          published: true,
          publish_status: "published",
          external_product_id: (data?.external as Record<string, unknown>)
            ?.id as string | undefined,
        };
      }

      if (
        typeof publishingStatus === "string" &&
        /fail|error|rejected/i.test(publishingStatus)
      ) {
        return {
          published: false,
          publish_status: `failed (${publishingStatus})`,
        };
      }
    }

    const suffix = lastKnownStatus ? `; last_status=${lastKnownStatus}` : "";
    return {
      published: false,
      publish_status: `publishing (timed out${suffix})`,
    };
  } catch (e: unknown) {
    const err = e as { message?: string };
    console.error("Printify publish error:", err.message);
    return { published: false, publish_status: "failed" };
  }
}
