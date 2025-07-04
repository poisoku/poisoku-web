const fs = require('fs');

// JSONファイルを読み込む
const data = JSON.parse(fs.readFileSync('chobirich_all_categories_data.json', 'utf8'));

// アプリカテゴリーの案件を探す
const appCampaigns = data.campaigns.filter(campaign => 
  campaign.category && campaign.category.includes('アプリ')
);

console.log('=== アプリ案件の確認 ===');
console.log(`アプリ案件数: ${appCampaigns.length}件`);

if (appCampaigns.length > 0) {
  console.log('\n=== アプリ案件サンプル（最初の10件） ===');
  appCampaigns.slice(0, 10).forEach((campaign, index) => {
    console.log(`${index + 1}. ${campaign.name}: ${campaign.cashback}`);
    console.log(`   URL: ${campaign.url}`);
  });
} else {
  console.log('\nアプリ案件が見つかりませんでした。');
  
  // 全カテゴリーを表示
  console.log('\n=== 取得されたカテゴリー一覧 ===');
  const categories = [...new Set(data.campaigns.map(c => c.category))];
  categories.sort().forEach(cat => {
    const count = data.campaigns.filter(c => c.category === cat).length;
    console.log(`${cat}: ${count}件`);
  });
}