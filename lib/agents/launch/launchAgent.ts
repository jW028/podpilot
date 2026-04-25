import 'dotenv/config';
import axios from 'axios';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import type { LaunchProductInput } from '@/lib/types';
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
  userMessage = null,
}: {
  businessId: string;
  productId: string;
  productData: LaunchProductInput;
  shopId?: string;
  userMessage?: string | null;
}) {
  const glm = getGlmClient();

  // 1. Load business context (get printify_shop_id + sales_channels)
  const { data: business, error } = await supabase
    .from('businesses')
    .select('id, name, printify_shop_id, sales_channels')
    .eq('id', businessId)
    .single();

  if (error || !business) {
    throw new Error('Business not found');
  }

  // Resolve shop ID: explicit request > first sales channel > legacy column
  const salesChannels: Array<{ shop_id: string; title: string; channel: string }> =
    Array.isArray(business.sales_channels) ? business.sales_channels : [];
  const resolvedShopId =
    requestedShopId ||
    (salesChannels.length > 0 ? salesChannels[0].shop_id : business.printify_shop_id);

  // Find the channel name for the resolved shop (used in signals)
  const resolvedChannel = salesChannels.find((ch) => ch.shop_id === resolvedShopId);

  const printifyToken = await resolveBusinessPrintifyToken(supabase, businessId);

  if (!printifyToken || !resolvedShopId) {
    console.warn('[Launch Agent] Printify credentials missing, mock creation will be used.');
  }

  // 2. Insert pending launch state in the database
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
  const toolState: { marketResearchSummary: string; printifyResult: { product_id?: string; [key: string]: unknown } | null; publishResult: { publish_status?: string; published?: boolean; external_product_id?: string; [key: string]: unknown } | null; prices: Record<string, number> | null; reasoning: string } = { marketResearchSummary: '', printifyResult: null, publishResult: null, prices: null, reasoning: '' };
  
  async function executeTool(name: string, args: Record<string, unknown>) {
    try {
      switch (name) {
        case 'performMarketResearch': {
          const res = await performMarketResearch({ productName: args.productName, categories: args.categories });
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
            prices: args.prices,
            printifyToken: printifyToken!,
            shopId: resolvedShopId!,
          });
          toolState.printifyResult = res;
          toolState.prices = args.prices;
          toolState.reasoning = args.reasoning;

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
            productId: args.productId,
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

  // 4. Build the system prompt
  const systemPrompt = `You are the Launch Agent for "${business.name}", an AI-operated print-on-demand business.

WORKFLOW — follow these steps in order:
1. Call performMarketResearch to fetch live data about the product's market and pricing in Malaysia.
2. Call createPrintifyProduct using the returned market data to determine profitable, realistic prices (suggested margins 30-50% over base cost).
3. Call publishProductToSalesChannel using the returned productId (from step 2) to push the product live.
4. After all calls complete, give a concise summary message. You must exclusively use the tools provided.`;

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
      tools: TOOL_DEFINITIONS as OpenAI.Chat.ChatCompletionTool[],
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
          const resp = await axios.get(
            `https://api.printify.com/v1/shops/${shopId}/products/${launch.printify_product_id}.json`,
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

          if (isPublished) {
            await supabase
              .from('product_launches')
              .update({
                status: 'published',
                publish_status: 'published',
                external_product_id: resp.data?.external?.id,
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
          const status = axios.isAxiosError(shopErr) ? shopErr.response?.status : undefined;
          const msg = shopErr instanceof Error ? shopErr.message : 'unknown error';
          // Product may belong to another shop; keep trying candidates.
          if (status === 400 || status === 404) {
            continue;
          }
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
