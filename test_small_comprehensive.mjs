import fetch from 'node-fetch';

async function testSmallComprehensive() {
  try {
    console.log('🔍 モッピー小規模テスト開始...');
    console.log('   （1-2ページのみで動作確認）');
    
    const startTime = Date.now();
    
    // 実際のモッピーのカテゴリページをテスト
    const testUrl = 'https://pc.moppy.jp/ad/category/1/'; // ショッピングカテゴリ
    
    console.log(`テスト対象: ${testUrl}`);
    
    const response = await fetch('http://localhost:3000/api/comprehensive-scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer poisoku-scraping-secret-2024'
      },
      body: JSON.stringify({
        site: 'モッピー',
        fullScrape: false, // 小規模テスト
        testMode: true
      })
    });

    const result = await response.json();
    const totalTime = Date.now() - startTime;
    
    if (result.success) {
      console.log('\\n✅ 小規模テスト成功!');
      console.log('=====================================');
      
      console.log('📊 結果:');
      console.log(`  案件数: ${result.stats.totalCampaigns}件`);
      console.log(`  処理時間: ${(totalTime / 1000).toFixed(1)}秒`);
      
      console.log('\\n💾 データベース保存:');
      console.log(`  新規: ${result.database.savedCount}件`);
      console.log(`  更新: ${result.database.updatedCount}件`);
      console.log(`  エラー: ${result.database.errors.length}件`);
      
      if (result.campaigns && result.campaigns.length > 0) {
        console.log('\\n📋 正規化テスト結果（最初の5件）:');
        result.campaigns.slice(0, 5).forEach((campaign, index) => {
          console.log(`${index + 1}. ${campaign.name.substring(0, 40)}...`);
          console.log(`   元の還元率: "${campaign.cashbackRate}"`);
          console.log(`   正規化後: "${campaign.normalizedCashback}"`);
          console.log(`   カテゴリ: ${campaign.category}`);
          console.log(`   パーセント表記: ${campaign.isPercentage ? 'Yes' : 'No'}`);
          console.log('');
        });
      }
      
      if (result.database.errors.length > 0) {
        console.log('⚠️  データベースエラー (最初の3件):');
        result.database.errors.slice(0, 3).forEach((err, index) => {
          console.log(`  ${index + 1}. ${err}`);
        });
      }
      
      console.log('\\n🎯 小規模テストが成功しました！');
      console.log('   → 全案件取得の準備が整いました。');
      
    } else {
      console.log('❌ 小規模テスト失敗:', result.error);
    }
    
  } catch (error) {
    console.error('❌ テストエラー:', error.message);
    console.log('\\n💡 トラブルシューティング:');
    console.log('   1. npm run dev が起動していますか？');
    console.log('   2. Supabaseデータベースに接続できますか？');
    console.log('   3. .env.local ファイルは正しく設定されていますか？');
  }
}

testSmallComprehensive();