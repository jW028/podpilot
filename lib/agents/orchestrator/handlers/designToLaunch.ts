import { createClient } from '@supabase/supabase-js';
import type { WorkflowRow, HandlerResult } from '@/lib/types/workflow';
import type { DesignToLaunchPayload, LaunchProductInput } from '@/lib/types';
import { runLaunchAgent } from '@/lib/agents/launch/launchAgent';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function handleDesignToLaunch(row: WorkflowRow): Promise<HandlerResult> {
  const payload = row.payload as {
    productId?: string;
    businessId?: string;
    designPayload?: DesignToLaunchPayload;
    salesChannelIds?: string[];
  };

  const { productId, businessId, designPayload, salesChannelIds } = payload;

  if (!productId || !businessId || !designPayload) {
    return { status: 'failed', error: 'Missing productId, businessId, or designPayload in workflow payload' };
  }

  // Fetch product details to build productData for the launch agent
  const { data: product, error } = await supabase
    .from('products')
    .select('title, description, attributes')
    .eq('id', productId)
    .single();

  if (error || !product) {
    return { status: 'failed', error: `Product not found: ${error?.message ?? 'unknown'}` };
  }

  const productData: LaunchProductInput = {
    name: designPayload.productName || product.title,
    description: designPayload.description || product.description || '',
    categories: designPayload.categories,
    tags: designPayload.tags,
  };

  try {
    const result = await runLaunchAgent({
      businessId,
      productId,
      productData,
      designPayload,
      salesChannelIds,
    });

    return {
      status: 'completed',
      data: {
        launch_id: result.launch_id,
        publish_status: result.publish_result?.publish_status ?? 'unknown',
      },
    };
  } catch (err: unknown) {
    return { status: 'failed', error: err instanceof Error ? err.message : String(err) };
  }
}
