#!/usr/bin/env node

/**
 * 洗練版スクレイパーの動作確認テスト
 */

const ExtendedChobirichScraperRefined = require('./src/sites/chobirich/ExtendedChobirichScraper_Refined');

async function testRefinedScraper() {
  console.log('🔧 洗練版スクレイパー動作確認テスト');
  console.log('='.repeat(60));
  
  const scraper = new ExtendedChobirichScraperRefined();
  
  try {
    await scraper.initialize();
    
    // 簡易テスト：2カテゴリから1ページずつ
    const testCategories = ['shopping_101', 'service_101'];
    
    console.log(`\n📋 テスト対象カテゴリ: ${testCategories.length}件`);
    
    for (const categoryKey of testCategories) {
      const category = scraper.categories[categoryKey];
      if (!category) continue;
      
      console.log(`\n📂 ${categoryKey}: ${category.name}`);
      
      const campaigns = await scraper.scrapeCategoryPage(
        category.baseUrl, 
        1, 
        category.type
      );
      
      console.log(`✅ ${campaigns.length}件の案件を取得`);
      
      if (campaigns.length > 0) {
        const sample = campaigns[0];
        console.log(`📋 サンプル:`);
        console.log(`   タイトル: ${sample.title}`);
        console.log(`   還元率: ${sample.points}`);
        console.log(`   URL: ${sample.url}`);
      }
    }
    
    await scraper.cleanup();
    
    console.log('\n✅ 洗練版スクレイパー動作確認完了！');
    console.log('🎯 コードの改善により、メンテナンス性が向上しました。');
    
  } catch (error) {
    console.error('💥 テストエラー:', error);
    await scraper.cleanup();
  }
}

// 実行
if (require.main === module) {
  testRefinedScraper().catch(console.error);
}