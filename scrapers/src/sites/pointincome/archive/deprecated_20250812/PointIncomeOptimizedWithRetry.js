#!/usr/bin/env node

require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const PointIncomeScrapingConfig = require('./PointIncomeScrapingConfig');
const PointIncomeRetryManager = require('./PointIncomeRetryManager');

/**
 * ポイントインカム モバイル版スクレイパー（最適化版 + 自動再実行機能）
 * 全83カテゴリの案件を無限スクロールで取得
 * エラー発生時の自動再実行機能を搭載
 */
class PointIncomeOptimizedWithRetry {
  constructor() {
    this.browser = null;
    this.results = [];
    this.seenCampaignIds = new Set();
    this.scrapingConfig = new PointIncomeScrapingConfig();
    this.retryManager = new PointIncomeRetryManager();
    this.stats = {
      startTime: null,
      endTime: null,
      categoriesProcessed: 0,
      totalScrolls: 0,
      totalPages: 0,
      duplicatesSkipped: 0,
      errors: [],
      categoryBreakdown: {},
      highVolumeCategories: 0,
      consecutiveTimeouts: 0,
      retryStats: {}
    };
  }

  // 設定を統一管理クラスから取得（モバイル環境指定）
  get config() {
    // 通常案件はモバイル版ページを使用するため、ios環境を指定
    const optimizedConfig = this.scrapingConfig.getOptimizedConfig('ios', 'normalCampaigns');
    return {
      ...optimizedConfig,
      maxRetriesPerCategory: 2,
      maxScrollsPerCategory: 500,        // 異常時の安全弁として大幅拡張
      stableScrollCount: 8,              // 真の無限スクロール: 8回連続で新規なし→完了
      categoryTimeout: 1800000,          // カテゴリ別30分タイムアウト
      scrollWaitTime: 2500,              // スクロール間隔維持
      browserStartupWait: 1000,
      highVolumeThreshold: 50,           // 大量案件の閾値
      infiniteScrollMode: true           // 無限スクロール有効化フラグ
    };
  }

