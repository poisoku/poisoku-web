const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class ChobirichMobileApps {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.campaigns = new Map();
  }

  async init() {
    console.log('ちょびリッチ モバイルアプリ案件スクレイパー起動中...\n');
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  }

  async close() {
    await this.browser.close();
  }

  // モバイルアプリページから案件IDを収集
  async collectAppCampaignIds(page = 1) {
    const browserPage = await this.browser.newPage();
    
    // iPhoneのユーザーエージェントを設定
    await browserPage.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
    await browserPage.setViewport({ width: 375, height: 812, isMobile: true });
    
    const url = page === 1 
      ? `${this.baseUrl}/smartphone?sort=point`
      : `${this.baseUrl}/smartphone?sort=point&page=${page}`;
    
    try {
      console.log(`モバイルアプリページ取得: ${url}`);
      await browserPage.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      // ページが正しく読み込まれたか確認
      const pageInfo = await browserPage.evaluate(() => {
        const is404 = document.title.includes('404') || 
                     document.body.textContent.includes('ページが見つかりません');
        
        // モバイル専用ページの確認
        const isMobilePage = document.body.textContent.includes('アプリ') ||
                           document.querySelector('[class*="app"]') !== null ||
                           document.querySelector('[class*="smartphone"]') !== null;
        
        const campaignLinks = document.querySelectorAll('a[href*="/ad_details/"]');
        
        // デバッグ情報
        const debugInfo = {
          title: document.title,
          hasAppKeyword: document.body.textContent.includes('アプリ'),
          campaignCount: campaignLinks.length,
          sampleLinks: Array.from(campaignLinks).slice(0, 3).map(link => ({
            href: link.href,
            text: link.textContent.trim().substring(0, 50)
          }))
        };
        
        return {
          is404: is404,
          isMobilePage: isMobilePage,
          campaignCount: campaignLinks.length,
          debugInfo: debugInfo
        };
      });

      console.log(`  → ページ情報:`, pageInfo.debugInfo);

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

      console.log(`  → ${campaignIds.length}件のアプリ案件ID取得`);
      return campaignIds;

    } catch (error) {
      console.error(`エラー (${url}):`, error.message);
      return [];
    } finally {
      await browserPage.close();
    }
  }

  // 案件詳細を取得（既存のロジックを使用）
  async scrapeCampaignDetail(campaignId) {
    if (this.campaigns.has(campaignId)) {
      return;
    }

    const page = await this.browser.newPage();
    
    // モバイルユーザーエージェントを維持
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
    await page.setViewport({ width: 375, height: 812, isMobile: true });
    
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
          category: 'アプリ',
          url: window.location.href,
          conditions: {},
          isApp: false
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

        // アプリ案件かどうか確認
        data.isApp = data.name.includes('アプリ') || 
                    document.body.textContent.includes('ダウンロード') ||
                    document.body.textContent.includes('インストール');

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

      this.campaigns.set(campaignId, campaign);
      console.log(`✓ ${campaignId}: ${campaign.name} - ${campaign.cashback} ${campaign.isApp ? '[アプリ]' : ''}`);

    } catch (error) {
      console.error(`エラー (${campaignId}):`, error.message);
    } finally {
      await page.close();
    }
  }

  // メイン処理
  async scrapeAll(maxPages = 10) {
    console.log('=== モバイルアプリ案件収集開始 ===\n');
    const allIds = new Set();
    
    // 複数ページをチェック
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const ids = await this.collectAppCampaignIds(pageNum);
      
      if (ids.length === 0) {
        console.log(`${pageNum}ページ目で終了（案件なし）`);
        break;
      }
      
      ids.forEach(id => allIds.add(id));
      await this.delay(2000);
    }

    console.log(`\n合計: ${allIds.size}件のアプリ案件IDを発見`);
    
    // 各案件の詳細を取得
    let count = 0;
    for (const id of allIds) {
      await this.scrapeCampaignDetail(id);
      count++;
      
      if (count % 10 === 0) {
        await this.saveResults();
        console.log(`[進捗] ${count}/${allIds.size}件完了`);
      }
      
      await this.delay(1500);
    }
    
    return allIds.size;
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
      'chobirich_mobile_apps_data.json',
      JSON.stringify(data, null, 2),
      'utf8'
    );
    
    console.log(`[保存] ${this.campaigns.size}件のアプリ案件データを保存`);
  }

  showStats() {
    const stats = {
      total: this.campaigns.size,
      withPercentage: 0,
      withPoints: 0,
      noCashback: 0,
      appRelated: 0
    };

    this.campaigns.forEach(campaign => {
      if (campaign.cashback === 'なし') {
        stats.noCashback++;
      } else if (campaign.cashback.includes('%')) {
        stats.withPercentage++;
      } else if (campaign.cashback.includes('pt')) {
        stats.withPoints++;
      }
      
      if (campaign.isApp) {
        stats.appRelated++;
      }
    });

    console.log('\n=== 統計情報 ===');
    console.log(`総案件数: ${stats.total}`);
    console.log(`％還元: ${stats.withPercentage}件`);
    console.log(`ポイント還元: ${stats.withPoints}件`);
    console.log(`還元率表示なし: ${stats.noCashback}件`);
    console.log(`アプリ関連案件: ${stats.appRelated}件`);
    
    console.log('\n=== サンプルデータ ===');
    Array.from(this.campaigns.values()).slice(0, 10).forEach(campaign => {
      console.log(`- ${campaign.name}: ${campaign.cashback}`);
    });
  }
}

// 実行
async function main() {
  const scraper = new ChobirichMobileApps();
  
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