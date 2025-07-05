const ChobirichDifferentialSystem = require('./chobirich-differential-system');

// iOS・Android両方を差分取得する統合実行スクリプト
async function runBothPlatforms() {
  console.log('🚀 ちょびリッチ 統合差分取得システム開始');
  console.log('='.repeat(60));
  
  const startTime = Date.now();
  
  try {
    // iOS差分取得
    console.log('\n📱 iOS差分取得開始...');
    const iosScraper = new ChobirichDifferentialSystem('ios');
    await iosScraper.processDifferential();
    
    // 待機時間
    console.log('\n⏳ プラットフォーム切り替え待機（10秒）...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Android差分取得
    console.log('\n🤖 Android差分取得開始...');
    const androidScraper = new ChobirichDifferentialSystem('android');
    await androidScraper.processDifferential();
    
    // 完了レポート
    const endTime = Date.now();
    const totalTime = Math.round((endTime - startTime) / 1000);
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 統合差分取得完了！');
    console.log('='.repeat(60));
    console.log(`⏱️ 総実行時間: ${totalTime}秒`);
    console.log('📄 更新されたファイル:');
    console.log('  - chobirich_all_app_campaigns.json (iOS)');
    console.log('  - chobirich_android_app_campaigns.json (Android)');
    console.log('\n💡 次回実行時も同じ高速差分取得が利用できます');
    
  } catch (error) {
    console.error('統合差分取得エラー:', error);
  }
}

// 実行
runBothPlatforms().catch(console.error);