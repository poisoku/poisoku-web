#!/usr/bin/env node

/**
 * モッピー スマホアプリ案件スクレイピング メインエントリー
 * iOS/Android両対応
 */

const MoppyMobileAppScraper = require('./src/sites/moppy/MoppyMobileAppScraper');

async function main() {
  console.log('🚀 モッピー スマホアプリ案件スクレイピング開始');
  console.log('📱 対象: iOS/Android アプリ案件');
  console.log('🔗 URL: parent_category=4');
  console.log('⏰ 開始時刻:', new Date().toLocaleString('ja-JP'));
  
  const scraper = new MoppyMobileAppScraper();
  
  try {
    // スクレイピング実行
    const results = await scraper.scrape();
    
    // 結果保存
    await scraper.saveResults();
    
    // 統計表示
    console.log('\n📊 最終統計:');
    console.log(`✅ 取得案件数: ${results.length}件`);
    
    const iosCount = results.filter(c => c.osType === 'ios').length;
    const androidCount = results.filter(c => c.osType === 'android').length;
    
    console.log(`📱 iOS案件: ${iosCount}件`);
    console.log(`🤖 Android案件: ${androidCount}件`);
    
    // ポイント検出率
    const withPoints = results.filter(c => c.points && c.points !== null).length;
    const pointDetectionRate = results.length > 0 ? Math.round((withPoints / results.length) * 100) : 0;
    console.log(`💰 ポイント検出率: ${pointDetectionRate}% (${withPoints}/${results.length})`);
    
    // 成功終了
    console.log('\n🎉 モッピー スマホアプリ案件スクレイピング成功完了!');
    process.exit(0);
    
  } catch (error) {
    console.error('\n💥 スクレイピング失敗:', error);
    process.exit(1);
  } finally {
    await scraper.cleanup();
  }
}

// コマンドライン引数の処理
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
📱 モッピー スマホアプリ案件スクレイパー

使用方法:
  node main_moppy_mobile_app.js

機能:
  - iOS/Android両対応のスマホアプリ案件取得
  - parent_category=4を対象とした完全スクレイピング
  - 重複除去とデータ検証
  - JSON形式での結果保存

出力ファイル:
  - moppy_ios_app_campaigns_[timestamp].json
  - moppy_android_app_campaigns_[timestamp].json  
  - moppy_mobile_app_campaigns_combined_[timestamp].json

オプション:
  --help, -h    このヘルプを表示
  `);
  process.exit(0);
}

// 実行
if (require.main === module) {
  main();
}