import 'dotenv/config';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import type { LaunchProductInput, SuggestedPrices, DesignToLaunchPayload } from '@/lib/types';
import { resolveBusinessPrintifyToken } from '@/lib/printify/credentials';
import {
  performMarketResearch,
  createPrintifyProduct,
  publishProductToSalesChannel,
  TOOL_DEFINITIONS,
} from './tools';

function getGlmClient(): OpenAI {
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // backend uses service role
);

export async function runLaunchAgent({
  businessId,
  productId,
  productData,
  shopId: requestedShopId,
  salesChannelIds,
  designPayload,
  userMessage = null,
}: {
  businessId: string;
  productId: string;
  productData: LaunchProductInput;
  shopId?: string;
  salesChannelIds?: string[];
  designPayload?: DesignToLaunchPayload;
  userMessage?: string | null;
}) {
  const glm = getGlmClient();

  // 1. Load business context (get printify_shop_id + sales_channels) + product attributes
  const [{ data: business, error }, { data: product }] = await Promise.all([
    supabase
      .from('businesses')
      .select('id, name, printify_shop_id, sales_channels')
      .eq('id', businessId)
      .single(),
    supabase
      .from('products')
      .select('attributes, price')
      .eq('id', productId)
      .maybeSingle(),
  ]);

  if (error || !business) {
    throw new Error('Business not found');
  }

  // Merge product attributes into designPayload so blueprint/provider/variants/prices are always correct
  const attrs = product?.attributes as Record<string, { value: unknown }> | null ?? {};
  const attrBlueprintId = typeof attrs['blueprint_id']?.value === 'number' ? attrs['blueprint_id'].value as number : undefined;
  const attrProviderId = typeof attrs['print_provider_id']?.value === 'number' ? attrs['print_provider_id'].value as number : undefined;
  const attrVariantIds: number[] | undefined = (() => {
    const v = attrs['variant_ids']?.value;
    if (typeof v === 'string' && v) {
      const parsed = v.split(',').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0);
      return parsed.length > 0 ? parsed : undefined;
    }
    if (Array.isArray(v)) return v as number[];
    return undefined;
  })();

  // Extract price_* fields from attributes (e.g. price_hoodie, price_tshirt)
  const attrPrices: Record<string, number> = {};
  for (const [key, attr] of Object.entries(attrs)) {
    if (key.startsWith('price_') && typeof attr?.value === 'number' && attr.value > 0) {
      attrPrices[key.replace('price_', '')] = attr.value;
    }
  }

  // Fall back to product.price (float4 column) when no price_* attributes exist
  const productPrice: number = (product as { price?: number } | null)?.price ?? 0;
  if (Object.keys(attrPrices).length === 0 && productPrice > 0) {
    const productType = typeof attrs['product_type']?.value === 'string'
      ? attrs['product_type'].value.toLowerCase()
      : 'item';
    attrPrices[productType.replace(/[^a-z0-9]+/g, '_').slice(0, 30)] = productPrice;
    console.log(`[Launch Agent] Using product.price (${productPrice}) as fallback price under key "${Object.keys(attrPrices)[0]}"`);
  }

  const attrPricingReasoning = typeof attrs['pricing_reasoning']?.value === 'string'
    ? attrs['pricing_reasoning'].value
    : undefined;

  const mergedPrices = { ...attrPrices, ...(designPayload?.prices ?? {}) };

  designPayload = {
    productName: productData.name,
    description: productData.description ?? '',
    categories: productData.categories ?? [],
    tags: designPayload?.tags,
    ...designPayload,
    blueprintId: designPayload?.blueprintId ?? attrBlueprintId ?? 384,
    printProviderId: designPayload?.printProviderId ?? attrProviderId,
    variantIds: designPayload?.variantIds ?? attrVariantIds,
    prices: mergedPrices,
    pricingReasoning: designPayload?.pricingReasoning ?? attrPricingReasoning,
  };

  console.log('[Launch Agent] Resolved launch config:', {
    productId,
    blueprintId: designPayload.blueprintId,
    printProviderId: designPayload.printProviderId,
    variantIds: designPayload.variantIds,
    prices: designPayload.prices,
    hasPrices: Object.keys(designPayload.prices).length > 0,
    pricingReasoning: designPayload.pricingReasoning ?? '(none)',
  });

  // Resolve shop ID: explicit request > selected channels > first sales channel > legacy column
  const salesChannels: Array<{ shop_id: string; title: string; channel: string }> =
    Array.isArray(business.sales_channels) ? business.sales_channels : [];
  const eligibleChannels = salesChannelIds && salesChannelIds.length > 0
    ? salesChannels.filter((ch) => salesChannelIds.includes(ch.shop_id))
    : salesChannels;
  const resolvedShopId =
    requestedShopId ||
    (eligibleChannels.length > 0 ? eligibleChannels[0].shop_id : business.printify_shop_id);

  // Find the channel name for the resolved shop (used in signals)
  const resolvedChannel = salesChannels.find((ch) => ch.shop_id === resolvedShopId);

  const printifyToken = await resolveBusinessPrintifyToken(supabase, businessId);

  if (!printifyToken || !resolvedShopId) {
    console.warn('[Launch Agent] Printify credentials missing, mock creation will be used.');
  }

  // Resolve product design image from Supabase storage (download bytes to avoid public URL dependency)
  let designImageBase64: string | undefined;
  let designImageFileName: string | undefined;
  try {
    const { data: files } = await supabase.storage
      .from('products')
      .list('', { search: productId });
    const match = files?.find((f) => f.name.startsWith(productId));
    if (match) {
      const { data: blob, error: dlErr } = await supabase.storage
        .from('products')
        .download(match.name);
      if (!dlErr && blob) {
        designImageBase64 = Buffer.from(await blob.arrayBuffer()).toString('base64');
        designImageFileName = match.name;
        console.log(`[Launch Agent] Design image loaded: ${match.name}`);
      } else {
        console.warn('[Launch Agent] Failed to download design image:', dlErr?.message);
      }
    } else {
      console.log('[Launch Agent] No design image in storage — will use placeholder.');
    }
  } catch (imgErr) {
    console.warn('[Launch Agent] Failed to resolve design image:', imgErr);
  }

  console.log('[Launch Agent] Image resolved:', { file: designImageFileName ?? 'none (placeholder)' });

  // 2. Signal command center: launch agent is now running
  const { data: activityRow } = await supabase
    .from('workflows')
    .insert({
      business_id: businessId,
      type: 'agent_active',
      source_agent: 'launch_agent',
      target_agent: 'launch_agent',
      state: 'processing',
      payload: { product_id: productId, product_name: productData.name },
    })
    .select('id')
    .single();
  const activityId = activityRow?.id ?? null;

  // 3. Insert pending launch state in the database
  const { data: launchRecord, error: launchError } = await supabase
    .from('product_launches')
    .insert({
      business_id: businessId,
      product_id: productId,
      status: 'in_progress',
    })
    .select()
    .single();

  if (launchError) {
    throw new Error(`Failed to create product_launches record: ${launchError.message}`);
  }

  const launchId = launchRecord.id;

  // 3. Build the tool executor
  const toolState: { marketResearchSummary: string; printifyResult: { product_id?: string; [key: string]: unknown } | null; publishResult: { publish_status?: string; published?: boolean; external_product_id?: string; [key: string]: unknown } | null; prices: Record<string, number> | null; reasoning: string } = {
    marketResearchSummary: '',
    printifyResult: null,
    publishResult: null,
    prices: designPayload?.prices ?? null,
    reasoning: designPayload?.pricingReasoning ?? '',
  };
  
  async function executeTool(name: string, args: Record<string, unknown>) {
    try {
      switch (name) {
        case 'performMarketResearch': {
          const res = await performMarketResearch({ productName: args.productName as string, categories: args.categories as string[] });
          toolState.marketResearchSummary = res;
          
          await supabase.from('product_launches').update({
            market_research_summary: res.substring(0, 800) + '...',
            updated_at: new Date().toISOString()
          }).eq('id', launchId);
          
          return { marketData: res };
        }
        case 'createPrintifyProduct': {
          const res = await createPrintifyProduct({
            productData,
            prices: args.prices as SuggestedPrices,
            printifyToken: printifyToken!,
            shopId: resolvedShopId!,
            blueprintId: designPayload?.blueprintId,
            printProviderId: designPayload?.printProviderId,
            variantIds: designPayload?.variantIds,
            designImageBase64,
            designImageFileName,
          });
          toolState.printifyResult = res;
          toolState.prices = args.prices as Record<string, number>;
          toolState.reasoning = args.reasoning as string;

          // Check for previous prices on this product to emit price_updated signal
          const { data: prevLaunch } = await supabase
            .from('product_launches')
            .select('optimal_prices')
            .eq('product_id', productId)
            .neq('id', launchId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const oldPrices = prevLaunch?.optimal_prices as Record<string, number> | null;

          await supabase.from('product_launches').update({
            printify_product_id: res.product_id,
            optimal_prices: args.prices,
            pricing_reasoning: args.reasoning,
            pricing_confidence: args.confidence || 0.85,
            status: 'created',
            updated_at: new Date().toISOString()
          }).eq('id', launchId);

          // Signal finance agent: price updated (only if previous prices differ)
          if (oldPrices) {
            const newPrices = args.prices as Record<string, number>;
            const changedKey = Object.keys(newPrices).find(
              (k) => oldPrices[k] !== undefined && oldPrices[k] !== newPrices[k]
            );
            if (changedKey) {
              await supabase.from('workflows').insert({
                business_id: businessId,
                type: 'price_updated',
                source_agent: 'launch_agent',
                target_agent: 'finance_agent',
                state: 'pending',
                payload: {
                  product_id: res.product_id,
                  product_title: productData.name,
                  old_price: oldPrices[changedKey],
                  new_price: newPrices[changedKey],
                  updated_at: new Date().toISOString(),
                },
              });
            }
          }

          return res;
        }
        case 'publishProductToSalesChannel': {
          const res = await publishProductToSalesChannel({
            productId: args.productId as string,
            printifyToken: printifyToken!,
            shopId: resolvedShopId!,
            waitForPublish: false,
          });
          toolState.publishResult = res;
          
          await supabase.from('product_launches').update({
            publish_status: res.publish_status,
            status: res.published ? 'published' : 'created',
            launched_at: res.published ? new Date().toISOString() : null,
            updated_at: new Date().toISOString()
          }).eq('id', launchId);

          if (!res.published && res.publish_status === 'publishing') {
            await supabase.from('workflows').insert({
              business_id: businessId,
              type: 'product_launch_publish',
              source_agent: 'launch_agent',
              target_agent: 'launch_agent',
              state: 'pending',
              payload: {
                launch_id: launchId,
                product_id: productId,
                printify_product_id: toolState.printifyResult?.product_id ?? args.productId,
                publish_status: res.publish_status,
              },
            });
          }

          if (res.published && res.external_product_id) {
            await supabase.from('product_launches').update({
              external_product_id: res.external_product_id,
            }).eq('id', launchId);
          }

          // Signal finance agent: product launched
          if (res.published || res.publish_status === 'published (mock)') {
            const listedPrice = Object.values(toolState.prices || {}).find(
              (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0
            ) ?? 0;
            await supabase.from('workflows').insert({
              business_id: businessId,
              type: 'product_launched',
              source_agent: 'launch_agent',
              target_agent: 'finance_agent',
              state: 'pending',
              payload: {
                product_id: toolState.printifyResult?.product_id ?? args.productId,
                product_title: productData.name,
                base_cost: 0,
                listed_price: listedPrice,
                marketplace: resolvedChannel?.channel || 'Printify',
                launched_at: new Date().toISOString(),
              },
            });
          }

          return res;
        }
        default:
          return { error: `Unknown tool: ${name}` };
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[Launch Agent] Tool ${name} failed:`, errorMessage);
      return { error: errorMessage, tool: name, recoverable: true };
    }
  }

  // 4. Build the system prompt and tool list (skip market research when design payload provides prices)
  const hasDesignPrices = designPayload && Object.keys(designPayload.prices).length > 0;
  const dp = designPayload!;
  const systemPrompt = hasDesignPrices
    ? `You are the Launch Agent for "${business.name}", an AI-operated print-on-demand business.

The product has already been designed and priced by the Design Agent. Prices provided: ${JSON.stringify(dp.prices)}.

WORKFLOW — follow these steps in order:
1. Call createPrintifyProduct with the provided prices: ${JSON.stringify(dp.prices)} and reasoning: "${dp.pricingReasoning ?? 'Prices set by design agent'}". Do NOT call performMarketResearch.
2. Call publishProductToSalesChannel using the returned productId (from step 1) to push the product live.
3. After all calls complete, give a concise summary message. You must exclusively use the tools provided.`
    : `You are the Launch Agent for "${business.name}", an AI-operated print-on-demand business.

WORKFLOW — follow these steps in order:
1. Call performMarketResearch to fetch live data about the product's market and pricing in Malaysia.
2. Call createPrintifyProduct using the returned market data to determine profitable, realistic prices (suggested margins 30-50% over base cost).
3. Call publishProductToSalesChannel using the returned productId (from step 2) to push the product live.
4. After all calls complete, give a concise summary message. You must exclusively use the tools provided.`;

  const activeTools = hasDesignPrices
    ? TOOL_DEFINITIONS.filter((t) => t.function.name !== 'performMarketResearch')
    : TOOL_DEFINITIONS;

  // 5. Run the agentic tools loop
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: userMessage || `Launch the product "${productData.name}" belonging to categories: ${productData.categories.join(', ')}. Description: ${productData.description}`,
    },
  ];

  let finalInsights = '';
  const MAX_ITERATIONS = 6;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await glm.chat.completions.create({
      model: (process.env.GLM_MODEL || 'ilmu-glm-5.1').trim(),
      messages,
      tools: activeTools as OpenAI.Chat.ChatCompletionTool[],
      tool_choice: 'auto',
      max_tokens: 2048,
      temperature: 0.4,
    });

    const msg = response.choices[0].message;
    messages.push(msg);

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      finalInsights = msg.content || '';
      break;
    }

    for (const toolCall of msg.tool_calls) {
      if (toolCall.type !== 'function') continue;
      const name = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments || '{}');

      console.log(`[Launch Agent] Calling tool: ${name}`);
      const result = await executeTool(name, args);

      messages.push({
        role: 'tool',
        content: JSON.stringify(result),
        tool_call_id: toolCall.id,
      });
    }
  }

  // Mark launch agent as done in command center
  if (activityId) {
    await supabase.from('workflows').update({
      state: 'processed',
      processed_at: new Date().toISOString(),
    }).eq('id', activityId);
  }

  return {
    launch_id: launchId,
    product_name: productData.name,
    optimal_prices: toolState.prices || {},
    pricing_reasoning: toolState.reasoning,
    printify_result: toolState.printifyResult,
    publish_result: toolState.publishResult,
    timestamp: new Date().toISOString(),
    final_message: finalInsights,
  };
}

// Background poll: updates product_launches row when Printify publish completes
export async function pollPublishStatus(launchId: string) {
  const { data: launch } = await supabase
    .from('product_launches')
    .select('id, business_id, printify_product_id, status, publish_status')
    .eq('id', launchId)
    .maybeSingle();

  if (!launch || launch.status === 'published' || launch.status === 'failed') return;

  const printifyToken = process.env.PRINTIFY_DEV_TOKEN;
  if (!printifyToken || !launch.printify_product_id || launch.printify_product_id.startsWith('mock-pf-')) {
    return;
  }

  // Resolve shop ID for this business
  const { data: business } = await supabase
    .from('businesses')
    .select('printify_shop_id, sales_channels')
    .eq('id', launch.business_id)
    .maybeSingle();

  const salesChannels: Array<{ shop_id: string }> = Array.isArray(business?.sales_channels)
    ? business.sales_channels
    : [];
  const shopCandidates = Array.from(
    new Set(
      [
        business?.printify_shop_id,
        ...salesChannels.map((ch) => ch.shop_id),
      ]
        .map((id) => (id || '').trim())
        .filter(Boolean)
    )
  );
  if (shopCandidates.length === 0) return;

  const maxAttempts = 24; // 24 * 5s = 2 minutes
  const intervalMs = 5000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, intervalMs));

    try {
      let lastNon404Error: { shopId: string; message: string } | null = null;

      for (const shopId of shopCandidates) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 15_000);
          let resp: Response;
          try {
            resp = await fetch(
              `https://api.printify.com/v1/shops/${shopId}/products/${launch.printify_product_id}.json`,
              {
                headers: {
                  Authorization: `Bearer ${printifyToken}`,
                  'Content-Type': 'application/json',
                  'User-Agent': 'PODCoPilot-Hackathon',
                },
                signal: controller.signal,
              },
            );
          } finally {
            clearTimeout(timer);
          }

          if (resp.status === 400 || resp.status === 404) {
            continue;
          }

          if (!resp.ok) {
            lastNon404Error = { shopId, message: `HTTP ${resp.status}` };
            break;
          }

          const data = await resp.json() as Record<string, unknown>;
          const isPublished = data?.is_published;
          const publishingStatus =
            (data?.publishing_status as string | undefined) ||
            (data?.publishing as Record<string, unknown>)?.status ||
            data?.publishing ||
            data?.status;

          if (isPublished) {
            await supabase
              .from('product_launches')
              .update({
                status: 'published',
                publish_status: 'published',
                external_product_id: (data?.external as Record<string, unknown>)?.id,
                launched_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', launchId);
            console.log(`[PollPublish] ${launchId} → published (shop ${shopId})`);
            return;
          }

          if (typeof publishingStatus === 'string' && /fail|error|rejected/i.test(publishingStatus)) {
            await supabase
              .from('product_launches')
              .update({
                status: 'failed',
                publish_status: `failed (${publishingStatus})`,
                updated_at: new Date().toISOString(),
              })
              .eq('id', launchId);
            console.log(`[PollPublish] ${launchId} → failed: ${publishingStatus} (shop ${shopId})`);
            return;
          }

          // Product exists on this shop and is still publishing; continue attempts.
          lastNon404Error = null;
          break;
        } catch (shopErr: unknown) {
          const msg = shopErr instanceof Error ? shopErr.message : 'unknown error';
          lastNon404Error = { shopId, message: msg };
        }
      }

      if (lastNon404Error) {
        console.error(
          `[PollPublish] attempt ${attempt + 1}: shop ${lastNon404Error.shopId} error ${lastNon404Error.message}`
        );
      }
    } catch (err: unknown) {
      console.error(`[PollPublish] Poll error attempt ${attempt + 1}:`, err instanceof Error ? err.message : String(err));
    }
  }

  // Timed out
  await supabase.from('product_launches').update({
    publish_status: 'publishing (timed out)',
    updated_at: new Date().toISOString(),
  }).eq('id', launchId);
  console.log(`[PollPublish] ${launchId} → timed out`);
}

// ====================== TEST / MOCK (run with ts-node or in API route) ======================
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('launchAgent.ts')) {
  runLaunchAgent({
    businessId: '123e4567-e89b-12d3-a456-426614174000', // Dummy ID
    productId: 'aaaaaaaa-0001-0001-0001-000000000001', // Dummy ID
    productData: {
      name: 'Malaysian Cyber Cat Hoodie',
      description: 'Futuristic cyber-y2k cat wearing songkok and batik pattern.',
      categories: ['hoodie', 'tshirt', 'mug'],
      tags: ['malaysia', 'cyber', 'cat'],
    }
  })
    .then((result) => console.log('LAUNCH RESULT:\n', JSON.stringify(result, null, 2)))
    .catch(console.error);
}
// lib/agents/launchAgent.ts
