#!/usr/bin/env node

/**
 * ちょびリッチ スマホアプリ案件スクレイピングシステム メインエントリーポイント
 * 
 * 【完成版】iOS/Android別々にアクセスして案件を取得
 * - 20ページ対応（iOS/Android合計577-578件）
 * - 正確なポイント値抽出（1-5桁、カンマ区切り対応）
 * - 太字タイトル取得、矢印表記対応
 * - OSによって表示される案件が異なるため
 * 
 * 最終更新: 2025-08-06
 */

const MobileAppScraper = require('./src/sites/chobirich/MobileAppScraper');
const fs = require('fs').promises;
const path = require('path');

/**
 * メイン実行関数
 */
async function main() {
  console.log('📱 ちょびリッチ スマホアプリ案件スクレイピングシステム【完成版】');
  console.log('=' .repeat(60));
  console.log('🎯 システム仕様:');
  console.log('  - iOS/Android別々にアクセス（User-Agent自動切替）');
  console.log('  - OSごとに異なる案件を完全取得');
  console.log('  - 全20ページ対応（577-578件対応）');
  console.log('  - 正確なポイント値抽出（1-5桁、カンマ区切り）');
  console.log('  - 太字タイトル取得、矢印表記（→）対応');
  console.log('  - レート制限対応（3秒間隔）');
  console.log('=' .repeat(60));

  const scraper = new MobileAppScraper();
  
  try {
    // コマンドライン引数の解析
    const args = process.argv.slice(2);
    let targetOS = ['ios', 'android'];
    
    if (args.length > 0) {
      const arg = args[0].toLowerCase();
      
      // OS指定
      if (arg === 'ios') {
        targetOS = ['ios'];
        console.log('🎯 iOS案件のみ処理');
      } else if (arg === 'android') {
        targetOS = ['android'];
        console.log('🎯 Android案件のみ処理');
      } else if (arg === 'both' || arg === 'all') {
        console.log('🎯 iOS・Android両OS処理');
      }
    } else {
      console.log('🎯 iOS・Android両OS処理（デフォルト）');
    }
    
    // スクレイピング実行
    const results = await scraper.scrape(targetOS);
    
    // 結果保存
    await saveResults(results, targetOS);
    
    console.log('\n🎊 スマホアプリ案件スクレイピング完了！');
    
  } catch (error) {
    console.error('💥 エラー:', error);
    process.exit(1);
  }
}

/**
 * 結果保存
 */
async function saveResults(results, targetOS) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '_');
  
  // OS別保存とまとめ保存の両方実行
  if (targetOS.includes('ios') && targetOS.includes('android')) {
    // 両OS取得時は、OS別ファイルとまとめファイルを作成
    const iosCampaigns = results.filter(c => c.os === 'ios');
    const androidCampaigns = results.filter(c => c.os === 'android');
    
    // iOS専用ファイル
    await saveOSSpecificFile(iosCampaigns, 'ios', timestamp);
    // Android専用ファイル  
    await saveOSSpecificFile(androidCampaigns, 'android', timestamp);
    // まとめファイル
    await saveCombinedFile(results, timestamp);
    
    console.log('\n📊 保存完了統計:');
    console.log(`   iOS専用ファイル: ${iosCampaigns.length}件`);
    console.log(`   Android専用ファイル: ${androidCampaigns.length}件`);
    console.log(`   まとめファイル: ${results.length}件`);
  } else {
    // 単一OS取得時
    const osName = targetOS[0];
    await saveOSSpecificFile(results, osName, timestamp);
    console.log(`\n📊 ${osName.toUpperCase()}専用ファイル保存: ${results.length}件`);
  }
}

async function saveOSSpecificFile(campaigns, osName, timestamp) {
  const filename = `chobirich_${osName}_app_campaigns_${timestamp}.json`;
  const filepath = path.join(__dirname, filename);
  
  const output = {
    scrapeDate: new Date().toISOString(),
    version: 'mobile_app_scraper_v2.0.0',
    systemType: 'mobile_app_final',
    os: osName,
    campaigns: campaigns,
    summary: {
      total: campaigns.length,
      os: osName,
      maxPages: 20,
      features: [
        'User-Agent切替',
        '1-5桁ポイント対応',
        '太字タイトル取得',
        '矢印表記対応'
      ]
    }
  };
  
  await fs.writeFile(filepath, JSON.stringify(output, null, 2));
  console.log(`💾 ${osName.toUpperCase()}ファイル保存: ${filename}`);
}

async function saveCombinedFile(results, timestamp) {
  const filename = `chobirich_mobile_app_campaigns_combined_${timestamp}.json`;
  const filepath = path.join(__dirname, filename);
  
  const iosCampaigns = results.filter(c => c.os === 'ios');
  const androidCampaigns = results.filter(c => c.os === 'android');
  
  const output = {
    scrapeDate: new Date().toISOString(),
    version: 'mobile_app_scraper_v2.0.0',
    systemType: 'mobile_app_final_combined',
    campaigns: results,
    summary: {
      total: results.length,
      osBreakdown: {
        ios: iosCampaigns.length,
        android: androidCampaigns.length
      },
      coverage: '20ページ完全対応',
      quality: '高精度ポイント抽出'
    }
  };
  
  await fs.writeFile(filepath, JSON.stringify(output, null, 2));
  console.log(`💾 まとめファイル保存: ${filename}`);
}

/**
 * ヘルプ表示
 */
function showHelp() {
  console.log('📖 ちょびリッチ スマホアプリ案件スクレイピングシステム【完成版】使用方法:');
  console.log('');
  console.log('🔧 基本的な使用方法:');
  console.log('    node main_mobile_app.js                # iOS・Android両方（推奨）');
  console.log('    node main_mobile_app.js ios            # iOSのみ');
  console.log('    node main_mobile_app.js android        # Androidのみ');
  console.log('');
  console.log('📊 システム仕様:');
  console.log('    ・対応ページ数: 20ページ（自動検出）');
  console.log('    ・取得可能件数: iOS + Android 合計約577-578件');
  console.log('    ・ポイント範囲: 1pt ～ 70,000pt以上');
  console.log('    ・実行時間: 約15-25分（両OS）');
  console.log('');
  console.log('💾 出力ファイル:');
  console.log('    chobirich_ios_app_campaigns_YYYY-MM-DD_HH_MM_SS.json');
  console.log('    chobirich_android_app_campaigns_YYYY-MM-DD_HH_MM_SS.json');
  console.log('    chobirich_mobile_app_campaigns_combined_YYYY-MM-DD_HH_MM_SS.json');
  console.log('');
  console.log('⚠️  注意事項:');
  console.log('    ・レート制限対応（3秒間隔）');
  console.log('    ・大量アクセスのため、1日1-2回の実行推奨');
  console.log('    ・403エラー発生時は時間を空けて再実行');
}

// ヘルプ要求チェック
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showHelp();
  process.exit(0);
}

// 実行
if (require.main === module) {
  main().catch(console.error);
}