/**
 * End-to-end workflow test: design agent → launch agent → finance agent
 *
 * Simulates the full inter-agent signal chain without actually calling Printify.
 * Requires: local dev server running (pnpm dev) + .env loaded.
 *
 * Run: node --env-file=.env test/test-design-to-finance.js
 */

import { createClient } from '@supabase/supabase-js';

const BASE = 'http://localhost:3000';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const CRON_SECRET = process.env.CRON_SECRET;

async function triggerOrchestrator() {
  const res = await fetch(`${BASE}/api/cron/orchestrate`, {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Orchestrator failed: ${JSON.stringify(body)}`);
  return body;
}

async function waitForState(workflowId, expectedState, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 600));
    const { data } = await supabase
      .from('workflows')
      .select('state, error_message')
      .eq('id', workflowId)
      .single();
    if (data?.state === expectedState) return data;
    if (data?.state === 'failed') throw new Error(`Workflow failed: ${data.error_message}`);
  }
  throw new Error(`Timed out waiting for state "${expectedState}" on workflow ${workflowId}`);
}

async function run() {
  console.log('\n=== Design → Launch → Finance workflow test ===\n');

  // ── Resolve a real business ───────────────────────────────────────────────
  const { data: biz } = await supabase
    .from('businesses')
    .select('id, name')
    .limit(1)
    .single();
  if (!biz) throw new Error('No business found. Create one first.');
  console.log(`Business: ${biz.name} (${biz.id})`);

  // ── Resolve a real product ────────────────────────────────────────────────
  const { data: product } = await supabase
    .from('products')
    .select('id, title, attributes, price')
    .eq('business_id', biz.id)
    .not('attributes', 'is', null)
    .limit(1)
    .maybeSingle();
  if (!product) throw new Error('No product with attributes found. Design one first.');
  console.log(`Product: "${product.title}" (${product.id})`);
  console.log(`  blueprint_id: ${product.attributes?.blueprint_id?.value ?? '(none)'}`);
  console.log(`  print_provider_id: ${product.attributes?.print_provider_id?.value ?? '(none)'}`);
  console.log(`  price column: ${product.price}`);

  const pricingAttrs = Object.entries(product.attributes ?? {})
    .filter(([k]) => k.startsWith('price_'))
    .map(([k, v]) => `${k.replace('price_', '')}: ${v.value}`);
  console.log(`  price attrs: ${pricingAttrs.length > 0 ? pricingAttrs.join(', ') : '(none)'}`);

  // ── Phase 1: Simulate launch agent emitting product_launched signal ───────
  console.log('\n[Phase 1] Inserting product_launched signal → finance_agent...');
  const listedPrice = pricingAttrs.length > 0
    ? Number(pricingAttrs[0].split(': ')[1])
    : (product.price ?? 0);

  const { data: launchWf, error: launchWfErr } = await supabase
    .from('workflows')
    .insert({
      business_id: biz.id,
      type: 'product_launched',
      source_agent: 'launch_agent',
      target_agent: 'finance_agent',
      state: 'pending',
      payload: {
        product_id: product.id,
        product_title: product.title,
        listed_price: listedPrice,
        marketplace: 'etsy',
        launched_at: new Date().toISOString(),
      },
    })
    .select('id')
    .single();
  if (launchWfErr) throw new Error(`Failed to insert workflow: ${launchWfErr.message}`);
  console.log(`  Workflow inserted: ${launchWf.id}`);

  // ── Phase 2: Run orchestrator ─────────────────────────────────────────────
  console.log('\n[Phase 2] Triggering orchestrator...');
  const orchResult = await triggerOrchestrator();
  console.log(`  Result: processed=${orchResult.processed} skipped=${orchResult.skipped} failed=${orchResult.failed}`);

  // ── Phase 3: Verify product_launched was processed ────────────────────────
  console.log('\n[Phase 3] Verifying product_launched workflow state...');
  const launchWfFinal = await waitForState(launchWf.id, 'processed');
  console.log(`  ✓ product_launched → ${launchWfFinal.state}`);

  // ── Phase 4: Verify finance_agent received financial_analysis trigger ─────
  console.log('\n[Phase 4] Checking finance agent received financial_analysis workflow...');
  const { data: financeWf } = await supabase
    .from('workflows')
    .select('id, type, state, payload')
    .eq('business_id', biz.id)
    .eq('type', 'financial_analysis')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!financeWf) {
    console.log('  ✗ No financial_analysis workflow found');
  } else {
    console.log(`  ✓ financial_analysis workflow: ${financeWf.id} (state: ${financeWf.state})`);
    console.log(`    trigger: ${financeWf.payload?.trigger}, product: "${financeWf.payload?.product_title}"`);
  }

  // ── Phase 5: Also test price_updated signal ───────────────────────────────
  console.log('\n[Phase 5] Inserting price_updated signal → finance_agent...');
  const { data: priceWf } = await supabase
    .from('workflows')
    .insert({
      business_id: biz.id,
      type: 'price_updated',
      source_agent: 'launch_agent',
      target_agent: 'finance_agent',
      state: 'pending',
      payload: {
        product_id: product.id,
        product_title: product.title,
        old_price: listedPrice,
        new_price: Math.round(listedPrice * 1.1),
        updated_at: new Date().toISOString(),
      },
    })
    .select('id')
    .single();

  await triggerOrchestrator();
  const priceWfFinal = await waitForState(priceWf.id, 'processed');
  console.log(`  ✓ price_updated → ${priceWfFinal.state}`);

  console.log('\n=== All phases passed ✓ ===\n');
}

run().catch((err) => {
  console.error('\n✗ Test failed:', err.message);
  process.exit(1);
});
