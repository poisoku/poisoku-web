const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class ChobirichAndroidScraper {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.listingUrl = 'https://www.chobirich.com/smartphone?sort=point';
    this.results = [];
    this.errors = [];
    this.browser = null;
    
    // エラー対策用の設定
    this.maxConnectionsPerBrowser = 30;
    this.connectionCount = 0;
    this.processedCount = 0;
    this.errorCount = 0;
    this.checkpointInterval = 20;
    
    // Android ユーザーエージェント
    this.androidUserAgent = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36';
  }

  async sleep(seconds) {
    console.log(`⏳ ${seconds}秒待機中...`);
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }

  async initBrowser() {
    console.log('🤖 Android版ブラウザ初期化中...');
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--disable-features=VizDisplayCompositor',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-background-timer-throttling',
        '--js-flags=--max-old-space-size=2048',
        '--disable-web-security'
      ],
      timeout: 60000,
      protocolTimeout: 120000
    });
    
    this.connectionCount = 0;
    console.log('✅ Android版ブラウザ初期化完了');
  }

  async checkBrowserHealth() {
    try {
      if (!this.browser || !this.browser.isConnected()) {
        return false;
      }
      
      const testPage = await this.browser.newPage();
      await testPage.goto('about:blank', { timeout: 5000 });
      await testPage.close();
      
      return true;
    } catch (error) {
      console.log('⚠️ ブラウザ健全性チェック失敗');
      return false;
    }
  }

  async restartBrowser() {
    console.log('🔄 Android版ブラウザを安全に再起動中...');
    
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        // エラー無視
      }
      this.browser = null;
    }
    
    await this.sleep(3);
    await this.initBrowser();
  }

  logMemoryUsage() {
    const used = process.memoryUsage();
    console.log(`📊 メモリ: RSS=${Math.round(used.rss / 1024 / 1024)}MB`);
    
    if (used.rss > 1.5 * 1024 * 1024 * 1024) {
      console.log('⚠️ メモリ使用量が高い');
      return true;
    }
    return false;
  }

  async saveCheckpoint() {
    const checkpoint = {
      timestamp: new Date().toISOString(),
      processedCount: this.processedCount,
      errorCount: this.errorCount,
      appCampaignsFound: this.results.length,
      lastProcessedUrl: this.results.length > 0 ? this.results[this.results.length - 1].url : null
    };
    
    await fs.writeFile(
      'chobirich_android_checkpoint.json',
      JSON.stringify(checkpoint, null, 2)
    );
    
    console.log(`💾 Androidチェックポイント: アプリ案件${this.results.length}件発見`);
  }

  async saveResults() {
    const output = {
      scrape_date: new Date().toISOString(),
      strategy: 'android_app_scraper',
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

    console.log('💾 Android結果をchobirich_android_app_campaigns.jsonに保存');
  }

  async setupPage() {
    const page = await this.browser.newPage();
    
    page.setDefaultTimeout(25000);
    page.setDefaultNavigationTimeout(25000);
    
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    // Android設定
    await page.setUserAgent(this.androidUserAgent);
    await page.setViewport({ width: 412, height: 915, isMobile: true });
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ja-JP,ja;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-User': '?1',
      'Sec-Fetch-Dest': 'document',
      'Referer': 'https://www.chobirich.com/'
    });

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

  async extractAllUrls() {
    console.log('📚 Android版: 全ページからURL抽出開始');
    
    const allUrls = new Set();
    let pageNum = 1;
    let hasMorePages = true;
    
    while (hasMorePages && pageNum <= 30) {
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
          hasMorePages = false;
          continue;
        }

        await this.sleep(2);

        const pageData = await page.evaluate(() => {
          const links = document.querySelectorAll('a[href*="/ad_details/"]');
          const urls = Array.from(links)
            .map(link => link.href)
            .filter(href => href && href.includes('/ad_details/'));
          
          // 次ページの存在確認
          const hasNext = !!document.querySelector(`a[href*="page=${parseInt(window.location.search.match(/page=(\d+)/)?.[1] || '1') + 1}"]`);
          
          return { urls, hasNext, pageContent: document.body.innerText.substring(0, 100) };
        });

        if (pageData.urls.length === 0) {
          console.log(`📝 Androidページ ${pageNum}: 案件なし - 終了`);
          hasMorePages = false;
          continue;
        }

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
        
        hasMorePages = pageData.hasNext;
        pageNum++;
        
        if (hasMorePages) {
          await this.sleep(3);
        }
        
      } catch (error) {
        console.error(`❌ Androidページ ${pageNum} エラー: ${error.message}`);
        hasMorePages = false;
      } finally {
        await page.close();
      }
    }
    
    console.log(`\n🎯 Android版全ページ抽出完了: 合計 ${allUrls.size} 件のURL`);
    return Array.from(allUrls);
  }

  async processCampaign(url) {
    const campaignId = url.match(/\/ad_details\/(?:redirect\/)?(\d+)\/?/)?.[1];
    
    try {
      this.connectionCount++;
      if (this.connectionCount >= this.maxConnectionsPerBrowser) {
        console.log(`🔄 Android版: ${this.maxConnectionsPerBrowser}接続到達`);
        await this.restartBrowser();
      }
      
      const page = await this.setupPage();
      
      try {
        const response = await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 25000 
        });
        
        if (response.status() !== 200) {
          return null;
        }

        await this.sleep(1);

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
            const match = text.match(/((?:\d{1,3}(?:,\d{3})*|\d+)(?:ちょび)?(?:ポイント|pt))/);
            if (match) {
              cashback = match[0];
            }
          }

          let method = '';
          const bodyText = document.body.innerText;
          
          // 改良されたmethod取得ロジック（iOS版と同じ）
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

          // Android環境での OS判定強化
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
          else detectedOs = 'android'; // Android環境でアクセスしているため、明示がない場合はandroidとする

          return {
            title: title || '',
            cashback: cashback || '',
            method: method || '',
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
            method: data.method || '不明',
            timestamp: new Date().toISOString()
          };

          console.log(`✅ [${campaignId}] ${data.title} (${data.cashback}) - Android環境`);
          this.processedCount++;
          return result;
        }

        this.processedCount++;
        return null;

      } finally {
        await page.close();
      }

    } catch (error) {
      console.log(`❌ [${campaignId}] Android版エラー: ${error.message}`);
      this.errorCount++;
      
      if (error.message.includes('Protocol error') || error.message.includes('Connection closed')) {
        await this.restartBrowser();
      }
      
      return null;
    }
  }

  async run() {
    console.log('🚀 ちょびリッチ Android版アプリ案件取得開始\n');
    
    try {
      await this.initBrowser();
      
      // 全ページからURL抽出
      const urls = await this.extractAllUrls();
      console.log(`\n🎯 Android版: ${urls.length}件の案件を処理開始\n`);
      
      // 各案件の処理
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        console.log(`[${i + 1}/${urls.length}] Android版処理中`);
        
        // メモリチェック
        if (i > 0 && i % 20 === 0) {
          const needsRestart = this.logMemoryUsage();
          if (needsRestart) {
            await this.restartBrowser();
          }
        }
        
        const result = await this.processCampaign(url);
        if (result) {
          this.results.push(result);
        }
        
        // チェックポイント
        if ((i + 1) % this.checkpointInterval === 0) {
          await this.saveCheckpoint();
          await this.saveResults(); // 中間保存
        }
        
        // 進行状況
        if ((i + 1) % 50 === 0) {
          console.log(`\n📊 Android版進行: ${i + 1}/${urls.length} (アプリ: ${this.results.length}件)\n`);
        }
        
        if (i < urls.length - 1) {
          await this.sleep(2);
        }
      }

      // 最終結果保存
      await this.saveResults();

      console.log('\n' + '='.repeat(60));
      console.log('📊 Android版全アプリ案件取得完了！');
      console.log('='.repeat(60));
      console.log(`📄 総処理数: ${this.processedCount}件`);
      console.log(`📱 アプリ案件: ${this.results.length}件`);
      console.log(`❌ エラー: ${this.errorCount}件`);
      
      console.log('\n📱 Android版OS別内訳:');
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
      console.error('Android版致命的エラー:', error);
      await this.saveCheckpoint();
      await this.saveResults();
    } finally {
      if (this.browser) {
        try {
          await this.browser.close();
        } catch (error) {
          // エラー無視
        }
      }
    }
  }
}

// ========================================
// ちょびリッチ Androidアプリ案件スクレイパー
// ========================================
// 目的: ちょびリッチの全Androidアプリ案件データを自動取得
// 対象: https://www.chobirich.com/smartphone?sort=point (全ページ)
// 
// 重要な技術仕様:
// 1. Android UA使用 (テスト結果: アクセス成功確認)
// 2. リダイレクトURL自動変換機能
// 3. 30接続ごとのブラウザ再起動 (エラー対策)
// 4. iOS版と同じmethod取得ロジック使用
// 5. Android環境でのOS判定強化
// ========================================

// 実行
(async () => {
  const scraper = new ChobirichAndroidScraper();
  await scraper.run();
})();