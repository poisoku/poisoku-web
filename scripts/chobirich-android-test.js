const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class ChobirichAndroidTester {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.listingUrl = 'https://www.chobirich.com/smartphone?sort=point';
    this.browser = null;
    
    // 複数のAndroid User Agents
    this.androidUserAgents = [
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
      'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36',
      'Mozilla/5.0 (Linux; Android 11; OnePlus 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36',
      'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Mobile Safari/537.36'
    ];
    
    // 比較用iOS User Agent
    this.iosUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
    
    this.testResults = [];
  }

  async init() {
    console.log('🤖 Android環境テスト開始');
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--user-agent-override'
      ]
    });
  }

  async testUserAgent(userAgent, platform, testId) {
    console.log(`\n🧪 テスト${testId}: ${platform}`);
    console.log(`UA: ${userAgent.substring(0, 50)}...`);
    
    const page = await this.browser.newPage();
    
    try {
      // リソース最適化
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });
      
      // User Agent設定
      await page.setUserAgent(userAgent);
      
      // Viewport設定（プラットフォーム別）
      if (platform === 'iOS') {
        await page.setViewport({ width: 390, height: 844, isMobile: true });
      } else {
        await page.setViewport({ width: 412, height: 915, isMobile: true });
      }
      
      // ヘッダー設定
      await page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja-JP,ja;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-User': '?1',
        'Sec-Fetch-Dest': 'document'
      });

      // 基本ページアクセステスト
      const response = await page.goto(this.listingUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      
      const statusCode = response.status();
      console.log(`ステータス: ${statusCode}`);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // ページ内容分析
      const pageData = await page.evaluate(() => {
        const title = document.title;
        const bodyText = document.body.innerText.substring(0, 200);
        const is403 = title.includes('403') || 
                     bodyText.includes('Forbidden') || 
                     bodyText.includes('アクセスが拒否');
        const isBlocked = title.includes('エラー') || 
                         bodyText.includes('アクセスできません');
        
        // 案件リンク数をカウント
        const campaignLinks = document.querySelectorAll('a[href*="/ad_details/"]');
        const linkCount = campaignLinks.length;
        
        return {
          title,
          bodyText,
          is403,
          isBlocked,
          linkCount,
          hasContent: bodyText.length > 100
        };
      });
      
      // 結果判定
      let status = 'success';
      let message = `${pageData.linkCount}件のキャンペーンリンクを検出`;
      
      if (statusCode === 403) {
        status = 'blocked_http';
        message = 'HTTP 403 Forbidden';
      } else if (pageData.is403) {
        status = 'blocked_content';
        message = 'コンテンツレベルでのアクセス拒否';
      } else if (pageData.isBlocked) {
        status = 'blocked_other';
        message = 'その他のブロック検出';
      } else if (pageData.linkCount === 0) {
        status = 'no_content';
        message = 'キャンペーンリンクが見つからない';
      } else if (!pageData.hasContent) {
        status = 'empty_page';
        message = 'ページコンテンツが空';
      }
      
      const result = {
        testId,
        platform,
        userAgent: userAgent.substring(0, 80),
        statusCode,
        status,
        message,
        linkCount: pageData.linkCount,
        title: pageData.title,
        bodyPreview: pageData.bodyText.substring(0, 100)
      };
      
      console.log(`結果: ${status} - ${message}`);
      this.testResults.push(result);
      
      return result;
      
    } catch (error) {
      console.log(`❌ エラー: ${error.message}`);
      
      const errorResult = {
        testId,
        platform,
        userAgent: userAgent.substring(0, 80),
        statusCode: 0,
        status: 'error',
        message: error.message,
        linkCount: 0,
        title: '',
        bodyPreview: ''
      };
      
      this.testResults.push(errorResult);
      return errorResult;
      
    } finally {
      await page.close();
    }
  }

  async testSpecificCampaign(campaignId, userAgent, platform) {
    console.log(`\n🎯 個別案件テスト: ${campaignId} (${platform})`);
    
    const page = await this.browser.newPage();
    
    try {
      await page.setUserAgent(userAgent);
      if (platform === 'iOS') {
        await page.setViewport({ width: 390, height: 844, isMobile: true });
      } else {
        await page.setViewport({ width: 412, height: 915, isMobile: true });
      }
      
      const url = `${this.baseUrl}/ad_details/${campaignId}/`;
      const response = await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 25000 
      });
      
      console.log(`${platform} - ステータス: ${response.status()}`);
      
      if (response.status() === 200) {
        const data = await page.evaluate(() => {
          const title = document.querySelector('h1')?.textContent?.trim() || '';
          const bodyText = document.body.innerText;
          const is403 = bodyText.includes('403') || bodyText.includes('Forbidden');
          
          return { title, is403, bodyPreview: bodyText.substring(0, 150) };
        });
        
        console.log(`${platform} - タイトル: ${data.title || '取得失敗'}`);
        return { platform, status: response.status(), ...data };
      }
      
      return { platform, status: response.status(), title: '', is403: true };
      
    } catch (error) {
      console.log(`${platform} - エラー: ${error.message}`);
      return { platform, status: 'error', error: error.message };
    } finally {
      await page.close();
    }
  }

  async run() {
    await this.init();
    
    console.log('='.repeat(60));
    console.log('Android vs iOS アクセステスト');
    console.log('='.repeat(60));
    
    // 1. 基本アクセステスト
    console.log('\n📋 Phase 1: 基本アクセステスト');
    
    // iOS制御テスト
    await this.testUserAgent(this.iosUserAgent, 'iOS', 'control');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Android UA テスト
    for (let i = 0; i < this.androidUserAgents.length; i++) {
      await this.testUserAgent(this.androidUserAgents[i], 'Android', `android_${i + 1}`);
      await new Promise(resolve => setTimeout(resolve, 5000)); // 長めの間隔
    }
    
    // 2. 個別案件比較テスト
    console.log('\n📋 Phase 2: 個別案件比較テスト');
    const testCampaignId = '1835496'; // ピコットタウン
    
    const iosResult = await this.testSpecificCampaign(testCampaignId, this.iosUserAgent, 'iOS');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const androidResult = await this.testSpecificCampaign(testCampaignId, this.androidUserAgents[0], 'Android');
    
    // 結果保存
    const finalResults = {
      test_date: new Date().toISOString(),
      summary: {
        total_tests: this.testResults.length,
        ios_success: this.testResults.filter(r => r.platform === 'iOS' && r.status === 'success').length,
        android_success: this.testResults.filter(r => r.platform === 'Android' && r.status === 'success').length,
        android_blocked: this.testResults.filter(r => r.platform === 'Android' && r.status.includes('blocked')).length
      },
      basic_tests: this.testResults,
      campaign_comparison: {
        ios: iosResult,
        android: androidResult
      }
    };
    
    await fs.writeFile(
      'chobirich_android_test_results.json',
      JSON.stringify(finalResults, null, 2)
    );
    
    // 結果表示
    console.log('\n' + '='.repeat(60));
    console.log('🔍 テスト結果サマリー');
    console.log('='.repeat(60));
    
    console.log(`\n📊 基本アクセステスト:`);
    console.log(`iOS成功: ${finalResults.summary.ios_success}件`);
    console.log(`Android成功: ${finalResults.summary.android_success}件`);
    console.log(`Androidブロック: ${finalResults.summary.android_blocked}件`);
    
    console.log(`\n🎯 個別案件比較:`);
    console.log(`iOS: ${iosResult.status} - ${iosResult.title || 'タイトル取得失敗'}`);
    console.log(`Android: ${androidResult.status} - ${androidResult.title || 'タイトル取得失敗'}`);
    
    console.log('\n💾 詳細結果をchobirich_android_test_results.jsonに保存');
    
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// 実行
(async () => {
  const tester = new ChobirichAndroidTester();
  await tester.run();
})();