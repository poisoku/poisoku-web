#!/usr/bin/env node

/**
 * 修正されたポイントインカムページネーションテスト
 */

const PointIncomeWebScraper = require('./scrapers/src/sites/pointincome/PointIncomeWebScraper');

async function testPagination() {
  console.log('🧪 修正されたポイントインカム ページネーションテスト');
  
  const scraper = new PointIncomeWebScraper();
  
  // テスト用に1カテゴリのみ実行
  scraper.categories = {
    'category_66': {
      name: 'ショッピングモール',
      url: 'https://pointi.jp/list.php?category=66',
      type: 'web',
      category_type: 'shopping'
    }
  };
  
  // 最大3ページまでテスト
  scraper.config.maxPagesPerCategory = 3;
  
  try {
    await scraper.execute();
    
    console.log('\n🎯 テスト結果:');
    console.log(`取得案件数: ${scraper.results.length}件`);
    console.log(`処理ページ数: ${scraper.stats.pagesProcessed}ページ`);
    console.log(`重複スキップ数: ${scraper.stats.duplicatesSkipped}件`);
    
    if (scraper.stats.pagesProcessed > 1) {
      console.log('✅ ページネーション成功！');
    } else {
      console.log('❌ ページネーション失敗（1ページのみ）');
    }
    
  } catch (error) {
    console.error('❌ テストエラー:', error);
  }
}

testPagination();