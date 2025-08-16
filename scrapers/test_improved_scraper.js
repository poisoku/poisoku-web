#!/usr/bin/env node

/**
 * 改善版スクレイパーのテスト
 * カテゴリ6のみをテストして改善を確認
 */

const MoppyWebScraperV2 = require('./src/sites/moppy/MoppyWebScraperV2');

class ImprovedScraperTest {
  constructor() {
    this.scraper = new MoppyWebScraperV2();
  }

  async testCategory6Only() {
    console.log('🧪 改善版スクレイパーテスト開始...');
    console.log('🎯 対象: カテゴリ6（ショッピング詳細）のみ');
    console.log('📊 期待件数: 923件');
    
    try {
      await this.scraper.initialize();
      
      // カテゴリ6のみテスト
      const category6Results = await this.scraper.scrapeCategory(6, 'ショッピング詳細（テスト）');
      
      console.log('\n🎉 テスト完了!');
      console.log('📊 結果サマリー:');
      console.log(`🌐 カテゴリ6案件: ${category6Results.length}件`);
      console.log(`⏱️ 実行時間: 測定中...`);
      
      // 期待値との比較
      const expectedCount = 923;
      const actualCount = category6Results.length;
      const accuracy = Math.round(actualCount / expectedCount * 100);
      
      console.log('\n📈 精度分析:');
      console.log(`📊 期待件数: ${expectedCount}件`);
      console.log(`✅ 実際取得: ${actualCount}件`);
      console.log(`📈 取得率: ${accuracy}%`);
      
      if (accuracy >= 95) {
        console.log('🎯 取得率95%以上 - 改善成功！');
      } else if (accuracy >= 80) {
        console.log('⚠️ 取得率80-95% - さらなる改善が必要');
      } else {
        console.log('❌ 取得率80%未満 - 大幅な改善が必要');
      }
      
      // サンプル案件表示
      if (category6Results.length > 0) {
        console.log('\n📋 取得案件サンプル（最初の5件）:');
        category6Results.slice(0, 5).forEach((campaign, index) => {
          console.log(`${index + 1}. ${campaign.title} [${campaign.points}]`);
        });
      }
      
      return {
        success: true,
        count: actualCount,
        accuracy: accuracy,
        results: category6Results
      };
      
    } catch (error) {
      console.error('💥 テストエラー:', error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      await this.scraper.cleanup();
    }
  }
}

// 実行
async function main() {
  const tester = new ImprovedScraperTest();
  const result = await tester.testCategory6Only();
  
  if (result.success) {
    console.log('\n✅ 改善版スクレイパーテスト完了');
    console.log(`📊 最終結果: ${result.count}件取得（取得率: ${result.accuracy}%）`);
  } else {
    console.log('\n❌ テスト失敗:', result.error);
  }
}

main().catch(console.error);