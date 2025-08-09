#!/usr/bin/env node

/**
 * 複数カテゴリでのページネーション修正版テスト
 */

const PointIncomeWebScraper = require('./scrapers/src/sites/pointincome/PointIncomeWebScraper');

async function testMultiCategoryPagination() {
  console.log('🧪 複数カテゴリ ページネーション修正版テスト');
  
  const scraper = new PointIncomeWebScraper();
  
  // 問題のあるカテゴリを含むサンプルでテスト
  scraper.categories = {
    'shopping_66': {
      id: 66,
      name: 'ショッピングモール',
      url: 'https://pointi.jp/list.php?category=66',
      type: 'shopping'
    },
    'shopping_161': {
      id: 161,
      name: 'ショッピングカテゴリ161',
      url: 'https://pointi.jp/list.php?category=161',
      type: 'shopping'
    },
    'shopping_177': {
      id: 177,
      name: 'ショッピングカテゴリ177',
      url: 'https://pointi.jp/list.php?category=177',
      type: 'shopping'
    },
    'shopping_251': {
      id: 251,
      name: 'ショッピングカテゴリ251',
      url: 'https://pointi.jp/list.php?category=251',
      type: 'shopping'
    }
  };
  
  // 最大3ページまでテスト
  scraper.config.maxPagesPerCategory = 5;
  
  try {
    await scraper.execute();
    
    console.log('\n🎯 テスト結果サマリー:');
    console.log(`総取得案件数: ${scraper.results.length}件`);
    console.log(`処理ページ数: ${scraper.stats.pagesProcessed}ページ`);
    console.log(`重複スキップ数: ${scraper.stats.duplicatesSkipped}件`);
    
    console.log('\n📊 カテゴリ別詳細:');
    Object.entries(scraper.stats.categoryBreakdown).forEach(([cat, count]) => {
      console.log(`  ${cat}: ${count}件`);
    });
    
    const multiPageCategories = Object.entries(scraper.stats.categoryBreakdown)
      .filter(([cat, count]) => count > 30);
    
    console.log(`\n✅ 複数ページ取得成功カテゴリ: ${multiPageCategories.length}/4`);
    
    if (multiPageCategories.length >= 3) {
      console.log('🎉 ページネーション修正成功！');
    } else {
      console.log('❌ まだページネーション問題が残っています');
    }
    
  } catch (error) {
    console.error('❌ テストエラー:', error);
  }
}

testMultiCategoryPagination();