  // カテゴリデータを簡潔に定義
  get categories() {
    return [
      // ショッピングカテゴリ（50個）
      { id: 66, name: 'ショッピング', type: 'shopping' },
      { id: 161, name: 'ショッピング', type: 'shopping' },
      { id: 160, name: 'ショッピング', type: 'shopping' },
      { id: 229, name: 'ショッピング', type: 'shopping' },
      { id: 244, name: 'ショッピング', type: 'shopping' },
      { id: 245, name: 'ショッピング', type: 'shopping' },
      { id: 246, name: 'ショッピング', type: 'shopping' },
      { id: 177, name: 'ショッピング', type: 'shopping' },
      { id: 179, name: 'ショッピング', type: 'shopping' },
      { id: 247, name: 'ショッピング', type: 'shopping' },
      { id: 178, name: 'ショッピング', type: 'shopping' },
      { id: 248, name: 'ショッピング', type: 'shopping' },
      { id: 249, name: 'ショッピング', type: 'shopping' },
      { id: 262, name: 'ショッピング', type: 'shopping' },
      { id: 250, name: 'ショッピング', type: 'shopping' },
      { id: 251, name: 'ショッピング', type: 'shopping' },
      { id: 184, name: 'ショッピング', type: 'shopping' },
      { id: 185, name: 'ショッピング', type: 'shopping' },
      { id: 263, name: 'ショッピング', type: 'shopping' },
      { id: 252, name: 'ショッピング', type: 'shopping' },
      { id: 264, name: 'ショッピング', type: 'shopping' },
      { id: 265, name: 'ショッピング', type: 'shopping' },
      { id: 183, name: 'ショッピング', type: 'shopping' },
      { id: 253, name: 'ショッピング', type: 'shopping' },
      { id: 230, name: 'ショッピング', type: 'shopping' },
      { id: 225, name: 'ショッピング', type: 'shopping' },
      { id: 195, name: 'ショッピング', type: 'shopping' },
      { id: 257, name: 'ショッピング', type: 'shopping' },
      { id: 258, name: 'ショッピング', type: 'shopping' },
      { id: 194, name: 'ショッピング', type: 'shopping' },
      { id: 196, name: 'ショッピング', type: 'shopping' },
      { id: 193, name: 'ショッピング', type: 'shopping' },
      { id: 259, name: 'ショッピング', type: 'shopping' },
      { id: 260, name: 'ショッピング', type: 'shopping' },
      { id: 180, name: 'ショッピング', type: 'shopping' },
      { id: 169, name: 'ショッピング', type: 'shopping' },
      { id: 166, name: 'ショッピング', type: 'shopping' },
      { id: 168, name: 'ショッピング', type: 'shopping' },
      { id: 167, name: 'ショッピング', type: 'shopping' },
      { id: 255, name: 'ショッピング', type: 'shopping' },
      { id: 256, name: 'ショッピング', type: 'shopping' },
      { id: 261, name: 'ショッピング', type: 'shopping' },
      { id: 254, name: 'ショッピング', type: 'shopping' },
      { id: 171, name: 'ショッピング', type: 'shopping' },
      { id: 162, name: 'ショッピング', type: 'shopping' },
      { id: 163, name: 'ショッピング', type: 'shopping' },
      { id: 164, name: 'ショッピング', type: 'shopping' },
      { id: 173, name: 'ショッピング', type: 'shopping' },
      { id: 174, name: 'ショッピング', type: 'shopping' },
      { id: 175, name: 'ショッピング', type: 'shopping' },
      { id: 176, name: 'ショッピング', type: 'shopping' },

      // サービスカテゴリ（33個）
      { id: 69, name: 'サービス', type: 'service' },
      { id: 70, name: 'サービス', type: 'service' },
      { id: 75, name: 'サービス', type: 'service' },
      { id: 281, name: 'サービス', type: 'service' },
      { id: 73, name: 'サービス', type: 'service' },
      { id: 74, name: 'サービス', type: 'service' },
      { id: 276, name: 'サービス', type: 'service' },
      { id: 78, name: 'サービス', type: 'service' },
      { id: 235, name: 'サービス', type: 'service' },
      { id: 79, name: 'サービス', type: 'service' },
      { id: 240, name: 'サービス', type: 'service' },
      { id: 72, name: 'サービス', type: 'service' },
      { id: 76, name: 'サービス', type: 'service' },
      { id: 81, name: 'サービス', type: 'service' },
      { id: 274, name: 'サービス', type: 'service' },
      { id: 237, name: 'サービス', type: 'service' },
      { id: 209, name: 'サービス', type: 'service' },
      { id: 271, name: 'サービス', type: 'service' },
      { id: 232, name: 'サービス', type: 'service' },
      { id: 269, name: 'サービス', type: 'service' },
      { id: 234, name: 'サービス', type: 'service' },
      { id: 238, name: 'サービス', type: 'service' },
      { id: 280, name: 'サービス', type: 'service' },
      { id: 272, name: 'サービス', type: 'service' },
      { id: 278, name: 'サービス', type: 'service' },
      { id: 277, name: 'サービス', type: 'service' },
      { id: 283, name: 'サービス', type: 'service' },
      { id: 279, name: 'サービス', type: 'service' },
      { id: 77, name: 'サービス', type: 'service' },
      { id: 236, name: 'サービス', type: 'service' },
      { id: 270, name: 'サービス', type: 'service' },
      { id: 82, name: 'サービス', type: 'service' }
    ];
  }

  /**
   * カテゴリスクレイピング（再実行機能付き）
   */
  async scrapeCategoryWithRetry(category) {
    let lastError = null;
    
    // 再実行ループ
    while (true) {
      try {
        console.log(`      🎯 カテゴリ${category.id}処理開始 (${category.type})`);
        await this.scrapeCategory(category);
        
        // 成功時は再実行管理をリセット
        this.retryManager.failedCategories.delete(category.id.toString());
        console.log(`      ✅ カテゴリ${category.id}処理完了`);
        return;
        
      } catch (error) {
        lastError = error;
        console.error(`      ❌ カテゴリ${category.id}エラー:`, error.message);
        
        // 再実行判定
        const retryDecision = this.retryManager.shouldRetryCategory(category.id, error);
        
        if (retryDecision.shouldRetry) {
          console.log(`      🔄 カテゴリ${category.id} 再実行 (${retryDecision.retryCount}/${retryDecision.maxRetries}回目) [${retryDecision.errorType}エラー]`);
          
          // 再実行戦略実行
          this.browser = await this.retryManager.executeRetryStrategy(
            retryDecision.strategy,
            this.browser,
            this.scrapingConfig,
            'ios'
          );
          
          // 待機
          await this.retryManager.sleep(retryDecision.waitTime);
          continue;
          
        } else {
          console.error(`      💀 カテゴリ${category.id} 最大再実行回数に到達 - スキップ`);
          this.stats.errors.push({
            category: category.id,
            error: error.message,
            retryCount: retryDecision.retryCount
          });
          break;
        }
      }
    }
  }

