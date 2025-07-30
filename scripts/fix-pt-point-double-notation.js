const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://pjjhyzbnnslaauwzknrr.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqamh5emJubnNsYWF1d3prbnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5ODg4MzksImV4cCI6MjA2NjU2NDgzOX0.qcrcwNpwX83dCNbhxFaks2E68K_wp2W8urdYwfenDtM';

async function fixPtPointDoubleNotation() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('🔧 「ptポイント」二重表記の修正を開始...');
  console.log('='.repeat(60));
  
  // 問題のある案件を検索
  const { data: problematicCampaigns, error } = await supabase
    .from('campaigns')
    .select('*')
    .or('cashback_rate.ilike.%ptポイント%,cashback_rate.ilike.%ptpoint%')
    .eq('is_active', true);
    
  if (error) {
    console.error('❌ 検索エラー:', error);
    return;
  }
  
  console.log(`📊 修正対象: ${problematicCampaigns?.length || 0}件`);
  
  if (!problematicCampaigns || problematicCampaigns.length === 0) {
    console.log('✅ 修正が必要な案件はありません');
    return;
  }
  
  let successCount = 0;
  let errorCount = 0;
  
  // 各案件を修正
  for (const campaign of problematicCampaigns) {
    const oldRate = campaign.cashback_rate;
    const newRate = oldRate.replace(/ptポイント/gi, 'pt').replace(/ptpoint/gi, 'pt');
    
    console.log(`\n修正中: ${campaign.name.substring(0, 50)}...`);
    console.log(`  変更前: ${oldRate}`);
    console.log(`  変更後: ${newRate}`);
    
    const { error: updateError } = await supabase
      .from('campaigns')
      .update({ cashback_rate: newRate })
      .eq('id', campaign.id);
      
    if (updateError) {
      console.error(`  ❌ 更新エラー: ${updateError.message}`);
      errorCount++;
    } else {
      console.log(`  ✅ 更新成功`);
      successCount++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 修正結果:');
  console.log(`  ✅ 成功: ${successCount}件`);
  console.log(`  ❌ エラー: ${errorCount}件`);
  console.log(`  📋 合計: ${problematicCampaigns.length}件`);
  
  if (successCount > 0) {
    console.log('\n💡 次のステップ:');
    console.log('  検索データを再生成してください:');
    console.log('  node scripts/generate-search-data.js');
  }
}

// 実行
fixPtPointDoubleNotation().catch(console.error);