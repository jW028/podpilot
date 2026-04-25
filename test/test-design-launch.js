import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const BASE = 'http://localhost:3000';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function run() {
  // ── 0. Resolve a real business + product ─────────────────────────────────
  console.log('\n[0] Fetching business and product...');
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name')
    .limit(1)
    .single();

  if (!business) {
    console.error('❌ No business found in DB. Create one first.');
    process.exit(1);
  }
  console.log(`  business: ${business.name} (${business.id})`);

  let { data: product } = await supabase
    .from('products')
    .select('id, title')
    .eq('business_id', business.id)
    .limit(1)
    .single();

  if (!product) {
    console.log('  No product found, creating a test product...');
    const { data: newProduct, error: prodError } = await supabase
      .from('products')
      .insert({
        business_id: business.id,
        title: 'Malaysian Batik T-Shirt',
        description: 'A vibrant batik-inspired print-on-demand t-shirt.',
        status: 'designing',
      })
      .select()
      .single();

    if (prodError || !newProduct) {
      console.error('❌ Failed to create test product:', prodError);
      process.exit(1);
    }
    product = newProduct;
  }
  console.log(`  product:  ${product.title} (${product.id})`);

  // ── 1. Design agent: finalize action ─────────────────────────────────────
  console.log('\n[1] Testing design agent finalize action...');
  const finalizeRes = await fetch(
    `${BASE}/api/business/${business.id}/products/design`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'finalize',
        messages: [{ role: 'user', content: 'Finalize this product.' }],
        productContext: {
          title: product.title,
          description: 'A Malaysian-themed print-on-demand product.',
        },
        businessContext: { name: business.name, niche: 'Malaysia culture' },
        finalizePayload: {
          blueprintId: 384,
          categories: ['tshirt', 'hoodie'],
          fieldSuggestions: [
            { fieldName: 'price_tshirt', type: 'number', label: 'T-Shirt Price', value: 5500 },
            { fieldName: 'price_hoodie', type: 'number', label: 'Hoodie Price', value: 8900 },
            { fieldName: 'pricing_reasoning', type: 'text', label: 'Reasoning', value: 'Priced at market-rate for Malaysia POD, 35% margin over base cost.' },
            { fieldName: 'tags', type: 'selection', label: 'Tags', value: ['malaysia', 'culture', 'batik'] },
          ],
        },
      }),
    },
  );

  const finalizeData = await finalizeRes.json();
  if (!finalizeRes.ok || !finalizeData.success) {
    console.error('❌ Design finalize failed:', finalizeData);
    process.exit(1);
  }

  const launchPayload = finalizeData.data?.launchPayload;
  if (!launchPayload) {
    console.error('❌ No launchPayload in response:', finalizeData);
    process.exit(1);
  }

  console.log('  ✅ launchPayload received:');
  console.log('    blueprintId:', launchPayload.blueprintId);
  console.log('    prices:', launchPayload.prices);
  console.log('    pricingReasoning:', launchPayload.pricingReasoning);
  console.log('    tags:', launchPayload.tags);

  // ── 2. Launch agent: skip market research, use design prices ─────────────
  console.log('\n[2] Testing launch agent with design payload (no market research)...');
  const launchRes = await fetch(`${BASE}/api/agents/launch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessId: business.id,
      productId: product.id,
      productData: {
        name: product.title,
        description: 'A Malaysian-themed print-on-demand product.',
        categories: launchPayload.categories,
        tags: launchPayload.tags,
      },
      designPayload: launchPayload,
    }),
  });

  const launchData = await launchRes.json();
  if (!launchRes.ok) {
    console.error('❌ Launch agent failed:', launchData);
    process.exit(1);
  }

  console.log('  ✅ Launch agent result:');
  console.log('    launch_id:', launchData.launch_id);
  console.log('    optimal_prices:', launchData.optimal_prices);
  console.log('    pricing_reasoning:', launchData.pricing_reasoning);
  console.log('    printify_result:', launchData.printify_result?.product_id, launchData.printify_result?.status);
  console.log('    publish_result:', launchData.publish_result?.publish_status);

  // ── 3. Orchestrator: design_to_launch workflow row ────────────────────────
  console.log('\n[3] Testing orchestrator with design_to_launch workflow row...');
  const { error: wfError } = await supabase.from('workflows').insert({
    business_id: business.id,
    type: 'design_to_launch',
    source_agent: 'design_agent',
    target_agent: 'launch_agent',
    state: 'pending',
    payload: {
      businessId: business.id,
      productId: product.id,
      salesChannelIds: [],
      designPayload: launchPayload,
    },
  });

  if (wfError) {
    console.error('❌ Failed to insert workflow row:', wfError);
    process.exit(1);
  }
  console.log('  workflow row inserted, triggering orchestrator...');

  const orchRes = await fetch(`${BASE}/api/cron/orchestrate`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });

  const orchData = await orchRes.json();
  if (!orchRes.ok) {
    console.error('❌ Orchestrator failed:', orchData);
    process.exit(1);
  }

  console.log('  ✅ Orchestrator result:', orchData);

  console.log('\n✅ All 3 tests passed.\n');
}

run().catch((err) => {
  console.error('\n❌ Unexpected error:', err.message);
  process.exit(1);
});
