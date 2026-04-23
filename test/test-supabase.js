import { createClient } from '@supabase/supabase-js';
import 'dotenv/config'; 

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSupabase() {
  console.log(`Testing connection to Supabase at: ${supabaseUrl} ...`);
  try {
    // 尝试向 businesses 表抓取一笔资料，测试连线与权限
    const { data, error } = await supabase.from('businesses').select('*').limit(1);
    
    if (error) {
      console.error('\n❌ Error: Failed to fetch data from Supabase!');
      console.error('Message:', error.message);
      console.error('Details:', error.details);
    } else {
      console.log('\n✅ Success! Connected to Supabase successfully.');
      console.log('Sample data from "businesses" table:', data);
    }
  } catch (err) {
    console.error('\n❌ Unexpected Error:');
    console.error(err.message);
  }
}

testSupabase();
