#!/usr/bin/env node

require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const PointIncomeScrapingConfig = require('./PointIncomeScrapingConfig');

/**
 * ポイントインカム スマホアプリ案件完全版スクレイパー
 * 18カテゴリ × iOS/Android = 36パターンの案件を取得
 */
class PointIncomeFullAppScraper {
  constructor() {
    this.browser = null;
    this.scrapingConfig = new PointIncomeScrapingConfig();
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
        consecutiveTimeouts: 0
      },
      android: { 
        categoriesProcessed: 0,
        totalCampaigns: 0,
        duplicatesSkipped: 0,
        errors: [],
        categoryBreakdown: {},
        consecutiveTimeouts: 0
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
      maxScrollsPerCategory: 500,        // 真の無限スクロール用安全弁
      stableScrollCount: 8,              // 8回連続新規なし→完了
      categoryTimeout: 1800000,          // 30分タイムアウト
      pageLoadWait: 3000,
      infiniteScrollMode: true           // 無限スクロール有効
    };
  }
  
  // 環境別最適化設定を取得
  getEnvironmentConfig(os) {
    return this.scrapingConfig.getOptimizedConfig(os, 'appCampaigns');
  }

  async execute() {
    console.log('🎯 ポイントインカム スマホアプリ案件完全版取得開始');
    console.log('='.repeat(70));
    console.log(`📱 対象カテゴリ: ${this.config.categories.length}個`);
    console.log(`🔄 取得パターン: ${this.config.categories.length} × 2 OS = ${this.config.categories.length * 2}回`);
    
    this.stats.startTime = new Date();

    try {
      // iOS環境で全カテゴリ取得
      console.log('\n📱 iOS環境での取得開始...');
      await this.scrapeAllCategories('ios');
      
      // Android環境で全カテゴリ取得
      console.log('\n🤖 Android環境での取得開始...');
      await this.scrapeAllCategories('android');
      
      this.stats.endTime = new Date();
      
      // レポート生成と保存
      await this.generateReport();
      await this.saveResults();
      
    } catch (error) {
      console.error('💥 実行エラー:', error);
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  async scrapeAllCategories(os) {
    await this.initializeBrowser(os);
    
    // 統一設定から環境別設定を取得
    const envConfig = this.getEnvironmentConfig(os);
    
    // 設定情報の表示
    this.scrapingConfig.logConfiguration(os, 'appCampaigns');
    
    for (let i = 0; i < this.config.categories.length; i++) {
      const category = this.config.categories[i];
      
      try {
        await this.scrapeCategory(category, os);
        this.stats[os].categoriesProcessed++;
        this.stats[os].consecutiveTimeouts = 0; // 成功時にリセット
        
        // 統一設定による動的ブラウザ再起動
        const restartInfo = this.scrapingConfig.shouldRestartBrowser(i, os, 'appCampaigns');
        if (restartInfo.shouldRestart) {
          console.log(`   🔄 ブラウザ再起動 (${i + 1}/${restartInfo.restartInterval}カテゴリ処理完了) - ${os.toUpperCase()}最適化`);
          await this.initializeBrowser(os);
          
          // メモリクリーンアップ実行
          if (restartInfo.needsMemoryCleanup && global.gc) {
            console.log(`   🧹 ${os.toUpperCase()}用メモリクリーンアップ実行`);
            await this.sleep(2000);
            global.gc();
          }
        }
        
        // 進捗表示
        if ((i + 1) % 5 === 0 || i === this.config.categories.length - 1) {
          const progress = ((i + 1) / this.config.categories.length * 100).toFixed(1);
          console.log(`   📈 ${os.toUpperCase()}進捗: ${i + 1}/${this.config.categories.length} (${progress}%)`);
        }
        
      } catch (error) {
        console.error(`   ❌ カテゴリ${category.id}エラー (${os.toUpperCase()}):`, error.message);
        this.stats[os].errors.push({
          category: category.id,
          error: error.message
        });
        
        // タイムアウトエラーの統一処理
        if (error.message.includes('timeout') || error.message.includes('Navigation')) {
          this.stats[os].consecutiveTimeouts++;
          console.log(`   🚨 ${os.toUpperCase()} タイムアウト検出 (連続${this.stats[os].consecutiveTimeouts}回) - 緊急復旧開始`);
          
          // 統一設定による緊急復旧処理
          this.browser = await this.scrapingConfig.handleTimeoutError(
            this.browser, 
            os, 
            this.stats[os].consecutiveTimeouts
          );
          
          // 連続タイムアウト対策
          if (this.stats[os].consecutiveTimeouts >= 2) {
            await this.sleep(5000);
          }
        }
      }
      
      await this.sleep(envConfig.categoryWaitTime);
    }
  }

  async scrapeCategory(category, os) {
    const page = await this.browser.newPage();
    
    try {
      // 統一設定から環境別設定を取得
      const envConfig = this.getEnvironmentConfig(os);
      
      await page.setUserAgent(envConfig.userAgent);
      await page.setViewport(envConfig.viewport);
      
      const url = this.config.getUrl(category.id);
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: envConfig.timeout
      });
      
      await this.sleep(this.config.pageLoadWait);
      
      // 無限スクロール実行
      const scrollResult = await this.performInfiniteScroll(page);
      
      // 案件データ抽出
      const campaigns = await this.extractCampaigns(page, os, category);
      
      // 新規案件の追加（重複除去）
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

  async performInfiniteScroll(page) {
    console.log(`      🔄 真の無限スクロール開始（アプリ案件完全取得）`);
    
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
      
      // 様々なセレクタで案件要素を探す
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
          // タイトル取得（様々なパターンに対応）
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
          
          // ポイント正規化（pt → 円変換）
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
              id = `app_${categoryInfo.id}_${Date.now()}_${index}`;
            }
          }
          
          // URL生成
          let url = '';
          if (relativeUrl) {
            if (relativeUrl.startsWith('http')) {
              url = relativeUrl;
            } else if (relativeUrl.startsWith('/')) {
              url = `https://pointi.jp${relativeUrl}`;
            } else {
              url = `https://pointi.jp/${relativeUrl}`;
            }
          }
          
          if (title && id) {
            campaigns.push({
              id,
              title,
              url,
              points,
              device: deviceOS.toUpperCase(),
              category_id: categoryInfo.id,
              category_name: categoryInfo.name,
              timestamp: new Date().toISOString()
            });
          }
        } catch (e) {
          console.error('Campaign extraction error:', e);
        }
      });
      
      return campaigns;
    }, os, category);
  }

  async initializeBrowser(os = 'desktop') {
    if (this.browser) {
      await this.browser.close();
    }
    
    // 統一設定クラスを使用してブラウザ作成
    this.browser = await this.scrapingConfig.createBrowser(os);
    console.log(`   🚀 ブラウザ再起動完了 - ${os.toUpperCase()}最適化`);
  }

  async generateReport() {
    const duration = (this.stats.endTime - this.stats.startTime) / 1000 / 60;
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 スマホアプリ案件完全版取得完了レポート');
    console.log('='.repeat(70));
    console.log(`⏱️ 実行時間: ${duration.toFixed(2)}分`);
    console.log(`📱 iOS案件: ${this.stats.ios.totalCampaigns}件`);
    console.log(`🤖 Android案件: ${this.stats.android.totalCampaigns}件`);
    console.log(`📊 合計案件数: ${this.stats.ios.totalCampaigns + this.stats.android.totalCampaigns}件`);
    console.log(`🔁 重複除去: iOS ${this.stats.ios.duplicatesSkipped}件, Android ${this.stats.android.duplicatesSkipped}件`);
    
    // カテゴリ別の取得数上位
    console.log('\n📈 カテゴリ別取得数（上位5）:');
    const allCategories = [
      ...Object.entries(this.stats.ios.categoryBreakdown).map(([cat, count]) => ({ cat, count, os: 'iOS' })),
      ...Object.entries(this.stats.android.categoryBreakdown).map(([cat, count]) => ({ cat, count, os: 'Android' }))
    ];
    
    allCategories
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .forEach((item, i) => {
        console.log(`   ${i + 1}. カテゴリ${item.cat} (${item.os}): ${item.count}件`);
      });
    
    // エラーサマリー
    const totalErrors = this.stats.ios.errors.length + this.stats.android.errors.length;
    if (totalErrors > 0) {
      console.log(`\n⚠️ エラー: ${totalErrors}件`);
    }
  }

  async saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const dataDir = path.join(__dirname, '../../../data/pointincome');
    
    await fs.mkdir(dataDir, { recursive: true });
    
    // iOS用ファイル
    const iosData = {
      scrape_date: new Date().toISOString(),
      device: 'iOS',
      categories_processed: this.stats.ios.categoriesProcessed,
      total_campaigns: this.stats.ios.totalCampaigns,
      duplicates_skipped: this.stats.ios.duplicatesSkipped,
      campaigns: this.results.ios,
      stats: this.stats.ios
    };
    const iosFile = path.join(dataDir, `pointincome_ios_app_full_${timestamp}.json`);
    await fs.writeFile(iosFile, JSON.stringify(iosData, null, 2));
    console.log(`\n💾 iOS用ファイル: ${iosFile}`);
    
    // Android用ファイル
    const androidData = {
      scrape_date: new Date().toISOString(),
      device: 'Android',
      categories_processed: this.stats.android.categoriesProcessed,
      total_campaigns: this.stats.android.totalCampaigns,
      duplicates_skipped: this.stats.android.duplicatesSkipped,
      campaigns: this.results.android,
      stats: this.stats.android
    };
    const androidFile = path.join(dataDir, `pointincome_android_app_full_${timestamp}.json`);
    await fs.writeFile(androidFile, JSON.stringify(androidData, null, 2));
    console.log(`💾 Android用ファイル: ${androidFile}`);
    
    // 統合版ファイル
    const combinedData = {
      scrape_date: new Date().toISOString(),
      total_campaigns: this.stats.ios.totalCampaigns + this.stats.android.totalCampaigns,
      ios_campaigns: this.stats.ios.totalCampaigns,
      android_campaigns: this.stats.android.totalCampaigns,
      campaigns: [...this.results.ios, ...this.results.android],
      stats: this.stats
    };
    const combinedFile = path.join(dataDir, `pointincome_app_full_combined_${timestamp}.json`);
    await fs.writeFile(combinedFile, JSON.stringify(combinedData, null, 2));
    console.log(`💾 統合版ファイル: ${combinedFile}`);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 実行
if (require.main === module) {
  const scraper = new PointIncomeFullAppScraper();
  scraper.execute()
    .then(() => {
      console.log('\n✅ 全処理完了');
      process.exit(0);
    })
    .catch(error => {
      console.error('致命的エラー:', error);
      process.exit(1);
    });
}

module.exports = PointIncomeFullAppScraper;