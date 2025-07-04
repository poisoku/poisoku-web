const fs = require('fs');

// JSONファイルを読み込む
const data = JSON.parse(fs.readFileSync('chobirich_all_categories_data.json', 'utf8'));

// 基本情報
console.log('=== 基本情報 ===');
console.log(`スクレイピング日時: ${data.scraped_at}`);
console.log(`総案件数: ${data.total_campaigns}`);
console.log('');

// カテゴリー別の集計
const categoryCount = {};
for (const campaign of data.campaigns) {
    const category = campaign.category || '不明';
    categoryCount[category] = (categoryCount[category] || 0) + 1;
}

console.log('=== カテゴリー別案件数 ===');
const sortedCategories = Object.entries(categoryCount)
    .sort((a, b) => b[1] - a[1]);
for (const [category, count] of sortedCategories) {
    console.log(`${category}: ${count}件`);
}
console.log('');

// 還元率タイプ別の集計
const cashbackTypes = {
    percent: 0,  // %還元
    point: 0,    // pt還元
    none: 0,     // なし
    other: 0     // その他
};

// 還元率の詳細情報
const cashbackDetails = {
    percent: {},  // %還元の値別
    point: {}     // pt還元の値別
};

for (const campaign of data.campaigns) {
    const cashback = campaign.cashback || '';
    if (cashback === 'なし') {
        cashbackTypes.none += 1;
    } else if (cashback.includes('%')) {
        cashbackTypes.percent += 1;
        // %の値を抽出
        cashbackDetails.percent[cashback] = (cashbackDetails.percent[cashback] || 0) + 1;
    } else if (cashback.includes('pt') || cashback.includes('ポイント')) {
        cashbackTypes.point += 1;
        // ptの値を抽出
        cashbackDetails.point[cashback] = (cashbackDetails.point[cashback] || 0) + 1;
    } else {
        cashbackTypes.other += 1;
    }
}

console.log('=== 還元率タイプ別集計 ===');
console.log(`%還元: ${cashbackTypes.percent}件`);
console.log(`pt還元: ${cashbackTypes.point}件`);
console.log(`なし: ${cashbackTypes.none}件`);
console.log(`その他: ${cashbackTypes.other}件`);
console.log('');

// %還元の詳細
if (Object.keys(cashbackDetails.percent).length > 0) {
    console.log('=== %還元の詳細（上位10件） ===');
    const sortedPercent = Object.entries(cashbackDetails.percent)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    for (const [cashback, count] of sortedPercent) {
        console.log(`${cashback}: ${count}件`);
    }
    console.log('');
}

// pt還元の詳細
if (Object.keys(cashbackDetails.point).length > 0) {
    console.log('=== pt還元の詳細（上位10件） ===');
    const sortedPoint = Object.entries(cashbackDetails.point)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    for (const [cashback, count] of sortedPoint) {
        console.log(`${cashback}: ${count}件`);
    }
    console.log('');
}

// データの整合性チェック
console.log('=== データ整合性チェック ===');
const errors = [];

// 必須フィールドのチェック
const requiredFields = ['id', 'name', 'cashback', 'category', 'url'];
for (let i = 0; i < data.campaigns.length; i++) {
    const campaign = data.campaigns[i];
    for (const field of requiredFields) {
        if (!campaign[field] || campaign[field] === '') {
            errors.push(`案件 ${i + 1}: ${field}フィールドが欠落または空`);
        }
    }
}

// URLフォーマットのチェック
for (let i = 0; i < data.campaigns.length; i++) {
    const campaign = data.campaigns[i];
    const url = campaign.url || '';
    if (url && !url.startsWith('https://www.chobirich.com/ad_details/')) {
        errors.push(`案件 ${i + 1} (${campaign.name || '不明'}): 不正なURLフォーマット`);
    }
}

// IDの重複チェック
const idCount = {};
for (const campaign of data.campaigns) {
    const campaignId = campaign.id;
    if (campaignId) {
        idCount[campaignId] = (idCount[campaignId] || 0) + 1;
    }
}

const duplicateIds = Object.entries(idCount)
    .filter(([id, count]) => count > 1);
if (duplicateIds.length > 0) {
    for (const [dupId, count] of duplicateIds) {
        errors.push(`ID ${dupId}: ${count}回重複`);
    }
}

if (errors.length > 0) {
    console.log(`エラー数: ${errors.length}`);
    for (let i = 0; i < Math.min(10, errors.length); i++) {
        console.log(`  - ${errors[i]}`);
    }
    if (errors.length > 10) {
        console.log(`  ... 他 ${errors.length - 10} 件のエラー`);
    }
} else {
    console.log('エラーは検出されませんでした');
}

// データ件数の確認
console.log('');
console.log('=== データ整合性確認 ===');
console.log(`total_campaignsフィールドの値: ${data.total_campaigns}`);
console.log(`実際のcampaigns配列の長さ: ${data.campaigns.length}`);
if (data.total_campaigns === data.campaigns.length) {
    console.log('データ件数は一致しています');
} else {
    console.log('警告: データ件数が一致していません');
}