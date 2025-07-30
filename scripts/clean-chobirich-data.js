const fs = require('fs').promises;

// 完全スクレイピングデータから有効な案件のみを抽出
async function cleanChobirichData() {
  try {
    console.log('🧹 ちょびリッチデータのクリーニング開始...');
    
    // 完全スクレイピングデータを読み込み
    const data = await fs.readFile('chobirich_complete_app_campaigns.json', 'utf8');
    const jsonData = JSON.parse(data);
    const campaigns = jsonData.app_campaigns || [];
    
    console.log(`📊 元のデータ: ${campaigns.length}件`);
    
    // 有効な案件のみをフィルタリング
    const validCampaigns = campaigns.filter(campaign => {
      // 名前が空欄の案件を除外
      if (!campaign.name || campaign.name.trim() === '') {
        return false;
      }
      
      // 還元率が「不明」の案件を除外
      if (campaign.cashback === '不明') {
        return false;
      }
      
      // リダイレクトURLの案件を除外
      if (campaign.url && campaign.url.includes('/redirect/')) {
        return false;
      }
      
      // member_onlyの案件を除外
      if (campaign.url && campaign.url.includes('/member_only/')) {
        return false;
      }
      
      return true;
    });
    
    console.log(`✅ 有効な案件: ${validCampaigns.length}件`);
    console.log(`🚫 除外した案件: ${campaigns.length - validCampaigns.length}件`);
    
    // 有効な案件の例を表示
    if (validCampaigns.length > 0) {
      console.log('\n📋 有効な案件の例:');
      validCampaigns.slice(0, 3).forEach((campaign, i) => {
        console.log(`${i + 1}. ${campaign.name}`);
        console.log(`   URL: ${campaign.url}`);
        console.log(`   還元率: ${campaign.cashback}`);
      });
    }
    
    // クリーンなデータを保存
    const cleanData = {
      scrape_date: jsonData.scrape_date,
      total_processed: jsonData.total_processed,
      app_campaigns_found: validCampaigns.length,
      app_campaigns: validCampaigns
    };
    
    await fs.writeFile('chobirich_clean_app_campaigns.json', JSON.stringify(cleanData, null, 2));
    console.log('\n💾 クリーンなデータを chobirich_clean_app_campaigns.json に保存しました');
    
    return validCampaigns.length;
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
    return 0;
  }
}

// 実行
(async () => {
  const validCount = await cleanChobirichData();
  
  if (validCount === 0) {
    console.log('\n⚠️ 有効な案件が見つかりませんでした。');
    console.log('完全スクレイピングシステムは正規の案件データを取得できていない可能性があります。');
  }
})();