  /**
   * 全カテゴリのスクレイピング（失敗カテゴリの再処理付き）
   */
  async scrapeAllCategoriesWithRetry() {
    console.log('\n🎯 ポイントインカム 通常案件取得開始（自動再実行機能付き）');
    await this.initializeBrowser();
    
    this.scrapingConfig.logConfiguration('ios', 'normalCampaigns');
    
    // 第1段階: 全カテゴリ処理
    for (let i = 0; i < this.categories.length; i++) {
      const category = this.categories[i];
      
      await this.scrapeCategoryWithRetry(category);
      this.stats.categoriesProcessed++;
      this.stats.consecutiveTimeouts = 0; // 成功時にリセット
      
      // ブラウザ再起動判定
      const restartInfo = this.scrapingConfig.shouldRestartBrowser(i, 'ios', 'normalCampaigns');
      if (restartInfo.shouldRestart) {
        console.log(`   🔄 ブラウザ再起動 (${i + 1}/${restartInfo.restartInterval}カテゴリ処理完了) - 高負荷対応最適化`);
        await this.initializeBrowser();
        
        // メモリクリーンアップ実行
        if (restartInfo.needsMemoryCleanup && global.gc) {
          console.log(`   🧹 メモリクリーンアップ実行`);
          await this.sleep(2000);
          global.gc();
        }
      }
      
      // 進捗表示
      if ((i + 1) % 10 === 0 || i === this.categories.length - 1) {
        const progress = ((i + 1) / this.categories.length * 100).toFixed(1);
        console.log(`📈 進捗: ${i + 1}/${this.categories.length} (${progress}%) - 取得数: ${this.results.length}件`);
      }
      
      await this.sleep(this.config.categoryWaitTime || 3000);
    }
    
    // 第2段階: 失敗カテゴリの再処理
    const failedCategories = this.retryManager.getFailedCategories();
    if (failedCategories.length > 0) {
      console.log(`\n🔄 失敗カテゴリの再処理開始 (${failedCategories.length}個)`);
      
      for (const categoryId of failedCategories) {
        const category = this.categories.find(c => c.id === categoryId);
        if (category) {
          console.log(`   🎯 再処理: カテゴリ${categoryId}`);
          await this.scrapeCategoryWithRetry(category);
        }
      }
    }
    
    // 統計更新
    this.stats.retryStats = this.retryManager.getRetryStats();
  }

  /**
   * メイン実行関数（全体再実行機能付き）
   */
  async execute() {
    console.log('🎯 ポイントインカム取得開始 (83カテゴリ + 自動再実行機能)');
    console.log('='.repeat(70));
    
    this.stats.startTime = new Date();
    let globalRetryCount = 0;
    
    while (globalRetryCount <= this.retryManager.maxGlobalRetries) {
      try {
        // 全カテゴリ取得
        await this.scrapeAllCategoriesWithRetry();
        
        // 全体再実行判定
        const globalRetryDecision = this.retryManager.shouldRetryGlobal(this.categories);
        
        if (globalRetryDecision.shouldRetry) {
          console.log(`\n🚨 全体再実行判定: 失敗率${globalRetryDecision.failureRate}% (${globalRetryDecision.failedCount}/${this.categories.length}カテゴリ)`);
          console.log(`🔄 全体再実行開始 (${globalRetryDecision.globalRetryCount}/${globalRetryDecision.maxGlobalRetries}回目)`);
          
          // 状態リセットして再実行
          this.retryManager.resetForGlobalRetry();
          this.results = [];
          this.seenCampaignIds.clear();
          this.stats.categoriesProcessed = 0;
          globalRetryCount++;
          continue;
        }
        
        // 成功時はループを抜ける
        break;
        
      } catch (error) {
        console.error('💥 致命的エラー:', error.message);
        globalRetryCount++;
        
        if (globalRetryCount > this.retryManager.maxGlobalRetries) {
          console.error('💀 最大全体再実行回数に到達 - 処理終了');
          break;
        }
        
        console.log(`🔄 全体再実行 (${globalRetryCount}/${this.retryManager.maxGlobalRetries}回目)`);
        await this.retryManager.sleep(10000);
      }
    }
    
    this.stats.endTime = new Date();
    await this.saveResults();
    this.displayFinalReport();
    
    if (this.browser) {
      await this.browser.close();
    }
  }

