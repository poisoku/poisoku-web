#!/usr/bin/env node

const PointIncomeFullAppScraper = require('../scrapers/src/sites/pointincome/PointIncomeFullAppScraper');

/**
 * アプリ案件真の無限スクロール効果テスト
 * 限定カテゴリでテストして改善効果を検証
 */
class TestAppInfiniteScroll extends PointIncomeFullAppScraper {
  constructor() {
    super();
  }

  get config() {
    const baseConfig = super.config;
    // テスト用に3カテゴリに限定
    return {
      ...baseConfig,
      categories: [
        { id: 285, name: 'アプリカテゴリ285' },
        { id: 290, name: 'アプリカテゴリ290' },
        { id: 295, name: 'アプリカテゴリ295' }
      ]
    };
  }

  async generateReport() {
    const duration = (this.stats.endTime - this.stats.startTime) / 1000 / 60;
    
    console.log('\n' + '='.repeat(70));
    console.log('📱 アプリ案件真の無限スクロール効果検証');
    console.log('='.repeat(70));
    console.log(`⏱️ テスト時間: ${duration.toFixed(2)}分`);
    
    ['ios', 'android'].forEach(os => {
      const stats = this.stats[os];
      console.log(`\n📊 ${os.toUpperCase()}環境結果:`);
      console.log(`   📂 処理カテゴリ: ${stats.categoriesProcessed}/${this.config.categories.length}`);
      console.log(`   🎯 取得案件数: ${this.results[os].length}`);
      
      if (Object.keys(stats.categoryBreakdown).length > 0) {
        console.log('   📋 カテゴリ別結果:');
        Object.entries(stats.categoryBreakdown).forEach(([catId, count]) => {
          console.log(`      カテゴリ${catId}: ${count}件`);
        });
      }
      
      if (stats.errors.length > 0) {
        console.log(`   ⚠️ エラー: ${stats.errors.length}件`);
      }
    });

    await this.saveResults();
  }

  async saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // iOS結果
    if (this.results.ios.length > 0) {
      const iosFilename = `/Users/kn/poisoku-web/scrapers/data/pointincome/app_infinite_scroll_ios_test_${timestamp}.json`;
      const iosData = {
        scrape_date: new Date().toISOString(),
        test_type: 'app_infinite_scroll_ios',
        version: 'true_infinite_scroll_v1',
        environment: 'ios',
        total_campaigns: this.results.ios.length,
        stats: this.stats.ios,
        campaigns: this.results.ios
      };
      
      const fs = require('fs').promises;
      await fs.writeFile(iosFilename, JSON.stringify(iosData, null, 2));
      console.log(`💾 iOS結果保存: ${iosFilename}`);
    }
    
    // Android結果
    if (this.results.android.length > 0) {
      const androidFilename = `/Users/kn/poisoku-web/scrapers/data/pointincome/app_infinite_scroll_android_test_${timestamp}.json`;
      const androidData = {
        scrape_date: new Date().toISOString(),
        test_type: 'app_infinite_scroll_android',
        version: 'true_infinite_scroll_v1',
        environment: 'android',
        total_campaigns: this.results.android.length,
        stats: this.stats.android,
        campaigns: this.results.android
      };
      
      const fs = require('fs').promises;
      await fs.writeFile(androidFilename, JSON.stringify(androidData, null, 2));
      console.log(`💾 Android結果保存: ${androidFilename}`);
    }
  }
}

// テスト実行
if (require.main === module) {
  console.log('📱 アプリ案件真の無限スクロール効果検証開始');
  console.log('対象: 3カテゴリ × iOS/Android = 6パターン');
  console.log('='.repeat(50));
  
  const tester = new TestAppInfiniteScroll();
  tester.execute()
    .then(() => {
      console.log('\n🎉 アプリ案件テスト完了！');
      process.exit(0);
    })
    .catch(error => {
      console.error('アプリテストエラー:', error);
      process.exit(1);
    });
}

module.exports = TestAppInfiniteScroll;