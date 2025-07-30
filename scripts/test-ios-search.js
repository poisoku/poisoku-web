const fs = require('fs').promises;

// 検索ロジックをエミュレート
async function testIOSSearch() {
  console.log('📱 iOS案件検索テスト開始\n');
  
  // 検索データを読み込み
  const searchDataContent = await fs.readFile('/Users/kn/poisoku-web/public/search-data.json', 'utf8');
  const searchData = JSON.parse(searchDataContent);
  
  console.log(`📊 総案件数: ${searchData.campaigns.length}`);
  
  // デバイス別の集計
  const deviceCounts = {};
  searchData.campaigns.forEach(campaign => {
    deviceCounts[campaign.device] = (deviceCounts[campaign.device] || 0) + 1;
  });
  
  console.log('\n📱 デバイス別集計:');
  Object.entries(deviceCounts).forEach(([device, count]) => {
    console.log(`  ${device}: ${count}件`);
  });
  
  // iOS案件のフィルタリングテスト
  console.log('\n🔍 iOSフィルタリングテスト:');
  
  const iosResults = searchData.campaigns.filter(campaign => {
    return ['iOS', 'iOS/Android', 'All'].includes(campaign.device);
  });
  
  console.log(`iOS対応案件: ${iosResults.length}件`);
  
  // iOS専用案件
  const iosOnlyResults = searchData.campaigns.filter(campaign => {
    return campaign.device === 'iOS';
  });
  
  console.log(`iOS専用案件: ${iosOnlyResults.length}件`);
  
  // iOS専用案件のサンプル表示
  console.log('\n📱 iOS専用案件サンプル (10件):');
  iosOnlyResults.slice(0, 10).forEach((campaign, i) => {
    console.log(`${i + 1}. ${campaign.description.substring(0, 60)}...`);
    console.log(`   サイト: ${campaign.siteName}`);
    console.log(`   還元: ${campaign.cashback}`);
    console.log(`   デバイス: ${campaign.device}`);
    console.log('');
  });
  
  // ちょびリッチのiOS案件
  const chobirichIOS = searchData.campaigns.filter(campaign => {
    return campaign.siteName === 'ちょびリッチ' && campaign.device === 'iOS';
  });
  
  console.log(`📍 ちょびリッチのiOS案件: ${chobirichIOS.length}件`);
  
  // 指定案件の確認
  const targetCampaign = searchData.campaigns.find(campaign => 
    campaign.campaignUrl && campaign.campaignUrl.includes('1838584')
  );
  
  console.log('\n🎯 指定案件（ID: 1838584）の確認:');
  if (targetCampaign) {
    console.log(`✅ 発見: ${targetCampaign.description}`);
    console.log(`   デバイス: ${targetCampaign.device}`);
    console.log(`   還元: ${targetCampaign.cashback}`);
    console.log(`   URL: ${targetCampaign.campaignUrl}`);
  } else {
    console.log('❌ 指定案件が見つかりません');
  }
  
  // マフィア・シティを検索
  console.log('\n🔍 "マフィア・シティ"で検索テスト:');
  const mafiaResults = searchData.campaigns.filter(campaign => {
    const searchText = campaign.description.toLowerCase();
    return searchText.includes('マフィア') || searchText.includes('シティ');
  });
  
  console.log(`マフィア・シティ関連案件: ${mafiaResults.length}件`);
  mafiaResults.forEach((campaign, i) => {
    console.log(`${i + 1}. ${campaign.description.substring(0, 80)}...`);
    console.log(`   デバイス: ${campaign.device}`);
    console.log(`   還元: ${campaign.cashback}`);
    console.log('');
  });
}

testIOSSearch().catch(console.error);