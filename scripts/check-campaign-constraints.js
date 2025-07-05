const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pjjhyzbnnslaauwzknrr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqamh5emJubnNsYWF1d3prbnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5ODg4MzksImV4cCI6MjA2NjU2NDgzOX0.qcrcwNpwX83dCNbhxFaks2E68K_wp2W8urdYwfenDtM';

async function checkConstraints() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('🔍 campaignsテーブルの制約を確認中...');
  
  // 既存のカテゴリ値を確認
  const { data: categories, error } = await supabase
    .from('campaigns')
    .select('category')
    .limit(100);
  
  if (categories) {
    const uniqueCategories = [...new Set(categories.map(c => c.category))];
    console.log('✅ 既存のカテゴリ値:', uniqueCategories);
  }
  
  // 既存のdevice値を確認
  const { data: devices, error: deviceError } = await supabase
    .from('campaigns')
    .select('device')
    .limit(100);
  
  if (devices) {
    const uniqueDevices = [...new Set(devices.map(d => d.device))];
    console.log('✅ 既存のdevice値:', uniqueDevices);
  }
}

checkConstraints().catch(console.error);