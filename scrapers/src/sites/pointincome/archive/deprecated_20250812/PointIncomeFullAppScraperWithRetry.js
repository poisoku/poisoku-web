#!/usr/bin/env node

require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const PointIncomeScrapingConfig = require('./PointIncomeScrapingConfig');
const PointIncomeRetryManager = require('./PointIncomeRetryManager');

/**
 * ポイントインカム スマホアプリ案件完全版スクレイパー（自動再実行機能付き）
 * 18カテゴリ × iOS/Android = 36パターンの案件を取得
 * エラー発生時の自動再実行機能を搭載
 */
class PointIncomeFullAppScraperWithRetry {
  constructor() {
    this.browser = null;
    this.scrapingConfig = new PointIncomeScrapingConfig();
    this.retryManager = new PointIncomeRetryManager();
    this.results = {
      ios: [],
      android: []
    };
    this.seenIds = {
      ios: new Set(),
      android: new Set()
    };
    this.stats = {
      startTime: null,
      endTime: null,
      ios: { 
        categoriesProcessed: 0,
        totalCampaigns: 0,
        duplicatesSkipped: 0,
        errors: [],
        categoryBreakdown: {},
        consecutiveTimeouts: 0,
        retryStats: {}
      },
      android: { 
        categoriesProcessed: 0,
        totalCampaigns: 0,
        duplicatesSkipped: 0,
        errors: [],
        categoryBreakdown: {},
        consecutiveTimeouts: 0,
        retryStats: {}
      }
    };
  }

  get config() {
    return {
      categories: [
        { id: 285, name: 'アプリカテゴリ285' },
        { id: 286, name: 'アプリカテゴリ286' },
        { id: 287, name: 'アプリカテゴリ287' },
        { id: 288, name: 'アプリカテゴリ288' },
        { id: 289, name: 'アプリカテゴリ289' },
        { id: 290, name: 'アプリカテゴリ290' },
        { id: 291, name: 'アプリカテゴリ291' },
        { id: 292, name: 'アプリカテゴリ292' },
        { id: 293, name: 'アプリカテゴリ293' },
        { id: 294, name: 'アプリカテゴリ294' },
        { id: 295, name: 'アプリカテゴリ295' },
        { id: 296, name: 'アプリカテゴリ296' },
        { id: 297, name: 'アプリカテゴリ297' },
        { id: 298, name: 'アプリカテゴリ298' },
        { id: 299, name: 'アプリカテゴリ299' },
        { id: 300, name: 'アプリカテゴリ300' },
        { id: 301, name: 'アプリカテゴリ301' },
        { id: 302, name: 'アプリカテゴリ302' }
      ],
      getUrl: (categoryId) => `https://sp.pointi.jp/pts_app.php?cat_no=${categoryId}&sort=&sub=4`,
      scrollWaitTime: 2500,
      maxScrollsPerCategory: 500,
      stableScrollCount: 8,
      categoryTimeout: 1800000,
      pageLoadWait: 3000,
      infiniteScrollMode: true
    };
  }

