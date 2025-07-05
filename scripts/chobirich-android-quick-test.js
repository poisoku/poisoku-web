const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class ChobirichAndroidQuickTest {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.listingUrl = 'https://www.chobirich.com/smartphone?sort=point';
    this.results = [];
    this.browser = null;
    
    this.androidUserAgent = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36';
  }

  async init() {
    console.log('🤖 Android版クイックテスト開始');
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  }

  async setupPage() {
    const page = await this.browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    await page.setUserAgent(this.androidUserAgent);
    await page.setViewport({ width: 412, height: 915, isMobile: true });
    return page;
  }

  convertRedirectToDirectUrl(url) {
    const redirectPattern = /\/ad_details\/redirect\/(\d+)\/?$/;
    const match = url.match(redirectPattern);
    if (match) {
      return `${this.baseUrl}/ad_details/${match[1]}/`;
    }
    return url;
  }

  isAppCampaign(title, bodyText) {
    const appKeywords = [
      'アプリ', 'app', 'インストール', 'ダウンロード',
      'ゲーム', 'game', 'レベル', 'level', 'クリア',
      'iOS', 'iPhone', 'iPad', 'Android', 'アンドロイド',
      'Google Play', 'App Store', 'プレイ', 'play',
      'チュートリアル', 'アプリランド'
    ];
    
    const titleLower = title.toLowerCase();
    const bodyTextLower = bodyText.toLowerCase();
    
    return appKeywords.some(keyword => 
      titleLower.includes(keyword.toLowerCase()) || 
      bodyTextLower.includes(keyword.toLowerCase())
    );
  }

  async quickUrlExtraction() {
    console.log('📚 Android版: 最初の3ページのURL抽出');
    
    const allUrls = new Set();
    
    for (let pageNum = 1; pageNum <= 3; pageNum++) {
      console.log(`📄 Androidページ ${pageNum} 処理中...`);
      
      const page = await this.setupPage();
      
      try {
        const url = pageNum === 1 
          ? this.listingUrl 
          : `${this.listingUrl}&page=${pageNum}`;
        
        const response = await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 25000 
        });
        
        if (response.status() !== 200) {
          console.log(`❌ Androidページ ${pageNum}: ステータス ${response.status()}`);
          continue;
        }

        await new Promise(resolve => setTimeout(resolve, 2000));

        const pageData = await page.evaluate(() => {
          const links = document.querySelectorAll('a[href*="/ad_details/"]');
          const urls = Array.from(links)
            .map(link => link.href)
            .filter(href => href && href.includes('/ad_details/'));
          
          return { urls };
        });

        console.log(`📊 Androidページ ${pageNum}: ${pageData.urls.length}件のURL発見`);
        
        let newUrls = 0;
        pageData.urls.forEach(url => {
          const directUrl = this.convertRedirectToDirectUrl(url);
          if (!allUrls.has(directUrl)) {
            allUrls.add(directUrl);
            newUrls++;
          }
        });
        
        console.log(`🆕 新規: ${newUrls}件, 累計: ${allUrls.size}件`);
        
        if (pageNum < 3) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
      } catch (error) {
        console.error(`❌ Androidページ ${pageNum} エラー: ${error.message}`);
      } finally {
        await page.close();
      }
    }
    
    console.log(`\n🎯 Android版3ページ抽出完了: 合計 ${allUrls.size} 件のURL`);
    return Array.from(allUrls).slice(0, 20); // 最初の20件のみテスト
  }

  async processCampaign(url) {
    const campaignId = url.match(/\/ad_details\/(?:redirect\/)?(\d+)\/?/)?.[1];
    
    try {
      const page = await this.setupPage();
      
      try {
        const response = await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 25000 
        });
        
        if (response.status() !== 200) {
          return null;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

        const data = await page.evaluate(() => {
          let title = '';
          const h1Element = document.querySelector('h1.AdDetails__title');
          if (h1Element) {
            title = h1Element.textContent.trim();
          } else {
            const h1Elements = document.querySelectorAll('h1');
            for (const h1 of h1Elements) {
              const text = h1.textContent.trim();
              if (text && !text.includes('ちょびリッチ') && text !== 'エラー') {
                title = text;
                break;
              }
            }
          }

          let cashback = '';
          const pointElement = document.querySelector('.AdDetails__pt.ItemPtLarge');
          if (pointElement) {
            const text = pointElement.textContent.trim();
            const match = text.match(/(?:最大)?([\d,]+)(?:ちょび)?(?:ポイント|pt)/);
            if (match) {
              cashback = match[1] + 'ポイント';
            }
          }

          // OS判定
          let detectedOs = 'android'; // Android環境でアクセス
          const titleLower = title.toLowerCase();
          const bodyText = document.body.innerText;
          const bodyTextLower = bodyText.toLowerCase();
          
          const androidKeywords = ['android', 'アンドロイド', 'google play'];
          const iosKeywords = ['ios', 'iphone', 'ipad', 'app store'];
          
          let isAndroid = androidKeywords.some(k => titleLower.includes(k) || bodyTextLower.includes(k));
          let isIOS = iosKeywords.some(k => titleLower.includes(k) || bodyTextLower.includes(k));
          
          if (isAndroid && isIOS) detectedOs = 'both';
          else if (isIOS) detectedOs = 'ios';
          else if (isAndroid) detectedOs = 'android';

          return {
            title: title || '',
            cashback: cashback || '',
            detectedOs: detectedOs,
            bodyText: bodyText,
            pageValid: !!title && title !== 'エラー'
          };
        });

        if (!data.pageValid) {
          return null;
        }

        if (this.isAppCampaign(data.title, data.bodyText)) {
          const result = {
            id: campaignId,
            name: data.title,
            url: url,
            cashback: data.cashback || '不明',
            os: data.detectedOs,
            timestamp: new Date().toISOString()
          };

          console.log(`✅ [${campaignId}] ${data.title} (${data.cashback}) - OS: ${data.detectedOs}`);
          return result;
        }

        return null;

      } finally {
        await page.close();
      }

    } catch (error) {
      console.log(`❌ [${campaignId}] Android版エラー: ${error.message}`);
      return null;
    }
  }

  async run() {
    await this.init();
    
    try {
      // 最初の3ページからURL抽出
      const urls = await this.quickUrlExtraction();
      console.log(`\n🎯 Android版: ${urls.length}件の案件をテスト処理\n`);
      
      // 最初の20件のみ処理
      for (let i = 0; i < Math.min(urls.length, 20); i++) {
        const url = urls[i];
        console.log(`[${i + 1}/${Math.min(urls.length, 20)}] Android版処理中`);
        
        const result = await this.processCampaign(url);
        if (result) {
          this.results.push(result);
        }
        
        if (i < Math.min(urls.length, 20) - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // 結果保存
      const output = {
        scrape_date: new Date().toISOString(),
        strategy: 'android_quick_test',
        summary: {
          total_tested: Math.min(urls.length, 20),
          app_campaigns_found: this.results.length,
          os_breakdown: {
            ios: this.results.filter(r => r.os === 'ios').length,
            android: this.results.filter(r => r.os === 'android').length,
            both: this.results.filter(r => r.os === 'both').length,
            unknown: this.results.filter(r => r.os === 'unknown').length
          }
        },
        app_campaigns: this.results
      };

      await fs.writeFile(
        'chobirich_android_quick_results.json',
        JSON.stringify(output, null, 2)
      );

      console.log('\n' + '='.repeat(60));
      console.log('📊 Android版クイックテスト完了！');
      console.log('='.repeat(60));
      console.log(`📄 テスト数: ${Math.min(urls.length, 20)}件`);
      console.log(`📱 アプリ案件: ${this.results.length}件`);
      
      console.log('\n📱 Android版OS別内訳:');
      const osCounts = output.summary.os_breakdown;
      console.log(`iOS: ${osCounts.ios}件`);
      console.log(`Android: ${osCounts.android}件`);
      console.log(`両対応: ${osCounts.both}件`);
      console.log(`不明: ${osCounts.unknown}件`);
      
      console.log('\n💾 結果をchobirich_android_quick_results.jsonに保存');
      
    } catch (error) {
      console.error('Android版エラー:', error);
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

// 実行
(async () => {
  const tester = new ChobirichAndroidQuickTest();
  await tester.run();
})();