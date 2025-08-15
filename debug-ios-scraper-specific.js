#!/usr/bin/env node

/**
 * PointIncomeFullAppScraperの設定でiOS問題を再現
 */

const puppeteer = require('puppeteer');

class DebugIOSScraperSpecific {
  constructor() {
    this.browser = null;
    this.config = {
      categories: [
        { id: 285, name: 'アプリカテゴリ285' },
        { id: 286, name: 'アプリカテゴリ286' }
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
      browserRestartInterval: 5
    };
  }

  async execute() {
    console.log('🔍 PointIncomeFullAppScraper設定でiOS問題再現テスト');
    console.log('='.repeat(70));

    try {
      await this.initializeBrowser();
      
      // 元のスクレイパーと同じフローで実行
      await this.testOriginalFlow();
      
      console.log('\n✅ テスト完了');
      
    } catch (error) {
      console.error('💥 テストエラー:', error);
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  async initializeBrowser() {
    // 元のスクレイパーと同じ設定
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
    console.log('🚀 ブラウザ起動完了（オリジナル設定）');
  }

  async testOriginalFlow() {
    console.log('\n📋 オリジナルフローでのテスト');
    console.log('-'.repeat(50));
    
    // iOS環境テスト
    console.log('\n📱 iOS環境テスト開始...');
    await this.testOS('ios');
    
    // Android環境テスト
    console.log('\n🤖 Android環境テスト開始...');
    await this.testOS('android');
  }

  async testOS(os) {
    for (let i = 0; i < Math.min(2, this.config.categories.length); i++) {
      const category = this.config.categories[i];
      
      try {
        console.log(`\n   📂 カテゴリ${category.id}をテスト中...`);
        await this.scrapeCategory(category, os);
        console.log(`   ✅ カテゴリ${category.id}: 成功`);
        
      } catch (error) {
        console.log(`   ❌ カテゴリ${category.id}: ${error.message}`);
        
        // 詳細なエラー情報
        console.log(`      エラータイプ: ${error.name}`);
        if (error.message.includes('timeout')) {
          console.log('      💡 タイムアウトエラーを検出');
        }
        if (error.message.includes('Navigation')) {
          console.log('      💡 ナビゲーションエラーを検出');
        }
      }
    }
  }

  async scrapeCategory(category, os) {
    const page = await this.browser.newPage();
    
    try {
      // 元のスクレイパーと同じ設定
      await page.setUserAgent(this.config.userAgents[os]);
      await page.setViewport(this.config.viewport[os]);
      
      const url = this.config.getUrl(category.id);
      console.log(`      🌐 アクセス: ${url}`);
      
      // ネットワークイベント監視
      let responseCount = 0;
      let lastResponseTime = Date.now();
      
      page.on('response', response => {
        responseCount++;
        lastResponseTime = Date.now();
        console.log(`         📡 応答${responseCount}: ${response.status()} ${response.url().substring(0, 80)}...`);
      });
      
      page.on('requestfailed', request => {
        console.log(`         ❌ 失敗: ${request.url()} - ${request.failure().errorText}`);
      });
      
      const startTime = Date.now();
      
      // 元のスクレイパーと同じgoto設定
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.config.timeout
      });
      
      const gotoTime = Date.now() - startTime;
      console.log(`      ✅ goto完了: ${gotoTime}ms`);
      
      // 元のスクレイパーと同じ待機時間
      await this.sleep(this.config.pageLoadWait);
      console.log(`      ⏱️ 追加待機完了: ${this.config.pageLoadWait}ms`);
      
      // 無限スクロールテスト（簡略版）
      const scrollResult = await this.performInfiniteScrollTest(page);
      console.log(`      🔄 スクロール完了: ${scrollResult.totalScrolls}回`);
      
      // 案件数確認
      const campaignCount = await this.getCampaignCount(page);
      console.log(`      🎯 案件数: ${campaignCount}件`);
      
    } finally {
      await page.close();
    }
  }

  async performInfiniteScrollTest(page) {
    let scrollCount = 0;
    const maxTestScrolls = 3; // テスト用に短縮
    
    while (scrollCount < maxTestScrolls) {
      scrollCount++;
      
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await this.sleep(1000); // テスト用に短縮
      
      const currentCount = await this.getCampaignCount(page);
      console.log(`         📜 スクロール${scrollCount}: ${currentCount}件検出`);
    }
    
    return { totalScrolls: scrollCount };
  }

  async getCampaignCount(page) {
    try {
      return await page.evaluate(() => {
        const elements = document.querySelectorAll('.box01, .campaign-item, .app-item, li[class*="app"], div[class*="campaign"]');
        return elements.length;
      });
    } catch (error) {
      return 0;
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 実行
if (require.main === module) {
  const debugTool = new DebugIOSScraperSpecific();
  debugTool.execute();
}

module.exports = DebugIOSScraperSpecific;