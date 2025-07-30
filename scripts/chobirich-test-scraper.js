const puppeteer = require('puppeteer');
const fs = require('fs').promises;

/**
 * ちょびリッチテストスクレイパー
 * 各カテゴリから3件ずつランダムに取得
 */
class ChobirichTestScraper {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.results = {};
    this.browser = null;
    
    // iOS ユーザーエージェント
    this.iosUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
    
    // テスト用カテゴリ定義（各3件のみ）
    this.testCategories = {
      shopping: {
        name: 'ショッピング',
        url: `${this.baseUrl}/shopping/shop/101`,
        sampleSize: 3
      },
      service: {
        name: 'サービス',
        url: `${this.baseUrl}/service/`,
        sampleSize: 3
      },
      app: {
        name: 'アプリ',
        url: `${this.baseUrl}/smartphone?sort=point`,
        sampleSize: 3
      },
      creditcard: {
        name: 'クレジットカード',
        url: `${this.baseUrl}/creditcard/`,
        sampleSize: 3
      }
    };
  }

  async randomDelay(minSeconds, maxSeconds) {
    const delay = Math.random() * (maxSeconds - minSeconds) + minSeconds;
    console.log(`⏳ ${delay.toFixed(1)}秒待機中...`);
    await new Promise(resolve => setTimeout(resolve, delay * 1000));
  }

  async initBrowser() {
    console.log('🚀 ブラウザ初期化中...');
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });
    
    console.log('✅ ブラウザ初期化完了');
  }

  async setupPage() {
    const page = await this.browser.newPage();
    
    // タイムアウト設定
    page.setDefaultTimeout(30000);
    
    // ユーザーエージェント設定
    await page.setUserAgent(this.iosUserAgent);
    
    // ヘッダー設定
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

  convertRedirectToDirectUrl(url) {
    const redirectPattern = /\/ad_details\/redirect\/(\d+)\/?$/;
    const match = url.match(redirectPattern);
    
    if (match) {
      return `${this.baseUrl}/ad_details/${match[1]}/`;
    }
    
    return url;
  }

  async extractUrlsFromCategory(categoryUrl, sampleSize) {
    const page = await this.setupPage();
    const urls = [];
    
    try {
      console.log(`📄 アクセス中: ${categoryUrl}`);
      
      const response = await page.goto(categoryUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      
      if (response.status() !== 200) {
        console.log(`⚠️ HTTPステータス: ${response.status()}`);
        return urls;
      }
      
      await this.randomDelay(2, 4);
      
      // 案件URL抽出
      const allUrls = await page.evaluate(() => {
        const links = document.querySelectorAll('a[href*="/ad_details/"]');
        return Array.from(links).map(link => link.href);
      });
      
      // 重複除去
      const uniqueUrls = [...new Set(allUrls)];
      
      // ランダムに選択
      const shuffled = uniqueUrls.sort(() => 0.5 - Math.random());
      urls.push(...shuffled.slice(0, sampleSize));
      
      console.log(`✅ ${uniqueUrls.length}件中${urls.length}件を選択`);
      
    } catch (error) {
      console.log(`❌ URL取得エラー: ${error.message}`);
    } finally {
      await page.close();
    }
    
    return urls;
  }

  async getCampaignDetails(url, categoryName) {
    const page = await this.setupPage();
    
    try {
      const directUrl = this.convertRedirectToDirectUrl(url);
      console.log(`🔍 詳細取得: ${directUrl}`);
      
      const response = await page.goto(directUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      
      if (response.status() !== 200) {
        console.log(`⚠️ HTTPステータス: ${response.status()}`);
        return null;
      }
      
      await this.randomDelay(1, 3);
      
      // データ抽出
      const data = await page.evaluate(() => {
        // タイトル取得
        let name = '';
        const h1 = document.querySelector('h1');
        if (h1) {
          name = h1.textContent.trim();
        } else {
          const titleMeta = document.querySelector('meta[property="og:title"]');
          if (titleMeta) {
            name = titleMeta.content;
          }
        }
        
        // 還元率取得
        let cashback = '';
        const patterns = [
          /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:pt|ポイント|円|%)/gi,
          /(\d+)\s*pt/gi,
          /(\d+(?:\.\d+)?)\s*%/gi
        ];
        
        const bodyText = document.body.innerText;
        for (const pattern of patterns) {
          const match = bodyText.match(pattern);
          if (match) {
            cashback = match[0];
            break;
          }
        }
        
        // 獲得条件取得
        let method = '';
        const conditionSelectors = [
          '.condition',
          '[class*="condition"]',
          'div:has(> h2:contains("獲得条件"))',
          'div:has(> h3:contains("獲得条件"))'
        ];
        
        for (const selector of conditionSelectors) {
          try {
            const elem = document.querySelector(selector);
            if (elem) {
              method = elem.textContent.trim();
              break;
            }
          } catch (e) {
            // セレクタエラー無視
          }
        }
        
        return { name, cashback, method };
      });
      
      // URLからIDを抽出
      const idMatch = directUrl.match(/\/ad_details\/(\d+)/);
      const id = idMatch ? idMatch[1] : 'unknown';
      
      return {
        id,
        name: data.name || '名前取得失敗',
        url: directUrl,
        cashback: data.cashback || '要確認',
        category: categoryName,
        method: data.method || '詳細はサイトでご確認ください',
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.log(`❌ 詳細取得エラー: ${error.message}`);
      return null;
    } finally {
      await page.close();
    }
  }

  async run() {
    console.log('🧪 ちょびリッチテストスクレイピング開始\n');
    console.log('=' .repeat(60));
    console.log('各カテゴリから3件ずつランダムに取得します\n');
    
    try {
      await this.initBrowser();
      
      // 各カテゴリを処理
      for (const [key, category] of Object.entries(this.testCategories)) {
        console.log(`\n📁 ${category.name}カテゴリ`);
        console.log('-'.repeat(40));
        
        this.results[key] = [];
        
        // URLを取得
        const urls = await this.extractUrlsFromCategory(category.url, category.sampleSize);
        
        if (urls.length === 0) {
          console.log('❌ URLが取得できませんでした');
          continue;
        }
        
        // 各URLの詳細を取得
        for (const url of urls) {
          const details = await this.getCampaignDetails(url, category.name);
          if (details) {
            this.results[key].push(details);
            console.log(`✅ ${details.name}`);
            console.log(`   💰 ${details.cashback}`);
          }
          
          await this.randomDelay(3, 5);
        }
      }
      
      // 結果を保存
      const output = {
        test_date: new Date().toISOString(),
        test_type: 'random_sample',
        results: this.results
      };
      
      await fs.writeFile(
        'chobirich_test_results.json',
        JSON.stringify(output, null, 2)
      );
      
      // 結果サマリー表示
      console.log('\n' + '='.repeat(60));
      console.log('📊 テスト結果サマリー');
      console.log('='.repeat(60));
      
      for (const [key, campaigns] of Object.entries(this.results)) {
        const category = this.testCategories[key];
        console.log(`\n【${category.name}】 ${campaigns.length}件取得`);
        campaigns.forEach((campaign, i) => {
          console.log(`${i + 1}. ${campaign.name}`);
          console.log(`   URL: ${campaign.url}`);
          console.log(`   還元: ${campaign.cashback}`);
        });
      }
      
      console.log('\n💾 詳細はchobirich_test_results.jsonに保存されました');
      
    } catch (error) {
      console.error('💥 エラー:', error);
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

// 実行
if (require.main === module) {
  const scraper = new ChobirichTestScraper();
  scraper.run().catch(console.error);
}

module.exports = ChobirichTestScraper;