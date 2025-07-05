const fs = require('fs').promises;

async function testStaticSearch() {
  console.log('🧪 静的検索機能テスト開始');
  console.log('='.repeat(60));

  try {
    // 検索データを読み込み
    const searchDataRaw = await fs.readFile('public/search-data.json', 'utf8');
    const searchData = JSON.parse(searchDataRaw);
    
    console.log(`📊 読み込み完了: ${searchData.campaigns.length}件のキャンペーン`);
    console.log(`📅 最終更新: ${searchData.metadata.lastUpdated}`);
    
    // テストケース
    const testCases = [
      { keyword: 'ショップ', expectedMinResults: 100 },
      { keyword: 'アプリ', expectedMinResults: 10 },
      { keyword: 'Yahoo', expectedMinResults: 1 },
      { keyword: 'カード', expectedMinResults: 50 },
      { keyword: '楽天', expectedMinResults: 1 }
    ];

    for (const testCase of testCases) {
      console.log(`\n🔍 テスト: "${testCase.keyword}"`);
      
      // 簡単な検索ロジック（実際のライブラリと同じ）
      const searchTerms = testCase.keyword.toLowerCase().split(/\s+/);
      const results = searchData.campaigns.filter(campaign => {
        const searchText = `${campaign.description} ${campaign.siteName}`.toLowerCase();
        return searchTerms.every(term => 
          searchText.includes(term) || campaign.searchKeywords.includes(term)
        );
      });

      console.log(`   ✅ 結果: ${results.length}件`);
      
      if (results.length >= testCase.expectedMinResults) {
        console.log(`   ✅ 期待値(${testCase.expectedMinResults}件以上)をクリア`);
      } else {
        console.log(`   ⚠️  期待値(${testCase.expectedMinResults}件以上)を下回る`);
      }

      // サンプル結果を表示
      if (results.length > 0) {
        console.log(`   📝 サンプル: ${results[0].description.substring(0, 50)}...`);
        console.log(`   💰 還元率: ${results[0].cashback}`);
        console.log(`   🏪 サイト: ${results[0].siteName}`);
      }
    }

    // カテゴリ・デバイス統計
    console.log(`\n📋 カテゴリ統計:`);
    Object.entries(searchData.metadata.categories).forEach(([category, count]) => {
      console.log(`   ${category}: ${count}件`);
    });

    console.log(`\n📱 デバイス統計:`);
    Object.entries(searchData.metadata.devices).forEach(([device, count]) => {
      console.log(`   ${device}: ${count}件`);
    });

    console.log(`\n🏪 サイト統計:`);
    Object.entries(searchData.metadata.sites).forEach(([site, count]) => {
      console.log(`   ${site}: ${count}件`);
    });

    // 最高還元率情報
    if (searchData.metadata.maxCashbackData) {
      console.log(`\n📈 過去7日間最高還元率:`);
      console.log(`   金額: ${searchData.metadata.maxCashbackData.amount}`);
      console.log(`   サイト: ${searchData.metadata.maxCashbackData.site}`);
      console.log(`   日付: ${searchData.metadata.maxCashbackData.date}`);
    }

    // 人気キーワード
    console.log(`\n🔥 人気キーワード（上位10個）:`);
    searchData.metadata.popularKeywords.slice(0, 10).forEach((item, i) => {
      console.log(`   ${i+1}. ${item.keyword} (${item.count}回)`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('🎉 静的検索機能テスト完了');

  } catch (error) {
    console.error('💥 テストエラー:', error);
  }
}

testStaticSearch();