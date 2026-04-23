// lib/agents/launchAgent.ts
import 'dotenv/config'; // loads .env when running standalone (no-op inside Next.js)
import OpenAI from 'openai';
import axios from 'axios';
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  LaunchProductInput,
  PricingDecision,
  PrintifyResult,
  SuggestedPrices,
} from '@/lib/types';

type TavilySearchResult = {
  title?: string;
  content?: string;
  url?: string | null;
};

function parseModelJson<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      const slice = raw.slice(start, end + 1);
      return JSON.parse(slice) as T;
    }
    throw new Error('Model response was not valid JSON.');
  }
}

// #region agent log
fetch('http://127.0.0.1:7271/ingest/9ca32cd0-69c1-494d-a764-c305875b4eca',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b255ef'},body:JSON.stringify({sessionId:'b255ef',runId:'pre-fix',hypothesisId:'H2',location:'lib/agents/launchAgent.ts:17',message:'launchAgent module evaluated',data:{hasRequireTypeof:typeof require,hasModuleTypeof:typeof module},timestamp:Date.now()})}).catch(()=>{});
// #endregion

export class LaunchAgent {
  private printifyBase = 'https://api.printify.com/v1';
  private defaultSafetyInformation =
    'GPSR information: John Doe, test@example.com, 123 Main St, Apt 1, New York, NY, 10001, US Product information: Gildan, 5000, 2 year warranty in EU and UK as per Directive 1999/44/EC Warnings, Hazard: No warranty, US Care instructions: Machine wash: warm (max 40C or 105F), Non-chlorine: bleach as needed, Tumble dry: medium, Do not iron, Do not dryclean';

  private getGlmClient(): OpenAI {
    const apiKey = process.env.GLM_API_KEY;
    if (!apiKey) {
      throw new Error('Missing GLM_API_KEY');
    }

    const baseURL = (process.env.ILMU_BASE_URL || 'https://api.ilmu.ai/v1').trim();
    const timeoutMsRaw = Number(process.env.GLM_TIMEOUT_MS || 30_000);
    const timeout = Number.isFinite(timeoutMsRaw) && timeoutMsRaw > 0 ? timeoutMsRaw : 30_000;

    return new OpenAI({
      apiKey,
      baseURL,
      timeout,
      maxRetries: 1,
    });
  }

  private parseVariantIds(raw: string | undefined, fallback: number[]): number[] {
    if (!raw) return fallback;
    const parsed = raw
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isInteger(item) && item > 0);
    return parsed.length > 0 ? parsed : fallback;
  }

  private async uploadPlaceholderImageToPrintify(token: string): Promise<string> {
    if (process.env.PRINTIFY_IMAGE_ID) {
      console.log('Using PRINTIFY_IMAGE_ID from env, skipping upload.');
      return process.env.PRINTIFY_IMAGE_ID;
    }

    const imagePath =
      process.env.PRINTIFY_PLACEHOLDER_IMAGE || 'assets/printify-placeholders/image.png';
    const absoluteImagePath = resolve(process.cwd(), imagePath);
    console.log(`Uploading placeholder image: ${absoluteImagePath}`);
    const fileBuffer = await readFile(absoluteImagePath);
    const fileName = basename(absoluteImagePath);
    const base64Contents = fileBuffer.toString('base64');

    const response = await axios.post(
      `${this.printifyBase}/uploads/images.json`,
      {
        file_name: fileName,
        contents: base64Contents,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'PODCoPilot-Hackathon',
        },
        timeout: 30_000,
      }
    );

    const uploadId = response?.data?.id;
    if (!uploadId) {
      throw new Error('Printify upload response missing image id.');
    }

    return String(uploadId);
  }

  // ====================== MARKET RESEARCH ======================
  private async marketResearch(productName: string, categories: string[]): Promise<string> {
    const tavilyApiKey = process.env.TAVILY_API_KEY;
    if (!tavilyApiKey) {
      console.warn('Missing TAVILY_API_KEY, market research skipped.');
      return 'Market research skipped: Missing TAVILY_API_KEY';
    }

    const queries = [
      `${productName} ${categories.join(' ')} price Etsy`,
      `${productName} ${categories.join(' ')} price Shopee Malaysia`,
      `${productName} ${categories.join(' ')} price TikTok Shop`,
    ];

    let results = '';
    for (const q of queries) {
      try {
        const response = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            api_key: tavilyApiKey,
            query: q,
            max_results: 4,
            topic: 'general',
            search_depth: 'basic',
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Tavily request failed (${response.status}): ${errorText}`);
        }

        const payload = (await response.json()) as { results?: TavilySearchResult[] };
        const top = (payload.results || []).slice(0, 4);
        results += `Query: ${q}\n${top
          .map(
            (r: TavilySearchResult) =>
              `Title: ${r.title}\nSnippet: ${r.content}\nLink: ${r.url ?? 'N/A'}\n`
          )
          .join('\n')}\n\n`;
      } catch (error) {
        console.error(`Tavily search failed for query "${q}":`, error);
        results += `Search failed for ${q}\n`;
      }
    }

    console.log(results);
    return results;
  }

  // ====================== OPTIMAL PRICING (GLM) ======================
  private buildPricingPrompts(productData: LaunchProductInput, marketData: string) {
    const systemPrompt = `You are the Launch Agent for PODCoPilot.
Return ONLY valid JSON with this exact structure:
{
  "suggested_prices": { "tshirt": 2999, "mug": 1999, "hoodie": 4999 },
  "reasoning": "short explanation",
  "confidence": 0.85
}`;

    const userPrompt = `
Product: ${productData.name}
Categories: ${productData.categories.join(', ')}
Description: ${productData.description}

Market research:
${marketData}

Suggest profitable prices for Malaysia market (30-50% margin over Printify cost).
`;

    return { systemPrompt, userPrompt };
  }

  private async decideOptimalPriceWithGlm(
    productData: LaunchProductInput,
    marketData: string
  ): Promise<PricingDecision> {
    const glm = this.getGlmClient();
    const { systemPrompt, userPrompt } = this.buildPricingPrompts(productData, marketData);
    const model = (process.env.GLM_MODEL || 'ilmu-glm-5.1').trim();

    const startedAt = Date.now();

    const response = await glm.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.5,
    });

    console.log(`GLM pricing completed in ${Date.now() - startedAt}ms`);

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('GLM returned no message content.');
    }

    return parseModelJson<PricingDecision>(content);
  }

  private async decideOptimalPrice(
    productData: LaunchProductInput,
    marketData: string
  ): Promise<PricingDecision> {
    try {
      return await this.decideOptimalPriceWithGlm(productData, marketData);
    } catch (glmError) {
      console.warn('GLM pricing failed, using fallback pricing:', glmError);
      return {
        suggested_prices: { tshirt: 2999, mug: 1999, hoodie: 4999 },
        reasoning: 'Fallback pricing (GLM unavailable or returned invalid JSON).',
        confidence: 0.7,
      };
    }
  }

  // ====================== CREATE ON PRINTIFY ======================
  private async createOnPrintify(
    productData: LaunchProductInput,
    prices: SuggestedPrices
  ): Promise<PrintifyResult> {
    const printifyToken = process.env.PRINTIFY_DEV_TOKEN;
    if (!printifyToken || !process.env.PRINTIFY_SHOP_ID) {
      console.log('⚠️ No Printify credentials → returning mock');
      return this.mockPrintifyCreation(productData, prices);
    }

    const blueprintId = Number(process.env.PRINTIFY_BLUEPRINT_ID || 384);
    const printProviderId = Number(process.env.PRINTIFY_PROVIDER_ID || 1);
    const variantIds = this.parseVariantIds(
      process.env.PRINTIFY_VARIANT_IDS,
      [45740, 45742, 45744, 45746]
    );
    try {
      console.log('Creating product on Printify...', { blueprintId, printProviderId, variantIds });
      const designImageId = await this.uploadPlaceholderImageToPrintify(printifyToken);
      console.log(`Design image ID: ${designImageId}`);
      const basePrice =
        (Number.isFinite(prices.hoodie) && prices.hoodie > 0
          ? prices.hoodie
          : Number.isFinite(prices.tshirt) && prices.tshirt > 0
            ? prices.tshirt
            : Number.isFinite(prices.mug) && prices.mug > 0
              ? prices.mug
              : 400);

      const payload = {
        title: productData.name,
        description: productData.description,
        safety_information: process.env.PRINTIFY_SAFETY_INFORMATION || this.defaultSafetyInformation,
        tags: productData.tags || ['pod', 'custom'],
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
                position: 'front',
                images: [
                  {
                    id: designImageId,
                    x: 0.5,
                    y: 0.5,
                    scale: 1,
                    angle: 0,
                  },
                ],
              },
            ],
          },
        ],
      };

      const resp = await axios.post(
        `${this.printifyBase}/shops/${process.env.PRINTIFY_SHOP_ID}/products.json`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${printifyToken}`,
            'Content-Type': 'application/json',
            'User-Agent': 'PODCoPilot-Hackathon',
          },
          timeout: 30_000,
        }
      );
      console.log(`Printify product created: ${resp.data.id}`);
      return { success: true, product_id: resp.data.id, ...resp.data };
    } catch (e: unknown) {
      const err = e as { response?: { data?: unknown }; message?: string };
      console.error(
        'Printify error:',
        err.response?.data || err.message,
        'Set PRINTIFY_PLACEHOLDER_IMAGE to a valid local file path or use PRINTIFY_IMAGE_ID.'
      );
      return this.mockPrintifyCreation(productData, prices);
    }
  }

  private mockPrintifyCreation(
    _productData: LaunchProductInput,
    prices: SuggestedPrices
  ): PrintifyResult {
    return {
      success: true,
      product_id: `mock-pf-${Date.now()}`,
      status: 'created (mock)',
      printify_url: 'https://printify.com/demo-product',
      prices_used: prices,
      note: 'Mock response — real API would return live product',
    };
  }

  // ====================== PUBLISH TO SALES CHANNEL ======================
  private async publishToSalesChannel(
    productId: string
  ): Promise<{ published: boolean; publish_status: string; external_product_id?: string }> {
    const printifyToken = process.env.PRINTIFY_DEV_TOKEN;
    const shopId = process.env.PRINTIFY_SHOP_ID;

    if (!printifyToken || !shopId) {
      return { published: false, publish_status: 'skipped' };
    }

    if (productId.startsWith('mock-pf-')) {
      return { published: true, publish_status: 'published (mock)' };
    }

    if (process.env.PRINTIFY_PUBLISH_ENABLED === 'false') {
      return { published: false, publish_status: 'disabled' };
    }

    try {
      console.log(`Publishing product ${productId} to sales channel...`);
      await axios.post(
        `${this.printifyBase}/shops/${shopId}/products/${productId}/publish.json`,
        {
          title: true,
          description: true,
          images: true,
          variants: true,
          tags: true,
          keyFeatures: true,
          shipping_template: true,
        },
        {
          headers: {
            Authorization: `Bearer ${printifyToken}`,
            'Content-Type': 'application/json',
            'User-Agent': 'PODCoPilot-Hackathon',
          },
          timeout: 30_000,
        }
      );

      // Poll for publish status
      const maxAttempts = Number(process.env.PRINTIFY_PUBLISH_MAX_ATTEMPTS || 40);
      const intervalMs = Number(process.env.PRINTIFY_PUBLISH_INTERVAL_MS || 3000);
      const safeMaxAttempts = Number.isFinite(maxAttempts) && maxAttempts > 0 ? maxAttempts : 40;
      const safeIntervalMs = Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 3000;

      let lastKnownStatus: string | undefined;
      for (let attempt = 0; attempt < safeMaxAttempts; attempt++) {
        await new Promise((r) => setTimeout(r, safeIntervalMs));
        console.log(`Publish poll attempt ${attempt + 1}/${safeMaxAttempts}...`);

        const resp = await axios.get(
          `${this.printifyBase}/shops/${shopId}/products/${productId}.json`,
          {
            headers: {
              Authorization: `Bearer ${printifyToken}`,
              'Content-Type': 'application/json',
              'User-Agent': 'PODCoPilot-Hackathon',
            },
            timeout: 15_000,
          }
        );

        const isPublished = resp.data?.is_published;
        const publishingStatus =
          resp.data?.publishing_status ||
          resp.data?.publishing?.status ||
          resp.data?.publishing ||
          resp.data?.status;
        if (typeof publishingStatus === 'string' && publishingStatus.trim().length > 0) {
          lastKnownStatus = publishingStatus;
        }

        if (isPublished) {
          return {
            published: true,
            publish_status: 'published',
            external_product_id: resp.data?.external?.id,
          };
        }

        if (
          typeof publishingStatus === 'string' &&
          /fail|error|rejected/i.test(publishingStatus)
        ) {
          return {
            published: false,
            publish_status: `failed (${publishingStatus})`,
          };
        }
      }

      const suffix = lastKnownStatus ? `; last_status=${lastKnownStatus}` : '';
      return { published: false, publish_status: `publishing (timed out${suffix})` };
    } catch (e: unknown) {
      const err = e as { response?: { data?: unknown }; message?: string };
      console.error('Printify publish error:', err.response?.data || err.message);
      return { published: false, publish_status: 'failed' };
    }
  }

  // ====================== STANDALONE PUBLISH ======================
  public async publishProduct(productId: string): Promise<{
    product_id: string;
    published: boolean;
    publish_status: string;
    external_product_id?: string;
    timestamp: string;
  }> {
    console.log(`Publishing product ${productId} to sales channel...`);
    const result = await this.publishToSalesChannel(productId);
    return {
      product_id: productId,
      ...result,
      timestamp: new Date().toISOString(),
    };
  }

  // ====================== MAIN LAUNCH METHOD ======================
  public async launchProduct(productData: LaunchProductInput) {
    // #region agent log
    fetch('http://127.0.0.1:7271/ingest/9ca32cd0-69c1-494d-a764-c305875b4eca',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b255ef'},body:JSON.stringify({sessionId:'b255ef',runId:'pre-fix',hypothesisId:'H4',location:'lib/agents/launchAgent.ts:235',message:'launchProduct entered',data:{productName:productData.name,categoryCount:productData.categories.length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    console.log(`🚀 LaunchAgent starting for: ${productData.name}`);

    // 1. Market research
    const marketData = await this.marketResearch(productData.name, productData.categories);

    // 2. GLM decides optimal prices
    console.log('Step 2: Deciding optimal prices with GLM...');
    const pricing = await this.decideOptimalPrice(productData, marketData);
    console.log('Pricing decision:', JSON.stringify(pricing));

    // 3. Create on Printify (or mock)
    console.log('Step 3: Creating product on Printify...');
    const result = await this.createOnPrintify(productData, pricing.suggested_prices);
    console.log(`Printify result: success=${result.success}, product_id=${result.product_id}`);

    // 4. Publish to sales channel
    console.log('Step 4: Publishing to sales channel...');
    let publishResult: { published: boolean; publish_status: string; external_product_id?: string } = { published: false, publish_status: 'skipped' };
    if (result.success) {
      publishResult = await this.publishToSalesChannel(result.product_id);
    }
    result.published = publishResult.published;
    result.publish_status = publishResult.publish_status;
    if (publishResult.external_product_id) {
      result.external_product_id = publishResult.external_product_id;
    }

    // 5. Final structured output
    const overallStatus = !result.success
      ? 'failed'
      : publishResult.published
        ? 'launched'
        : 'created but unpublished';

    return {
      product_name: productData.name,
      market_research_summary: marketData.substring(0, 800) + '...',
      optimal_prices: pricing.suggested_prices,
      pricing_reasoning: pricing.reasoning,
      printify_result: result,
      status: overallStatus,
      timestamp: new Date().toISOString(),
    };
  }
}

