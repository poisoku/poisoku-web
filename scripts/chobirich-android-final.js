const puppeteer = require('puppeteer');
const fs = require('fs').promises;

// 残り17件の最終仕上げ用スクレイパー
class ChobirichAndroidFinal {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.listingUrl = 'https://www.chobirich.com/smartphone?sort=point';
    this.results = [];
    this.browser = null;
    
    this.androidUserAgent = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36';
    this.processedIds = new Set();
    this.processedCount = 0;
    this.errorCount = 0;
  }

  async loadExistingData() {
    try {
      const data = JSON.parse(await fs.readFile('chobirich_android_app_campaigns.json', 'utf8'));
      console.log(`📋 既存データ読み込み: ${data.app_campaigns.length}件`);
      
      this.results = data.app_campaigns;
      this.processedCount = data.summary.total_processed;
      this.errorCount = data.summary.errors;
      
      data.app_campaigns.forEach(campaign => {
        this.processedIds.add(campaign.id);
      });
      
      console.log(`🔄 処理済みID: ${this.processedIds.size}件`);
      
    } catch (error) {
      console.log('📋 既存データなし、新規開始');
    }
  }

  async init() {
    console.log('🤖 Android版最終仕上げ開始');
    
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

  async extractRemainingUrls() {
    console.log('📚 Android版: 残りURLの最終抽出');
    
    const allUrls = new Set();
    
    // 最後の3ページを重点的にチェック
    for (let pageNum = 16; pageNum <= 18; pageNum++) {
      console.log(`📄 Androidページ ${pageNum} 最終チェック...`);
      
      const page = await this.setupPage();
      
      try {
        const url = `${this.listingUrl}&page=${pageNum}`;
        
        const response = await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 25000 
        });
        
        if (response.status() !== 200) continue;

        await new Promise(resolve => setTimeout(resolve, 2000));

        const pageData = await page.evaluate(() => {
          const links = document.querySelectorAll('a[href*="/ad_details/"]');
          const urls = Array.from(links)
            .map(link => link.href)
            .filter(href => href && href.includes('/ad_details/'));
          
          return { urls };
        });

        pageData.urls.forEach(url => {
          const directUrl = this.convertRedirectToDirectUrl(url);
          allUrls.add(directUrl);
        });
        
      } catch (error) {
        console.error(`❌ Androidページ ${pageNum} エラー: ${error.message}`);
      } finally {
        await page.close();
      }
    }
    
    // 未処理のURLのみフィルタリング
    const unprocessedUrls = Array.from(allUrls).filter(url => {
      const campaignId = url.match(/\/ad_details\/(?:redirect\/)?(\d+)\/?/)?.[1];
      return campaignId && !this.processedIds.has(campaignId);
    });
    
    console.log(`🎯 最終未処理URL: ${unprocessedUrls.length} 件`);
    return unprocessedUrls;
  }

  async processCampaign(url) {
    const campaignId = url.match(/\/ad_details\/(?:redirect\/)?(\d+)\/?/)?.[1];
    
    if (this.processedIds.has(campaignId)) {
      console.log(`⏭️ [${campaignId}] 既に処理済み - スキップ`);
      return null;
    }
    
    try {
      const page = await this.setupPage();
      
      try {
        const response = await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 25000 
        });
        
        if (response.status() !== 200) return null;

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
            const match = text.match(/(\d{1,3}(?:,\d{3})*(?:ちょび)?(?:ポイント|pt))/);
            if (match) {
              cashback = match[0];
            }
          }

          let method = '';
          const bodyText = document.body.innerText;
          
          const specificPatterns = [
            /新規アプリインストール後.*?レベル\s*\d+[^\n。]{0,60}/,
            /レベル\s*\d+[^\n。]{0,60}/,
            /\d+日間[^\n。]{0,60}/,
            /チュートリアル完了[^\n。]{0,60}/,
            /初回ログイン[^\n。]{0,60}/,
            /アプリ初回起動[^\n。]{0,60}/,
            /新規インストール[^\n。]{0,60}/,
            /インストール後[^\n。]{0,60}/
          ];
          
          const excludePatterns = [
            /インストール日・時刻/,
            /広告主発行の申込完了メール/,
            /プレイヤー情報画面キャプチャ/,
            /アプリの場合はプレイヤー情報/,
            /などが必要です/
          ];
          
          for (const pattern of specificPatterns) {
            const match = bodyText.match(pattern);
            if (match) {
              const foundMethod = match[0].trim();
              const shouldExclude = excludePatterns.some(excludePattern => 
                excludePattern.test(foundMethod)
              );
              
              if (!shouldExclude) {
                method = foundMethod.substring(0, 120);
                break;
              }
            }
          }
          
          if (!method) {
            const generalPatterns = [
              /獲得条件[：:]\s*([^\n]+)/,
              /達成条件[：:]\s*([^\n]+)/,
              /条件[：:]\s*([^\n]+)/
            ];
            
            for (const pattern of generalPatterns) {
              const match = bodyText.match(pattern);
              if (match && match[1]) {
                const foundMethod = match[1].trim();
                const shouldExclude = excludePatterns.some(excludePattern => 
                  excludePattern.test(foundMethod)
                );
                
                if (!shouldExclude) {
                  method = foundMethod.substring(0, 120);
                  break;
                }
              }
            }
          }

          let detectedOs = 'unknown';
          const titleLower = title.toLowerCase();
          const bodyTextLower = bodyText.toLowerCase();
          
          const androidKeywords = ['android', 'アンドロイド', 'google play'];
          const iosKeywords = ['ios', 'iphone', 'ipad', 'app store'];
          
          let isAndroid = androidKeywords.some(k => titleLower.includes(k) || bodyTextLower.includes(k));
          let isIOS = iosKeywords.some(k => titleLower.includes(k) || bodyTextLower.includes(k));
          
          if (isAndroid && isIOS) detectedOs = 'both';
          else if (isAndroid) detectedOs = 'android';
          else if (isIOS) detectedOs = 'ios';
          else detectedOs = 'android';

          return {
            title: title || '',
            cashback: cashback || '',
            method: method || '',
            detectedOs: detectedOs,
            bodyText: bodyText,
            pageValid: !!title && title !== 'エラー'
          };
        });

        if (!data.pageValid) return null;

        if (this.isAppCampaign(data.title, data.bodyText)) {
          const result = {
            id: campaignId,
            name: data.title,
            url: url,
            cashback: data.cashback || '不明',
            os: data.detectedOs,
            method: data.method || '不明',
            timestamp: new Date().toISOString()
          };

          console.log(`✅ [${campaignId}] ${data.title} (${data.cashback}) - Android環境`);
          this.processedCount++;
          this.processedIds.add(campaignId);
          return result;
        }

        this.processedCount++;
        this.processedIds.add(campaignId);
        return null;

      } finally {
        await page.close();
      }

    } catch (error) {
      console.log(`❌ [${campaignId}] Android版エラー: ${error.message}`);
      this.errorCount++;
      return null;
    }
  }

  async saveResults() {
    const output = {
      scrape_date: new Date().toISOString(),
      strategy: 'android_app_scraper_final',
      summary: {
        total_processed: this.processedCount,
        app_campaigns_found: this.results.length,
        errors: this.errorCount,
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
      'chobirich_android_app_campaigns.json',
      JSON.stringify(output, null, 2)
    );

    console.log('💾 Android最終結果をchobirich_android_app_campaigns.jsonに保存');
  }

  async run() {
    await this.loadExistingData();
    await this.init();
    
    try {
      const urls = await this.extractRemainingUrls();
      console.log(`\n🎯 Android版: ${urls.length}件の最終案件を処理\n`);
      
      if (urls.length === 0) {
        console.log('🎉 すべての案件が処理済みです！');
        await this.saveResults();
        return;
      }
      
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        console.log(`[${i + 1}/${urls.length}] Android版最終処理中`);
        
        const result = await this.processCampaign(url);
        if (result) {
          this.results.push(result);
        }
        
        if (i < urls.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      await this.saveResults();

      console.log('\n' + '='.repeat(60));
      console.log('🎉 Android版全アプリ案件取得完了！');
      console.log('='.repeat(60));
      console.log(`📄 総処理数: ${this.processedCount}件`);
      console.log(`📱 アプリ案件: ${this.results.length}件`);
      console.log(`❌ エラー: ${this.errorCount}件`);
      
      console.log('\n📱 Android版最終OS別内訳:');
      const osCounts = {
        ios: this.results.filter(r => r.os === 'ios').length,
        android: this.results.filter(r => r.os === 'android').length,
        both: this.results.filter(r => r.os === 'both').length,
        unknown: this.results.filter(r => r.os === 'unknown').length
      };
      console.log(`iOS: ${osCounts.ios}件`);
      console.log(`Android: ${osCounts.android}件`);
      console.log(`両対応: ${osCounts.both}件`);
      console.log(`不明: ${osCounts.unknown}件`);
      
    } catch (error) {
      console.error('Android版最終エラー:', error);
      await this.saveResults();
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

// 実行
(async () => {
  const scraper = new ChobirichAndroidFinal();
  await scraper.run();
})();