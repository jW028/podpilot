import { createClient } from '@supabase/supabase-js';
import type { WorkflowRow, HandlerResult } from '@/lib/types/workflow';
import { resolveBusinessPrintifyToken } from '@/lib/printify/credentials';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type PublishPayload = {
  launch_id: string;
  product_id: string;
  printify_product_id: string;
  publish_status: string;
};

export async function handleProductLaunchPublish(row: WorkflowRow): Promise<HandlerResult> {
  const { launch_id, printify_product_id } = row.payload as PublishPayload;

  // Mock products are immediately published
  if (printify_product_id?.startsWith('mock-pf-')) {
    await supabase.from('product_launches').update({
      publish_status: 'published (mock)',
      status: 'published',
      launched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', launch_id);
    return { status: 'completed', data: { publish_status: 'published (mock)' } };
  }

  const printifyToken = await resolveBusinessPrintifyToken(supabase, row.business_id);
  const shopId = await getShopId(row.business_id);

  if (!printifyToken || !shopId) {
    return { status: 'failed', error: 'Printify credentials not configured' };
  }

  try {
    const resp = await fetch(
      `https://api.printify.com/v1/shops/${shopId}/products/${printify_product_id}.json`,
      { headers: { Authorization: `Bearer ${printifyToken}` } },
    );

    if (!resp.ok) {
      return { status: 'failed', error: `Printify API returned ${resp.status}` };
    }

    const data = await resp.json();
    const isPublished = data?.is_published === true;
    const publishingStatus = data?.publishing_status || data?.publishing?.status || data?.status;

    if (isPublished) {
      const externalId = data?.external?.id;
      const update: Record<string, unknown> = {
        publish_status: 'published',
        status: 'published',
        launched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (externalId) update.external_product_id = externalId;

      await supabase.from('product_launches').update(update).eq('id', launch_id);
      return { status: 'completed', data: { publish_status: 'published' } };
    }

    if (typeof publishingStatus === 'string' && /fail|error|rejected/i.test(publishingStatus)) {
      await supabase.from('product_launches').update({
        publish_status: `failed (${publishingStatus})`,
        status: 'created',
        updated_at: new Date().toISOString(),
      }).eq('id', launch_id);
      return { status: 'failed', error: `Publish failed: ${publishingStatus}` };
    }

    // Still publishing — reset workflow row back to pending for next cron tick
    await supabase.from('workflows').update({
      state: 'pending',
      processed_at: null,
    }).eq('id', row.id);

    await supabase.from('product_launches').update({
      updated_at: new Date().toISOString(),
    }).eq('id', launch_id);

    return { status: 'skipped', reason: `Still publishing (status: ${publishingStatus}), will retry next tick` };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { status: 'failed', error: message };
  }
}

async function getShopId(businessId: string): Promise<string | null> {
  const { data } = await supabase
    .from('businesses')
    .select('printify_shop_id')
    .eq('id', businessId)
    .maybeSingle();
  return data?.printify_shop_id || null;
}
