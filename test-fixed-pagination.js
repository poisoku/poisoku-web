#!/usr/bin/env node

/**
 * 修正版ページネーションのテスト
 */

const PointIncomeWebScraper = require('./scrapers/src/sites/pointincome/PointIncomeWebScraper');

async function testFixedPagination() {
  console.log('🧪 修正版ページネーションテスト');
  
  const scraper = new PointIncomeWebScraper();
  
  // 問題があったカテゴリでテスト
  scraper.categories = {
    'shopping_161': {
      id: 161,
      name: 'カテゴリ161（2ページ目問題あり）',
      url: 'https://pointi.jp/list.php?category=161',
      type: 'shopping'
    },
    'shopping_179': {
      id: 179,
      name: 'カテゴリ179（2ページ目問題あり）',
      url: 'https://pointi.jp/list.php?category=179',
      type: 'shopping'
    },
    'shopping_177': {
      id: 177,
      name: 'カテゴリ177（正常動作していた）',
      url: 'https://pointi.jp/list.php?category=177',
      type: 'shopping'
    }
  };
  
  console.log('🎯 テスト対象: 修正前に問題があったカテゴリ + 正常動作していたカテゴリ');
  
  try {
    await scraper.execute();
    
    console.log('\n🎯 修正版テスト結果:');
    console.log(`総取得案件数: ${scraper.results.length}件`);
    console.log(`処理ページ数: ${scraper.stats.pagesProcessed}ページ`);
    console.log(`エラー数: ${scraper.stats.errors.length}件`);
    
    // カテゴリ別の詳細情報
    console.log('\n📊 カテゴリ別結果:');
    Object.entries(scraper.stats.categoryBreakdown).forEach(([cat, count]) => {
      console.log(`   ${cat}: ${count}件`);
    });
    
    if (scraper.stats.errors.length > 0) {
      console.log('\n⚠️ エラー:');
      scraper.stats.errors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error.category || error.phase}: ${error.error}`);
      });
    }
    
    // 成功判定
    const categoryBreakdown = scraper.stats.categoryBreakdown;
    const cat161 = categoryBreakdown['shopping_161'] || 0;
    const cat179 = categoryBreakdown['shopping_179'] || 0;
    const cat177 = categoryBreakdown['shopping_177'] || 0;
    
    console.log('\n✅ 修正効果の確認:');
    console.log(`   カテゴリ161: ${cat161}件 (修正前: 15件 → 期待: 40件以上)`);
    console.log(`   カテゴリ179: ${cat179}件 (修正前: 12件 → 期待: 40件以上)`);
    console.log(`   カテゴリ177: ${cat177}件 (修正前: 105件 → 期待: 100件以上)`);
    
    if (cat161 > 30 && cat179 > 30) {
      console.log('\n🎉 ページネーション修正成功！');
    } else {
      console.log('\n⚠️ まだ問題が残っている可能性があります');
    }
    
  } catch (error) {
    console.error('❌ テストエラー:', error);
  }
}

testFixedPagination();