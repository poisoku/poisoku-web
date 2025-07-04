const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class ChobirichAllCategories {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.campaigns = new Map();
    this.categories = [
      // ショッピングカテゴリー（複数の番号）
      { name: 'ショッピング-101', url: '/shopping/shop/101', type: 'standard' },
      { name: 'ショッピング-102', url: '/shopping/shop/102', type: 'standard' },
      { name: 'ショッピング-103', url: '/shopping/shop/103', type: 'standard' },
      { name: 'ショッピング-104', url: '/shopping/shop/104', type: 'standard' },
      { name: 'ショッピング-105', url: '/shopping/shop/105', type: 'standard' },
      
      // サービスカテゴリー（複数の番号）
      { name: 'サービス-101', url: '/earn/apply/101', type: 'standard' },
      { name: 'サービス-102', url: '/earn/apply/102', type: 'standard' },
      { name: 'サービス-103', url: '/earn/apply/103', type: 'standard' },
      
      // 旅行カテゴリー（特殊：タブ切り替え）
      { name: '旅行', url: '/trip', type: 'tab' },
      
      // アプリカテゴリー（モバイル限定）
      { name: 'アプリ', url: '/smartphone?sort=point', type: 'mobile' }
    ];
  }

  async init() {
    console.log('ちょびリッチ全カテゴリースクレイパー起動中...\n');
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  }

  async close() {
    await this.browser.close();
  }

  // 標準的なカテゴリページから案件IDを収集（ページネーション対応）
  async collectCampaignIds(categoryUrl, page = 1, isMobile = false) {
    const browserPage = await this.browser.newPage();
    
    // モバイルユーザーエージェント設定
    if (isMobile) {
      await browserPage.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1');
      await browserPage.setViewport({ width: 375, height: 812, isMobile: true });
    }
    
    // URLの構築（?page=対応）
    let url;
    if (page === 1) {
      url = `${this.baseUrl}${categoryUrl}`;
    } else {
      // 既に?が含まれる場合は&page=、ない場合は?page=
      if (categoryUrl.includes('?')) {
        url = `${this.baseUrl}${categoryUrl}&page=${page}`;
      } else {
        url = `${this.baseUrl}${categoryUrl}?page=${page}`;
      }
    }
    
    try {
      console.log(`カテゴリページ取得: ${url}`);
      await browserPage.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 45000
      });

      const pageInfo = await browserPage.evaluate(() => {
        const is404 = document.title.includes('404') || 
                     document.body.textContent.includes('ページが見つかりません');
        
        const campaignLinks = document.querySelectorAll('a[href*="/ad_details/"]');
        return {
          is404: is404,
          campaignCount: campaignLinks.length
        };
      });

      if (pageInfo.is404 || pageInfo.campaignCount === 0) {
        console.log(`  → ページが存在しないか案件が0件`);
        return [];
      }

      const campaignIds = await browserPage.evaluate(() => {
        const ids = new Set();
        
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
      await browserPage.close();
    }
  }

  // 旅行カテゴリー（タブ切り替え）用の特別処理
  async collectTravelCampaignIds() {
    const page = await this.browser.newPage();
    const url = `${this.baseUrl}/trip`;
    
    try {
      console.log(`旅行カテゴリページ取得: ${url}`);
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 45000
      });

      // タブを順番にクリックして案件を収集
      const tabs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('[class*="tab"], [role="tab"]'))
          .map(tab => tab.textContent.trim());
      });

      console.log(`  → ${tabs.length}個のタブを発見`);

      const allIds = new Set();
      
      // 各タブをクリックして案件を収集
      for (let i = 0; i < tabs.length; i++) {
        if (i > 0) {
          // タブをクリック
          await page.evaluate((index) => {
            const tabElements = document.querySelectorAll('[class*="tab"], [role="tab"]');
            if (tabElements[index]) {
              tabElements[index].click();
            }
          }, i);
          
          // コンテンツの読み込み待機
          await page.waitForTimeout(2000);
        }

        const ids = await page.evaluate(() => {
          const campaignIds = new Set();
          document.querySelectorAll('a[href*="/ad_details/"]').forEach(link => {
            const match = link.href.match(/\/ad_details\/(\d+)/);
            if (match) {
              campaignIds.add(match[1]);
            }
          });
          return Array.from(campaignIds);
        });

        ids.forEach(id => allIds.add(id));
        console.log(`  → タブ${i + 1}: ${ids.length}件の案件ID`);
      }

      console.log(`  → 合計: ${allIds.size}件の案件ID取得`);
      return Array.from(allIds);

    } catch (error) {
      console.error(`エラー (旅行):`, error.message);
      return [];
    } finally {
      await page.close();
    }
  }

  // 案件詳細を取得（既存のロジックを使用）
  async scrapeCampaignDetail(campaignId, categoryName = '') {
    if (this.campaigns.has(campaignId)) {
      return;
    }

    const page = await this.browser.newPage();
    const url = `${this.baseUrl}/ad_details/${campaignId}/`;
    
    try {
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 45000
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

        // 案件名を取得
        const titleElement = document.querySelector('h1.AdDetails__title');
        if (titleElement && titleElement.textContent.trim()) {
          data.name = titleElement.textContent.trim();
        } else {
          const h1Elements = document.querySelectorAll('h1');
          for (const h1 of h1Elements) {
            const text = h1.textContent.trim();
            if (text && !text.includes('ちょびリッチ')) {
              data.name = text;
              break;
            }
          }
        }

        // 還元率を取得（全角％対応）
        const mainPtElement = document.querySelector('.AdDetails__pt.ItemPtLarge');
        if (mainPtElement) {
          const text = mainPtElement.textContent.trim();
          const match = text.match(/(\d+(?:\.\d+)?[%％]|\d+(?:,\d+)?(?:ちょび)?pt)/);
          if (match) {
            data.cashback = match[1].replace('％', '%');
          }
        }

        if (!data.cashback) {
          data.cashback = 'なし';
        }

        // 条件情報取得
        const detailElements = document.querySelectorAll('dt, dd, th, td');
        let currentLabel = '';
        
        detailElements.forEach(el => {
          const text = el.textContent.trim();
          if (text.includes('獲得方法')) {
            currentLabel = 'method';
          } else if (text.includes('予定明細')) {
            currentLabel = 'pending';
          } else if (text.includes('加算日')) {
            currentLabel = 'creditDate';
          } else if (currentLabel && text && !text.includes('獲得方法') && !text.includes('予定明細') && !text.includes('加算日')) {
            if (!data.conditions[currentLabel]) {
              data.conditions[currentLabel] = text;
            }
            currentLabel = '';
          }
        });

        return data;
      });

      campaign.category = categoryName; // カテゴリー名を追加
      this.campaigns.set(campaignId, campaign);
      console.log(`✓ ${campaignId}: ${campaign.name} - ${campaign.cashback} [${categoryName}]`);

    } catch (error) {
      console.error(`エラー (${campaignId}):`, error.message);
    } finally {
      await page.close();
    }
  }

  // カテゴリーをスクレイピング
  async scrapeCategory(category, maxPages = 10) {
    console.log(`\n=== ${category.name}カテゴリー ===`);
    const allIds = new Set();
    
    if (category.type === 'tab') {
      // 旅行カテゴリーの特別処理
      const ids = await this.collectTravelCampaignIds();
      ids.forEach(id => allIds.add(id));
    } else {
      // 標準的なページネーション処理
      const isMobile = category.type === 'mobile';
      
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        const ids = await this.collectCampaignIds(category.url, pageNum, isMobile);
        
        if (ids.length === 0) {
          console.log(`${pageNum}ページ目で終了（案件なし）`);
          break;
        }
        
        ids.forEach(id => allIds.add(id));
        await this.delay(2000);
      }
    }

    console.log(`${category.name}カテゴリー合計: ${allIds.size}件の案件ID`);
    
    // 各案件の詳細を取得
    let count = 0;
    for (const id of allIds) {
      await this.scrapeCampaignDetail(id, category.name);
      count++;
      
      if (count % 15 === 0) {
        await this.saveResults();
        console.log(`[進捗] ${count}/${allIds.size}件完了`);
      }
      
      await this.delay(1500);
    }
    
    return allIds.size;
  }

  // メイン処理
  async scrapeAll() {
    let totalCampaigns = 0;
    
    for (const category of this.categories) {
      const count = await this.scrapeCategory(category);
      totalCampaigns += count;
      
      console.log(`${category.name}完了: ${count}件`);
      await this.delay(5000);
    }

    console.log(`\n全カテゴリー完了: 合計${totalCampaigns}件の案件を発見`);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async saveResults() {
    const data = {
      scraped_at: new Date().toISOString(),
      total_campaigns: this.campaigns.size,
      campaigns: Array.from(this.campaigns.values())
    };

    await fs.writeFile(
      'chobirich_all_categories_data.json',
      JSON.stringify(data, null, 2),
      'utf8'
    );
    
    console.log(`[保存] ${this.campaigns.size}件の案件データを保存`);
  }

  showStats() {
    const stats = {
      total: this.campaigns.size,
      withPercentage: 0,
      withPoints: 0,
      noCashback: 0,
      byCategory: {}
    };

    this.campaigns.forEach(campaign => {
      // 還元率タイプ別集計
      if (campaign.cashback === 'なし') {
        stats.noCashback++;
      } else if (campaign.cashback.includes('%')) {
        stats.withPercentage++;
      } else if (campaign.cashback.includes('pt')) {
        stats.withPoints++;
      }
      
      // カテゴリー別集計
      const category = campaign.category || '不明';
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
    });

    console.log('\n=== 統計情報 ===');
    console.log(`総案件数: ${stats.total}`);
    console.log(`％還元: ${stats.withPercentage}件`);
    console.log(`ポイント還元: ${stats.withPoints}件`);
    console.log(`還元率表示なし: ${stats.noCashback}件`);
    
    console.log('\n=== カテゴリー別案件数 ===');
    Object.entries(stats.byCategory).forEach(([category, count]) => {
      console.log(`${category}: ${count}件`);
    });
    
    console.log('\n=== サンプルデータ ===');
    Array.from(this.campaigns.values()).slice(0, 10).forEach(campaign => {
      console.log(`- [${campaign.category}] ${campaign.name}: ${campaign.cashback}`);
    });
  }
}

// 実行
async function main() {
  const scraper = new ChobirichAllCategories();
  
  try {
    await scraper.init();
    await scraper.scrapeAll();
    await scraper.saveResults();
    scraper.showStats();
  } catch (error) {
    console.error('エラー:', error);
    await scraper.saveResults();
  } finally {
    await scraper.close();
    console.log('\n完了！');
  }
}

main().catch(console.error);