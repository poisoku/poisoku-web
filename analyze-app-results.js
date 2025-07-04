const fs = require('fs');

// JSONファイルを読み込む
const data = JSON.parse(fs.readFileSync('chobirich_mobile_apps_data.json', 'utf8'));

// 統計情報を集計
const stats = {
  total: data.total_campaigns,
  withPercentage: 0,
  withPoints: 0,
  noCashback: 0,
  appKeywords: {}
};

console.log('=== アプリ案件の分析結果 ===');
console.log(`総案件数: ${stats.total}件`);
console.log(`スクレイピング日時: ${data.scraped_at}`);

// 還元率タイプ別と案件名のキーワード分析
data.campaigns.forEach(campaign => {
  // 還元率タイプ別
  if (campaign.cashback === 'なし') {
    stats.noCashback++;
  } else if (campaign.cashback.includes('%')) {
    stats.withPercentage++;
  } else if (campaign.cashback.includes('pt')) {
    stats.withPoints++;
  }
  
  // アプリ関連キーワードの分析
  const name = campaign.name.toLowerCase();
  const keywords = ['アプリ', 'ゲーム', 'インストール', 'ダウンロード', 'ios', 'android'];
  keywords.forEach(keyword => {
    if (name.includes(keyword.toLowerCase())) {
      stats.appKeywords[keyword] = (stats.appKeywords[keyword] || 0) + 1;
    }
  });
});

console.log('\n=== 還元率タイプ別 ===');
console.log(`％還元: ${stats.withPercentage}件`);
console.log(`ポイント還元: ${stats.withPoints}件`);
console.log(`還元なし: ${stats.noCashback}件`);

console.log('\n=== アプリキーワード別 ===');
Object.entries(stats.appKeywords)
  .sort((a, b) => b[1] - a[1])
  .forEach(([keyword, count]) => {
    console.log(`${keyword}: ${count}件`);
  });

// 還元なしの案件を詳しく調査
console.log('\n=== 還元なし案件の詳細（最初の10件） ===');
const noCashbackCampaigns = data.campaigns.filter(c => c.cashback === 'なし');
noCashbackCampaigns.slice(0, 10).forEach((campaign, index) => {
  console.log(`${index + 1}. ${campaign.name}`);
  console.log(`   獲得方法: ${campaign.conditions.method || '不明'}`);
  console.log(`   URL: ${campaign.url}`);
  console.log('');
});

// ポイント還元案件のサンプル
console.log('\n=== ポイント還元案件のサンプル（最初の10件） ===');
const pointCampaigns = data.campaigns.filter(c => c.cashback.includes('pt'));
pointCampaigns.slice(0, 10).forEach((campaign, index) => {
  console.log(`${index + 1}. ${campaign.name}: ${campaign.cashback}`);
  console.log(`   獲得方法: ${campaign.conditions.method || '不明'}`);
  console.log('');
});

// 問題のある案件を特定
console.log('\n=== 問題分析 ===');
const suspiciousCampaigns = data.campaigns.filter(campaign => {
  return campaign.cashback === 'なし' && 
         (campaign.conditions.method === '-' || !campaign.conditions.method);
});

console.log(`疑わしい案件（還元なし＆獲得方法不明）: ${suspiciousCampaigns.length}件`);

if (suspiciousCampaigns.length > 0) {
  console.log('詳細:');
  suspiciousCampaigns.slice(0, 5).forEach((campaign, index) => {
    console.log(`  ${index + 1}. ${campaign.name} (ID: ${campaign.id})`);
  });
}