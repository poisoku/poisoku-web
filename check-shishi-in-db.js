const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pjjhyzbnnslaauwzknrr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqamh5emJubnNsYWF1d3prbnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5ODg4MzksImV4cCI6MjA2NjU2NDgzOX0.qcrcwNpwX83dCNbhxFaks2E68K_wp2W8urdYwfenDtM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkShishiInDB() {
  console.log('🔍 データベース内の獅子の如く検索...');
  
  try {
    // 獅子の如くを検索
    const { data: shishiCampaigns, error } = await supabase
      .from('campaigns')
      .select('name, device, cashback_rate, category')
      .ilike('name', '%獅子の如く%');
    
    if (error) {
      console.error('❌ 検索エラー:', error);
      return;
    }
    
    console.log(`\n🎯 獅子の如く案件: ${shishiCampaigns.length}件発見`);
    
    if (shishiCampaigns.length > 0) {
      shishiCampaigns.forEach((campaign, index) => {
        console.log(`${index + 1}. ${campaign.name}`);
        console.log(`   デバイス: ${campaign.device}`);
        console.log(`   還元率: ${campaign.cashback_rate}`);
        console.log(`   カテゴリ: ${campaign.category || 'null'}`);
        console.log('');
      });
    } else {
      console.log('❌ 獅子の如くが見つかりませんでした');
    }
    
    // ポイントインカムのデバイス別統計
    const { data: deviceStats } = await supabase
      .from('campaigns')
      .select('device')
      .eq('point_site_id', '0a47d15a-72e4-49a2-8821-51c29f7327a6');
    
    if (deviceStats) {
      const stats = {};
      deviceStats.forEach(row => {
        stats[row.device] = (stats[row.device] || 0) + 1;
      });
      
      console.log('📊 ポイントインカムのデバイス別統計:');
      Object.entries(stats).forEach(([device, count]) => {
        console.log(`  ${device}: ${count}件`);
      });
    }
    
    // モバイルアプリっぽい案件をチェック
    const { data: mobileApps } = await supabase
      .from('campaigns')
      .select('name, device, cashback_rate')
      .eq('point_site_id', '0a47d15a-72e4-49a2-8821-51c29f7327a6')
      .in('device', ['iOS', 'Android']);
    
    console.log(`\n📱 iOS/Android案件: ${mobileApps?.length || 0}件`);
    if (mobileApps && mobileApps.length > 0) {
      mobileApps.slice(0, 5).forEach((app, index) => {
        console.log(`${index + 1}. ${app.name.substring(0, 50)}... (${app.device}) - ${app.cashback_rate}`);
      });
    }
    
  } catch (error) {
    console.error('❌ 確認エラー:', error);
  }
}

checkShishiInDB();