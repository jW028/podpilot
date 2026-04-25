import { createClient } from '@supabase/supabase-js';
import type { WorkflowRow, HandlerResult } from '@/lib/types/workflow';
import type { DesignToLaunchPayload, LaunchProductInput } from '@/lib/types';
import { runLaunchAgent } from '@/lib/agents/launch/launchAgent';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Handler for launch_agent steps in a startAgentPipeline / startConcurrentPipelines chain.
// The dependency result from the preceding design_agent step carries the productId.
export async function handleLaunchAgentPipeline(row: WorkflowRow): Promise<HandlerResult> {
  const dep = row.payload.dependencyResult as Record<string, unknown> | undefined;
  const productId = dep?.productId as string | undefined;

  if (!productId) {
    return { status: 'failed', error: 'launch_agent pipeline step: no productId from design_agent dependency' };
  }

  const { data: product, error } = await supabase
    .from('products')
    .select('title, description, attributes')
    .eq('id', productId)
    .maybeSingle();

  if (error || !product) {
    return { status: 'failed', error: `Product ${productId} not found: ${error?.message ?? 'unknown'}` };
  }

  const attrs = (product.attributes as Record<string, { value: unknown }> | null) ?? {};

  const categories =
    Array.isArray(attrs['categories']?.value) ? (attrs['categories'].value as string[]) : ['apparel'];

  const blueprintId =
    typeof attrs['blueprint_id']?.value === 'number' ? (attrs['blueprint_id'].value as number) : undefined;
  const printProviderId =
    typeof attrs['print_provider_id']?.value === 'number' ? (attrs['print_provider_id'].value as number) : undefined;

  const designPayload: DesignToLaunchPayload = {
    productName: product.title,
    description: product.description ?? '',
    categories,
    tags: [],
    prices: {},
    blueprintId: blueprintId ?? 384,
    ...(printProviderId !== undefined && { printProviderId }),
  };

  const productData: LaunchProductInput = {
    name: product.title,
    description: product.description ?? '',
    categories,
  };

  try {
    const result = await runLaunchAgent({
      businessId: row.business_id,
      productId,
      productData,
      designPayload,
      userMessage: (row.payload.userMessage as string | null) ?? null,
    });

    return {
      status: 'completed',
      data: {
        launch_id: result.launch_id,
        publish_status: result.publish_result?.publish_status ?? 'unknown',
        productId,
      },
    };
  } catch (err: unknown) {
    return { status: 'failed', error: err instanceof Error ? err.message : String(err) };
  }
}