  /**
   * 通常のスクレイピングメソッド（既存ロジック）
   */
  async scrapeCategory(category) {
    const page = await this.browser.newPage();
    
    try {
      // モバイル環境設定
      const config = this.config;
      await page.setUserAgent(config.userAgent);
      await page.setViewport(config.viewport);
      
      const url = `https://sp.pointi.jp/list.php?category=${category.id}`;
      
      console.log(`      🔄 真の無限スクロール開始（完了まで継続）`);
      await page.goto(url, { 
        waitUntil: 'domcontentloaded', 
        timeout: config.timeout 
      });
      
      await this.sleep(config.pageLoadWait || 3000);
      
      // 無限スクロール実行
      const scrollResult = await this.performInfiniteScroll(page, category);
      
      // 案件データ抽出
      const campaigns = await this.extractCampaigns(page, category);
      
      // 新規案件の追加（重複除去）
      let newCount = 0;
      campaigns.forEach(campaign => {
        if (!this.seenCampaignIds.has(campaign.id)) {
          this.seenCampaignIds.add(campaign.id);
          this.results.push(campaign);
          newCount++;
        } else {
          this.stats.duplicatesSkipped++;
        }
      });
      
      this.stats.categoryBreakdown[category.id] = newCount;
      
      // 大量案件カテゴリの判定
      if (newCount >= this.config.highVolumeThreshold) {
        this.stats.highVolumeCategories++;
      }
      
      const scrollInfo = scrollResult.completionReason || `${scrollResult.totalScrolls}回スクロール`;
      console.log(`✅ ${category.type}_${category.id}: ${newCount}件 (新規: ${newCount}件) [${scrollInfo}]`);
      
    } finally {
      await page.close();
    }
  }

  async performInfiniteScroll(page, category) {
    let scrollCount = 0;
    let noChangeCount = 0;
    let previousCount = await this.getCampaignCount(page);
    const startTime = Date.now();

    console.log(`      📊 初期案件数: ${previousCount}件`);

    while (scrollCount < this.config.maxScrollsPerCategory && noChangeCount < this.config.stableScrollCount) {
      scrollCount++;
      
      // カテゴリ別タイムアウトチェック
      const elapsed = Date.now() - startTime;
      if (elapsed > this.config.categoryTimeout) {
        console.log(`      ⏰ カテゴリタイムアウト (${Math.round(elapsed/60000)}分) - 強制終了`);
        break;
      }
      
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await this.sleep(this.config.scrollWaitTime);
      
      const currentCount = await this.getCampaignCount(page);
      
      if (currentCount > previousCount) {
        const newItems = currentCount - previousCount;
        console.log(`      📈 スクロール${scrollCount}: ${newItems}件追加 (計:${currentCount}件)`);
        noChangeCount = 0;
      } else {
        noChangeCount++;
        if (this.config.infiniteScrollMode && scrollCount % 10 === 0) {
          console.log(`      ⏸️  スクロール${scrollCount}: 新規なし(${noChangeCount}/${this.config.stableScrollCount}回連続)`);
        }
      }
      
      previousCount = currentCount;
    }

    const endReason = noChangeCount >= this.config.stableScrollCount ? 
      `完全取得(${noChangeCount}回連続で新規なし)` : 
      `安全弁作動(${scrollCount}回到達)`;
    
    console.log(`      ✅ 無限スクロール完了: ${endReason}`);
    console.log(`      📊 最終結果: ${previousCount}件 (${scrollCount}回スクロール)`);

    this.stats.totalScrolls += scrollCount;

    return { 
      totalScrolls: scrollCount, 
      finalCount: previousCount,
      completionReason: endReason,
      elapsedTime: Math.round((Date.now() - startTime) / 1000)
    };
  }

  async getCampaignCount(page) {
    return await page.evaluate(() => {
      const elements = document.querySelectorAll('.box01, .campaign-item, .ad-item, li[class*="campaign"], div[class*="ad"]');
      return elements.length;
    });
  }

