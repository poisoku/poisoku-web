const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class ChobirichPuppeteerScraper {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.campaigns = new Map();
  }

  async init() {
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }

  async close() {
    await this.browser.close();
  }

  // 案件詳細ページから正確なデータを取得
  async scrapeCampaignDetail(campaignId) {
    const page = await this.browser.newPage();
    const url = `${this.baseUrl}/ad_details/${campaignId}/`;
    
    try {
      console.log(`案件取得中: ${campaignId}`);
      
      // ページに移動
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // ページが完全に読み込まれるまで待機
      await page.waitForTimeout(2000);

      // データを抽出
      const campaign = await page.evaluate(() => {
        const data = {
          id: window.location.pathname.match(/\/ad_details\/(\d+)/)?.[1],
          name: '',
          cashback: '',
          cashbackType: '', // % or pt
          category: '',
          description: '',
          conditions: {},
          url: window.location.href
        };

        // 案件名を取得（複数のセレクタを試す）
        const titleSelectors = [
          'h1',
          '.campaign-title',
          '.ad-title',
          '[class*="title"]'
        ];
        
        for (const selector of titleSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim()) {
            data.name = element.textContent.trim();
            break;
          }
        }

        // 還元率を取得（大きく表示されている数値を優先）
        const findCashback = () => {
          // 方法1: 大きなフォントサイズの要素を探す
          const allElements = document.querySelectorAll('*');
          const cashbackElements = [];
          
          allElements.forEach(el => {
            const text = el.textContent.trim();
            const fontSize = window.getComputedStyle(el).fontSize;
            
            // ポイント表記のパターン
            if (text.match(/^\d+(?:\.\d+)?%$/) || text.match(/^\d+(?:,\d+)?(?:ちょび)?pt$/)) {
              cashbackElements.push({
                element: el,
                text: text,
                fontSize: parseInt(fontSize)
              });
            }
          });

          // フォントサイズが大きい順にソート
          cashbackElements.sort((a, b) => b.fontSize - a.fontSize);
          
          if (cashbackElements.length > 0) {
            data.cashback = cashbackElements[0].text;
            data.cashbackType = cashbackElements[0].text.includes('%') ? 'percentage' : 'points';
          }
        };

        findCashback();

        // 獲得方法、予定明細、加算日を取得
        const detailItems = document.querySelectorAll('dl dt, dl dd');
        for (let i = 0; i < detailItems.length; i += 2) {
          const label = detailItems[i]?.textContent.trim();
          const value = detailItems[i + 1]?.textContent.trim();
          
          if (label && value) {
            if (label.includes('獲得方法')) data.conditions.method = value;
            if (label.includes('予定明細')) data.conditions.pending = value;
            if (label.includes('加算日')) data.conditions.creditDate = value;
          }
        }

        // 説明文を取得
        const descSelectors = [
          '.campaign-description',
          '.ad-description',
          '[class*="description"]',
          'meta[name="description"]'
        ];
        
        for (const selector of descSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            data.description = element.content || element.textContent.trim();
            break;
          }
        }

        return data;
      });

      // スクリーンショットを保存（デバッグ用）
      await page.screenshot({ 
        path: `screenshots/campaign_${campaignId}.png`,
        fullPage: true 
      });

      this.campaigns.set(campaignId, campaign);
      console.log(`✓ ${campaign.name} - ${campaign.cashback}`);
      
      return campaign;

    } catch (error) {
      console.error(`エラー (${campaignId}):`, error.message);
      return null;
    } finally {
      await page.close();
    }
  }

  // カテゴリページから案件一覧を取得
  async scrapeCategoryPage(categoryUrl) {
    const page = await this.browser.newPage();
    
    try {
      console.log(`カテゴリページ取得中: ${categoryUrl}`);
      
      await page.goto(categoryUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // 案件リストを取得
      const campaigns = await page.evaluate(() => {
        const items = [];
        
        // 案件要素を探す（複数のパターンに対応）
        const selectors = [
          'a[href*="/ad_details/"]',
          '.campaign-item',
          '.offer-item',
          '[class*="campaign"]',
          '[class*="offer"]'
        ];
        
        const campaignElements = new Set();
        selectors.forEach(selector => {
          document.querySelectorAll(selector).forEach(el => {
            campaignElements.add(el);
          });
        });

        campaignElements.forEach(element => {
          const link = element.href || element.querySelector('a')?.href;
          if (link && link.includes('/ad_details/')) {
            const idMatch = link.match(/\/ad_details\/(\d+)/);
            if (idMatch) {
              const item = {
                id: idMatch[1],
                name: element.textContent.trim().substring(0, 100),
                listingCashback: ''
              };

              // リスト表示での還元率を取得
              const cashbackText = element.textContent;
              const cashbackMatch = cashbackText.match(/(\d+(?:\.\d+)?%|\d+(?:,\d+)?(?:ちょび)?pt)/);
              if (cashbackMatch) {
                item.listingCashback = cashbackMatch[1];
              }

              items.push(item);
            }
          }
        });

        return items;
      });

      console.log(`見つかった案件: ${campaigns.length}件`);
      return campaigns;

    } catch (error) {
      console.error(`カテゴリページエラー:`, error.message);
      return [];
    } finally {
      await page.close();
    }
  }

  // 結果を保存
  async saveResults() {
    // スクリーンショット用ディレクトリ作成
    try {
      await fs.mkdir('screenshots', { recursive: true });
    } catch (e) {}

    const data = {
      scraped_at: new Date().toISOString(),
      total_campaigns: this.campaigns.size,
      campaigns: Array.from(this.campaigns.values())
    };

    await fs.writeFile(
      'chobirich_campaigns_puppeteer.json',
      JSON.stringify(data, null, 2),
      'utf8'
    );
    
    console.log(`\n結果を保存しました`);
    console.log(`合計 ${this.campaigns.size} 件の案件を取得`);
  }
}

// 実行
async function main() {
  const scraper = new ChobirichPuppeteerScraper();
  
  try {
    await scraper.init();
    
    // 1. 楽天市場でテスト
    console.log('=== テスト: 楽天市場 (ID: 36796) ===');
    await scraper.scrapeCampaignDetail('36796');
    
    // 2. ショッピングカテゴリーの案件一覧を取得
    console.log('\n=== ショッピングカテゴリー案件一覧 ===');
    const campaigns = await scraper.scrapeCategoryPage('https://www.chobirich.com/shopping/shop/101/');
    
    // 3. 各案件の詳細を取得（最初の5件）
    for (const campaign of campaigns.slice(0, 5)) {
      await scraper.scrapeCampaignDetail(campaign.id);
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2秒待機
    }
    
    // 結果を保存
    await scraper.saveResults();
    
  } finally {
    await scraper.close();
  }
}

// Puppeteerの存在確認
try {
  require.resolve('puppeteer');
  main().catch(console.error);
} catch (e) {
  console.log('Puppeteerをインストールしてください: npm install puppeteer');
}