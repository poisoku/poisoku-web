#!/usr/bin/env node

/**
 * モッピースクレイピングシステム - メインエントリーポイント
 */

const MoppyBasicScraper = require('./src/sites/moppy/MoppyBasicScraper');
const MoppyAdvancedScraper = require('./src/sites/moppy/MoppyAdvancedScraper');
const MoppyPointsOptimizer = require('./src/sites/moppy/MoppyPointsOptimizer');
const fs = require('fs').promises;
const path = require('path');

async function main() {
  console.log('🎯 モッピースクレイピングシステム起動');
  console.log('');
  
  // コマンドライン引数でスクレイパーを選択
  const scraperType = process.argv[2] || 'optimizer';
  
  try {
    if (scraperType === 'basic') {
      console.log('バージョン: 1.0.0 (Basic)');
      const scraper = new MoppyBasicScraper();
      await scraper.execute();
    } else if (scraperType === 'advanced') {
      console.log('バージョン: 2.0.0 (Advanced - ステルス対応)');
      const scraper = new MoppyAdvancedScraper();
      await scraper.execute();
    } else {
      console.log('バージョン: 3.0.0 (Points Optimizer - 高精度ポイント検出)');
      const scraper = new MoppyPointsOptimizer();
      await scraper.execute();
    }
    
    console.log('\n✅ 全処理完了');
    
  } catch (error) {
    console.error('💥 実行エラー:', error);
    process.exit(1);
  }
}

// 実行
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };