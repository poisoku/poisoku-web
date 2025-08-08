#!/usr/bin/env node

/**
 * 403エラー分析システム
 * ちょびリッチの検知システム回避戦略の検討
 */

const ExtendedChobirichScraper = require('./src/sites/chobirich/ExtendedChobirichScraper');
const fs = require('fs').promises;
const path = require('path');

class ChobirichErrorAnalyzer {
  constructor() {
    this.errorLog = [];
    this.testResults = {};
    this.patterns = [];
  }

  /**
   * 403エラー要因分析
   */
  async analyze403Patterns() {
    console.log('🔍 ちょびリッチ403エラー要因分析システム');
    console.log('='.repeat(70));

    // 分析項目
    const analysisItems = [
      '1. アクセス頻度による検知',
      '2. User-Agent検証',
      '3. リクエストパターン検知',
      '4. セッション管理',
      '5. IP/地理的制限',
      '6. 時間帯による制限'
    ];

    console.log('\n📋 分析項目:');
    analysisItems.forEach(item => console.log(`   ${item}`));

    // Test 1: 単発アクセステスト
    await this.testSingleAccess();
    
    // Test 2: 連続アクセステスト 
    await this.testConsecutiveAccess();
    
    // Test 3: 異なるUser-Agentテスト
    await this.testUserAgentVariations();
    
    // Test 4: 待機時間テスト
    await this.testDelayImpact();

    await this.generateAnalysisReport();
  }

