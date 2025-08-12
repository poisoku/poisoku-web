#!/usr/bin/env node

/**
 * ポイントインカム スマホアプリ案件スクレイピング
 * メインエントリーポイント
 * 
 * 使用方法:
 *   node main_pointincome_app.js
 * 
 * 特徴:
 * - iOS環境のみで全案件取得（最適化版）
 * - タイトルベースでデバイス分類
 * - 実行時間: 約4分
 * - 取得件数: 約340件 → 370件（iOS/Android別）
 */

const PointIncomeAppScraper = require('./PointIncomeAppScraper');

async function main() {
  const scraper = new PointIncomeAppScraper();
  
  try {
    await scraper.execute();
    process.exit(0);
  } catch (error) {
    console.error('❌ スクレイピングエラー:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = main;