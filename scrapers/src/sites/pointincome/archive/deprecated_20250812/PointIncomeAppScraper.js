#!/usr/bin/env node

require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

/**
 * ポイントインカム スマホアプリ案件スクレイパー
 * iOS/Android別にアプリ案件を取得
 */
class PointIncomeAppScraper {
  constructor() {
    this.browser = null;
    this.results = {
      ios: [],
      android: []
    };
    this.config = {
      url: 'https://sp.pointi.jp/list.php?cat_no=68',
      userAgents: {
        ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        android: 'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Mobile Safari/537.36'
      },
      viewport: {
        ios: { width: 375, height: 812, isMobile: true, hasTouch: true },
        android: { width: 360, height: 640, isMobile: true, hasTouch: true }
      },
      scrollWaitTime: 2500,
      maxScrolls: 50,
      pageLoadWait: 3000,
      stableScrollCount: 3,
      timeout: 45000
    };
    this.stats = {
      startTime: null,
      endTime: null,
      ios: { scrolls: 0, campaigns: 0, errors: [] },
      android: { scrolls: 0, campaigns: 0, errors: [] }
    };
  }

  async execute() {
    console.log('🎯 ポイントインカム スマホアプリ案件取得開始');
    console.log('='.repeat(70));
    
    this.stats.startTime = new Date();

    try {
      // iOS案件取得
      console.log('\n📱 iOS案件取得開始...');
      await this.scrapeForOS('ios');
      
      // Android案件取得
      console.log('\n🤖 Android案件取得開始...');
      await this.scrapeForOS('android');
      
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

  async scrapeForOS(os) {
    try {
      // ブラウザ初期化
      await this.initializeBrowser();
      
      const page = await this.browser.newPage();
      await page.setUserAgent(this.config.userAgents[os]);
      await page.setViewport(this.config.viewport[os]);
      
      // ページアクセス
      console.log(`   📍 URL: ${this.config.url}`);
      await page.goto(this.config.url, {
        waitUntil: 'domcontentloaded', // networkidle2から変更
        timeout: this.config.timeout
      });
      
      await this.sleep(this.config.pageLoadWait);
      
      // 無限スクロールで全案件取得
      const scrollResult = await this.performInfiniteScroll(page, os);
      console.log(`   📜 スクロール完了: ${scrollResult.totalScrolls}回`);
      
      // 案件データ抽出
      const campaigns = await this.extractCampaigns(page, os);
      this.results[os] = campaigns;
      
      this.stats[os].scrolls = scrollResult.totalScrolls;
      this.stats[os].campaigns = campaigns.length;
      
      console.log(`   ✅ ${os.toUpperCase()}案件取得完了: ${campaigns.length}件`);
      
      await page.close();
      
    } catch (error) {
      console.error(`   ❌ ${os.toUpperCase()}取得エラー:`, error.message);
      this.stats[os].errors.push(error.message);
    }
  }

  async initializeBrowser() {
    if (this.browser) {
      await this.browser.close();
    }
    
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  }

  async performInfiniteScroll(page, os) {
    let scrollCount = 0;
    let noChangeCount = 0;
    let previousCount = await this.getCampaignCount(page);
    
    console.log(`   📊 初期案件数: ${previousCount}件`);
    
    while (scrollCount < this.config.maxScrolls && noChangeCount < this.config.stableScrollCount) {
      scrollCount++;
      
      // スクロール実行
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await this.sleep(this.config.scrollWaitTime);
      
      const currentCount = await this.getCampaignCount(page);
      
      if (currentCount > previousCount) {
        noChangeCount = 0;
        if (scrollCount % 5 === 0) {
          console.log(`   📄 スクロール${scrollCount}: ${currentCount}件`);
        }
      } else {
        noChangeCount++;
      }
      
      previousCount = currentCount;
    }
    
    return {
      totalScrolls: scrollCount,
      finalCount: previousCount
    };
  }

  async getCampaignCount(page) {
    return await page.evaluate(() => {
      // ポイントインカムのアプリ案件要素セレクタ（要確認）
      const elements = document.querySelectorAll('.box01, .campaign-item, .app-item');
      return elements.length;
    });
  }

  async extractCampaigns(page, os) {
    return await page.evaluate((deviceOS) => {
      const campaigns = [];
      
      // 案件要素を取得（セレクタは実際のHTML構造に合わせて調整）
      const elements = document.querySelectorAll('.box01, .campaign-item, .app-item');
      
      elements.forEach((element, index) => {
        try {
          // タイトル取得
          const titleEl = element.querySelector('.title, .app-title, h3, h4');
          const title = titleEl ? titleEl.textContent.trim() : '';
          
          // URL取得
          const linkEl = element.querySelector('a[href*="/ad/"], a[href*="ad_details"]');
          const relativeUrl = linkEl ? linkEl.getAttribute('href') : '';
          
          // ポイント取得
          const pointEl = element.querySelector('.point, .point2, .reward');
          let points = pointEl ? pointEl.textContent.trim() : '';
          
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
            const idMatch = relativeUrl.match(/\/ad\/(\d+)\/|ad_details\/(\d+)/);
            id = idMatch ? (idMatch[1] || idMatch[2]) : `app_${Date.now()}_${index}`;
          }
          
          // URL生成
          const url = relativeUrl.startsWith('http') ? relativeUrl : 
                     relativeUrl.startsWith('/') ? `https://pointi.jp${relativeUrl}` : 
                     `https://pointi.jp/${relativeUrl}`;
          
          if (title && id) {
            campaigns.push({
              id,
              title,
              url,
              points,
              device: deviceOS.toUpperCase(),
              timestamp: new Date().toISOString()
            });
          }
        } catch (e) {
          console.error('Campaign extraction error:', e);
        }
      });
      
      return campaigns;
    }, os);
  }

  async generateReport() {
    const duration = (this.stats.endTime - this.stats.startTime) / 1000 / 60;
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 スマホアプリ案件取得完了レポート');
    console.log('='.repeat(70));
    console.log(`⏱️ 実行時間: ${duration.toFixed(2)}分`);
    console.log(`📱 iOS案件: ${this.stats.ios.campaigns}件`);
    console.log(`🤖 Android案件: ${this.stats.android.campaigns}件`);
    console.log(`📊 合計案件数: ${this.stats.ios.campaigns + this.stats.android.campaigns}件`);
    
    if (this.stats.ios.errors.length > 0 || this.stats.android.errors.length > 0) {
      console.log('\n⚠️ エラー:');
      if (this.stats.ios.errors.length > 0) {
        console.log(`   iOS: ${this.stats.ios.errors.join(', ')}`);
      }
      if (this.stats.android.errors.length > 0) {
        console.log(`   Android: ${this.stats.android.errors.join(', ')}`);
      }
    }
  }

  async saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const dataDir = path.join(__dirname, '../../../data/pointincome');
    
    // ディレクトリ作成
    await fs.mkdir(dataDir, { recursive: true });
    
    // iOS用ファイル
    const iosData = {
      scrape_date: new Date().toISOString(),
      device: 'iOS',
      total_campaigns: this.results.ios.length,
      campaigns: this.results.ios,
      stats: this.stats.ios
    };
    const iosFile = path.join(dataDir, `pointincome_ios_app_campaigns_${timestamp}.json`);
    await fs.writeFile(iosFile, JSON.stringify(iosData, null, 2));
    console.log(`\n💾 iOS用ファイル: ${iosFile}`);
    
    // Android用ファイル
    const androidData = {
      scrape_date: new Date().toISOString(),
      device: 'Android',
      total_campaigns: this.results.android.length,
      campaigns: this.results.android,
      stats: this.stats.android
    };
    const androidFile = path.join(dataDir, `pointincome_android_app_campaigns_${timestamp}.json`);
    await fs.writeFile(androidFile, JSON.stringify(androidData, null, 2));
    console.log(`💾 Android用ファイル: ${androidFile}`);
    
    // 統合版ファイル
    const combinedData = {
      scrape_date: new Date().toISOString(),
      total_campaigns: this.results.ios.length + this.results.android.length,
      ios_campaigns: this.results.ios.length,
      android_campaigns: this.results.android.length,
      campaigns: [...this.results.ios, ...this.results.android],
      stats: this.stats
    };
    const combinedFile = path.join(dataDir, `pointincome_app_campaigns_combined_${timestamp}.json`);
    await fs.writeFile(combinedFile, JSON.stringify(combinedData, null, 2));
    console.log(`💾 統合版ファイル: ${combinedFile}`);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 実行
if (require.main === module) {
  const scraper = new PointIncomeAppScraper();
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

module.exports = PointIncomeAppScraper;