import fetch from 'node-fetch';

async function checkCampaigns() {
  try {
    console.log('📊 データベース内の案件データを確認中...');
    
    const response = await fetch('http://localhost:3000/api/check-campaigns?site=モッピー&limit=20');
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ データベース確認成功');
      console.log('='.repeat(50));
      
      console.log('📈 基本統計:');
      console.log(`  総案件数: ${data.statistics.totalActiveCampaigns}件`);
      console.log(`  サンプル表示: ${data.statistics.sampleCampaignsReturned}件`);
      
      if (Object.keys(data.categoryDistribution).length > 0) {
        console.log('\\n📂 カテゴリ別分布:');
        Object.entries(data.categoryDistribution)
          .sort((a, b) => b[1] - a[1])
          .forEach(([category, count]) => {
            console.log(`  ${category}: ${count}件`);
          });
      }
      
      if (data.sampleCampaigns.length > 0) {
        console.log('\\n📋 モッピー案件サンプル (最新20件):');
        data.sampleCampaigns.forEach((campaign, index) => {
          const name = campaign.name.substring(0, 40);
          const updated = new Date(campaign.lastUpdated).toLocaleString('ja-JP');
          console.log(`  ${index + 1}. ${name}... - ${campaign.cashbackRate}`);
          console.log(`     [${campaign.category}] 更新: ${updated}`);
        });
      }
      
      if (data.recentUpdates.length > 0) {
        console.log('\\n🕒 最近更新された案件 (最新10件):');
        data.recentUpdates.forEach((campaign, index) => {
          const name = campaign.name.substring(0, 35);
          const updated = new Date(campaign.updatedAt).toLocaleString('ja-JP');
          console.log(`  ${index + 1}. ${name}... - ${campaign.cashbackRate} (${campaign.siteName})`);
          console.log(`     更新: ${updated}`);
        });
      }
      
      if (data.highValueSample.length > 0) {
        console.log('\\n💰 高還元案件サンプル:');
        data.highValueSample.forEach((campaign, index) => {
          const name = campaign.name.substring(0, 35);
          console.log(`  ${index + 1}. ${name}... - ${campaign.cashbackRate}`);
          console.log(`     [${campaign.category}] (${campaign.siteName})`);
        });
      }
      
      console.log('\\n🔍 次のテスト手順:');
      console.log('  1. ブラウザで http://localhost:3000 を開く');
      console.log('  2. 以下のキーワードで検索テスト:');
      console.log('     - "楽天" (多数ヒット予想)');
      console.log('     - "Amazon" (ショッピング案件)');
      console.log('     - "カード" (金融案件)');
      console.log('     - "じゃらん" (旅行案件)');
      console.log('  3. 検索結果にモッピーのデータが表示されることを確認');
      console.log('  4. 還元率の表示形式を確認');
      
    } else {
      console.log('❌ データベース確認失敗:', data.error);
    }
    
  } catch (error) {
    console.error('❌ 確認エラー:', error.message);
  }
}

// カテゴリ別詳細確認
async function checkByCategory() {
  try {
    console.log('\\n📂 カテゴリ別詳細確認...');
    
    const categories = ['shopping', 'finance', 'travel', 'entertainment', 'other'];
    
    for (const category of categories) {
      const response = await fetch(`http://localhost:3000/api/check-campaigns?site=モッピー&category=${category}&limit=5`);
      const data = await response.json();
      
      if (data.success && data.sampleCampaigns.length > 0) {
        console.log(`\\n  【${category}】 ${data.statistics.totalActiveCampaigns}件中 ${data.sampleCampaigns.length}件表示:`);
        data.sampleCampaigns.forEach((campaign, index) => {
          const name = campaign.name.substring(0, 30);
          console.log(`    ${index + 1}. ${name}... - ${campaign.cashbackRate}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ カテゴリ別確認エラー:', error.message);
  }
}

console.log('='.repeat(60));
console.log('    データベース案件データ確認ツール');
console.log('='.repeat(60));

checkCampaigns().then(() => {
  return checkByCategory();
}).then(() => {
  console.log('\\n✅ データベース確認完了！');
}).catch(error => {
  console.error('❌ エラー:', error);
});