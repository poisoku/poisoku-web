#!/usr/bin/env node

/**
 * ポイントインカムiOSアプリ案件タイムアウト問題デバッグ
 */

const puppeteer = require('puppeteer');

class DebugIOSTimeout {
  constructor() {
    this.browser = null;
  }

  async execute() {
    console.log('🔍 ポイントインカムiOSアプリ案件タイムアウト問題調査開始');
    console.log('='.repeat(70));

    try {
      await this.initializeBrowser();
      
      // テスト1: 基本アクセステスト
      await this.testBasicAccess();
      
      // テスト2: User-Agent別比較テスト
      await this.testUserAgentComparison();
      
      // テスト3: タイムアウト設定テスト
      await this.testTimeoutSettings();
      
      console.log('\n✅ デバッグ調査完了');
      
    } catch (error) {
      console.error('💥 デバッグエラー:', error);
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  async initializeBrowser() {
    this.browser = await puppeteer.launch({
      headless: false, // ブラウザを表示してデバッグ
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
    console.log('🚀 ブラウザ起動完了（デバッグモード）');
  }

  async testBasicAccess() {
    console.log('\n📋 テスト1: 基本アクセステスト');
    console.log('-'.repeat(50));
    
    const page = await this.browser.newPage();
    
    try {
      // iOSユーザーエージェント設定
      const iosUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
      await page.setUserAgent(iosUserAgent);
      await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
      
      const testUrl = 'https://sp.pointi.jp/pts_app.php?cat_no=285&sort=&sub=4';
      console.log(`🌐 アクセス先: ${testUrl}`);
      
      // ネットワークイベントを監視
      page.on('response', response => {
        console.log(`📡 応答: ${response.status()} ${response.url()}`);
      });
      
      page.on('requestfailed', request => {
        console.log(`❌ リクエスト失敗: ${request.url()} - ${request.failure().errorText}`);
      });
      
      const startTime = Date.now();
      
      try {
        await page.goto(testUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 60000 // 60秒でテスト
        });
        
        const loadTime = Date.now() - startTime;
        console.log(`✅ ページ読み込み成功 (${loadTime}ms)`);
        
        // ページのタイトルと内容確認
        const title = await page.title();
        console.log(`📄 ページタイトル: ${title}`);
        
        const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 200));
        console.log(`📝 ページ内容（先頭200文字）: ${bodyText.replace(/\n/g, ' ')}`);
        
        // エラーメッセージの確認
        const errorElements = await page.$$eval('[class*="error"], [class*="alert"]', elements => 
          elements.map(el => el.textContent.trim()).filter(text => text.length > 0)
        );
        
        if (errorElements.length > 0) {
          console.log('⚠️ エラーメッセージ検出:');
          errorElements.forEach(error => console.log(`   - ${error}`));
        }
        
        // 案件要素の確認
        const campaignCount = await this.getCampaignCount(page);
        console.log(`🎯 検出された案件要素数: ${campaignCount}件`);
        
      } catch (error) {
        const loadTime = Date.now() - startTime;
        console.log(`❌ ページ読み込み失敗 (${loadTime}ms): ${error.message}`);
        
        // スクリーンショット取得
        try {
          await page.screenshot({ path: 'debug-ios-timeout.png' });
          console.log('📸 スクリーンショット保存: debug-ios-timeout.png');
        } catch (screenshotError) {
          console.log('📸 スクリーンショット取得失敗');
        }
      }
      
    } finally {
      await page.close();
    }
  }

  async testUserAgentComparison() {
    console.log('\n📋 テスト2: User-Agent別比較テスト');
    console.log('-'.repeat(50));
    
    const userAgents = {
      ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      android: 'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Mobile Safari/537.36',
      desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };
    
    for (const [osType, userAgent] of Object.entries(userAgents)) {
      console.log(`\n🔧 ${osType.toUpperCase()}環境テスト`);
      
      const page = await this.browser.newPage();
      
      try {
        await page.setUserAgent(userAgent);
        
        if (osType === 'ios') {
          await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
        } else if (osType === 'android') {
          await page.setViewport({ width: 360, height: 640, isMobile: true, hasTouch: true });
        } else {
          await page.setViewport({ width: 1920, height: 1080 });
        }
        
        const startTime = Date.now();
        
        try {
          await page.goto('https://sp.pointi.jp/pts_app.php?cat_no=285&sort=&sub=4', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });
          
          const loadTime = Date.now() - startTime;
          const campaignCount = await this.getCampaignCount(page);
          
          console.log(`   ✅ 成功: ${loadTime}ms, 案件数: ${campaignCount}件`);
          
        } catch (error) {
          const loadTime = Date.now() - startTime;
          console.log(`   ❌ 失敗: ${loadTime}ms - ${error.message}`);
        }
        
      } finally {
        await page.close();
      }
    }
  }

  async testTimeoutSettings() {
    console.log('\n📋 テスト3: タイムアウト設定テスト');
    console.log('-'.repeat(50));
    
    const timeoutSettings = [15000, 30000, 45000, 60000]; // 15秒, 30秒, 45秒, 60秒
    
    for (const timeout of timeoutSettings) {
      console.log(`\n⏱️ タイムアウト ${timeout/1000}秒でテスト`);
      
      const page = await this.browser.newPage();
      
      try {
        const iosUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
        await page.setUserAgent(iosUserAgent);
        await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
        
        const startTime = Date.now();
        
        try {
          await page.goto('https://sp.pointi.jp/pts_app.php?cat_no=285&sort=&sub=4', {
            waitUntil: 'domcontentloaded',
            timeout: timeout
          });
          
          const loadTime = Date.now() - startTime;
          console.log(`   ✅ 成功: ${loadTime}ms`);
          break; // 成功したら終了
          
        } catch (error) {
          const loadTime = Date.now() - startTime;
          console.log(`   ❌ 失敗: ${loadTime}ms - ${error.name}`);
        }
        
      } finally {
        await page.close();
      }
    }
  }

  async getCampaignCount(page) {
    try {
      return await page.evaluate(() => {
        const selectors = ['.box01', '.campaign-item', '.app-item', 'li[class*="app"]', 'div[class*="campaign"]'];
        let maxCount = 0;
        
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          maxCount = Math.max(maxCount, elements.length);
        }
        
        return maxCount;
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
  const debugTool = new DebugIOSTimeout();
  debugTool.execute();
}

module.exports = DebugIOSTimeout;