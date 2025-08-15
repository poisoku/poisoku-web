#!/usr/bin/env node

// Dotenv読込みはスキップ（テスト用）
const PointIncomeOptimized = require('../scrapers/src/sites/pointincome/PointIncomeOptimized');

/**
 * 真の無限スクロール効果テスト
 * 100件上限に達していたカテゴリのみをテストして改善効果を検証
 */
class TestInfiniteScroll extends PointIncomeOptimized {
  constructor() {
    super();
    // 前回100件に達した高取得カテゴリをテスト対象に限定
    this.testCategories = {
      'shopping_177': {
        id: 177,
        name: 'ショッピングカテゴリ177',
        url: 'https://pointi.jp/list.php?category=177',
        type: 'shopping',
        previousCount: 100
      },
      'shopping_178': {
        id: 178,
        name: 'ショッピングカテゴリ178', 
        url: 'https://pointi.jp/list.php?category=178',
        type: 'shopping',
        previousCount: 100
      },
      'shopping_251': {
        id: 251,
        name: 'ショッピングカテゴリ251',
        url: 'https://pointi.jp/list.php?category=251',
        type: 'shopping',
        previousCount: 100
      },
      'shopping_169': {
        id: 169,
        name: 'ショッピングカテゴリ169',
        url: 'https://pointi.jp/list.php?category=169',
        type: 'shopping',
        previousCount: 100
      },
      'shopping_166': {
        id: 166,
        name: 'ショッピングカテゴリ166',
        url: 'https://pointi.jp/list.php?category=166',
        type: 'shopping', 
        previousCount: 100
      }
    };
  }

  get categories() {
    return this.testCategories;
  }

  async generateReport() {
    const duration = (this.stats.endTime - this.stats.startTime) / 1000 / 60;
    
    console.log('\n' + '='.repeat(70));
    console.log('🧪 真の無限スクロール効果検証レポート');
    console.log('='.repeat(70));
    console.log(`⏱️ テスト時間: ${duration.toFixed(2)}分`);
    console.log(`📂 テストカテゴリ: ${this.stats.categoriesProcessed}/${Object.keys(this.categories).length}`);
    console.log(`🎯 取得案件数: ${this.results.length}`);
    
    console.log('\n📊 カテゴリ別改善効果:');
    Object.entries(this.stats.categoryBreakdown).forEach(([key, currentCount]) => {
      const category = this.testCategories[key];
      const improvement = currentCount - category.previousCount;
      const improvementPercent = ((improvement / category.previousCount) * 100).toFixed(1);
      
      if (improvement > 0) {
        console.log(`✅ ${key}: ${category.previousCount}件 → ${currentCount}件 (+${improvement}件, +${improvementPercent}%)`);
      } else {
        console.log(`⚪ ${key}: ${category.previousCount}件 → ${currentCount}件 (変動なし)`);
      }
    });

    if (this.stats.errors.length > 0) {
      console.log(`\n⚠️ エラー: ${this.stats.errors.length}件`);
    }

    await this.saveResults();
  }

  async saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `/Users/kn/poisoku-web/scrapers/data/pointincome/infinite_scroll_test_${timestamp}.json`;
    
    const data = {
      scrape_date: new Date().toISOString(),
      test_type: 'infinite_scroll_improvement',
      version: 'true_infinite_scroll_v1',
      stats: this.stats,
      total_campaigns: this.results.length,
      improvement_analysis: {},
      campaigns: this.results
    };

    // 改善効果分析
    Object.entries(this.stats.categoryBreakdown).forEach(([key, currentCount]) => {
      const category = this.testCategories[key];
      data.improvement_analysis[key] = {
        previous_count: category.previousCount,
        current_count: currentCount,
        improvement: currentCount - category.previousCount,
        improvement_percent: ((currentCount - category.previousCount) / category.previousCount * 100).toFixed(1)
      };
    });

    const fs = require('fs').promises;
    await fs.writeFile(filename, JSON.stringify(data, null, 2));
    console.log(`\n💾 テスト結果保存: ${filename}`);
  }
}

// テスト実行
if (require.main === module) {
  console.log('🧪 真の無限スクロール効果検証開始');
  console.log('対象: 前回100件上限に達したカテゴリ5個');
  console.log('='.repeat(50));
  
  const tester = new TestInfiniteScroll();
  tester.execute()
    .then(() => {
      console.log('\n🎉 テスト完了！');
      process.exit(0);
    })
    .catch(error => {
      console.error('テストエラー:', error);
      process.exit(1);
    });
}

module.exports = TestInfiniteScroll;