import { createClient } from '@supabase/supabase-js';
import type { DesignToLaunchPayload } from '@/lib/types';
import { executeLogDecision } from './tools';
import { runOrchestrator } from './orchestrator';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ─── Event: Product becomes "ready" ──────────────────────────────────────────

export async function handleProductReadyEvent(args: {
  businessId: string;
  productId: string;
  productTitle: string;
  designPayload?: DesignToLaunchPayload;
}): Promise<{ queued: boolean; reason: string }> {
  const { businessId, productId, productTitle, designPayload } = args;

  // Check if product has prices set
  const hasPrices = designPayload && Object.keys(designPayload.prices).length > 0;

  if (!hasPrices) {
    console.log(`[EventHandler] Product "${productTitle}" is ready but has no prices — skipping auto-launch queue`);
    return { queued: false, reason: 'No prices set — product needs manual launch' };
  }

  // Check if business has sales channels connected
  const { data: business } = await supabase
    .from('businesses')
    .select('sales_channels, printify_shop_id')
    .eq('id', businessId)
    .maybeSingle();

  const hasChannels = Array.isArray(business?.sales_channels) && business.sales_channels.length > 0;
  const hasShopId = !!business?.printify_shop_id;

  if (!hasChannels && !hasShopId) {
    console.log(`[EventHandler] Product "${productTitle}" ready but no sales channels — skipping auto-launch queue`);
    return { queued: false, reason: 'No sales channels connected' };
  }

  // Check for duplicate: already have a pending/awaiting_approval design_to_launch for this product
  const { data: existing } = await supabase
    .from('workflows')
    .select('id')
    .eq('business_id', businessId)
    .eq('type', 'design_to_launch')
    .in('state', ['pending', 'awaiting_approval'])
    .contains('payload', { productId })
    .limit(1);

  if (existing && existing.length > 0) {
    console.log(`[EventHandler] Product "${productTitle}" already has a launch workflow queued`);
    return { queued: false, reason: 'Launch workflow already queued for this product' };
  }

  // Insert an awaiting_approval workflow (requires user approval)
  const { error } = await supabase.from('workflows').insert({
    business_id: businessId,
    type: 'design_to_launch',
    source_agent: 'orchestrator',
    target_agent: 'launch_agent',
    state: 'awaiting_approval',
    payload: {
      productId,
      businessId,
      designPayload,
      auto_queued: true,
      reason: `Product "${productTitle}" is ready with prices and sales channels connected`,
    },
  });

  if (error) {
    console.error(`[EventHandler] Failed to queue auto-launch for "${productTitle}":`, error.message);
    return { queued: false, reason: `Failed: ${error.message}` };
  }

  // Log the decision
  await executeLogDecision({
    businessId,
    decision: 'auto_launch_queued',
    reasoning: `Product "${productTitle}" is ready with prices and sales channels. Queued for user approval.`,
    actionsTaken: [`Inserted awaiting_approval workflow for launch_agent`],
  });

  console.log(`[EventHandler] Product "${productTitle}" queued for auto-launch (awaiting approval)`);
  return { queued: true, reason: 'Queued for user approval' };
}

// ─── Event: Critical signal detected ─────────────────────────────────────────

export async function handleCriticalSignalEvent(args: {
  businessId: string;
  signalType: string;
  signalAction: string;
  productTitle: string;
  priority: string;
  workflowId: string;
}): Promise<void> {
  const { businessId, signalType, signalAction, productTitle, priority, workflowId } = args;

  if (priority !== 'CRITICAL') return;

  // Fetch the current payload, add the critical flag, and update
  const { data: workflow } = await supabase
    .from('workflows')
    .select('payload')
    .eq('id', workflowId)
    .maybeSingle();

  if (workflow) {
    const updatedPayload = {
      ...(workflow.payload as Record<string, unknown>),
      critical_flag: true,
      critical_detected_at: new Date().toISOString(),
    };

    await supabase
      .from('workflows')
      .update({ payload: updatedPayload })
      .eq('id', workflowId);
  }

  // Log the detection
  await executeLogDecision({
    businessId,
    decision: 'critical_signal_detected',
    reasoning: `CRITICAL ${signalAction} signal detected for "${productTitle}" (${signalType}). Flagged for prioritized processing.`,
    actionsTaken: [`Flagged workflow ${workflowId} as critical`],
  });

  console.log(`[EventHandler] CRITICAL signal flagged: ${signalAction} for "${productTitle}" (workflow ${workflowId})`);
}
