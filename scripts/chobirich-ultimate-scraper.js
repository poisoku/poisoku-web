const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class ChobirichUltimateScraper {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.campaigns = new Map();
  }

  async init() {
    console.log('ちょびリッチ究極版スクレイパー起動中...\n');
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  }

  async close() {
    await this.browser.close();
  }

  // カテゴリページから案件IDを収集
  async collectCampaignIds(categoryUrl, page = 1) {
    const browserPage = await this.browser.newPage();
    const url = page === 1 ? categoryUrl : `${categoryUrl}?page=${page}`;
    
    try {
      console.log(`カテゴリページ取得: ${url}`);
      await browserPage.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      const pageInfo = await browserPage.evaluate(() => {
        const is404 = document.title.includes('404') || 
                     document.body.textContent.includes('ページが見つかりません') ||
                     document.body.textContent.includes('見つかりませんでした');
        
        const campaignLinks = document.querySelectorAll('a[href*="/ad_details/"]');
        return {
          is404: is404,
          campaignCount: campaignLinks.length,
          title: document.title
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

  // 案件詳細を取得（究極版）
  async scrapeCampaignDetail(campaignId) {
    if (this.campaigns.has(campaignId)) {
      return;
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
          conditions: {},
          debug: { method: '', reason: '' }
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

        // 還元率を取得（優先順位に基づく確実な方法）
        const findCashback = () => {
          // 方法1: 最優先 - AdDetails__pt ItemPtLarge（楽天市場のような正常な案件）
          const mainPtElement = document.querySelector('.AdDetails__pt.ItemPtLarge');
          if (mainPtElement) {
            const text = mainPtElement.textContent.trim();
            const match = text.match(/(\d+(?:\.\d+)?%|\d+(?:,\d+)?(?:ちょび)?pt)/);
            if (match) {
              data.debug.method = 'AdDetails__pt ItemPtLarge';
              return match[1];
            }
          }

          // 方法2: AdDetailsエリア内で、Recommendではない要素を探す
          const adDetailsArea = document.querySelector('.AdDetails');
          if (adDetailsArea) {
            const cashbackElements = [];
            
            adDetailsArea.querySelectorAll('*').forEach(el => {
              const text = el.textContent?.trim() || '';
              const exactMatch = text.match(/^(\d+(?:\.\d+)?%|\d+(?:,\d+)?(?:ちょび)?pt)$/);
              
              if (exactMatch) {
                const rect = el.getBoundingClientRect();
                const isVisible = rect.width > 0 && rect.height > 0;
                
                if (isVisible) {
                  cashbackElements.push({
                    text: exactMatch[1],
                    fontSize: parseInt(window.getComputedStyle(el).fontSize),
                    className: el.className,
                    isRecommend: el.className.includes('Recommend'),
                    isSideCol: el.className.includes('SideCol'),
                    isMaximumPt: el.className.includes('maximumPt'),
                    position: { top: Math.round(rect.top), left: Math.round(rect.left) }
                  });
                }
              }
            });

            // Recommendとサイドバー要素を除外
            const filteredElements = cashbackElements.filter(el => 
              !el.isRecommend && !el.isSideCol && !el.isMaximumPt
            );

            if (filteredElements.length > 0) {
              // フォントサイズで並び替え
              filteredElements.sort((a, b) => b.fontSize - a.fontSize);
              data.debug.method = 'AdDetails filtered';
              data.debug.reason = `Found ${filteredElements.length} valid elements`;
              return filteredElements[0].text;
            }
          }

          // 方法3: 還元率が明示されていない案件として扱う
          data.debug.method = 'No valid cashback found';
          data.debug.reason = 'AdDetails area has no valid cashback display';
          return 'なし';
        };

        data.cashback = findCashback();

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

      this.campaigns.set(campaignId, campaign);
      
      // デバッグ情報付きでログ出力
      const debugInfo = campaign.debug.method === 'No valid cashback found' ? ' (還元率表示なし)' : '';
      console.log(`✓ ${campaignId}: ${campaign.name} - ${campaign.cashback}${debugInfo}`);

    } catch (error) {
      console.error(`エラー (${campaignId}):`, error.message);
    } finally {
      await page.close();
    }
  }

  // カテゴリーの全ページをスクレイピング
  async scrapeCategory(categoryName, categoryUrl, maxPages = 10) {
    console.log(`\n=== ${categoryName}カテゴリー ===`);
    const allIds = new Set();
    
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const ids = await this.collectCampaignIds(categoryUrl, pageNum);
      
      if (ids.length === 0) {
        console.log(`${pageNum}ページ目で終了（案件なし）`);
        break;
      }
      
      ids.forEach(id => allIds.add(id));
      await this.delay(2000);
    }

    console.log(`${categoryName}カテゴリー合計: ${allIds.size}件の案件ID`);
    
    // 各案件の詳細を取得
    let count = 0;
    for (const id of allIds) {
      await this.scrapeCampaignDetail(id);
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
    // テスト：正常例と問題例
    console.log('=== テスト実行 ===');
    await this.scrapeCampaignDetail('36796'); // 楽天市場（正常）
    await this.scrapeCampaignDetail('1701350'); // ANAのふるさと納税（問題例）
    await this.scrapeCampaignDetail('1729087'); // ふるさと納税 ふるラボ（問題例）
    
    const categories = [
      { name: 'ショッピング', url: 'https://www.chobirich.com/shopping/shop/101' }
    ];

    let totalCampaigns = 0;
    
    for (const category of categories) {
      const count = await this.scrapeCategory(category.name, category.url);
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
      'chobirich_ultimate_data.json',
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
      noValidCashback: 0
    };

    this.campaigns.forEach(campaign => {
      if (campaign.cashback === 'なし') {
        stats.noCashback++;
      } else if (campaign.cashback.includes('%')) {
        stats.withPercentage++;
      } else if (campaign.cashback.includes('pt')) {
        stats.withPoints++;
      } else {
        stats.noValidCashback++;
      }
    });

    console.log('\n=== 統計情報 ===');
    console.log(`総案件数: ${stats.total}`);
    console.log(`％還元: ${stats.withPercentage}件`);
    console.log(`ポイント還元: ${stats.withPoints}件`);
    console.log(`還元率表示なし: ${stats.noCashback}件`);
    console.log(`その他: ${stats.noValidCashback}件`);
    
    console.log('\n=== サンプルデータ ===');
    Array.from(this.campaigns.values()).slice(0, 10).forEach(campaign => {
      console.log(`- ${campaign.name}: ${campaign.cashback}`);
    });
  }
}

// 実行
async function main() {
  const scraper = new ChobirichUltimateScraper();
  
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