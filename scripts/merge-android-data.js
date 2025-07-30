const fs = require('fs');

// 既存データ読み込み
const existingData = JSON.parse(fs.readFileSync('chobirich_unified_medium_results.json', 'utf8'));
const androidData = JSON.parse(fs.readFileSync('chobirich_android_cleaned.json', 'utf8'));

console.log('既存案件数:', existingData.campaigns.length);
console.log('Android案件数:', androidData.campaigns.length);

// Android案件を追加
existingData.campaigns.push(...androidData.campaigns);

// 重複除去（ID基準）
const uniqueCampaigns = [];
const seenIds = new Set();

existingData.campaigns.forEach(campaign => {
  if (!seenIds.has(campaign.id)) {
    seenIds.add(campaign.id);
    uniqueCampaigns.push(campaign);
  }
});

// 更新
existingData.campaigns = uniqueCampaigns;
existingData.unique_campaigns = uniqueCampaigns.length;
existingData.total_campaigns = uniqueCampaigns.length;
existingData.category_breakdown["アプリ"] = uniqueCampaigns.filter(c => c.category === "アプリ").length;

// 保存
fs.writeFileSync('chobirich_unified_medium_results.json', JSON.stringify(existingData, null, 2));

console.log('\nAndroid案件を統合しました:');
console.log('総案件数:', uniqueCampaigns.length);
console.log('アプリ案件:', existingData.category_breakdown["アプリ"]);

// Android案件のサンプル表示
const androidCampaigns = uniqueCampaigns.filter(c => c.device === 'android');
console.log('\nAndroid案件数:', androidCampaigns.length);
console.log('Android案件サンプル:');
androidCampaigns.slice(0, 5).forEach(c => {
  console.log(`- [${c.id}] ${c.name} (${c.cashbackAmount})`);
});