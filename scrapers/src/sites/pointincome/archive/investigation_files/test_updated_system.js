#!/usr/bin/env node

const PointIncomeFullAppScraper = require('./PointIncomeFullAppScraper');

/**
 * 更新されたAJAXシステムの単一カテゴリテスト
 */
async function testUpdatedSystem() {
  console.log('🧪 更新されたAJAXシステムのテスト実行');
  console.log('='.repeat(70));
  
  // テスト用に1カテゴリのみの設定でスクレイパーを作成
  class TestPointIncomeFullAppScraper extends PointIncomeFullAppScraper {
    get config() {
      const originalConfig = super.config;
      return {
        ...originalConfig,
        categories: [
          { id: 285, name: 'ゲーム' }  // テスト用に1カテゴリのみ
        ]
      };
    }
  }
  
  const scraper = new TestPointIncomeFullAppScraper();
  
  try {
    await scraper.execute();
    console.log('\n🎉 テスト完了！');
  } catch (error) {
    console.error('❌ テストエラー:', error);
  }
}

// 実行
testUpdatedSystem().catch(console.error);