  /**
   * Test 1: 単発アクセス成功率テスト
   */
  async testSingleAccess() {
    console.log('\n🎯 Test 1: 単発アクセス成功率テスト');
    console.log('-'.repeat(50));

    const testUrls = [
      'https://www.chobirich.com/shopping/shop/101',
      'https://www.chobirich.com/shopping/shop/103', 
      'https://www.chobirich.com/earn/apply/101',
      'https://www.chobirich.com/earn/apply/107'
    ];

    for (const url of testUrls) {
      try {
        console.log(`🔗 テスト中: ${url}`);
        const success = await this.performSingleRequest(url);
        
        this.errorLog.push({
          test: 'single_access',
          url,
          success,
          timestamp: new Date().toISOString()
        });

        console.log(`   ${success ? '✅ 成功' : '❌ 失敗'}`);
        
        // 各テスト間に待機
        await this.wait(5000);

      } catch (error) {
        console.log(`   ❌ エラー: ${error.message}`);
        this.errorLog.push({
          test: 'single_access',
          url,
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  /**
   * Test 2: 連続アクセス検知テスト
   */
  async testConsecutiveAccess() {
    console.log('\n🎯 Test 2: 連続アクセス検知テスト');
    console.log('-'.repeat(50));

    const testUrl = 'https://www.chobirich.com/shopping/shop/101';
    const accessCounts = [2, 5, 10, 20];

    for (const count of accessCounts) {
      console.log(`\n📊 ${count}回連続アクセステスト`);
      
      let successCount = 0;
      let firstFailAt = null;

      for (let i = 1; i <= count; i++) {
        try {
          console.log(`   ${i}/${count}: アクセス中...`);
          const success = await this.performSingleRequest(testUrl);
          
          if (success) {
            successCount++;
            console.log(`   ${i}/${count}: ✅ 成功`);
          } else {
            if (!firstFailAt) firstFailAt = i;
            console.log(`   ${i}/${count}: ❌ 失敗`);
          }

          // 短い間隔での連続アクセス
          await this.wait(1000);

        } catch (error) {
          if (!firstFailAt) firstFailAt = i;
          console.log(`   ${i}/${count}: ❌ エラー - ${error.message}`);
        }
      }

      this.testResults[`consecutive_${count}`] = {
        totalAttempts: count,
        successCount,
        firstFailAt,
        successRate: (successCount / count * 100).toFixed(1) + '%'
      };

      console.log(`   📊 結果: ${successCount}/${count} 成功 (${this.testResults[`consecutive_${count}`].successRate})`);
      if (firstFailAt) {
        console.log(`   ⚠️  初回失敗: ${firstFailAt}回目`);
      }

      // 次のテストセット前に長時間待機
      console.log('   ⏳ 次テストセット待機中...');
      await this.wait(15000);
    }
  }

  /**
   * Test 3: User-Agent検証テスト
   */
  async testUserAgentVariations() {
    console.log('\n🎯 Test 3: User-Agent検証テスト');
    console.log('-'.repeat(50));

    const userAgents = [
      {
        name: 'Chrome Windows',
        ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      {
        name: 'Firefox Windows', 
        ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0'
      },
      {
        name: 'Safari Mac',
        ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Version/16.1 Safari/537.36'
      },
      {
        name: 'Mobile Chrome',
        ua: 'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
      }
    ];

    const testUrl = 'https://www.chobirich.com/shopping/shop/103';

    for (const agent of userAgents) {
      console.log(`\n🔍 ${agent.name} テスト`);
      
      try {
        const success = await this.performSingleRequest(testUrl, agent.ua);
        
        console.log(`   ${success ? '✅ 成功' : '❌ 失敗'}`);
        
        this.testResults[`ua_${agent.name.toLowerCase().replace(' ', '_')}`] = {
          userAgent: agent.name,
          success,
          timestamp: new Date().toISOString()
        };

        await this.wait(8000);

      } catch (error) {
        console.log(`   ❌ エラー: ${error.message}`);
        this.testResults[`ua_${agent.name.toLowerCase().replace(' ', '_')}`] = {
          userAgent: agent.name,
          success: false,
          error: error.message
        };
      }
    }
  }

  /**
   * Test 4: 待機時間影響テスト
   */
  async testDelayImpact() {
    console.log('\n🎯 Test 4: 待機時間影響テスト');
    console.log('-'.repeat(50));

    const delays = [1000, 3000, 5000, 10000, 15000]; // 1秒〜15秒
    const testUrl = 'https://www.chobirich.com/shopping/shop/104';

    for (const delay of delays) {
      console.log(`\n⏳ ${delay/1000}秒待機テスト`);
      
      let successCount = 0;
      const attempts = 3;

      for (let i = 1; i <= attempts; i++) {
        try {
          console.log(`   ${i}/${attempts}: ${delay/1000}秒待機後アクセス...`);
          
          if (i > 1) await this.wait(delay);
          
          const success = await this.performSingleRequest(testUrl);
          if (success) {
            successCount++;
            console.log(`   ${i}/${attempts}: ✅ 成功`);
          } else {
            console.log(`   ${i}/${attempts}: ❌ 失敗`);
          }

        } catch (error) {
          console.log(`   ${i}/${attempts}: ❌ エラー - ${error.message}`);
        }
      }

      this.testResults[`delay_${delay}`] = {
        delay: `${delay/1000}秒`,
        successCount,
        attempts,
        successRate: (successCount / attempts * 100).toFixed(1) + '%'
      };

      console.log(`   📊 結果: ${successCount}/${attempts} 成功 (${this.testResults[`delay_${delay}`].successRate})`);
    }
  }

  /**
   * 単一リクエスト実行
   */
  async performSingleRequest(url, customUserAgent = null) {
    const puppeteer = require('puppeteer');
    
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    try {
      const page = await browser.newPage();
      
      // User-Agent設定
      const userAgent = customUserAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      await page.setUserAgent(userAgent);
      
      await page.setViewport({ width: 1920, height: 1080 });
      
      // リクエスト実行
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      const status = response.status();
      const success = status === 200;

      // 成功時は少しコンテンツをチェック
      if (success) {
        await page.waitForTimeout(2000);
        const title = await page.title();
        console.log(`     ページタイトル: ${title.substring(0, 30)}...`);
      }

      return success;

    } catch (error) {
      if (error.message.includes('403')) {
        return false;
      }
      throw error;
    } finally {
      await browser.close();
    }
  }

  /**
   * 待機
   */
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 分析レポート生成
   */
  async generateAnalysisReport() {
    console.log('\n' + '='.repeat(70));
    console.log('📊 403エラー分析結果レポート');
    console.log('='.repeat(70));

    // 成功率サマリー
    console.log('\n📈 テスト成功率サマリー:');
    
    const consecutiveTests = Object.keys(this.testResults).filter(k => k.startsWith('consecutive_'));
    if (consecutiveTests.length > 0) {
      console.log('\n   🔄 連続アクセステスト:');
      consecutiveTests.forEach(test => {
        const result = this.testResults[test];
        console.log(`     ${test.replace('consecutive_', '')}回連続: ${result.successRate} (${result.firstFailAt ? `${result.firstFailAt}回目で初回失敗` : '全成功'})`);
      });
    }

    const delayTests = Object.keys(this.testResults).filter(k => k.startsWith('delay_'));
    if (delayTests.length > 0) {
      console.log('\n   ⏳ 待機時間テスト:');
      delayTests.forEach(test => {
        const result = this.testResults[test];
        console.log(`     ${result.delay}: ${result.successRate}`);
      });
    }

    // 推定検知パターン
    console.log('\n🎯 推定検知パターン:');
    
    const patterns = this.analyzePatterns();
    patterns.forEach((pattern, index) => {
      console.log(`   ${index + 1}. ${pattern}`);
    });

    // 対策提案
    console.log('\n💡 推奨対策:');
    const recommendations = this.generateRecommendations();
    recommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec}`);
    });

    // レポート保存
    await this.saveDetailedReport();
  }

  /**
   * パターン分析
   */
  analyzePatterns() {
    const patterns = [];

    // 連続アクセスパターン分析
    const consecutive = Object.keys(this.testResults)
      .filter(k => k.startsWith('consecutive_'))
      .map(k => this.testResults[k]);

    if (consecutive.length > 0) {
      const highFailureRate = consecutive.filter(r => parseFloat(r.successRate) < 50);
      if (highFailureRate.length > 0) {
        patterns.push('連続アクセス回数による検知（5-10回で検知強化の可能性）');
      }
    }

    // 待機時間パターン分析  
    const delays = Object.keys(this.testResults)
      .filter(k => k.startsWith('delay_'))
      .map(k => this.testResults[k]);

    if (delays.length > 0) {
      const betterWithDelay = delays.filter(r => parseFloat(r.successRate) > 70);
      if (betterWithDelay.length > 0) {
        patterns.push('待機時間による成功率改善（10秒以上推奨の可能性）');
      }
    }

    patterns.push('時間帯・曜日による制限の可能性');
    patterns.push('セッション持続時間による検知');
    patterns.push('リクエストヘッダー・パターン検証');

    return patterns;
  }

  /**
   * 推奨対策生成
   */
  generateRecommendations() {
    return [
      '🕒 アクセス間隔: 最低10-15秒の待機時間',
      '🔄 セッション管理: 3-5リクエスト毎にブラウザ再起動',
      '🎭 User-Agent分散: リクエスト毎に異なるUA使用',  
      '⏰ 時間分散: 営業時間外（夜間・早朝）の実行',
      '🌐 IP分散: プロキシ・VPN活用',
      '📅 段階実行: 日次で少数カテゴリずつ実行',
      '🎯 優先度設定: 重要カテゴリから段階的アプローチ',
      '📊 リアルタイム監視: エラー発生時の即座停止機能'
    ];
  }

  /**
   * 詳細レポート保存
   */
  async saveDetailedReport() {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '_');
    const reportFile = path.join(__dirname, 'data', `error_analysis_${timestamp}.json`);

    const reportData = {
      analysisTime: new Date().toISOString(),
      errorLog: this.errorLog,
      testResults: this.testResults,
      patterns: this.analyzePatterns(),
      recommendations: this.generateRecommendations(),
      summary: {
        totalTests: Object.keys(this.testResults).length,
        errorCount: this.errorLog.filter(e => !e.success).length,
        overallSuccessRate: this.calculateOverallSuccessRate()
      }
    };

    await fs.writeFile(reportFile, JSON.stringify(reportData, null, 2));
    console.log(`\n📄 詳細分析レポート: ${path.basename(reportFile)}`);
  }

  /**
   * 全体成功率計算
   */
  calculateOverallSuccessRate() {
    const successful = this.errorLog.filter(e => e.success).length;
    const total = this.errorLog.length;
    return total > 0 ? ((successful / total) * 100).toFixed(1) + '%' : '0%';
  }
}

// 実行
async function main() {
  const analyzer = new ChobirichErrorAnalyzer();
  
  try {
    await analyzer.analyze403Patterns();
    console.log('\n✅ 403エラー分析完了');
  } catch (error) {
    console.error('💥 分析エラー:', error);
  }
}

if (require.main === module) {
  main();
}