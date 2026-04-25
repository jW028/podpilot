import { createClient } from '@supabase/supabase-js';
import type { WorkflowRow, HandlerResult, ProductSignal } from '@/lib/types/workflow';
import { resolveBusinessPrintifyToken } from '@/lib/printify/credentials';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function handleInterAgentSignal(row: WorkflowRow): Promise<HandlerResult> {
  const signal = row.payload.signal as ProductSignal | undefined;
  if (!signal) {
    return { status: 'skipped', reason: 'No signal in payload' };
  }

  if (row.target_agent === 'launch_agent') {
    if (signal.action === 'reprice') {
      return handleReprice(row, signal);
    }
    if (signal.action === 'retire') {
      return handleRetire(row, signal);
    }
    return { status: 'skipped', reason: `Unhandled action "${signal.action}" for launch_agent` };
  }

  if (row.target_agent === 'product_agent') {
    if (signal.action === 'boost') {
      return handleBoost(row, signal);
    }
    return { status: 'skipped', reason: `Unhandled action "${signal.action}" for product_agent` };
  }

  return { status: 'skipped', reason: `Unknown target_agent "${row.target_agent}"` };
}

async function handleReprice(row: WorkflowRow, signal: ProductSignal): Promise<HandlerResult> {
  const printifyToken = await resolveBusinessPrintifyToken(supabase, row.business_id);
  const shopId = await getShopId(row.business_id);

  if (!printifyToken || !shopId) {
    return { status: 'failed', error: 'Printify credentials not configured' };
  }

  try {
    const multiplier = signal.suggested_price_multiplier || 1.35;
    const resp = await fetch(
      `https://api.printify.com/v1/shops/${shopId}/products/${signal.product_id}.json`,
      { headers: { Authorization: `Bearer ${printifyToken}` } },
    );
    if (!resp.ok) {
      return { status: 'failed', error: `Printify fetch failed: ${resp.status}` };
    }

    const printifyProduct = await resp.json();
    const variants = (printifyProduct.variants || []).map((v: Record<string, unknown>) => ({
      id: v.id,
      price: Math.round(((v.price as number) || 0) * multiplier),
      is_enabled: v.is_enabled,
    }));

    const updateResp = await fetch(
      `https://api.printify.com/v1/shops/${shopId}/products/${signal.product_id}.json`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${printifyToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ variants }),
      },
    );

    if (!updateResp.ok) {
      return { status: 'failed', error: `Printify update failed: ${updateResp.status}` };
    }

    console.log(`[Orchestrator] Repriced product ${signal.product_id} by ${multiplier}x.`);
    return { status: 'completed', data: { product_id: signal.product_id, multiplier } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { status: 'failed', error: message };
  }
}

async function handleRetire(row: WorkflowRow, signal: ProductSignal): Promise<HandlerResult> {
  const printifyToken = await resolveBusinessPrintifyToken(supabase, row.business_id);
  const shopId = await getShopId(row.business_id);

  if (!printifyToken || !shopId) {
    return { status: 'failed', error: 'Printify credentials not configured' };
  }

  try {
    const resp = await fetch(
      `https://api.printify.com/v1/shops/${shopId}/products/${signal.product_id}.json`,
      { headers: { Authorization: `Bearer ${printifyToken}` } },
    );
    if (!resp.ok) {
      return { status: 'failed', error: `Printify fetch failed: ${resp.status}` };
    }

    const printifyProduct = await resp.json();
    const variants = (printifyProduct.variants || []).map((v: Record<string, unknown>) => ({
      id: v.id,
      price: v.price,
      is_enabled: false,
    }));

    await fetch(
      `https://api.printify.com/v1/shops/${shopId}/products/${signal.product_id}.json`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${printifyToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ variants }),
      },
    );

    await supabase
      .from('products')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('printify_product_id', signal.product_id)
      .eq('business_id', row.business_id);

    console.log(`[Orchestrator] Retired product ${signal.product_id}.`);
    return { status: 'completed', data: { product_id: signal.product_id, action: 'retired' } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { status: 'failed', error: message };
  }
}

async function handleBoost(_row: WorkflowRow, _signal: ProductSignal): Promise<HandlerResult> {
  return { status: 'skipped', reason: 'Boost action not yet implemented (product_agent pending)' };
}

async function getShopId(businessId: string): Promise<string | null> {
  const { data } = await supabase
    .from('businesses')
    .select('printify_shop_id')
    .eq('id', businessId)
    .maybeSingle();
  return data?.printify_shop_id || null;
}