// ====================== TEST / MOCK (run with ts-node or in API route) ======================
// #region agent log
fetch('http://127.0.0.1:7271/ingest/9ca32cd0-69c1-494d-a764-c305875b4eca',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b255ef'},body:JSON.stringify({sessionId:'b255ef',runId:'pre-fix',hypothesisId:'H1',location:'lib/agents/launchAgent.ts:260',message:'about to evaluate require.main guard',data:{note:'if this appears right before crash, require.main access is likely root trigger'},timestamp:Date.now()})}).catch(()=>{});
// #endregion
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  // #region agent log
  fetch('http://127.0.0.1:7271/ingest/9ca32cd0-69c1-494d-a764-c305875b4eca',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b255ef'},body:JSON.stringify({sessionId:'b255ef',runId:'post-fix',hypothesisId:'H1',location:'lib/agents/launchAgent.ts:271',message:'ESM-safe main-module guard passed',data:{argv1:process.argv[1] ?? null},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const agent = new LaunchAgent();
  agent
    .launchProduct({
      name: 'Malaysian Cyber Cat Hoodie',
      description: 'Futuristic cyber-y2k cat wearing songkok and batik pattern.',
      categories: ['hoodie', 'tshirt', 'mug'],
      tags: ['malaysia', 'cyber', 'cat'],
    })
    .then((result) => console.log('LAUNCH RESULT:\n', JSON.stringify(result, null, 2)))
    .catch(console.error);
}