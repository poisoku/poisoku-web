const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class ChobirichIOSAppScraperV2 {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.listingUrl = 'https://www.chobirich.com/smartphone?sort=point';
    this.allCampaignUrls = new Set(); // 重複排除用
    this.results = [];
    this.errors = [];
    
    // iOS ユーザーエージェント
    this.iosUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
  }

  async sleep(seconds) {
    console.log(`⏳ ${seconds}秒待機中...`);
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }

  async initBrowser() {
    console.log('🚀 ブラウザ初期化中...');
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log('✅ ブラウザ初期化完了');
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      console.log('🔐 ブラウザ終了');
    }
  }

  async setupPage() {
    const page = await this.browser.newPage();
    
    // iOS ユーザーエージェントを設定
    await page.setUserAgent(this.iosUserAgent);
    await page.setViewport({
      width: 390,
      height: 844
    });

    // リクエストヘッダーを設定
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ja-JP,ja;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': 'https://www.chobirich.com/'
    });

    return page;
  }

  async extractCampaignUrlsFromPage(pageNumber) {
    console.log(`📄 ページ ${pageNumber} から案件URLを抽出中...`);
    
    const page = await this.setupPage();
    
    try {
      const url = pageNumber === 1 
        ? this.listingUrl 
        : `${this.listingUrl}&page=${pageNumber}`;
      
      console.log(`アクセス中: ${url}`);
      
      const response = await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      if (response.status() !== 200) {
        console.log(`❌ ステータスコード: ${response.status()}`);
        return { urls: [], hasNextPage: false };
      }

      await this.sleep(2);

      // 案件URLと次ページの存在を確認
      const pageData = await page.evaluate(() => {
        const campaignUrls = [];
        
        // 案件リンクを抽出（複数のセレクタを試行）
        const selectors = [
          'a[href*="/ad_details/"]',
          '.campaign-item a',
          '.ad-item a',
          '[class*="campaign"] a[href*="/ad_details/"]',
          '[class*="ad"] a[href*="/ad_details/"]'
        ];
        
        let foundLinks = [];
        
        for (const selector of selectors) {
          const links = document.querySelectorAll(selector);
          if (links.length > 0) {
            foundLinks = Array.from(links);
            break;
          }
        }
        
        // URLを収集
        foundLinks.forEach(link => {
          const href = link.href;
          if (href && href.includes('/ad_details/')) {
            campaignUrls.push(href);
          }
        });
        
        // 次ページの存在確認
        const nextPageSelectors = [
          'a[href*="page=' + (parseInt(window.location.search.match(/page=(\d+)/)?.[1] || '1') + 1) + '"]',
          '.pagination a:contains("次")',
          '.pagination a:contains(">")',
          '.next-page',
          '[class*="next"]'
        ];
        
        let hasNextPage = false;
        for (const selector of nextPageSelectors) {
          if (document.querySelector(selector)) {
            hasNextPage = true;
            break;
          }
        }
        
        // ページ番号から判定（フォールバック）
        const currentPageText = document.body.innerText;
        const pageMatch = currentPageText.match(/(\d+)\s*\/\s*(\d+)/);
        if (pageMatch) {
          const currentPage = parseInt(pageMatch[1]);
          const totalPages = parseInt(pageMatch[2]);
          hasNextPage = currentPage < totalPages;
        }

        return {
          urls: campaignUrls,
          hasNextPage: hasNextPage,
          pageContent: document.body.innerText.substring(0, 500) // デバッグ用
        };
      });

      console.log(`📊 ページ ${pageNumber}: ${pageData.urls.length}件の案件URL抽出`);
      
      // 重複排除しながら追加
      let newUrls = 0;
      pageData.urls.forEach(url => {
        if (!this.allCampaignUrls.has(url)) {
          this.allCampaignUrls.add(url);
          newUrls++;
        }
      });
      
      console.log(`🆕 新規URL: ${newUrls}件`);
      console.log(`📈 累計URL: ${this.allCampaignUrls.size}件`);
      
      return {
        urls: pageData.urls,
        hasNextPage: pageData.hasNextPage
      };

    } catch (error) {
      console.error(`❌ ページ ${pageNumber} でエラー: ${error.message}`);
      return { urls: [], hasNextPage: false };
    } finally {
      await page.close();
    }
  }

  async extractAllCampaignUrls() {
    console.log('\n📚 全ページから案件URLを抽出開始');
    console.log('='.repeat(50));
    
    let currentPage = 1;
    let hasNextPage = true;
    
    while (hasNextPage) {
      const result = await this.extractCampaignUrlsFromPage(currentPage);
      
      if (result.urls.length === 0) {
        console.log(`📝 ページ ${currentPage}: 案件が見つからないため終了`);
        break;
      }
      
      hasNextPage = result.hasNextPage;
      currentPage++;
      
      if (hasNextPage) {
        await this.sleep(5); // ページ間の待機
      }
      
      // 安全装置（最大20ページまで）
      if (currentPage > 20) {
        console.log('⚠️ 最大ページ数に達したため終了');
        break;
      }
    }
    
    console.log(`\n🎯 抽出完了: 合計 ${this.allCampaignUrls.size} 件の案件URL`);
    return Array.from(this.allCampaignUrls);
  }

  async scrapeCampaignDetails(url) {
    const campaignId = url.match(/\/ad_details\/(?:redirect\/)?(\d+)\/?/)?.[1];
    console.log(`📱 案件 ${campaignId} の詳細取得中...`);
    
    const page = await this.setupPage();
    
    try {
      const response = await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      if (response.status() !== 200) {
        console.log(`❌ ステータスコード: ${response.status()}`);
        return null;
      }

      await this.sleep(2);

      // データ取得
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
          const match = text.match(/(\d{1,3}(?:,\d{3})*(?:ポイント|pt)?)/);
          if (match) {
            cashback = match[0];
          }
        }

        // 獲得方法
        let method = '';
        const bodyText = document.body.innerText;
        const patterns = [
          /インストール[^\n。]{0,50}/,
          /初回[^\n。]{0,50}/,
          /条件[：:]\s*([^\n]+)/,
          /獲得方法[：:]\s*([^\n]+)/
        ];
        
        for (const pattern of patterns) {
          const match = bodyText.match(pattern);
          if (match) {
            method = match[1] || match[0];
            method = method.trim().substring(0, 100);
            break;
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
          pageValid: !!title && title !== 'エラー'
        };
      });

      if (!data.pageValid) {
        console.log('❌ 無効なページ');
        return null;
      }

      const result = {
        id: campaignId,
        name: data.title,
        url: url,
        cashback: data.cashback || '不明',
        os: data.detectedOs,
        method: data.method || '不明',
        timestamp: new Date().toISOString()
      };

      console.log(`✅ ${data.title} (${data.cashback}) - OS: ${data.detectedOs}`);
      return result;

    } catch (error) {
      console.error(`❌ エラー: ${error.message}`);
      return null;
    } finally {
      await page.close();
    }
  }

  async scrapeAllCampaigns() {
    console.log('\n🔍 個別案件の詳細データ取得開始');
    console.log('='.repeat(50));
    
    const urls = Array.from(this.allCampaignUrls);
    console.log(`📊 取得対象: ${urls.length}件`);
    
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      console.log(`\n[${i + 1}/${urls.length}] ${url}`);
      
      const result = await this.scrapeCampaignDetails(url);
      if (result) {
        this.results.push(result);
      } else {
        this.errors.push({ url, error: 'データ取得失敗' });
      }
      
      // 案件間で3秒待機
      if (i < urls.length - 1) {
        await this.sleep(3);
      }
    }
  }

  async saveResults() {
    const output = {
      scrape_date: new Date().toISOString(),
      strategy: 'ios_ua_listing_pages',
      summary: {
        total_urls_found: this.allCampaignUrls.size,
        successful_scrapes: this.results.length,
        failed_scrapes: this.errors.length,
        success_rate: `${((this.results.length / this.allCampaignUrls.size) * 100).toFixed(1)}%`,
        os_breakdown: {
          ios: this.results.filter(r => r.os === 'ios').length,
          android: this.results.filter(r => r.os === 'android').length,
          both: this.results.filter(r => r.os === 'both').length,
          unknown: this.results.filter(r => r.os === 'unknown').length
        }
      },
      campaigns: this.results,
      errors: this.errors
    };

    await fs.writeFile(
      'chobirich_ios_app_campaigns_v2.json',
      JSON.stringify(output, null, 2)
    );

    console.log('\n' + '='.repeat(60));
    console.log('📊 スクレイピング完了！');
    console.log('='.repeat(60));
    console.log(`📄 発見URL数: ${this.allCampaignUrls.size}件`);
    console.log(`✅ 成功: ${this.results.length}件`);
    console.log(`❌ 失敗: ${this.errors.length}件`);
    console.log(`📈 成功率: ${output.summary.success_rate}`);
    
    console.log('\n📱 OS別内訳:');
    console.log(`iOS: ${output.summary.os_breakdown.ios}件`);
    console.log(`Android: ${output.summary.os_breakdown.android}件`);
    console.log(`両対応: ${output.summary.os_breakdown.both}件`);
    console.log(`不明: ${output.summary.os_breakdown.unknown}件`);
    
    console.log('\n💾 結果をchobirich_ios_app_campaigns_v2.jsonに保存しました');
  }

  async run() {
    try {
      await this.initBrowser();
      
      // Step 1: 全ページから案件URLを抽出
      await this.extractAllCampaignUrls();
      
      // Step 2: 各案件の詳細データを取得
      await this.scrapeAllCampaigns();
      
      // Step 3: 結果を保存
      await this.saveResults();
      
    } catch (error) {
      console.error('致命的エラー:', error);
    } finally {
      await this.closeBrowser();
    }
  }
}

// 実行
(async () => {
  console.log('🚀 ちょびリッチ iOS アプリ案件スクレイパー V2 開始\n');
  
  const scraper = new ChobirichIOSAppScraperV2();
  await scraper.run();
})();