  /**
   * カテゴリスクレイピング（再実行機能付き）
   */
  async scrapeCategoryWithRetry(category, os) {
    let lastError = null;
    
    // 再実行ループ
    while (true) {
      try {
        console.log(`      🎯 カテゴリ${category.id}処理開始 (${os.toUpperCase()})`);
        await this.scrapeCategory(category, os);
        
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
            os
          );
          
          // 待機
          await this.retryManager.sleep(retryDecision.waitTime);
          continue;
          
        } else {
          console.error(`      💀 カテゴリ${category.id} 最大再実行回数に到達 - スキップ`);
          this.stats[os].errors.push({
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
  async scrapeAllCategoriesWithRetry(os) {
    console.log(`\n📱 ${os.toUpperCase()}環境での取得開始（再実行機能付き）...`);
    await this.initializeBrowser(os);
    
    const envConfig = this.getEnvironmentConfig(os);
    this.scrapingConfig.logConfiguration(os, 'appCampaigns');
    
    // 第1段階: 全カテゴリ処理
    for (let i = 0; i < this.config.categories.length; i++) {
      const category = this.config.categories[i];
      
      await this.scrapeCategoryWithRetry(category, os);
      this.stats[os].categoriesProcessed++;
      
      // ブラウザ再起動判定
      const restartInfo = this.scrapingConfig.shouldRestartBrowser(i, os, 'appCampaigns');
      if (restartInfo.shouldRestart) {
        console.log(`   🔄 ブラウザ再起動 (${i + 1}/${restartInfo.restartInterval}カテゴリ処理完了)`);
        await this.initializeBrowser(os);
      }
      
      // 進捗表示
      if ((i + 1) % 5 === 0 || i === this.config.categories.length - 1) {
        const progress = ((i + 1) / this.config.categories.length * 100).toFixed(1);
        console.log(`   📈 ${os.toUpperCase()}進捗: ${i + 1}/${this.config.categories.length} (${progress}%)`);
      }
      
      await this.retryManager.sleep(envConfig.categoryWaitTime);
    }
    
    // 第2段階: 失敗カテゴリの再処理
    const failedCategories = this.retryManager.getFailedCategories();
    if (failedCategories.length > 0) {
      console.log(`\n🔄 ${os.toUpperCase()} 失敗カテゴリの再処理開始 (${failedCategories.length}個)`);
      
      for (const categoryId of failedCategories) {
        const category = this.config.categories.find(c => c.id === categoryId);
        if (category) {
          console.log(`   🎯 再処理: カテゴリ${categoryId}`);
          await this.scrapeCategoryWithRetry(category, os);
        }
      }
    }
    
    // 統計更新
    this.stats[os].retryStats = this.retryManager.getRetryStats();
  }

  /**
   * メイン実行関数（全体再実行機能付き）
   */
  async execute() {
    console.log('🎯 ポイントインカム スマホアプリ案件完全版取得開始（自動再実行機能付き）');
    console.log('='.repeat(70));
    
    this.stats.startTime = new Date();
    let globalRetryCount = 0;
    
    while (globalRetryCount <= this.retryManager.maxGlobalRetries) {
      try {
        // iOS環境で全カテゴリ取得
        await this.scrapeAllCategoriesWithRetry('ios');
        
        // Android環境で全カテゴリ取得  
        await this.scrapeAllCategoriesWithRetry('android');
        
        // 全体再実行判定
        const globalRetryDecision = this.retryManager.shouldRetryGlobal(this.config.categories);
        
        if (globalRetryDecision.shouldRetry) {
          console.log(`\n🚨 全体再実行判定: 失敗率${globalRetryDecision.failureRate}% (${globalRetryDecision.failedCount}/${this.config.categories.length}カテゴリ)`);
          console.log(`🔄 全体再実行開始 (${globalRetryDecision.globalRetryCount}/${globalRetryDecision.maxGlobalRetries}回目)`);
          
          // 状態リセットして再実行
          this.retryManager.resetForGlobalRetry();
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
  }

  /**
   * 通常のスクレイピングメソッド（既存ロジック）
   */
  async scrapeCategory(category, os) {
    const page = await this.browser.newPage();
    
    try {
      const envConfig = this.getEnvironmentConfig(os);
      
      await page.setUserAgent(envConfig.userAgent);
      await page.setViewport(envConfig.viewport);
      
      const url = this.config.getUrl(category.id);
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: envConfig.timeout
      });
      
      await this.sleep(this.config.pageLoadWait);
      
      const scrollResult = await this.performInfiniteScroll(page);
      const campaigns = await this.extractCampaigns(page, os, category);
      
      let newCount = 0;
      campaigns.forEach(campaign => {
        if (!this.seenIds[os].has(campaign.id)) {
          this.seenIds[os].add(campaign.id);
          this.results[os].push(campaign);
          newCount++;
        } else {
          this.stats[os].duplicatesSkipped++;
        }
      });
      
      this.stats[os].categoryBreakdown[category.id] = newCount;
      this.stats[os].totalCampaigns += newCount;
      
      const scrollInfo = scrollResult.completionReason || `${scrollResult.totalScrolls}回スクロール`;
      console.log(`   ✅ カテゴリ${category.id}: ${campaigns.length}件 (新規: ${newCount}件) [${scrollInfo}]`);
      
    } finally {
      await page.close();
    }
  }

  // 以下、既存のメソッドをそのまま継承
  getEnvironmentConfig(os) {
    return this.scrapingConfig.getOptimizedConfig(os, 'appCampaigns');
  }

  async initializeBrowser(os) {
    if (this.browser) {
      await this.browser.close();
    }
    this.browser = await this.scrapingConfig.createBrowser(os);
    console.log(`   🚀 ブラウザ再起動完了 - ${os.toUpperCase()}最適化`);
  }

  async performInfiniteScroll(page) {
    // 既存の無限スクロールロジック
    console.log(`      🔄 真の無限スクロール開始（アプリ案件完全取得）`);
    
    let scrollCount = 0;
    let noChangeCount = 0;
    let previousCount = await this.getCampaignCount(page);
    const startTime = Date.now();

    console.log(`      📊 初期案件数: ${previousCount}件`);

    while (scrollCount < this.config.maxScrollsPerCategory && noChangeCount < this.config.stableScrollCount) {
      scrollCount++;
      
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
        if (this.config.infiniteScrollMode && scrollCount % 5 === 0) {
          console.log(`      ⏸️  スクロール${scrollCount}: 新規なし(${noChangeCount}/${this.config.stableScrollCount}回連続)`);
        }
      }
      
      previousCount = currentCount;
    }

    const endReason = noChangeCount >= this.config.stableScrollCount ? 
      `完全取得(${noChangeCount}回連続で新規なし)` : 
      `安全弁作動(${scrollCount}回到達)`;
    
    console.log(`      ✅ アプリ案件無限スクロール完了: ${endReason}`);
    console.log(`      📊 最終結果: ${previousCount}件 (${scrollCount}回スクロール)`);

    return { 
      totalScrolls: scrollCount, 
      finalCount: previousCount,
      completionReason: endReason,
      elapsedTime: Math.round((Date.now() - startTime) / 1000)
    };
  }

  async getCampaignCount(page) {
    return await page.evaluate(() => {
      const elements = document.querySelectorAll('.box01, .campaign-item, .app-item, li[class*="app"], div[class*="campaign"]');
      return elements.length;
    });
  }

  async extractCampaigns(page, os, category) {
    return await page.evaluate((deviceOS, categoryInfo) => {
      const campaigns = [];
      
      const selectors = [
        '.box01',
        '.campaign-item', 
        '.app-item',
        'li[class*="app"]',
        'div[class*="campaign"]',
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
          const titleSelectors = ['.title', '.app-title', '.campaign-title', 'h3', 'h4', '.name'];
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
          const pointSelectors = ['.point', '.point2', '.reward', '.pts', '.cashback'];
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
              device: deviceOS.toUpperCase(),
              category_id: categoryInfo.id,
              category_name: categoryInfo.name,
              timestamp: new Date().toISOString()
            });
          }
          
        } catch (err) {
          console.log(`案件抽出エラー (${index}): ${err.message}`);
        }
      });
      
      return campaigns;
    }, os, category);
  }

  async saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const baseDir = path.join(__dirname, '../../data/pointincome');
    
    try {
      await fs.mkdir(baseDir, { recursive: true });
      
      // iOS用ファイル
      const iosData = {
        scrape_date: new Date().toISOString(),
        device: 'iOS',
        categories_processed: this.stats.ios.categoriesProcessed,
        total_campaigns: this.stats.ios.totalCampaigns,
        duplicates_skipped: this.stats.ios.duplicatesSkipped,
        retry_stats: this.stats.ios.retryStats,
        campaigns: this.results.ios
      };
      
      const iosPath = path.join(baseDir, `pointincome_ios_app_full_with_retry_${timestamp}.json`);
      await fs.writeFile(iosPath, JSON.stringify(iosData, null, 2), 'utf8');
      
      // Android用ファイル
      const androidData = {
        scrape_date: new Date().toISOString(),
        device: 'Android',
        categories_processed: this.stats.android.categoriesProcessed,
        total_campaigns: this.stats.android.totalCampaigns,
        duplicates_skipped: this.stats.android.duplicatesSkipped,
        retry_stats: this.stats.android.retryStats,
        campaigns: this.results.android
      };
      
      const androidPath = path.join(baseDir, `pointincome_android_app_full_with_retry_${timestamp}.json`);
      await fs.writeFile(androidPath, JSON.stringify(androidData, null, 2), 'utf8');
      
      // 統合版ファイル
      const combinedData = {
        scrape_date: new Date().toISOString(),
        total_campaigns: this.stats.ios.totalCampaigns + this.stats.android.totalCampaigns,
        ios_campaigns: this.stats.ios.totalCampaigns,
        android_campaigns: this.stats.android.totalCampaigns,
        retry_stats: {
          ios: this.stats.ios.retryStats,
          android: this.stats.android.retryStats
        },
        campaigns: [...this.results.ios, ...this.results.android]
      };
      
      const combinedPath = path.join(baseDir, `pointincome_app_full_combined_with_retry_${timestamp}.json`);
      await fs.writeFile(combinedPath, JSON.stringify(combinedData, null, 2), 'utf8');
      
      console.log(`\n💾 iOS用ファイル: ${iosPath}`);
      console.log(`💾 Android用ファイル: ${androidPath}`);
      console.log(`💾 統合版ファイル: ${combinedPath}`);
      
    } catch (error) {
      console.error('💥 ファイル保存エラー:', error);
    }
  }

  displayFinalReport() {
    const executionTime = ((this.stats.endTime - this.stats.startTime) / 1000 / 60).toFixed(2);
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 スマホアプリ案件完全版取得完了レポート（自動再実行機能付き）');
    console.log('='.repeat(70));
    console.log(`⏱️ 実行時間: ${executionTime}分`);
    console.log(`📱 iOS案件: ${this.stats.ios.totalCampaigns}件`);
    console.log(`🤖 Android案件: ${this.stats.android.totalCampaigns}件`);
    console.log(`📊 合計案件数: ${this.stats.ios.totalCampaigns + this.stats.android.totalCampaigns}件`);
    console.log(`🔁 重複除去: iOS ${this.stats.ios.duplicatesSkipped}件, Android ${this.stats.android.duplicatesSkipped}件`);
    
    // 再実行統計
    const iosRetryStats = this.stats.ios.retryStats;
    const androidRetryStats = this.stats.android.retryStats;
    
    if (iosRetryStats.totalFailedCategories > 0) {
      console.log(`\n🔄 iOS再実行統計:`);
      console.log(`   失敗カテゴリ: ${iosRetryStats.totalFailedCategories}個`);
      console.log(`   全体再実行: ${iosRetryStats.globalRetryCount}回`);
    }
    
    if (androidRetryStats.totalFailedCategories > 0) {
      console.log(`\n🔄 Android再実行統計:`);
      console.log(`   失敗カテゴリ: ${androidRetryStats.totalFailedCategories}個`);
      console.log(`   全体再実行: ${androidRetryStats.globalRetryCount}回`);
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
    const scraper = new PointIncomeFullAppScraperWithRetry();
    try {
      await scraper.execute();
    } catch (error) {
      console.error('💥 致命的エラー:', error);
      process.exit(1);
    }
  })();
}

module.exports = PointIncomeFullAppScraperWithRetry;