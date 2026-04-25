import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import type { WorkflowRow, HandlerResult } from '@/lib/types/workflow';
import { setAgentState } from '@/lib/agents/shared/agentStateManager';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function getGlmClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.GLM_API_KEY!,
    baseURL: process.env.ILMU_BASE_URL || 'https://api.ilmu.ai/v1',
  });
}

export async function handleDesignAgent(row: WorkflowRow): Promise<HandlerResult> {
  await setAgentState(row.business_id, 'design_agent', 'running', 'Generating product concept...');

  try {
    const context = (row.payload.context as string | undefined) ?? '';
    const userMessage = (row.payload.userMessage as string | undefined) ?? '';

    const dep = row.payload.dependencyResult as Record<string, unknown> | undefined;
    const niche = (dep?.niche as string | undefined) ?? '';
    const theme = (dep?.theme as string | undefined) ?? '';

    const designPrompt = [context || userMessage, niche && `Niche: ${niche}`, theme && `Brand: ${theme}`]
      .filter(Boolean)
      .join(' — ');

    // Use the LLM to generate a product title, description, and category
    let title = theme ? `${theme} Design` : 'New Design';
    let description = designPrompt;
    let categories: string[] = ['apparel'];

    try {
      await setAgentState(row.business_id, 'design_agent', 'running', 'Researching product concept...');
      const glm = getGlmClient();
      const response = await glm.chat.completions.create({
        model: process.env.GLM_MODEL || 'ilmu-glm-5.1',
        messages: [
          {
            role: 'system',
            content: 'You are a print-on-demand product designer. Given a brief, produce a product title (max 60 chars), a short description (max 120 chars), and 1-2 product categories from: [apparel, mug, poster, hat, bag]. Respond ONLY in JSON: {"title":"...","description":"...","categories":["..."]}',
          },
          { role: 'user', content: designPrompt || 'A general print-on-demand product' },
        ],
        max_tokens: 200,
        temperature: 0.7,
      });

      const raw = response.choices[0].message.content?.trim() ?? '';
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { title?: string; description?: string; categories?: string[] };
        if (parsed.title) title = parsed.title.slice(0, 60);
        if (parsed.description) description = parsed.description.slice(0, 120);
        if (Array.isArray(parsed.categories) && parsed.categories.length > 0) categories = parsed.categories;
      }
    } catch (llmErr) {
      console.warn('[DesignAgent] LLM title generation failed, using fallback:', llmErr);
    }

    await setAgentState(row.business_id, 'design_agent', 'running', `Creating product: ${title}`);

    const res = await supabase
      .from('products')
      .insert({
        business_id: row.business_id,
        title,
        description,
        status: 'draft',
        attributes: {
          orchestrator_prompt: { value: designPrompt },
          categories: { value: categories },
        },
      })
      .select('id')
      .single();

    const product = res.data as { id: string } | null;
    if (res.error || !product) {
      await setAgentState(row.business_id, 'design_agent', 'error', 'Failed to create product');
      return { status: 'failed', error: res.error?.message ?? 'Failed to create product' };
    }

    console.log(`[DesignAgent] Created product ${product.id} — "${title}"`);
    await setAgentState(row.business_id, 'design_agent', 'idle', null);

    return {
      status: 'completed',
      data: {
        action: 'product_created_for_design',
        productId: product.id,
        productTitle: title,
        designPrompt,
        categories,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await setAgentState(row.business_id, 'design_agent', 'error', message.slice(0, 100));
    return { status: 'failed', error: message };
  }
}
