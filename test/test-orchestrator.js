import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const cronSecret = process.env.CRON_SECRET;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testOrchestrator() {
  console.log('1. Fetching a business ID to use...');
  let { data: business, error } = await supabase.from('businesses').select('id').limit(1).single();
  
  let businessId;
  if (!business) {
    console.log("No business found. Let's create a dummy one.");
    const { data: newBusiness, error: insertError } = await supabase.from('businesses').insert({ name: 'Test Business' }).select().single();
    if (insertError) {
       console.error('Failed to create dummy business', insertError);
       return;
    }
    businessId = newBusiness.id;
  } else {
    businessId = business.id;
  }

  console.log(`2. Inserting a pending workflow for business ${businessId}...`);
  const { error: wfError } = await supabase.from('workflows').insert({
    business_id: businessId,
    type: 'inter_agent_signal',
    source_agent: 'finance_agent',
    target_agent: 'launch_agent',
    state: 'pending',
    payload: {
      signal: {
        type: 'product_signal',
        action: 'test_action_that_will_skip',
        product_id: 'test_123'
      }
    }
  });

  if (wfError) {
    console.error('Failed to insert workflow:', wfError);
    return;
  }

  console.log('3. Triggering the orchestrator API endpoint...');
  try {
    const res = await fetch('http://localhost:3000/api/cron/orchestrate', {
      headers: {
        'Authorization': `Bearer ${cronSecret}`
      }
    });

    const data = await res.json();
    console.log(`Response Status: ${res.status}`);
    console.log('Response Body:', data);
    
    if (res.ok) {
       console.log('\n✅ Orchestrator successfully ran and processed the dummy task!');
    } else {
       console.log('\n❌ Orchestrator failed to run. Is your local server running (npm run dev)?');
    }
  } catch (err) {
    console.error('\n❌ Failed to connect to local server. Make sure `npm run dev` is running.', err.message);
  }
}

testOrchestrator();
