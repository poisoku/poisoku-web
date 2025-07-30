const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pjjhyzbnnslaauwzknrr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqamh5emJubnNsYWF1d3prbnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5ODg4MzksImV4cCI6MjA2NjU2NDgzOX0.qcrcwNpwX83dCNbhxFaks2E68K_wp2W8urdYwfenDtM';

async function checkIOSCampaigns() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('📱 iOS案件の調査開始\n');
  
  // 1. ちょびリッチサイトIDを取得
  const { data: chobirichSite } = await supabase
    .from('point_sites')
    .select('id, name')
    .eq('name', 'ちょびリッチ')
    .single();
  
  if (!chobirichSite) {
    console.log('❌ ちょびリッチサイトが見つかりません');
    return;
  }
  
  console.log(`🏠 ちょびリッチサイトID: ${chobirichSite.id}`);
  
  // 2. デバイス別の案件数を確認
  const { data: deviceStats } = await supabase
    .from('campaigns')
    .select('device')
    .eq('point_site_id', chobirichSite.id);
    
  const deviceCounts = {};
  deviceStats.forEach(campaign => {
    deviceCounts[campaign.device] = (deviceCounts[campaign.device] || 0) + 1;
  });
  
  console.log('\n📊 デバイス別案件数:');
  Object.entries(deviceCounts).forEach(([device, count]) => {
    console.log(`  ${device}: ${count}件`);
  });
  
  // 3. iOS案件のサンプルを表示
  const { data: iosCampaigns } = await supabase
    .from('campaigns')
    .select('id, name, device, cashback_rate, campaign_url')
    .eq('point_site_id', chobirichSite.id)
    .eq('device', 'iOS')
    .limit(10);
    
  console.log('\n📱 iOS案件サンプル (10件):');
  if (iosCampaigns && iosCampaigns.length > 0) {
    iosCampaigns.forEach((campaign, i) => {
      console.log(`${i + 1}. ${campaign.name.substring(0, 50)}...`);
      console.log(`   デバイス: ${campaign.device}`);
      console.log(`   還元: ${campaign.cashback_rate}`);
      console.log(`   URL: ${campaign.campaign_url}`);
      console.log('');
    });
  } else {
    console.log('   ❌ iOS案件が見つかりません');
  }
  
  // 4. 大文字小文字やバリエーションも確認
  const deviceVariations = ['iOS', 'ios', 'IOS', 'All', 'all', 'ALL'];
  console.log('\n🔍 デバイス名バリエーション確認:');
  
  for (const deviceName of deviceVariations) {
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('device')
      .eq('point_site_id', chobirichSite.id)
      .eq('device', deviceName);
    
    console.log(`  "${deviceName}": ${campaigns?.length || 0}件`);
  }
  
  // 5. アプリカテゴリ案件のデバイス分布
  const { data: appCampaigns } = await supabase
    .from('campaigns')
    .select('device, name')
    .eq('point_site_id', chobirichSite.id)
    .eq('category', 'entertainment'); // アプリ案件はentertainmentカテゴリにマッピングされている
    
  const appDeviceCounts = {};
  appCampaigns?.forEach(campaign => {
    appDeviceCounts[campaign.device] = (appDeviceCounts[campaign.device] || 0) + 1;
  });
  
  console.log('\n📱 アプリ案件のデバイス分布:');
  Object.entries(appDeviceCounts).forEach(([device, count]) => {
    console.log(`  ${device}: ${count}件`);
  });
  
  // 6. 指定案件（1838584）の確認
  const { data: targetCampaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('point_site_id', chobirichSite.id)
    .ilike('name', '%1838584%')
    .or('campaign_url.ilike.%1838584%');
    
  console.log('\n🎯 指定案件（ID: 1838584）の確認:');
  if (targetCampaign && targetCampaign.length > 0) {
    targetCampaign.forEach(campaign => {
      console.log(`✅ 発見: ${campaign.name.substring(0, 80)}...`);
      console.log(`   デバイス: ${campaign.device}`);
      console.log(`   カテゴリ: ${campaign.category}`);
      console.log(`   還元: ${campaign.cashback_rate}`);
      console.log(`   URL: ${campaign.campaign_url}`);
    });
  } else {
    console.log('❌ 指定案件が見つかりません');
  }
}

checkIOSCampaigns().catch(console.error);