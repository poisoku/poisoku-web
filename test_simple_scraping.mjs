import fetch from 'node-fetch';

async function testSimpleScraping() {
  try {
    console.log('🧪 シンプルスクレイピングテスト開始...');
    console.log('   目標: 1つのURLから少数の案件を確実に取得');
    console.log('   手法: 基本的なスクレイピングの動作確認');
    console.log('');
    
    const startTime = Date.now();
    
    // シンプルなスクレイピングテスト
    const response = await fetch('http://localhost:3000/api/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer poisoku-scraping-secret-2024'
      },
      body: JSON.stringify({
        keyword: '楽天',  // テスト用キーワード
        testMode: true,
        maxPages: 1  // 1ページのみテスト
      })
    });

    const result = await response.json();
    const totalTime = Date.now() - startTime;
    
    if (result.success) {
      console.log('✅ シンプルスクレイピング成功!');
      console.log('='.repeat(50));
      console.log(`📊 取得結果: ${result.campaigns?.length || 0}件`);
      console.log(`⏱️ 処理時間: ${(totalTime / 1000).toFixed(1)}秒`);
      
      if (result.campaigns && result.campaigns.length > 0) {
        console.log('\n📋 取得した案件サンプル:');
        result.campaigns.slice(0, 5).forEach((campaign, index) => {
          console.log(`  ${index + 1}. ${campaign.name.substring(0, 30)}... - ${campaign.cashbackRate}`);
        });
        
        console.log('\n✅ 基本的なスクレイピングが動作しています');
        console.log('次のステップ: より多くの案件を取得するために並列処理を最適化');
      } else {
        console.log('\n⚠️ 案件が取得できませんでした');
        console.log('セレクタやURLの見直しが必要です');
      }
      
    } else {
      console.log('❌ シンプルスクレイピング失敗:', result.error);
      
      if (result.errors && result.errors.length > 0) {
        console.log('\nエラー詳細:');
        result.errors.forEach((error, index) => {
          console.log(`  ${index + 1}. ${error}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ テスト実行エラー:', error.message);
    console.log('\n💡 確認事項:');
    console.log('  - npm run dev が起動していますか？');
    console.log('  - APIエンドポイントは正常ですか？');
  }
}

console.log('='.repeat(70));
console.log('    シンプルスクレイピングテスト - 基本動作確認');
console.log('='.repeat(70));

testSimpleScraping();