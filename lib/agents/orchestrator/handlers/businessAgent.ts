import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import type { WorkflowRow, HandlerResult } from '@/lib/types/workflow';

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

async function generateFramework(prompt: string): Promise<BusinessFramework | null> {
  const glm = getGlmClient();

  const response = await glm.chat.completions.create({
    model: process.env.GLM_MODEL || 'ilmu-glm-5.1',
    messages: [
      {
        role: 'system',
        content: 'You are a business strategy expert for Malaysian print-on-demand businesses. Return only valid JSON, no markdown, no explanation.',
      },
      {
        role: 'user',
        content: `Based on this request: "${prompt}"

Generate a business framework JSON with exactly these fields:
{
  "niche": "specific product niche",
  "theme": "brand name / theme",
  "vibeKeywords": ["keyword1", "keyword2", "keyword3"],
  "brandVoice": "brand tone description",
  "targetAudience": "who buys this",
  "productLane": "what types of products to sell",
  "valueProposition": "one sentence why customers choose this",
  "malaysiaTrendNote": "relevant Malaysian market context",
  "risks": ["risk1", "risk2"],
  "next30Days": ["action1", "action2", "action3"]
}`,
      },
    ],
    max_tokens: 800,
    temperature: 0.7,
  });

  const raw = response.choices[0]?.message?.content ?? '';
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? (JSON.parse(match[0]) as BusinessFramework) : null;
  } catch {
    return null;
  }
}

export async function handleBusinessAgent(row: WorkflowRow): Promise<HandlerResult> {
  const context = (row.payload.context as string | undefined) ?? '';
  const userMessage = (row.payload.userMessage as string | undefined) ?? '';
  const prompt = context || userMessage;

  if (!prompt) {
    return { status: 'skipped', reason: 'No context provided to business_agent' };
  }

  console.log(`[BusinessAgent] Generating framework for: "${prompt.slice(0, 80)}..."`);

  const framework = await generateFramework(prompt);

  if (!framework) {
    return { status: 'failed', error: 'Failed to generate business framework from LLM' };
  }

  // Save to brand_profiles (upsert — business may already exist)
  const { error: brandError } = await supabase
    .from('brand_profiles')
    .upsert(
      {
        business_id: row.business_id,
        brand_name: framework.theme,
        tagline: framework.valueProposition,
        brand_voice: framework.brandVoice,
        target_audience: framework.targetAudience,
        color_palette: { vibeKeywords: framework.vibeKeywords },
        printify_setup_status: 'pending',
      },
      { onConflict: 'business_id' },
    );

  if (brandError) {
    console.error('[BusinessAgent] Failed to save brand profile:', brandError.message);
  }

  // Update business niche and mark as active
  await supabase
    .from('businesses')
    .update({ niche: framework.niche, status: 'active' })
    .eq('id', row.business_id);

  console.log(`[BusinessAgent] Framework saved: niche="${framework.niche}", theme="${framework.theme}"`);

  return {
    status: 'completed',
    data: {
      action: 'business_framework_generated',
      niche: framework.niche,
      theme: framework.theme,
      businessName: framework.theme,
      framework,
    },
  };
}
