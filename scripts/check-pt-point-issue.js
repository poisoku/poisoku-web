const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pjjhyzbnnslaauwzknrr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqamh5emJubnNsYWF1d3prbnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5ODg4MzksImV4cCI6MjA2NjU2NDgzOX0.qcrcwNpwX83dCNbhxFaks2E68K_wp2W8urdYwfenDtM';

async function checkPtPointIssue() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('🔍 「ptポイント」という二重表記の問題を調査中...');
  console.log('='.repeat(60));
  
  // 問題のある案件を検索
  const { data: problematicCampaigns, error } = await supabase
    .from('campaigns')
    .select('*')
    .or('cashback_rate.ilike.%ptポイント%,cashback_rate.ilike.%ptpoint%')
    .eq('is_active', true);
    
  if (error) {
    console.error('❌ エラー:', error);
    return;
  }
  
  console.log(`📊 問題のある案件: ${problematicCampaigns?.length || 0}件`);
  
  if (problematicCampaigns && problematicCampaigns.length > 0) {
    console.log('\n詳細:');
    problematicCampaigns.forEach((campaign, index) => {
      console.log(`\n${index + 1}. ${campaign.name}`);
      console.log(`   ID: ${campaign.id}`);
      console.log(`   還元率: ${campaign.cashback_rate}`);
      console.log(`   デバイス: ${campaign.device}`);
      console.log(`   URL: ${campaign.campaign_url}`);
    });
    
    // 修正方法の提案
    console.log('\n' + '='.repeat(60));
    console.log('💡 修正方法:');
    console.log('1. データベース内の cashback_rate フィールドから「ポイント」を削除');
    console.log('2. 例: "17280ptポイント" → "17280pt"');
    console.log('3. その後、検索データを再生成');
    
    // 修正SQLの生成
    console.log('\n📝 修正SQL:');
    problematicCampaigns.forEach(campaign => {
      const correctedRate = campaign.cashback_rate.replace(/ptポイント/gi, 'pt');
      console.log(`UPDATE campaigns SET cashback_rate = '${correctedRate}' WHERE id = '${campaign.id}';`);
    });
  }
  
  // より広範囲なチェック
  console.log('\n\n🔍 より広範囲なチェック（ptを含む全案件）:');
  const { data: allPtCampaigns, error: error2 } = await supabase
    .from('campaigns')
    .select('cashback_rate, id')
    .ilike('cashback_rate', '%pt%')
    .eq('is_active', true)
    .limit(20);
    
  if (allPtCampaigns) {
    console.log(`\n📊 「pt」を含む案件のサンプル（最大20件）:`);
    const patterns = new Map();
    
    allPtCampaigns.forEach(campaign => {
      const pattern = campaign.cashback_rate.match(/\d+pt.*/)?.[0] || campaign.cashback_rate;
      if (!patterns.has(pattern)) {
        patterns.set(pattern, 0);
      }
      patterns.set(pattern, patterns.get(pattern) + 1);
    });
    
    console.log('\nパターン別集計:');
    patterns.forEach((count, pattern) => {
      console.log(`  - "${pattern}": ${count}件`);
    });
  }
}

checkPtPointIssue().catch(console.error);