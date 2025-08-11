#!/usr/bin/env node

require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

/**
 * ポイントインカム スマホアプリ案件完全版スクレイパー
 * 18カテゴリ × iOS/Android = 36パターンの案件を取得
 */
class PointIncomeFullAppScraper {
  constructor() {
    this.browser = null;
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
        categoryBreakdown: {}
      },
      android: { 
        categoriesProcessed: 0,
        totalCampaigns: 0,
        duplicatesSkipped: 0,
        errors: [],
        categoryBreakdown: {}
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
      userAgents: {
        ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        android: 'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Mobile Safari/537.36'
      },
      viewport: {
        ios: { width: 375, height: 812, isMobile: true, hasTouch: true },
        android: { width: 360, height: 640, isMobile: true, hasTouch: true }
      },
      scrollWaitTime: 2500,
      maxScrolls: 30,
      pageLoadWait: 3000,
      stableScrollCount: 2,
      timeout: 45000,
      browserRestartInterval: 5,
      iosSpecificSettings: {
        browserRestartInterval: 3,
        categoryWaitTime: 3000,
        additionalMemoryCleanup: true
      }
    };
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
    await this.initializeBrowser();
    
    // OS別の設定適用
    const restartInterval = os === 'ios' ? 
      this.config.iosSpecificSettings.browserRestartInterval : 
      this.config.browserRestartInterval;
    const waitTime = os === 'ios' ? 
      this.config.iosSpecificSettings.categoryWaitTime : 
      1000;
    
    for (let i = 0; i < this.config.categories.length; i++) {
      const category = this.config.categories[i];
      
      try {
        await this.scrapeCategory(category, os);
        this.stats[os].categoriesProcessed++;
        
        // OS別ブラウザ再起動頻度
        if ((i + 1) % restartInterval === 0) {
          console.log(`   🔄 ブラウザ再起動 (${i + 1}カテゴリ処理完了) - ${os.toUpperCase()}最適化`);
          await this.initializeBrowser();
          
          // iOS用追加メモリクリーンアップ
          if (os === 'ios' && this.config.iosSpecificSettings.additionalMemoryCleanup) {
            console.log(`   🧹 iOS用メモリクリーンアップ実行`);
            await this.sleep(2000);
            if (global.gc) global.gc();
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
        
        // iOS でタイムアウトエラーの場合、ブラウザを即座に再起動
        if (os === 'ios' && error.message.includes('timeout')) {
          console.log(`   🚨 iOS タイムアウト検出 - 緊急ブラウザ再起動`);
          await this.initializeBrowser();
          await this.sleep(3000);
        }
      }
      
      await this.sleep(waitTime);
    }
  }

  async scrapeCategory(category, os) {
    const page = await this.browser.newPage();
    
    try {
      await page.setUserAgent(this.config.userAgents[os]);
      await page.setViewport(this.config.viewport[os]);
      
      const url = this.config.getUrl(category.id);
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.config.timeout
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
      
      console.log(`   ✅ カテゴリ${category.id}: ${campaigns.length}件 (新規: ${newCount}件)`);
      
    } finally {
      await page.close();
    }
  }

  async performInfiniteScroll(page) {
    let scrollCount = 0;
    let noChangeCount = 0;
    let previousCount = await this.getCampaignCount(page);
    
    while (scrollCount < this.config.maxScrolls && noChangeCount < this.config.stableScrollCount) {
      scrollCount++;
      
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await this.sleep(this.config.scrollWaitTime);
      
      const currentCount = await this.getCampaignCount(page);
      
      if (currentCount > previousCount) {
        noChangeCount = 0;
      } else {
        noChangeCount++;
      }
      
      previousCount = currentCount;
    }
    
    return { totalScrolls: scrollCount, finalCount: previousCount };
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

  async initializeBrowser() {
    if (this.browser) {
      await this.browser.close();
    }
    
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--memory-pressure-off',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    });
    
    // iOS最適化のためのブラウザコンテキスト設定
    const context = this.browser.defaultBrowserContext();
    await context.overridePermissions('https://sp.pointi.jp', []);
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