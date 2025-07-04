const fs = require('fs');
const path = require('path');

// 整理対象ファイルの分類
const fileCategories = {
  // 保持すべき重要ファイル
  keep: [
    'chobirich_android_ios_apps_data.json', // 最終的な572件のAndroid/iOSデータ
    'chobirich_all_categories_data.json',   // 全カテゴリー1,224件のデータ
    'chobirich_all_ids.json',              // IDリスト（572件）
    'scripts/chobirich-error-resistant.js', // 最終的な安定スクレイパー
    'scripts/chobirich-quality-improved.js', // データ品質改善スクレイパー
    'scripts/analyze-data-quality.js'       // データ分析スクリプト
  ],
  
  // 削除対象の古いデータファイル
  deleteData: [
    'chobirich_full_data.json',
    'chobirich_corrected_data.json', 
    'chobirich_fixed_data.json',
    'chobirich_final_data.json',
    'chobirich_fixed_final_data.json',
    'chobirich_mobile_apps_data.json',
    'chobirich_mobile_apps_improved_data.json',
    'chobirich_mobile_apps_final_data.json',
    'chobirich_complete_apps_data.json'
  ],
  
  // 削除対象の古いスクリプト
  deleteScripts: [
    'scripts/analyze-chobirich.js',
    'scripts/chobirich-simple-test.js',
    'scripts/scrape-chobirich.js',
    'scripts/chobirich-puppeteer.js',
    'scripts/chobirich-network-monitor.js',
    'scripts/chobirich-full-scraper.js',
    'scripts/chobirich-corrected-scraper.js',
    'scripts/debug-chobirich.js',
    'scripts/chobirich-fixed-scraper.js',
    'scripts/chobirich-final-scraper.js',
    'scripts/chobirich-ultimate-scraper.js',
    'scripts/chobirich-fixed-final.js',
    'scripts/chobirich-all-categories.js',
    'scripts/chobirich-mobile-apps.js',
    'scripts/chobirich-mobile-apps-improved.js',
    'scripts/chobirich-mobile-apps-final.js',
    'scripts/chobirich-android-ios-apps.js',
    'scripts/chobirich-android-ios-batch.js'
  ],
  
  // 削除対象のその他ファイル
  deleteOthers: [
    'run-chobirich-scraper.js',
    'chobirich-test.png',
    'debug-chobirich.png',
    'analyze_chobirich.py',
    'analyze_chobirich.js'
  ]
};

function analyzeFiles() {
  console.log('=== ちょびリッチ関連ファイル整理分析 ===\n');
  
  // 保持ファイルの確認
  console.log('📁 保持するファイル:');
  fileCategories.keep.forEach(file => {
    const fullPath = path.join('/Users/kn/poisoku-web', file);
    const exists = fs.existsSync(fullPath);
    const size = exists ? (fs.statSync(fullPath).size / 1024).toFixed(1) + 'KB' : 'なし';
    console.log(`  ✅ ${file} (${size})`);
  });
  
  // 削除対象ファイルの確認
  console.log('\n🗑️ 削除対象ファイル:');
  
  const allDeleteFiles = [
    ...fileCategories.deleteData,
    ...fileCategories.deleteScripts, 
    ...fileCategories.deleteOthers
  ];
  
  let totalDeleteSize = 0;
  let deleteCount = 0;
  
  allDeleteFiles.forEach(file => {
    const fullPath = path.join('/Users/kn/poisoku-web', file);
    if (fs.existsSync(fullPath)) {
      const size = fs.statSync(fullPath).size / 1024;
      totalDeleteSize += size;
      deleteCount++;
      console.log(`  🗑️ ${file} (${size.toFixed(1)}KB)`);
    }
  });
  
  console.log(`\n=== 削除サマリー ===`);
  console.log(`削除対象ファイル数: ${deleteCount}件`);
  console.log(`削除されるサイズ: ${totalDeleteSize.toFixed(1)}KB`);
  console.log(`保持ファイル数: ${fileCategories.keep.length}件`);
  
  return {
    deleteFiles: allDeleteFiles.filter(file => 
      fs.existsSync(path.join('/Users/kn/poisoku-web', file))
    ),
    deleteCount,
    totalSize: totalDeleteSize
  };
}

function executeCleanup(confirmed = false) {
  if (!confirmed) {
    console.log('\n⚠️ 実際の削除を実行するには、cleanup-chobirich-files.js内のexecuteCleanup(true)を呼び出してください。');
    return;
  }
  
  console.log('\n🧹 ファイル削除を実行中...');
  
  const allDeleteFiles = [
    ...fileCategories.deleteData,
    ...fileCategories.deleteScripts, 
    ...fileCategories.deleteOthers
  ];
  
  let deletedCount = 0;
  let errorCount = 0;
  
  allDeleteFiles.forEach(file => {
    const fullPath = path.join('/Users/kn/poisoku-web', file);
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
        console.log(`  ✅ 削除: ${file}`);
        deletedCount++;
      } catch (error) {
        console.log(`  ❌ エラー: ${file} - ${error.message}`);
        errorCount++;
      }
    }
  });
  
  console.log(`\n✨ 清理完了!`);
  console.log(`削除成功: ${deletedCount}件`);
  console.log(`エラー: ${errorCount}件`);
  
  // 残存ファイルの確認
  console.log('\n📁 残存する重要ファイル:');
  fileCategories.keep.forEach(file => {
    const fullPath = path.join('/Users/kn/poisoku-web', file);
    const exists = fs.existsSync(fullPath);
    console.log(`  ${exists ? '✅' : '❌'} ${file}`);
  });
}

// 分析のみ実行
const analysis = analyzeFiles();

// 削除を実行する場合は以下のコメントアウトを外してください
executeCleanup(true);