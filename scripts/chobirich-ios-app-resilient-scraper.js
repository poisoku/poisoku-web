const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class ChobirichResilientScraper {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.listingUrl = 'https://www.chobirich.com/smartphone?sort=point';
    this.results = [];
    this.errors = [];
    this.browser = null;
    
    // エラー対策用の設定
    this.maxConnectionsPerBrowser = 40; // ブラウザ再起動の閾値
    this.connectionCount = 0;
    this.processedCount = 0;
    this.errorCount = 0;
    this.checkpointInterval = 10; // 10件ごとにチェックポイント
    
    // iOS ユーザーエージェント
    this.iosUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
  }

  async sleep(seconds) {
    console.log(`⏳ ${seconds}秒待機中...`);
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }

  async initBrowser() {
    console.log('🚀 ブラウザ初期化中...');
    
    // より安定したブラウザ設定
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // 共有メモリ不足対策
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--disable-features=VizDisplayCompositor',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-background-timer-throttling',
        '--js-flags=--max-old-space-size=2048', // メモリ拡張
        '--disable-web-security'
      ],
      timeout: 60000,
      protocolTimeout: 120000 // プロトコルタイムアウトを延長
    });
    
    this.connectionCount = 0;
    console.log('✅ ブラウザ初期化完了');
  }

  async checkBrowserHealth() {
    try {
      if (!this.browser || !this.browser.isConnected()) {
        console.log('⚠️ ブラウザ接続切断検出');
        return false;
      }
      
      // テストページを開いて動作確認
      const testPage = await this.browser.newPage();
      await testPage.goto('about:blank', { timeout: 5000 });
      await testPage.close();
      
      return true;
    } catch (error) {
      console.log('⚠️ ブラウザ健全性チェック失敗:', error.message);
      return false;
    }
  }

  async restartBrowser() {
    console.log('🔄 ブラウザを安全に再起動中...');
    
    // 既存のブラウザを閉じる
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        console.log('ブラウザクローズエラー（無視）:', error.message);
      }
      this.browser = null;
    }
    
    // ガベージコレクション待機
    await this.sleep(3);
    
    // 新しいブラウザインスタンスを起動
    await this.initBrowser();
  }

  logMemoryUsage() {
    const used = process.memoryUsage();
    console.log(`📊 メモリ: RSS=${Math.round(used.rss / 1024 / 1024)}MB, Heap=${Math.round(used.heapUsed / 1024 / 1024)}MB`);
    
    // メモリ使用量が高い場合は警告
    if (used.rss > 1.5 * 1024 * 1024 * 1024) { // 1.5GB以上
      console.log('⚠️ メモリ使用量が高い - ブラウザ再起動推奨');
      return true;
    }
    return false;
  }

  async saveCheckpoint() {
    const checkpoint = {
      timestamp: new Date().toISOString(),
      processedCount: this.processedCount,
      errorCount: this.errorCount,
      successfulResults: this.results.length,
      lastResults: this.results.slice(-5) // 直近5件のみ保存
    };
    
    await fs.writeFile(
      'chobirich_checkpoint.json',
      JSON.stringify(checkpoint, null, 2)
    );
    
    console.log(`💾 チェックポイント保存: 成功${this.results.length}件, エラー${this.errors.length}件`);
  }

  async setupPage() {
    const page = await this.browser.newPage();
    
    // タイムアウト設定
    page.setDefaultTimeout(25000);
    page.setDefaultNavigationTimeout(25000);
    
    // リソース最適化（画像や CSS を読み込まない）
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    // エラーハンドリング
    page.on('error', error => {
      console.log('ページエラー:', error.message);
    });
    
    await page.setUserAgent(this.iosUserAgent);
    await page.setViewport({ width: 390, height: 844 });
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ja-JP,ja;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': 'https://www.chobirich.com/'
    });

    return page;
  }

  convertRedirectToDirectUrl(url) {
    const redirectPattern = /\/ad_details\/redirect\/(\d+)\/?$/;
    const match = url.match(redirectPattern);
    
    if (match) {
      const campaignId = match[1];
      return `${this.baseUrl}/ad_details/${campaignId}/`;
    }
    
    return url;
  }

  isAppCampaign(title, bodyText) {
    const appKeywords = [
      'アプリ', 'app', 'インストール', 'ダウンロード', 'DL',
      'ゲーム', 'game', 'レベル', 'level', 'クリア', 'clear',
      'iOS', 'iPhone', 'iPad', 'Android', 'アンドロイド',
      'Google Play', 'App Store', 'プレイ', 'play',
      'チュートリアル', 'tutorial', 'アプリランド'
    ];
    
    const titleLower = title.toLowerCase();
    const bodyTextLower = bodyText.toLowerCase();
    
    return appKeywords.some(keyword => 
      titleLower.includes(keyword.toLowerCase()) || 
      bodyTextLower.includes(keyword.toLowerCase())
    );
  }

  async scrapeCampaignWithRecovery(url, retryCount = 0) {
    const maxRetries = 2;
    const campaignId = url.match(/\/ad_details\/(?:redirect\/)?(\d+)\/?/)?.[1];
    
    try {
      // 接続数チェック
      this.connectionCount++;
      if (this.connectionCount >= this.maxConnectionsPerBrowser) {
        console.log(`🔄 ${this.maxConnectionsPerBrowser}接続到達 - ブラウザ再起動`);
        await this.restartBrowser();
      }
      
      // ブラウザ健全性チェック
      const isHealthy = await this.checkBrowserHealth();
      if (!isHealthy) {
        await this.restartBrowser();
      }
      
      const page = await this.setupPage();
      
      try {
        const response = await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 25000 
        });
        
        if (response.status() !== 200) {
          console.log(`❌ [${campaignId}] ステータス: ${response.status()}`);
          return null;
        }

        await this.sleep(2);

        const data = await page.evaluate(() => {
          // 案件タイトル
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

          // 還元率
          let cashback = '';
          const pointElement = document.querySelector('.AdDetails__pt.ItemPtLarge');
          if (pointElement) {
            const text = pointElement.textContent.trim();
            const match = text.match(/(\d{1,3}(?:,\d{3})*(?:ちょび)?(?:ポイント|pt))/);
            if (match) {
              cashback = match[0];
            }
          }
          
          if (!cashback) {
            const pointSelectors = ['.AdDetails__pt', '[class*="point"]', '[class*="pt"]'];
            for (const selector of pointSelectors) {
              const elements = document.querySelectorAll(selector);
              for (const elem of elements) {
                const text = elem.textContent.trim();
                const patterns = [
                  /(\d{1,3}(?:,\d{3})*(?:ちょび)?(?:ポイント|pt))/,
                  /(\d+(?:\.\d+)?[%％])/
                ];
                
                for (const pattern of patterns) {
                  const match = text.match(pattern);
                  if (match) {
                    cashback = match[1] || match[0];
                    break;
                  }
                }
                if (cashback) break;
              }
              if (cashback) break;
            }
          }

          // 獲得方法
          let method = '';
          const bodyText = document.body.innerText;
          
          const methodPatterns = [
            /獲得方法[：:]\s*([^\n]+)/,
            /条件[：:]\s*([^\n]+)/,
            /達成条件[：:]\s*([^\n]+)/
          ];
          
          for (const pattern of methodPatterns) {
            const match = bodyText.match(pattern);
            if (match) {
              method = match[1].trim().substring(0, 120);
              break;
            }
          }
          
          if (!method) {
            const appPatterns = [
              /インストール[^\n。]{0,80}/,
              /レベル\s*\d+[^\n。]{0,60}/,
              /\d+日間[^\n。]{0,60}/,
              /チュートリアル[^\n。]{0,60}/,
              /初回[^\n。]{0,80}/,
              /ダウンロード[^\n。]{0,60}/
            ];
            
            for (const pattern of appPatterns) {
              const match = bodyText.match(pattern);
              if (match) {
                method = match[0].trim().substring(0, 120);
                break;
              }
            }
          }

          // OS判定
          let detectedOs = 'unknown';
          const titleLower = title.toLowerCase();
          const bodyTextLower = bodyText.toLowerCase();
          
          const androidKeywords = ['android', 'アンドロイド', 'google play'];
          const iosKeywords = ['ios', 'iphone', 'ipad', 'app store'];
          
          let isAndroid = androidKeywords.some(keyword => 
            titleLower.includes(keyword) || bodyTextLower.includes(keyword)
          );
          let isIOS = iosKeywords.some(keyword => 
            titleLower.includes(keyword) || bodyTextLower.includes(keyword)
          );
          
          if (isAndroid && isIOS) {
            detectedOs = 'both';
          } else if (isAndroid) {
            detectedOs = 'android';
          } else if (isIOS) {
            detectedOs = 'ios';
          }

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
          console.log(`❌ [${campaignId}] 無効なページ`);
          return null;
        }

        const result = {
          id: campaignId,
          name: data.title,
          url: url,
          cashback: data.cashback || '不明',
          os: data.detectedOs,
          method: data.method || '不明',
          isApp: this.isAppCampaign(data.title, data.bodyText),
          timestamp: new Date().toISOString()
        };

        const appStatus = result.isApp ? '📱 アプリ案件' : '📄 一般案件';
        console.log(`✅ [${campaignId}] ${data.title} (${data.cashback}) - ${appStatus}`);
        
        this.processedCount++;
        return result;

      } finally {
        try {
          await page.close();
        } catch (error) {
          // ページクローズエラーは無視
        }
      }

    } catch (error) {
      console.log(`❌ [${campaignId}] エラー: ${error.message}`);
      this.errorCount++;
      
      // エラー種別に応じた対処
      if (error.message.includes('Protocol error') || 
          error.message.includes('Connection closed') ||
          error.message.includes('Target closed')) {
        console.log('🔄 接続エラー検出 - ブラウザ再起動');
        await this.restartBrowser();
      }
      
      // リトライ
      if (retryCount < maxRetries) {
        console.log(`🔁 リトライ ${retryCount + 1}/${maxRetries}`);
        await this.sleep(5);
        return await this.scrapeCampaignWithRecovery(url, retryCount + 1);
      }
      
      return null;
    }
  }

  async extractUrlsFromPages(maxPages = 5) {
    console.log(`📚 ${maxPages}ページからURL抽出開始`);
    
    const allUrls = new Set();
    
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      console.log(`📄 ページ ${pageNum} 処理中...`);
      
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
          console.log(`❌ ページ ${pageNum}: ステータス ${response.status()}`);
          continue;
        }

        await this.sleep(2);

        const urls = await page.evaluate(() => {
          const links = document.querySelectorAll('a[href*="/ad_details/"]');
          return Array.from(links)
            .map(link => link.href)
            .filter(href => href && href.includes('/ad_details/'));
        });

        console.log(`📊 ページ ${pageNum}: ${urls.length}件のURL発見`);
        
        let newUrls = 0;
        urls.forEach(url => {
          const directUrl = this.convertRedirectToDirectUrl(url);
          if (!allUrls.has(directUrl)) {
            allUrls.add(directUrl);
            newUrls++;
          }
        });
        
        console.log(`🆕 新規URL: ${newUrls}件, 累計: ${allUrls.size}件`);
        
        if (pageNum < maxPages) {
          await this.sleep(3);
        }
        
      } catch (error) {
        console.error(`❌ ページ ${pageNum} でエラー: ${error.message}`);
      } finally {
        try {
          await page.close();
        } catch (error) {
          // ページクローズエラーは無視
        }
      }
    }
    
    console.log(`\n🎯 抽出完了: 合計 ${allUrls.size} 件のユニークURL`);
    return Array.from(allUrls);
  }

  async run() {
    console.log('🚀 ちょびリッチ 高耐久性アプリ案件スクレイパー開始\n');
    
    try {
      await this.initBrowser();
      
      // URL抽出（最初の5ページのみ）
      const urls = await this.extractUrlsFromPages(5);
      console.log(`\n🎯 ${urls.length}件の案件を処理開始\n`);
      
      // 各案件の詳細取得
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        console.log(`[${i + 1}/${urls.length}] ${url}`);
        
        // メモリ使用量チェック
        if (i > 0 && i % 15 === 0) {
          const needsRestart = this.logMemoryUsage();
          if (needsRestart) {
            await this.restartBrowser();
          }
        }
        
        const result = await this.scrapeCampaignWithRecovery(url);
        if (result) {
          if (result.isApp) {
            this.results.push(result);
          }
        } else {
          this.errors.push({ url, error: 'データ取得失敗' });
        }
        
        // チェックポイント保存
        if ((i + 1) % this.checkpointInterval === 0) {
          await this.saveCheckpoint();
        }
        
        // 進行状況表示
        if ((i + 1) % 20 === 0) {
          console.log(`\n📊 進行状況: ${i + 1}/${urls.length} (アプリ案件: ${this.results.length}件)\n`);
        }
        
        if (i < urls.length - 1) {
          await this.sleep(3);
        }
      }

      // 最終結果保存
      const output = {
        scrape_date: new Date().toISOString(),
        strategy: 'resilient_ios_app_scraper',
        summary: {
          total_urls: urls.length,
          processed: this.processedCount,
          app_campaigns: this.results.length,
          errors: this.errors.length,
          success_rate: `${((this.processedCount / urls.length) * 100).toFixed(1)}%`,
          app_success_rate: `${((this.results.length / this.processedCount) * 100).toFixed(1)}%`,
          os_breakdown: {
            ios: this.results.filter(r => r.os === 'ios').length,
            android: this.results.filter(r => r.os === 'android').length,
            both: this.results.filter(r => r.os === 'both').length,
            unknown: this.results.filter(r => r.os === 'unknown').length
          }
        },
        app_campaigns: this.results,
        errors: this.errors.slice(0, 10) // エラーは最初の10件のみ保存
      };

      await fs.writeFile(
        'chobirich_resilient_app_results.json',
        JSON.stringify(output, null, 2)
      );

      console.log('\n' + '='.repeat(60));
      console.log('📊 高耐久性スクレイピング完了！');
      console.log('='.repeat(60));
      console.log(`📄 総案件数: ${urls.length}件`);
      console.log(`✅ 処理成功: ${this.processedCount}件`);
      console.log(`📱 アプリ案件: ${this.results.length}件`);
      console.log(`❌ エラー: ${this.errors.length}件`);
      console.log(`📈 処理成功率: ${output.summary.success_rate}`);
      console.log(`📱 アプリ発見率: ${output.summary.app_success_rate}`);
      
      console.log('\n📱 アプリ案件のOS別内訳:');
      console.log(`iOS: ${output.summary.os_breakdown.ios}件`);
      console.log(`Android: ${output.summary.os_breakdown.android}件`);
      console.log(`両対応: ${output.summary.os_breakdown.both}件`);
      console.log(`不明: ${output.summary.os_breakdown.unknown}件`);
      
      console.log('\n💾 結果をchobirich_resilient_app_results.jsonに保存しました');

      if (this.results.length > 0) {
        console.log('\n✅ 取得成功したアプリ案件例:');
        this.results.slice(0, 10).forEach((item, index) => {
          console.log(`${index + 1}. ${item.name} (${item.cashback}) - OS: ${item.os}`);
        });
      }
      
    } catch (error) {
      console.error('致命的エラー:', error);
      await this.saveCheckpoint(); // エラー時もチェックポイント保存
    } finally {
      if (this.browser) {
        try {
          await this.browser.close();
        } catch (error) {
          console.log('ブラウザクローズエラー:', error.message);
        }
      }
    }
  }
}

// 実行
(async () => {
  const scraper = new ChobirichResilientScraper();
  await scraper.run();
})();