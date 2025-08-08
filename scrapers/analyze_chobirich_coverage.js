#!/usr/bin/env node

/**
 * ちょびリッチ案件取得網羅性分析
 * 全20カテゴリの取得状況と未取得カテゴリを確認
 */

const ExtendedChobirichScraper = require('./src/sites/chobirich/ExtendedChobirichScraper');

class ChobirichCoverageAnalyzer {
  constructor() {
    this.scraper = new ExtendedChobirichScraper();
    this.coverageReport = {
      totalCategories: 0,
      successfulCategories: 0,
      failedCategories: 0,
      categoryDetails: {},
      estimatedTotalCampaigns: 0
    };
  }

  async analyze() {
    console.log('🔍 ちょびリッチ案件取得網羅性分析開始');
    console.log('='.repeat(60));
    
    // スクレイパー初期化
    await this.scraper.initialize();
    console.log('✅ スクレイパー初期化完了');
    
    const allCategories = Object.keys(this.scraper.categories);
    this.coverageReport.totalCategories = allCategories.length;
    
    console.log(`📋 対象カテゴリ数: ${allCategories.length}カテゴリ`);
    console.log('\n📊 カテゴリ別取得可能性チェック:');
    
    // 各カテゴリの1ページ目のみを軽量テスト
    for (const categoryKey of allCategories) {
      const category = this.scraper.categories[categoryKey];
      console.log(`\n🔍 ${categoryKey}: ${category.name}`);
      
      try {
        // 1ページ目のみ軽量テスト
        const testResults = await this.scraper.scrapeCategoryPage(
          category.baseUrl, 
          1, 
          category.type
        );
        
        if (testResults.length > 0) {
          console.log(`  ✅ 取得可能: ${testResults.length}件（1ページ目）`);
          this.coverageReport.successfulCategories++;
          this.coverageReport.categoryDetails[categoryKey] = {
            status: 'accessible',
            sampleCount: testResults.length,
            estimatedTotal: testResults.length * 10, // 推定総数
            category: category.name,
            type: category.type
          };
          this.coverageReport.estimatedTotalCampaigns += testResults.length * 10;
        } else {
          console.log(`  ⚠️ 案件なし`);
          this.coverageReport.categoryDetails[categoryKey] = {
            status: 'empty',
            sampleCount: 0,
            category: category.name,
            type: category.type
          };
        }
        
      } catch (error) {
        if (error.message.includes('403')) {
          console.log(`  ❌ アクセス制限（403エラー）`);
          this.coverageReport.failedCategories++;
          this.coverageReport.categoryDetails[categoryKey] = {
            status: 'blocked_403',
            error: '403 Forbidden',
            category: category.name,
            type: category.type,
            estimatedTotal: 100 // 保守的推定
          };
          this.coverageReport.estimatedTotalCampaigns += 100;
        } else {
          console.log(`  ❌ エラー: ${error.message}`);
          this.coverageReport.failedCategories++;
          this.coverageReport.categoryDetails[categoryKey] = {
            status: 'error',
            error: error.message,
            category: category.name,
            type: category.type
          };
        }
      }
      
      // カテゴリ間待機（403エラー回避）
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    await this.scraper.cleanup();
    this.displayReport();
    await this.saveReport();
  }

  displayReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 ちょびリッチ案件取得網羅性分析結果');
    console.log('='.repeat(60));
    
    console.log(`📋 総カテゴリ数: ${this.coverageReport.totalCategories}`);
    console.log(`✅ 取得可能カテゴリ: ${this.coverageReport.successfulCategories}`);
    console.log(`❌ 取得不可カテゴリ: ${this.coverageReport.failedCategories}`);
    console.log(`📊 推定総案件数: ${this.coverageReport.estimatedTotalCampaigns.toLocaleString()}件`);
    
    console.log('\n🛍️ ショッピングカテゴリ詳細:');
    Object.entries(this.coverageReport.categoryDetails)
      .filter(([key, data]) => data.type === 'shopping')
      .forEach(([key, data]) => {
        const statusIcon = data.status === 'accessible' ? '✅' : 
                          data.status === 'blocked_403' ? '🚫' : '❌';
        console.log(`  ${statusIcon} ${key}: ${data.category}`);
        if (data.sampleCount) {
          console.log(`     サンプル: ${data.sampleCount}件, 推定: ${data.estimatedTotal || 0}件`);
        }
        if (data.error) {
          console.log(`     エラー: ${data.error}`);
        }
      });
    
    console.log('\n🏢 サービスカテゴリ詳細:');
    Object.entries(this.coverageReport.categoryDetails)
      .filter(([key, data]) => data.type === 'service')
      .forEach(([key, data]) => {
        const statusIcon = data.status === 'accessible' ? '✅' : 
                          data.status === 'blocked_403' ? '🚫' : '❌';
        console.log(`  ${statusIcon} ${key}: ${data.category}`);
        if (data.sampleCount) {
          console.log(`     サンプル: ${data.sampleCount}件, 推定: ${data.estimatedTotal || 0}件`);
        }
        if (data.error) {
          console.log(`     エラー: ${data.error}`);
        }
      });
    
    // 取得失敗カテゴリの対応提案
    const blockedCategories = Object.entries(this.coverageReport.categoryDetails)
      .filter(([key, data]) => data.status === 'blocked_403')
      .map(([key, data]) => key);
    
    if (blockedCategories.length > 0) {
      console.log('\n🚫 403エラーで取得できていないカテゴリ:');
      blockedCategories.forEach(key => {
        console.log(`   - ${key}: ${this.coverageReport.categoryDetails[key].category}`);
      });
      
      console.log('\n💡 対応提案:');
      console.log('   1. 時間を置いて再実行（1-2時間後推奨）');
      console.log('   2. より長い待機時間での実行');
      console.log('   3. プロキシ・VPN使用での実行');
      console.log('   4. 複数回に分けての段階的実行');
    }
    
    // 現在の取得率
    const coverageRate = ((this.coverageReport.successfulCategories / this.coverageReport.totalCategories) * 100).toFixed(1);
    console.log(`\n📈 現在の取得率: ${coverageRate}% (${this.coverageReport.successfulCategories}/${this.coverageReport.totalCategories}カテゴリ)`);
    
    if (coverageRate < 100) {
      console.log('⚠️ まだ全案件を取得できていません。未取得カテゴリからの追加取得が必要です。');
    }
  }

  async saveReport() {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '_');
    const reportFile = `data/chobirich_coverage_analysis_${timestamp}.json`;
    
    const reportData = {
      analysisTime: new Date().toISOString(),
      summary: this.coverageReport,
      recommendations: {
        currentCoverage: `${this.coverageReport.successfulCategories}/${this.coverageReport.totalCategories} categories`,
        estimatedMissingCampaigns: this.coverageReport.estimatedTotalCampaigns - 664,
        nextActions: [
          "Wait 1-2 hours and retry blocked categories",
          "Use longer delays between requests", 
          "Consider proxy/VPN for IP rotation",
          "Implement staged execution approach"
        ]
      }
    };
    
    await require('fs').promises.writeFile(reportFile, JSON.stringify(reportData, null, 2));
    console.log(`\n📄 詳細レポート保存: ${reportFile}`);
  }
}

// 実行
async function main() {
  const analyzer = new ChobirichCoverageAnalyzer();
  try {
    await analyzer.analyze();
  } catch (error) {
    console.error('💥 分析エラー:', error);
  }
}

if (require.main === module) {
  main();
}