const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class ChobirichScraper {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.campaigns = new Map();
    this.categories = {
      shopping: { name: 'ショッピング', path: '/shopping/shop/', pages: 5 },
      service: { name: 'サービス', path: '/service/', pages: 3 },
      creditcard: { name: 'クレジットカード', path: '/creditcard/', pages: 2 },
      travel: { name: '旅行', path: '/travel/', pages: 2 }
    };
  }

  async init() {
    console.log('ちょびリッチスクレイパー起動中...\n');
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  }

  async close() {
    await this.browser.close();
  }

  // カテゴリページから案件IDを収集
  async collectCampaignIds(categoryPath, pageNum) {
    const page = await this.browser.newPage();
    const url = `${this.baseUrl}${categoryPath}${pageNum}/`;
    
    try {
      console.log(`カテゴリページ取得: ${url}`);
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // 404チェック
      const is404 = await page.evaluate(() => {
        return document.title.includes('404') || 
               document.body.textContent.includes('ページが見つかりません');
      });
      
      if (is404) {
        console.log(`  → ページが存在しません`);
        return [];
      }

      const campaignIds = await page.evaluate(() => {
        const ids = new Set();
        
        // ad_detailsリンクを探す
        document.querySelectorAll('a[href*="/ad_details/"]').forEach(link => {
          const match = link.href.match(/\/ad_details\/(\d+)/);
          if (match) {
            ids.add(match[1]);
          }
        });
        
        return Array.from(ids);
      });

      console.log(`  → ${campaignIds.length}件の案件ID取得`);
      return campaignIds;

    } catch (error) {
      console.error(`エラー (${url}):`, error.message);
      return [];
    } finally {
      await page.close();
    }
  }

  // 案件詳細を取得
  async scrapeCampaignDetail(campaignId) {
    if (this.campaigns.has(campaignId)) {
      return; // 既に取得済み
    }

    const page = await this.browser.newPage();
    const url = `${this.baseUrl}/ad_details/${campaignId}/`;
    
    try {
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      const campaign = await page.evaluate(() => {
        const data = {
          id: window.location.pathname.match(/\/ad_details\/(\d+)/)?.[1],
          name: '',
          cashback: '',
          category: '',
          url: window.location.href,
          conditions: {}
        };

        // タイトル取得
        const h1 = document.querySelector('h1');
        if (h1) {
          data.name = h1.textContent.trim();
        }

        // 還元率取得（大きいフォントサイズ優先）
        let maxFontSize = 0;
        document.querySelectorAll('*').forEach(el => {
          const text = el.textContent?.trim() || '';
          if (/^\d+(?:\.\d+)?%$/.test(text) || /^\d+(?:,\d+)?(?:ちょび)?pt$/.test(text)) {
            const fontSize = parseInt(window.getComputedStyle(el).fontSize);
            if (fontSize > maxFontSize) {
              maxFontSize = fontSize;
              data.cashback = text;
            }
          }
        });

        // 条件情報取得
        const detailRows = document.querySelectorAll('dl dt, dl dd, table tr');
        let lastLabel = '';
        detailRows.forEach(row => {
          const text = row.textContent.trim();
          if (text.includes('獲得方法')) {
            lastLabel = 'method';
          } else if (text.includes('予定明細')) {
            lastLabel = 'pending';
          } else if (text.includes('加算日')) {
            lastLabel = 'creditDate';
          } else if (lastLabel && !text.includes('獲得方法') && !text.includes('予定明細') && !text.includes('加算日')) {
            data.conditions[lastLabel] = text;
            lastLabel = '';
          }
        });

        return data;
      });

      this.campaigns.set(campaignId, campaign);
      console.log(`✓ ${campaignId}: ${campaign.name} - ${campaign.cashback}`);

    } catch (error) {
      console.error(`エラー (${campaignId}):`, error.message);
    } finally {
      await page.close();
    }
  }

  // メイン処理
  async scrapeAll() {
    // 1. ショッピングカテゴリーから開始
    console.log('\n=== ショッピングカテゴリー ===');
    const shoppingIds = new Set();
    
    for (let page = 101; page <= 105; page++) {
      const ids = await this.collectCampaignIds('/shopping/shop/', page);
      ids.forEach(id => shoppingIds.add(id));
      await this.delay(2000);
    }

    console.log(`\nショッピングカテゴリー合計: ${shoppingIds.size}件の案件ID`);

    // 2. 各案件の詳細を取得
    console.log('\n=== 案件詳細取得 ===');
    let count = 0;
    for (const id of shoppingIds) {
      await this.scrapeCampaignDetail(id);
      count++;
      
      // 10件ごとに進捗保存
      if (count % 10 === 0) {
        await this.saveResults();
      }
      
      await this.delay(1500); // 1.5秒待機
    }

    // 3. 他のカテゴリーも探索（URLパターンを推測）
    console.log('\n=== 他のカテゴリー探索 ===');
    const otherCategories = [
      { path: '/service/serv/', name: 'サービス' },
      { path: '/creditcard/card/', name: 'クレジットカード' },
      { path: '/travel/tra/', name: '旅行' }
    ];

    for (const category of otherCategories) {
      console.log(`\n${category.name}カテゴリーを探索...`);
      for (let page = 101; page <= 103; page++) {
        const ids = await this.collectCampaignIds(category.path, page);
        
        for (const id of ids) {
          await this.scrapeCampaignDetail(id);
          await this.delay(1500);
        }
        
        if (ids.length === 0) break; // 案件が見つからなければ終了
        await this.delay(2000);
      }
    }
  }

  // 待機処理
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 結果を保存
  async saveResults() {
    const data = {
      scraped_at: new Date().toISOString(),
      total_campaigns: this.campaigns.size,
      campaigns: Array.from(this.campaigns.values())
    };

    await fs.writeFile(
      'chobirich_full_data.json',
      JSON.stringify(data, null, 2),
      'utf8'
    );
    
    console.log(`\n[保存] ${this.campaigns.size}件の案件データを保存`);
  }

  // 統計情報を表示
  showStats() {
    const stats = {
      total: this.campaigns.size,
      withPercentage: 0,
      withPoints: 0,
      noCashback: 0
    };

    this.campaigns.forEach(campaign => {
      if (campaign.cashback.includes('%')) stats.withPercentage++;
      else if (campaign.cashback.includes('pt')) stats.withPoints++;
      else stats.noCashback++;
    });

    console.log('\n=== 統計情報 ===');
    console.log(`総案件数: ${stats.total}`);
    console.log(`％還元: ${stats.withPercentage}件`);
    console.log(`ポイント還元: ${stats.withPoints}件`);
    console.log(`還元率不明: ${stats.noCashback}件`);
  }
}

// 実行
async function main() {
  const scraper = new ChobirichScraper();
  
  try {
    await scraper.init();
    await scraper.scrapeAll();
    await scraper.saveResults();
    scraper.showStats();
  } catch (error) {
    console.error('エラー:', error);
    await scraper.saveResults(); // エラー時も保存
  } finally {
    await scraper.close();
    console.log('\n完了！');
  }
}

// 実行
main().catch(console.error);