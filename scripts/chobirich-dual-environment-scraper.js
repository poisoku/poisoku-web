const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const crypto = require('crypto');

/**
 * ちょびリッチ デュアル環境スクレイピングシステム
 * iOS環境とAndroid環境で別々にスクレイピングを実行し、
 * それぞれのデバイス固有案件を取得して統合する
 */
class ChobirichDualEnvironmentScraper {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.listingUrl = 'https://www.chobirich.com/smartphone?sort=point';
    
    // 結果保存用
    this.iosResults = [];
    this.androidResults = [];
    this.combinedResults = [];
    
    // エラー管理
    this.iosErrors = [];
    this.androidErrors = [];
    
    // 統計情報
    this.stats = {
      ios: { processed: 0, found: 0, errors: 0 },
      android: { processed: 0, found: 0, errors: 0 },
      combined: { total: 0, duplicates: 0, unique: 0 }
    };
    
    // ブラウザ管理
    this.iosBrowser = null;
    this.androidBrowser = null;
    this.maxConnectionsPerBrowser = 25;
    this.iosConnectionCount = 0;
    this.androidConnectionCount = 0;
    
    // User Agents
    this.iosUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
    this.androidUserAgent = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36';
  }

  async delay(seconds) {
    console.log(`⏳ ${seconds}秒待機中...`);
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }

  // iOS環境ブラウザ初期化
  async initIOSBrowser() {
    console.log('📱 iOS環境ブラウザ初期化中...');
    
    this.iosBrowser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--js-flags=--max-old-space-size=2048'
      ],
      timeout: 60000
    });
    
    this.iosConnectionCount = 0;
    console.log('✅ iOS環境ブラウザ初期化完了');
  }

  // Android環境ブラウザ初期化
  async initAndroidBrowser() {
    console.log('🤖 Android環境ブラウザ初期化中...');
    
    this.androidBrowser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--js-flags=--max-old-space-size=2048'
      ],
      timeout: 60000
    });
    
    this.androidConnectionCount = 0;
    console.log('✅ Android環境ブラウザ初期化完了');
  }

  // iOS環境ページセットアップ
  async setupIOSPage() {
    const page = await this.iosBrowser.newPage();
    
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);
    
    await page.setUserAgent(this.iosUserAgent);
    await page.setViewport({ width: 375, height: 812, isMobile: true });
    
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ja-JP,ja;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache'
    });
    
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

    return page;
  }

  // Android環境ページセットアップ
  async setupAndroidPage() {
    const page = await this.androidBrowser.newPage();
    
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);
    
    await page.setUserAgent(this.androidUserAgent);
    await page.setViewport({ width: 412, height: 915, isMobile: true });
    
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ja-JP,ja;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache'
    });
    
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

    return page;
  }

  // リダイレクトURL変換
  convertRedirectToDirectUrl(url) {
    const redirectPattern = /\/ad_details\/redirect\/(\d+)\/?$/;
    const match = url.match(redirectPattern);
    
    if (match) {
      return `${this.baseUrl}/ad_details/${match[1]}/`;
    }
    
    return url;
  }

  // アプリ案件判定
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

  // iOS環境での全URL抽出
  async extractIOSUrls() {
    console.log('📱 iOS環境: 全ページからURL抽出開始');
    
    const allUrls = new Set();
    let pageNum = 1;
    let hasMorePages = true;
    
    while (hasMorePages && pageNum <= 30) {
      console.log(`📄 iOSページ ${pageNum} 処理中...`);
      
      const page = await this.setupIOSPage();
      
      try {
        const url = pageNum === 1 
          ? this.listingUrl 
          : `${this.listingUrl}&page=${pageNum}`;
        
        const response = await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        });
        
        if (response.status() !== 200) {
          console.log(`❌ iOSページ ${pageNum}: ステータス ${response.status()}`);
          hasMorePages = false;
          continue;
        }

        await this.delay(2);

        const pageData = await page.evaluate(() => {
          const links = document.querySelectorAll('a[href*="/ad_details/"]');
          const urls = Array.from(links)
            .map(link => link.href)
            .filter(href => href && href.includes('/ad_details/'));
          
          // 次ページの存在確認
          const hasNext = !!document.querySelector(`a[href*="page=${parseInt(window.location.search.match(/page=(\d+)/)?.[1] || '1') + 1}"]`);
          
          return { urls, hasNext };
        });

        if (pageData.urls.length === 0) {
          console.log(`📝 iOSページ ${pageNum}: 案件なし - 終了`);
          hasMorePages = false;
          continue;
        }

        console.log(`📊 iOSページ ${pageNum}: ${pageData.urls.length}件のURL発見`);
        
        let newUrls = 0;
        pageData.urls.forEach(url => {
          const directUrl = this.convertRedirectToDirectUrl(url);
          if (!allUrls.has(directUrl)) {
            allUrls.add(directUrl);
            newUrls++;
          }
        });
        
        console.log(`🆕 iOS新規: ${newUrls}件, 累計: ${allUrls.size}件`);
        
        hasMorePages = pageData.hasNext;
        pageNum++;
        
        if (hasMorePages) {
          await this.delay(3);
        }
        
      } catch (error) {
        console.error(`❌ iOSページ ${pageNum} エラー: ${error.message}`);
        hasMorePages = false;
      } finally {
        await page.close();
      }
    }
    
    console.log(`🎯 iOS環境URL抽出完了: 合計 ${allUrls.size} 件`);
    return Array.from(allUrls);
  }

  // Android環境での全URL抽出
  async extractAndroidUrls() {
    console.log('🤖 Android環境: 全ページからURL抽出開始');
    
    const allUrls = new Set();
    let pageNum = 1;
    let hasMorePages = true;
    
    while (hasMorePages && pageNum <= 30) {
      console.log(`📄 Androidページ ${pageNum} 処理中...`);
      
      const page = await this.setupAndroidPage();
      
      try {
        const url = pageNum === 1 
          ? this.listingUrl 
          : `${this.listingUrl}&page=${pageNum}`;
        
        const response = await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        });
        
        if (response.status() !== 200) {
          console.log(`❌ Androidページ ${pageNum}: ステータス ${response.status()}`);
          hasMorePages = false;
          continue;
        }

        await this.delay(2);

        const pageData = await page.evaluate(() => {
          const links = document.querySelectorAll('a[href*="/ad_details/"]');
          const urls = Array.from(links)
            .map(link => link.href)
            .filter(href => href && href.includes('/ad_details/'));
          
          // 次ページの存在確認
          const hasNext = !!document.querySelector(`a[href*="page=${parseInt(window.location.search.match(/page=(\d+)/)?.[1] || '1') + 1}"]`);
          
          return { urls, hasNext };
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
        
        console.log(`🆕 Android新規: ${newUrls}件, 累計: ${allUrls.size}件`);
        
        hasMorePages = pageData.hasNext;
        pageNum++;
        
        if (hasMorePages) {
          await this.delay(3);
        }
        
      } catch (error) {
        console.error(`❌ Androidページ ${pageNum} エラー: ${error.message}`);
        hasMorePages = false;
      } finally {
        await page.close();
      }
    }
    
    console.log(`🎯 Android環境URL抽出完了: 合計 ${allUrls.size} 件`);
    return Array.from(allUrls);
  }

  // iOS環境での案件処理
  async processIOSCampaign(url) {
    const campaignId = url.match(/\/ad_details\/(?:redirect\/)?(\d+)\/?/)?.[1];
    
    try {
      this.iosConnectionCount++;
      if (this.iosConnectionCount >= this.maxConnectionsPerBrowser) {
        console.log(`🔄 iOS: ${this.maxConnectionsPerBrowser}接続到達 - ブラウザ再起動`);
        await this.iosBrowser.close();
        await this.initIOSBrowser();
      }
      
      const page = await this.setupIOSPage();
      
      try {
        const response = await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        });
        
        if (response.status() !== 200) {
          return null;
        }

        await this.delay(1);

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
          
          // method取得ロジック
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

          // OS判定（iOS環境）
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
          else detectedOs = 'ios'; // iOS環境でアクセスしているため、明示がない場合はiosとする

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
            environment: 'ios',
            timestamp: new Date().toISOString()
          };

          console.log(`✅ [iOS-${campaignId}] ${data.title} (${data.cashback}) - ${data.detectedOs}`);
          this.stats.ios.processed++;
          return result;
        }

        this.stats.ios.processed++;
        return null;

      } finally {
        await page.close();
      }

    } catch (error) {
      console.log(`❌ [iOS-${campaignId}] エラー: ${error.message}`);
      this.stats.ios.errors++;
      this.iosErrors.push(`${campaignId}: ${error.message}`);
      return null;
    }
  }

  // Android環境での案件処理
  async processAndroidCampaign(url) {
    const campaignId = url.match(/\/ad_details\/(?:redirect\/)?(\d+)\/?/)?.[1];
    
    try {
      this.androidConnectionCount++;
      if (this.androidConnectionCount >= this.maxConnectionsPerBrowser) {
        console.log(`🔄 Android: ${this.maxConnectionsPerBrowser}接続到達 - ブラウザ再起動`);
        await this.androidBrowser.close();
        await this.initAndroidBrowser();
      }
      
      const page = await this.setupAndroidPage();
      
      try {
        const response = await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        });
        
        if (response.status() !== 200) {
          return null;
        }

        await this.delay(1);

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
          
          // method取得ロジック（iOS版と同じ）
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

          // OS判定（Android環境）
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
            environment: 'android',
            timestamp: new Date().toISOString()
          };

          console.log(`✅ [Android-${campaignId}] ${data.title} (${data.cashback}) - ${data.detectedOs}`);
          this.stats.android.processed++;
          return result;
        }

        this.stats.android.processed++;
        return null;

      } finally {
        await page.close();
      }

    } catch (error) {
      console.log(`❌ [Android-${campaignId}] エラー: ${error.message}`);
      this.stats.android.errors++;
      this.androidErrors.push(`${campaignId}: ${error.message}`);
      return null;
    }
  }

  // 重複除去と統合
  combineResults() {
    console.log('\n🔗 iOS・Android結果の統合処理開始');
    
    const seenIds = new Set();
    const duplicateIds = new Set();
    
    // iOS結果を追加
    this.iosResults.forEach(campaign => {
      if (seenIds.has(campaign.id)) {
        duplicateIds.add(campaign.id);
      } else {
        seenIds.add(campaign.id);
      }
      this.combinedResults.push(campaign);
    });
    
    // Android結果を追加（重複IDでも別案件として扱う）
    this.androidResults.forEach(campaign => {
      if (seenIds.has(campaign.id)) {
        duplicateIds.add(campaign.id);
        // 重複IDの場合は環境情報を付与
        campaign.duplicate_id = true;
      } else {
        seenIds.add(campaign.id);
      }
      this.combinedResults.push(campaign);
    });
    
    this.stats.combined.total = this.combinedResults.length;
    this.stats.combined.duplicates = duplicateIds.size;
    this.stats.combined.unique = seenIds.size;
    
    console.log(`📊 統合結果: 総数${this.stats.combined.total}件 (重複ID: ${this.stats.combined.duplicates}件, ユニークID: ${this.stats.combined.unique}件)`);
  }

  // 結果保存
  async saveResults() {
    // iOS結果保存
    const iosOutput = {
      scrape_date: new Date().toISOString(),
      strategy: 'dual_environment_ios',
      environment: 'ios',
      summary: {
        total_processed: this.stats.ios.processed,
        app_campaigns_found: this.iosResults.length,
        errors: this.stats.ios.errors,
        os_breakdown: {
          ios: this.iosResults.filter(r => r.os === 'ios').length,
          android: this.iosResults.filter(r => r.os === 'android').length,
          both: this.iosResults.filter(r => r.os === 'both').length,
          unknown: this.iosResults.filter(r => r.os === 'unknown').length
        }
      },
      app_campaigns: this.iosResults
    };

    await fs.writeFile(
      'chobirich_dual_ios_campaigns.json',
      JSON.stringify(iosOutput, null, 2)
    );

    // Android結果保存
    const androidOutput = {
      scrape_date: new Date().toISOString(),
      strategy: 'dual_environment_android',
      environment: 'android',
      summary: {
        total_processed: this.stats.android.processed,
        app_campaigns_found: this.androidResults.length,
        errors: this.stats.android.errors,
        os_breakdown: {
          ios: this.androidResults.filter(r => r.os === 'ios').length,
          android: this.androidResults.filter(r => r.os === 'android').length,
          both: this.androidResults.filter(r => r.os === 'both').length,
          unknown: this.androidResults.filter(r => r.os === 'unknown').length
        }
      },
      app_campaigns: this.androidResults
    };

    await fs.writeFile(
      'chobirich_dual_android_campaigns.json',
      JSON.stringify(androidOutput, null, 2)
    );

    // 統合結果保存
    const combinedOutput = {
      scrape_date: new Date().toISOString(),
      strategy: 'dual_environment_combined',
      summary: {
        ios_campaigns: this.iosResults.length,
        android_campaigns: this.androidResults.length,
        total_campaigns: this.stats.combined.total,
        unique_ids: this.stats.combined.unique,
        duplicate_ids: this.stats.combined.duplicates,
        os_breakdown: {
          ios: this.combinedResults.filter(r => r.os === 'ios').length,
          android: this.combinedResults.filter(r => r.os === 'android').length,
          both: this.combinedResults.filter(r => r.os === 'both').length,
          unknown: this.combinedResults.filter(r => r.os === 'unknown').length
        },
        environment_breakdown: {
          ios_environment: this.combinedResults.filter(r => r.environment === 'ios').length,
          android_environment: this.combinedResults.filter(r => r.environment === 'android').length
        }
      },
      app_campaigns: this.combinedResults
    };

    await fs.writeFile(
      'chobirich_dual_environment_combined.json',
      JSON.stringify(combinedOutput, null, 2)
    );

    console.log('💾 結果保存完了:');
    console.log('  - chobirich_dual_ios_campaigns.json');
    console.log('  - chobirich_dual_android_campaigns.json');
    console.log('  - chobirich_dual_environment_combined.json');
  }

  // メイン実行
  async run() {
    console.log('🚀 ちょびリッチ デュアル環境スクレイピング開始\n');
    console.log('='.repeat(80));
    console.log('目的: iOS・Android両環境でアプリ案件を取得し、デバイス固有案件を発見');
    console.log('戦略: 同一IDでも環境別に別案件として扱い、検索結果に両方表示');
    console.log('='.repeat(80));
    
    try {
      // 1. ブラウザ初期化
      await this.initIOSBrowser();
      await this.initAndroidBrowser();

      // 2. URL抽出
      console.log('\n📚 フェーズ1: URL抽出');
      const iosUrls = await this.extractIOSUrls();
      await this.delay(5);
      const androidUrls = await this.extractAndroidUrls();

      // 3. iOS環境での案件処理
      console.log('\n📱 フェーズ2: iOS環境での案件処理');
      console.log(`処理対象: ${iosUrls.length}件\n`);
      
      for (let i = 0; i < iosUrls.length; i++) {
        console.log(`[iOS ${i + 1}/${iosUrls.length}]`);
        
        const result = await this.processIOSCampaign(iosUrls[i]);
        if (result) {
          this.iosResults.push(result);
          this.stats.ios.found++;
        }
        
        if ((i + 1) % 20 === 0) {
          console.log(`📊 iOS進捗: ${i + 1}/${iosUrls.length} (アプリ: ${this.iosResults.length}件)\n`);
        }
        
        if (i < iosUrls.length - 1) {
          await this.delay(2);
        }
      }

      // 4. Android環境での案件処理
      console.log('\n🤖 フェーズ3: Android環境での案件処理');
      console.log(`処理対象: ${androidUrls.length}件\n`);
      
      for (let i = 0; i < androidUrls.length; i++) {
        console.log(`[Android ${i + 1}/${androidUrls.length}]`);
        
        const result = await this.processAndroidCampaign(androidUrls[i]);
        if (result) {
          this.androidResults.push(result);
          this.stats.android.found++;
        }
        
        if ((i + 1) % 20 === 0) {
          console.log(`📊 Android進捗: ${i + 1}/${androidUrls.length} (アプリ: ${this.androidResults.length}件)\n`);
        }
        
        if (i < androidUrls.length - 1) {
          await this.delay(2);
        }
      }

      // 5. 結果統合
      this.combineResults();

      // 6. 結果保存
      await this.saveResults();

      // 7. 最終レポート
      this.showFinalReport();

    } catch (error) {
      console.error('💥 致命的エラー:', error);
    } finally {
      // ブラウザクリーンアップ
      if (this.iosBrowser) {
        try {
          await this.iosBrowser.close();
        } catch (error) {
          console.error('iOS browser close error:', error);
        }
      }
      
      if (this.androidBrowser) {
        try {
          await this.androidBrowser.close();
        } catch (error) {
          console.error('Android browser close error:', error);
        }
      }
    }
  }

  // 最終レポート表示
  showFinalReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 デュアル環境スクレイピング最終レポート');
    console.log('='.repeat(80));
    
    console.log('\n📱 iOS環境結果:');
    console.log(`  処理数: ${this.stats.ios.processed}件`);
    console.log(`  アプリ案件: ${this.iosResults.length}件`);
    console.log(`  エラー: ${this.stats.ios.errors}件`);
    
    const iosOsCounts = {
      ios: this.iosResults.filter(r => r.os === 'ios').length,
      android: this.iosResults.filter(r => r.os === 'android').length,
      both: this.iosResults.filter(r => r.os === 'both').length,
      unknown: this.iosResults.filter(r => r.os === 'unknown').length
    };
    console.log(`  OS内訳: iOS ${iosOsCounts.ios}件, Android ${iosOsCounts.android}件, 両対応 ${iosOsCounts.both}件, 不明 ${iosOsCounts.unknown}件`);
    
    console.log('\n🤖 Android環境結果:');
    console.log(`  処理数: ${this.stats.android.processed}件`);
    console.log(`  アプリ案件: ${this.androidResults.length}件`);
    console.log(`  エラー: ${this.stats.android.errors}件`);
    
    const androidOsCounts = {
      ios: this.androidResults.filter(r => r.os === 'ios').length,
      android: this.androidResults.filter(r => r.os === 'android').length,
      both: this.androidResults.filter(r => r.os === 'both').length,
      unknown: this.androidResults.filter(r => r.os === 'unknown').length
    };
    console.log(`  OS内訳: iOS ${androidOsCounts.ios}件, Android ${androidOsCounts.android}件, 両対応 ${androidOsCounts.both}件, 不明 ${androidOsCounts.unknown}件`);
    
    console.log('\n🔗 統合結果:');
    console.log(`  総案件数: ${this.stats.combined.total}件`);
    console.log(`  ユニークID: ${this.stats.combined.unique}件`);
    console.log(`  重複ID: ${this.stats.combined.duplicates}件`);
    
    const combinedOsCounts = {
      ios: this.combinedResults.filter(r => r.os === 'ios').length,
      android: this.combinedResults.filter(r => r.os === 'android').length,
      both: this.combinedResults.filter(r => r.os === 'both').length,
      unknown: this.combinedResults.filter(r => r.os === 'unknown').length
    };
    console.log(`  統合OS内訳: iOS ${combinedOsCounts.ios}件, Android ${combinedOsCounts.android}件, 両対応 ${combinedOsCounts.both}件, 不明 ${combinedOsCounts.unknown}件`);
    
    // 環境別の発見案件比較
    const iosOnlyIds = new Set(this.iosResults.map(r => r.id));
    const androidOnlyIds = new Set(this.androidResults.map(r => r.id));
    const iosExclusive = this.iosResults.filter(r => !androidOnlyIds.has(r.id));
    const androidExclusive = this.androidResults.filter(r => !iosOnlyIds.has(r.id));
    
    console.log('\n🎯 環境固有案件分析:');
    console.log(`  iOS専用発見: ${iosExclusive.length}件`);
    console.log(`  Android専用発見: ${androidExclusive.length}件`);
    
    if (iosExclusive.length > 0) {
      console.log('\n📱 iOS専用案件例:');
      iosExclusive.slice(0, 3).forEach((campaign, i) => {
        console.log(`  ${i + 1}. [${campaign.id}] ${campaign.name.substring(0, 50)}... (${campaign.os})`);
      });
    }
    
    if (androidExclusive.length > 0) {
      console.log('\n🤖 Android専用案件例:');
      androidExclusive.slice(0, 3).forEach((campaign, i) => {
        console.log(`  ${i + 1}. [${campaign.id}] ${campaign.name.substring(0, 50)}... (${campaign.os})`);
      });
    }
    
    console.log('\n✅ デュアル環境スクレイピング完了！');
    console.log('次のステップ: データベース統合とポイ速への反映');
  }
}

// ========================================
// ちょびリッチ デュアル環境スクレイピングシステム
// ========================================
// 目的: iOS・Android両環境で案件を取得し、デバイス固有案件を発見
// 戦略: 同一IDでも環境別に別案件として扱い、検索結果の充実化
// 出力: 環境別ファイル + 統合ファイル
// ========================================

// 実行
(async () => {
  const scraper = new ChobirichDualEnvironmentScraper();
  await scraper.run();
})();