import { createClient } from '@supabase/supabase-js';
import type { WorkflowRow, HandlerResult } from '@/lib/types/workflow';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function handleDesignAgent(row: WorkflowRow): Promise<HandlerResult> {
  const context = (row.payload.context as string | undefined) ?? '';
  const userMessage = (row.payload.userMessage as string | undefined) ?? '';

  // Pull niche/theme from the previous pipeline step (business_agent result)
  const dep = row.payload.dependencyResult as Record<string, unknown> | undefined;
  const niche = (dep?.niche as string | undefined) ?? '';
  const theme = (dep?.theme as string | undefined) ?? '';

  const designPrompt = [context || userMessage, niche && `Niche: ${niche}`, theme && `Brand: ${theme}`]
    .filter(Boolean)
    .join(' — ');

  // Create a product row so the design page has something to open
  const res = await supabase
    .from('products')
    .insert({
      business_id: row.business_id,
      title: theme ? `${theme} Design` : 'New Design',
      status: 'draft',
      attributes: {
        orchestrator_prompt: { value: designPrompt },
      },
    })
    .select('id')
    .single();

  const product = res.data as { id: string } | null;
  const insertError = res.error;

  if (insertError || !product) {
    return { status: 'failed', error: insertError?.message ?? 'Failed to create product' };
  }

  console.log(`[DesignAgent] Created product ${product.id} with prompt: "${designPrompt.slice(0, 80)}"`);

  return {
    status: 'completed',
    data: {
      action: 'product_created_for_design',
      productId: product.id,
      designPrompt,
    },
  };
}