  async extractCampaigns(page, category) {
    return await page.evaluate((categoryInfo) => {
      const campaigns = [];
      
      const selectors = [
        '.box01',
        '.campaign-item',
        '.ad-item',
        'li[class*="campaign"]',
        'div[class*="ad"]',
        '.list-item',
        '.item'
      ];
      
      let elements = [];
      for (const selector of selectors) {
        const found = document.querySelectorAll(selector);
        if (found.length > 0) {
          elements = found;
          break;
        }
      }
      
      elements.forEach((element, index) => {
        try {
          // タイトル取得
          let title = '';
          const titleSelectors = ['.title', '.campaign-title', '.ad-title', 'h3', 'h4', '.name', 'strong'];
          for (const sel of titleSelectors) {
            const titleEl = element.querySelector(sel);
            if (titleEl && titleEl.textContent.trim()) {
              title = titleEl.textContent.trim();
              break;
            }
          }
          
          // URL取得
          const linkEl = element.querySelector('a[href*="/ad/"], a[href*="ad_details"], a[href^="http"]');
          const relativeUrl = linkEl ? linkEl.getAttribute('href') : '';
          
          // ポイント取得
          let points = '';
          const pointSelectors = ['.point', '.point2', '.reward', '.pts', '.cashback', '.rate'];
          for (const sel of pointSelectors) {
            const pointEl = element.querySelector(sel);
            if (pointEl && pointEl.textContent.trim()) {
              points = pointEl.textContent.trim();
              break;
            }
          }
          
          // ポイント正規化
          if (points.includes('pt')) {
            const ptMatch = points.match(/([\d,]+)pt/);
            if (ptMatch) {
              const pts = parseInt(ptMatch[1].replace(/,/g, ''));
              const yen = Math.floor(pts / 10);
              points = `${yen.toLocaleString()}円`;
            }
          }
          
          // ID抽出
          let id = '';
          if (relativeUrl) {
            const idMatch = relativeUrl.match(/\/ad\/(\d+)\/|ad_details\/(\d+)|[?&]id=(\d+)/);
            if (idMatch) {
              id = idMatch[1] || idMatch[2] || idMatch[3];
            } else {
              id = `temp_${Date.now()}_${index}`;
            }
          } else {
            id = `temp_${Date.now()}_${index}`;
          }
          
          // 完全なURLを構築
          let fullUrl = relativeUrl;
          if (relativeUrl && !relativeUrl.startsWith('http')) {
            fullUrl = relativeUrl.startsWith('/') ? 
              `https://sp.pointi.jp${relativeUrl}` : 
              `https://sp.pointi.jp/${relativeUrl}`;
          }
          
          if (title && fullUrl && id) {
            campaigns.push({
              id: id,
              title: title,
              url: fullUrl,
              points: points || '0円',
              device: 'All',
              category_id: categoryInfo.id,
              category_name: categoryInfo.name,
              category_type: categoryInfo.type,
              timestamp: new Date().toISOString()
            });
          }
          
        } catch (err) {
          console.log(`案件抽出エラー (${index}): ${err.message}`);
        }
      });
      
      return campaigns;
    }, category);
  }

  async initializeBrowser() {
    if (this.browser) {
      await this.browser.close();
    }
    this.browser = await this.scrapingConfig.createBrowser('ios');
    console.log('   🚀 ブラウザ再起動完了 - モバイル高負荷対応最適化');
  }

  async saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const baseDir = path.join(__dirname, '../../data/pointincome');
    
    try {
      await fs.mkdir(baseDir, { recursive: true });
      
      const data = {
        scrape_date: new Date().toISOString(),
        categories_processed: this.stats.categoriesProcessed,
        total_campaigns: this.results.length,
        duplicates_skipped: this.stats.duplicatesSkipped,
        high_volume_categories: this.stats.highVolumeCategories,
        retry_stats: this.stats.retryStats,
        stats: this.stats,
        campaigns: this.results
      };
      
      const filePath = path.join(baseDir, `pointincome_optimized_with_retry_${timestamp}.json`);
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
      
      console.log(`\n💾 保存完了: ${filePath}`);
      
    } catch (error) {
      console.error('💥 ファイル保存エラー:', error);
    }
  }

  displayFinalReport() {
    const executionTime = ((this.stats.endTime - this.stats.startTime) / 1000 / 60).toFixed(2);
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 完了レポート（自動再実行機能付き）');
    console.log('='.repeat(70));
    console.log(`⏱️ 実行時間: ${executionTime}分`);
    console.log(`📂 処理カテゴリ: ${this.stats.categoriesProcessed}/${this.categories.length}`);
    console.log(`🎯 取得案件数: ${this.results.length}`);
    console.log(`📈 大量取得カテゴリ: ${this.stats.highVolumeCategories}個`);
    
    // 再実行統計
    const retryStats = this.stats.retryStats;
    if (retryStats && retryStats.totalFailedCategories > 0) {
      console.log(`\n🔄 再実行統計:`);
      console.log(`   失敗カテゴリ: ${retryStats.totalFailedCategories}個`);
      console.log(`   全体再実行: ${retryStats.globalRetryCount}回`);
    }
    
    console.log('\n✅ 全処理完了（自動再実行機能により安定性向上）');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// メイン実行
if (require.main === module) {
  (async () => {
    const scraper = new PointIncomeOptimizedWithRetry();
    try {
      await scraper.execute();
    } catch (error) {
      console.error('💥 致命的エラー:', error);
      process.exit(1);
    }
  })();
}

module.exports = PointIncomeOptimizedWithRetry;