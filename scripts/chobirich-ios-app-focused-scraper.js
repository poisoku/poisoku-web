const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class ChobirichIOSAppFocusedScraper {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.listingUrl = 'https://www.chobirich.com/smartphone?sort=point';
    this.allUrls = new Set();
    this.appCampaigns = [];
    this.nonAppCampaigns = [];
    this.errors = [];
    
    // iOS ユーザーエージェント
    this.iosUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
  }

  async sleep(seconds) {
    console.log(`⏳ ${seconds}秒待機中...`);
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }

  async setupPage() {
    const page = await this.browser.newPage();
    
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

  // redirect URLを直接URLに変換
  convertRedirectToDirectUrl(url) {
    const redirectPattern = /\/ad_details\/redirect\/(\d+)\/?$/;
    const match = url.match(redirectPattern);
    
    if (match) {
      const campaignId = match[1];
      return `${this.baseUrl}/ad_details/${campaignId}/`;
    }
    
    return url;
  }

  // アプリ案件かどうかを判定
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

  async extractUrlsFromMultiplePages() {
    console.log('📚 複数ページからアプリ案件URLを抽出開始');
    console.log('='.repeat(50));
    
    const maxPages = 10; // 最初の10ページをスキャン
    
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      console.log(`📄 ページ ${pageNum} から案件URLを抽出中...`);
      
      const page = await this.setupPage();
      
      try {
        const url = pageNum === 1 
          ? this.listingUrl 
          : `${this.listingUrl}&page=${pageNum}`;
        
        const response = await page.goto(url, { 
          waitUntil: 'networkidle2',
          timeout: 30000 
        });
        
        if (response.status() !== 200) {
          console.log(`❌ ページ ${pageNum}: ステータスコード ${response.status()}`);
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
        
        // redirect URLを直接URLに変換して追加
        let newUrls = 0;
        urls.forEach(url => {
          const directUrl = this.convertRedirectToDirectUrl(url);
          if (!this.allUrls.has(directUrl)) {
            this.allUrls.add(directUrl);
            newUrls++;
          }
        });
        
        console.log(`🆕 新規URL: ${newUrls}件, 累計: ${this.allUrls.size}件`);
        
        // ページ間で待機
        if (pageNum < maxPages) {
          await this.sleep(5);
        }
        
      } catch (error) {
        console.error(`❌ ページ ${pageNum} でエラー: ${error.message}`);
      } finally {
        await page.close();
      }
    }
    
    console.log(`\n🎯 抽出完了: 合計 ${this.allUrls.size} 件のユニークURL`);
    return Array.from(this.allUrls);
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
        
        // フォールバック: 他のポイント表示要素
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
        
        // 明示的な獲得方法
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
        
        // よくあるアプリ案件の条件パターン
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
        isApp: this.isAppCampaign(data.title, data.bodyText),
        timestamp: new Date().toISOString()
      };

      const appStatus = result.isApp ? '📱 アプリ案件' : '📄 一般案件';
      console.log(`✅ ${data.title} (${data.cashback}) - OS: ${data.detectedOs} - ${appStatus}`);
      
      return result;

    } catch (error) {
      console.error(`❌ エラー: ${error.message}`);
      return null;
    } finally {
      await page.close();
    }
  }

  async run() {
    console.log('🚀 ちょびリッチ アプリ案件特化スクレイパー開始\n');
    
    try {
      // ブラウザ初期化
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      // 複数ページからURL抽出
      const urls = await this.extractUrlsFromMultiplePages();
      console.log(`\n🎯 ${urls.length}件の案件を処理します\n`);
      
      // 各案件の詳細取得
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        console.log(`[${i + 1}/${urls.length}] ${url}`);
        
        const result = await this.scrapeCampaignDetails(url);
        if (result) {
          if (result.isApp) {
            this.appCampaigns.push(result);
          } else {
            this.nonAppCampaigns.push(result);
          }
        } else {
          this.errors.push({ url, error: 'データ取得失敗' });
        }
        
        // 進行状況表示
        if ((i + 1) % 20 === 0) {
          console.log(`\n📊 進行状況: ${i + 1}/${urls.length} (アプリ案件: ${this.appCampaigns.length}件)\n`);
        }
        
        // 案件間で3秒待機
        if (i < urls.length - 1) {
          await this.sleep(3);
        }
      }

      // 結果保存
      const output = {
        scrape_date: new Date().toISOString(),
        strategy: 'ios_ua_app_focused',
        summary: {
          total_urls: urls.length,
          total_successful: this.appCampaigns.length + this.nonAppCampaigns.length,
          app_campaigns: this.appCampaigns.length,
          non_app_campaigns: this.nonAppCampaigns.length,
          failed: this.errors.length,
          success_rate: `${(((this.appCampaigns.length + this.nonAppCampaigns.length) / urls.length) * 100).toFixed(1)}%`,
          app_os_breakdown: {
            ios: this.appCampaigns.filter(r => r.os === 'ios').length,
            android: this.appCampaigns.filter(r => r.os === 'android').length,
            both: this.appCampaigns.filter(r => r.os === 'both').length,
            unknown: this.appCampaigns.filter(r => r.os === 'unknown').length
          }
        },
        app_campaigns: this.appCampaigns,
        non_app_campaigns: this.nonAppCampaigns.slice(0, 10), // 一般案件は最初の10件のみ保存
        errors: this.errors
      };

      await fs.writeFile(
        'chobirich_ios_app_focused_results.json',
        JSON.stringify(output, null, 2)
      );

      console.log('\n' + '='.repeat(60));
      console.log('📊 アプリ案件特化スクレイピング完了！');
      console.log('='.repeat(60));
      console.log(`📄 総案件数: ${urls.length}件`);
      console.log(`✅ 成功: ${output.summary.total_successful}件`);
      console.log(`📱 アプリ案件: ${this.appCampaigns.length}件`);
      console.log(`📄 一般案件: ${this.nonAppCampaigns.length}件`);
      console.log(`❌ 失敗: ${this.errors.length}件`);
      console.log(`📈 成功率: ${output.summary.success_rate}`);
      
      console.log('\n📱 アプリ案件のOS別内訳:');
      console.log(`iOS: ${output.summary.app_os_breakdown.ios}件`);
      console.log(`Android: ${output.summary.app_os_breakdown.android}件`);
      console.log(`両対応: ${output.summary.app_os_breakdown.both}件`);
      console.log(`不明: ${output.summary.app_os_breakdown.unknown}件`);
      
      console.log('\n💾 結果をchobirich_ios_app_focused_results.jsonに保存しました');

      if (this.appCampaigns.length > 0) {
        console.log('\n✅ 取得成功したアプリ案件例:');
        this.appCampaigns.slice(0, 10).forEach((item, index) => {
          console.log(`${index + 1}. ${item.name} (${item.cashback}) - OS: ${item.os}`);
          console.log(`   条件: ${item.method}`);
        });
      }
      
    } catch (error) {
      console.error('致命的エラー:', error);
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

// 実行
(async () => {
  const scraper = new ChobirichIOSAppFocusedScraper();
  await scraper.run();
})();