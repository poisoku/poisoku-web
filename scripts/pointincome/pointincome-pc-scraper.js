const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class PointIncomePCScraper {
  constructor() {
    this.baseUrl = 'https://pointi.jp';
    this.results = [];
    this.browser = null;
    this.processedUrls = new Set();
    this.processedCount = 0;
    this.errorCount = 0;
  }

  async init() {
    console.log('🚀 ポイントインカムPC版スクレイピング開始');
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      defaultViewport: {
        width: 1920,
        height: 1080
      }
    });
  }

  async setupPage() {
    const page = await this.browser.newPage();
    
    // 画像の読み込みを無効化して高速化
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (['image', 'font'].includes(request.resourceType())) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // PC用のUser-Agent設定
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    return page;
  }

  async waitForLoad(page, selector, timeout = 30000) {
    try {
      await page.waitForSelector(selector, { timeout });
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(1000);
      return true;
    } catch (error) {
      console.log(`⏳ セレクタ待機タイムアウト: ${selector}`);
      return false;
    }
  }

  extractCashbackFromText(text) {
    if (!text) return null;

    // 円分表記から取得（例: (50,000円分)）
    const yenMatch = text.match(/[(（](\d{1,3}(?:,\d{3})*(?:\.\d+)?)円分[)）]/);
    if (yenMatch) {
      return yenMatch[1].replace(/,/g, '') + '円';
    }

    // ポイント表記から取得（例: 500,000pt）
    const pointMatch = text.match(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(?:pt|ポイント)/i);
    if (pointMatch) {
      const points = parseInt(pointMatch[1].replace(/,/g, ''));
      const yen = Math.floor(points / 10); // 10ポイント = 1円
      return yen + '円';
    }

    // パーセント表記
    const percentMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
    if (percentMatch) {
      return percentMatch[1] + '%';
    }

    return null;
  }

  async scrapeCampaignList(page, category) {
    console.log(`\n📂 カテゴリ「${category.name}」の案件取得開始`);
    
    try {
      await page.goto(category.url, { waitUntil: 'networkidle2', timeout: 60000 });
      console.log(`✅ ページアクセス成功: ${category.url}`);
      
      // ページの基本的な待機
      await this.waitForLoad(page, 'body');
      
      // 案件リストのセレクタ（要調整）
      const campaignSelectors = [
        '.campaign-list .campaign-item',
        '.offer-list .offer-item',
        '.point-list .point-item',
        'article.campaign',
        '.case-list li',
        '[class*="campaign"] [class*="item"]'
      ];
      
      let campaigns = [];
      let foundSelector = null;
      
      // 各セレクタを試す
      for (const selector of campaignSelectors) {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          foundSelector = selector;
          console.log(`✅ 案件要素発見: ${selector} (${elements.length}件)`);
          break;
        }
      }
      
      if (!foundSelector) {
        console.log('❌ 案件要素が見つかりません');
        // ページのHTMLを少し出力してデバッグ
        const bodyHTML = await page.$eval('body', el => el.innerHTML.substring(0, 1000));
        console.log('📄 ページHTML抜粋:', bodyHTML);
        return [];
      }
      
      // 案件情報を抽出
      campaigns = await page.$$eval(foundSelector, (elements) => {
        return elements.map(el => {
          const titleEl = el.querySelector('h3, h4, .title, .campaign-title, [class*="title"]');
          const cashbackEl = el.querySelector('.point, .cashback, [class*="point"], [class*="cashback"]');
          const linkEl = el.querySelector('a');
          
          return {
            title: titleEl ? titleEl.textContent.trim() : '',
            cashbackText: cashbackEl ? cashbackEl.textContent.trim() : '',
            url: linkEl ? linkEl.href : '',
            rawHTML: el.innerHTML.substring(0, 500) // デバッグ用
          };
        });
      });
      
      // 詳細ページの処理
      for (const campaign of campaigns) {
        if (!campaign.url || this.processedUrls.has(campaign.url)) {
          continue;
        }
        
        try {
          const detailData = await this.scrapeCampaignDetail(campaign.url);
          if (detailData) {
            this.results.push({
              ...detailData,
              category: category.name,
              device: 'PC'
            });
            this.processedUrls.add(campaign.url);
            this.processedCount++;
            
            console.log(`✅ [${this.processedCount}] ${detailData.title} - ${detailData.cashback}`);
          }
        } catch (error) {
          console.error(`❌ 詳細ページエラー: ${campaign.url}`, error.message);
          this.errorCount++;
        }
        
        // レート制限対策
        await page.waitForTimeout(2000 + Math.random() * 1000);
      }
      
      console.log(`📊 カテゴリ完了: ${campaigns.length}件処理`);
      
    } catch (error) {
      console.error(`❌ カテゴリエラー: ${category.name}`, error);
    }
  }

  async scrapeCampaignDetail(url) {
    const page = await this.setupPage();
    
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      
      // 詳細ページの情報取得
      const detailData = await page.evaluate(() => {
        const getTextContent = (selector) => {
          const el = document.querySelector(selector);
          return el ? el.textContent.trim() : '';
        };
        
        return {
          title: getTextContent('h1, h2, .campaign-title, [class*="title"]'),
          description: getTextContent('.description, .campaign-description, [class*="description"]'),
          cashbackText: getTextContent('.point-info, .cashback-info, [class*="point"], [class*="cashback"]'),
          conditions: getTextContent('.conditions, .terms, [class*="condition"]'),
          pageText: document.body.textContent.substring(0, 2000) // 全体テキストも取得
        };
      });
      
      // 還元率の抽出
      const cashback = this.extractCashbackFromText(detailData.cashbackText) || 
                      this.extractCashbackFromText(detailData.pageText);
      
      if (!cashback) {
        console.log(`⚠️ 還元率が見つかりません: ${url}`);
        return null;
      }
      
      return {
        id: this.generateId(url),
        title: detailData.title || '不明',
        description: detailData.description,
        url: url,
        cashback: cashback,
        conditions: detailData.conditions,
        lastUpdated: new Date().toLocaleString('ja-JP'),
        siteName: 'ポイントインカム'
      };
      
    } catch (error) {
      console.error(`❌ 詳細ページエラー: ${url}`, error.message);
      return null;
    } finally {
      await page.close();
    }
  }

  generateId(url) {
    // URLから一意のIDを生成
    const match = url.match(/\/(\d+)/);
    if (match) {
      return `pi_${match[1]}`;
    }
    return `pi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async saveResults() {
    const data = {
      siteName: 'ポイントインカム',
      scrapedAt: new Date().toISOString(),
      summary: {
        total_campaigns: this.results.length,
        total_processed: this.processedCount,
        errors: this.errorCount,
        device: 'PC'
      },
      campaigns: this.results
    };

    await fs.writeFile(
      'pointincome_pc_campaigns.json',
      JSON.stringify(data, null, 2),
      'utf8'
    );

    console.log(`\n💾 データ保存完了: pointincome_pc_campaigns.json`);
    console.log(`📊 総案件数: ${this.results.length}件`);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async run() {
    try {
      await this.init();
      
      // カテゴリ一覧（URLは要確認）
      const categories = [
        { name: 'ショッピング', url: `${this.baseUrl}/shopping` },
        { name: 'サービス', url: `${this.baseUrl}/service` },
        { name: 'クレジットカード', url: `${this.baseUrl}/creditcard` },
        { name: 'アンケート', url: `${this.baseUrl}/survey` },
        // 必要に応じて追加
      ];
      
      // 各カテゴリをスクレイピング
      const page = await this.setupPage();
      for (const category of categories) {
        await this.scrapeCampaignList(page, category);
        
        // 中間保存
        if (this.results.length > 0 && this.results.length % 50 === 0) {
          await this.saveResults();
        }
      }
      await page.close();
      
      // 最終保存
      await this.saveResults();
      
    } catch (error) {
      console.error('❌ 致命的エラー:', error);
    } finally {
      await this.close();
    }
  }
}

// 実行
(async () => {
  const scraper = new PointIncomePCScraper();
  await scraper.run();
})();