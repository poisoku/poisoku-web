const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class ChobirichIOSAppScraperV3 {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.listingUrl = 'https://www.chobirich.com/smartphone?sort=point';
    this.results = [];
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

  // redirect URLを直接URLに変換する機能
  convertRedirectToDirectUrl(url) {
    // https://www.chobirich.com/ad_details/redirect/1837310/ 
    // → https://www.chobirich.com/ad_details/1837310/
    
    const redirectPattern = /\/ad_details\/redirect\/(\d+)\/?$/;
    const match = url.match(redirectPattern);
    
    if (match) {
      const campaignId = match[1];
      const directUrl = `${this.baseUrl}/ad_details/${campaignId}/`;
      console.log(`🔄 redirect URL変換: ${campaignId} → 直接URL`);
      return directUrl;
    }
    
    return url; // 既に直接URLの場合はそのまま
  }

  async extractSampleUrls() {
    console.log('📄 サンプル案件URLを抽出中...');
    
    const page = await this.setupPage();
    
    try {
      await page.goto(this.listingUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      await this.sleep(2);

      const urls = await page.evaluate(() => {
        const links = document.querySelectorAll('a[href*="/ad_details/"]');
        return Array.from(links)
          .map(link => link.href)
          .filter(href => href && href.includes('/ad_details/'))
          .slice(0, 15); // 15件のサンプル
      });

      console.log(`📊 ${urls.length}件のサンプルURL抽出完了`);
      
      // redirect URLを直接URLに変換
      const convertedUrls = urls.map(url => this.convertRedirectToDirectUrl(url));
      
      console.log(`🔄 URL変換完了`);
      return convertedUrls;

    } finally {
      await page.close();
    }
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

        // 還元率（より詳細に検索）
        let cashback = '';
        
        // メインのポイント表示要素
        const pointElement = document.querySelector('.AdDetails__pt.ItemPtLarge');
        if (pointElement) {
          const text = pointElement.textContent.trim();
          const match = text.match(/(\d{1,3}(?:,\d{3})*(?:ちょび)?(?:ポイント|pt))/);
          if (match) {
            cashback = match[0];
          }
        }
        
        // フォールバック：他のポイント表示要素を探す
        if (!cashback) {
          const pointSelectors = [
            '.AdDetails__pt',
            '[class*="point"]',
            '[class*="pt"]',
            '.campaign-point'
          ];
          
          for (const selector of pointSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const elem of elements) {
              const text = elem.textContent.trim();
              const patterns = [
                /(\d{1,3}(?:,\d{3})*(?:ちょび)?(?:ポイント|pt))/,
                /(\d+(?:\.\d+)?[%％])/,
                /最大(\d{1,3}(?:,\d{3})*)/
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

        // 獲得方法（より詳細に検索）
        let method = '';
        const bodyText = document.body.innerText;
        
        // パターン1: 明示的な獲得方法の記載
        const methodPatterns = [
          /獲得方法[：:]\s*([^\n]+)/,
          /条件[：:]\s*([^\n]+)/,
          /達成条件[：:]\s*([^\n]+)/
        ];
        
        for (const pattern of methodPatterns) {
          const match = bodyText.match(pattern);
          if (match) {
            method = match[1].trim().substring(0, 100);
            break;
          }
        }
        
        // パターン2: よくある獲得条件パターン
        if (!method) {
          const commonPatterns = [
            /インストール[^\n。]{0,60}/,
            /初回[^\n。]{0,60}/,
            /レベル\s*\d+[^\n。]{0,40}/,
            /\d+日間[^\n。]{0,40}/,
            /チュートリアル[^\n。]{0,40}/,
            /登録[^\n。]{0,40}/
          ];
          
          for (const pattern of commonPatterns) {
            const match = bodyText.match(pattern);
            if (match) {
              method = match[0].trim().substring(0, 100);
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
          pageValid: !!title && title !== 'エラー',
          debugInfo: {
            hasPointElement: !!document.querySelector('.AdDetails__pt.ItemPtLarge'),
            bodyTextLength: bodyText.length
          }
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

  async run() {
    console.log('🚀 ちょびリッチ iOS アプリ案件スクレイパー V3（redirect対応版）\n');
    
    try {
      // ブラウザ初期化
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      // サンプルURL抽出（redirect → 直接URL変換含む）
      const urls = await this.extractSampleUrls();
      console.log(`\n🎯 ${urls.length}件のサンプル案件を処理します\n`);
      
      // 各案件の詳細取得
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        console.log(`[${i + 1}/${urls.length}] ${url}`);
        
        const result = await this.scrapeCampaignDetails(url);
        if (result) {
          this.results.push(result);
        } else {
          this.errors.push({ url, error: 'データ取得失敗' });
        }
        
        if (i < urls.length - 1) {
          await this.sleep(3);
        }
      }

      // 結果保存
      const output = {
        scrape_date: new Date().toISOString(),
        strategy: 'ios_ua_redirect_conversion',
        summary: {
          total_urls: urls.length,
          successful: this.results.length,
          failed: this.errors.length,
          success_rate: `${((this.results.length / urls.length) * 100).toFixed(1)}%`,
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
        'chobirich_ios_redirect_conversion_results.json',
        JSON.stringify(output, null, 2)
      );

      console.log('\n' + '='.repeat(50));
      console.log('📊 redirect対応版テスト完了！');
      console.log('='.repeat(50));
      console.log(`📄 総件数: ${urls.length}件`);
      console.log(`✅ 成功: ${this.results.length}件`);
      console.log(`❌ 失敗: ${this.errors.length}件`);
      console.log(`📈 成功率: ${output.summary.success_rate}`);
      
      console.log('\n📱 OS別内訳:');
      console.log(`iOS: ${output.summary.os_breakdown.ios}件`);
      console.log(`Android: ${output.summary.os_breakdown.android}件`);
      console.log(`両対応: ${output.summary.os_breakdown.both}件`);
      console.log(`不明: ${output.summary.os_breakdown.unknown}件`);
      
      console.log('\n💾 結果をchobirich_ios_redirect_conversion_results.jsonに保存しました');

      if (this.results.length > 0) {
        console.log('\n✅ 取得成功した案件例:');
        this.results.slice(0, 10).forEach((item, index) => {
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
  const scraper = new ChobirichIOSAppScraperV3();
  await scraper.run();
})();