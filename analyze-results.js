const fs = require('fs');

// JSONファイルを読み込む
const data = JSON.parse(fs.readFileSync('chobirich_all_categories_data.json', 'utf8'));

// 統計情報を集計
const stats = {
  total: data.total_campaigns,
  byCategory: {},
  byCashbackType: {
    percentage: 0,
    points: 0,
    none: 0
  }
};

// カテゴリー別とキャッシュバックタイプ別に集計
data.campaigns.forEach(campaign => {
  // カテゴリー別
  const category = campaign.category || '不明';
  stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
  
  // キャッシュバックタイプ別
  if (campaign.cashback === 'なし') {
    stats.byCashbackType.none++;
  } else if (campaign.cashback.includes('%')) {
    stats.byCashbackType.percentage++;
  } else if (campaign.cashback.includes('pt')) {
    stats.byCashbackType.points++;
  }
});

// 結果を表示
console.log('=== ちょびリッチ全カテゴリースクレイピング結果 ===');
console.log(`総案件数: ${stats.total}件`);
console.log(`スクレイピング日時: ${data.scraped_at}`);

console.log('\n=== カテゴリー別案件数 ===');
Object.entries(stats.byCategory)
  .sort((a, b) => b[1] - a[1])
  .forEach(([category, count]) => {
    console.log(`${category}: ${count}件`);
  });

console.log('\n=== キャッシュバックタイプ別 ===');
console.log(`％還元: ${stats.byCashbackType.percentage}件`);
console.log(`ポイント還元: ${stats.byCashbackType.points}件`);
console.log(`還元なし: ${stats.byCashbackType.none}件`);

// サンプルデータを表示
console.log('\n=== サンプルデータ（各カテゴリーから1件ずつ） ===');
const seenCategories = new Set();
data.campaigns.forEach(campaign => {
  if (!seenCategories.has(campaign.category) && seenCategories.size < 10) {
    seenCategories.add(campaign.category);
    console.log(`[${campaign.category}] ${campaign.name}: ${campaign.cashback}`);
  }
});