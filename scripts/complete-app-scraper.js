const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class CompleteAppScraper {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.campaigns = new Map();
    this.userAgents = [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 15_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1'
    ];
    this.currentUserAgentIndex = 0;
    this.consecutiveErrors = 0;
  }

  async init() {
    console.log('完全版アプリスクレイパー起動中...\n');
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  }

  async close() {
    await this.browser.close();
  }

  getNextUserAgent() {
    const userAgent = this.userAgents[this.currentUserAgentIndex];
    this.currentUserAgentIndex = (this.currentUserAgentIndex + 1) % this.userAgents.length;
    return userAgent;
  }

  // アプリページから全IDを再収集
  async collectAllAppIds(maxPages = 10) {
    console.log('=== 全アプリIDを再収集中 ===');
    const allIds = new Set();
    
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const page = await this.browser.newPage();
      
      try {
        // モバイル設定
        const userAgent = this.getNextUserAgent();
        await page.setUserAgent(userAgent);
        await page.setViewport({ width: 375, height: 812, isMobile: true });
        
        const url = pageNum === 1 
          ? `${this.baseUrl}/smartphone?sort=point`
          : `${this.baseUrl}/smartphone?sort=point&page=${pageNum}`;
        
        console.log(`ページ${pageNum}を収集中: ${url}`);
        
        await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: 60000
        });

        const pageInfo = await page.evaluate(() => {
          const is403 = document.title.includes('403') || 
                       document.body.textContent.includes('Forbidden');
          
          if (is403) return { is403: true, campaignCount: 0, ids: [] };
          
          const campaignLinks = document.querySelectorAll('a[href*="/ad_details/"]');
          const ids = [];
          
          campaignLinks.forEach(link => {
            const match = link.href.match(/\/ad_details\/(\d+)/);
            if (match) {
              ids.push(match[1]);
            }
          });
          
          return {
            is403: false,
            campaignCount: campaignLinks.length,
            ids: [...new Set(ids)] // 重複除去
          };
        });

        if (pageInfo.is403) {
          console.log(`  → 403エラー - 120秒待機中...`);
          await this.delay(120000);
          continue;
        }

        if (pageInfo.campaignCount === 0) {
          console.log(`  → ページ${pageNum}で終了（案件なし）`);
          break;
        }

        pageInfo.ids.forEach(id => allIds.add(id));
        console.log(`  → ${pageInfo.ids.length}件のID取得 (累計: ${allIds.size}件)`);
        
        await this.delay(5000);
        
      } catch (error) {
        console.error(`ページ${pageNum}エラー:`, error.message);
        
        if (error.message.includes('403')) {
          console.log(`  → 403エラー - 120秒待機中...`);
          await this.delay(120000);
        }
      } finally {
        await page.close();
      }
    }
    
    console.log(`\n合計: ${allIds.size}件のアプリ案件IDを発見`);
    return Array.from(allIds);
  }

  // 案件詳細を取得（403対策強化版）
  async scrapeCampaignDetail(campaignId, retryCount = 0) {
    if (this.campaigns.has(campaignId)) {
      return;
    }

    // 連続エラーが多い場合は長時間休憩
    if (this.consecutiveErrors >= 3) {
      console.log(`⚠️ 連続エラー${this.consecutiveErrors}回 - 3分間休憩中...`);
      await this.delay(180000); // 3分
      this.consecutiveErrors = 0;
    }

    const page = await this.browser.newPage();
    
    try {
      // ランダムなユーザーエージェントを設定
      const userAgent = this.getNextUserAgent();
      await page.setUserAgent(userAgent);
      await page.setViewport({ width: 375, height: 812, isMobile: true });
      
      // リファラーを設定
      await page.setExtraHTTPHeaders({
        'Referer': 'https://www.chobirich.com/smartphone?sort=point',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
      });
      
      const url = `${this.baseUrl}/ad_details/${campaignId}/`;
      
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      await this.delay(1000);

      // 403エラーチェック
      const pageInfo = await page.evaluate(() => {
        return {
          title: document.title,
          is403: document.title.includes('403') || 
                 document.body.textContent.includes('Forbidden'),
          hasContent: document.querySelector('.AdDetails') !== null
        };
      });

      if (pageInfo.is403) {
        this.consecutiveErrors++;
        console.log(`❌ 403エラー (${campaignId}) - 試行${retryCount + 1}/2`);
        
        if (retryCount < 1) {
          await page.close();
          const waitTime = (retryCount + 1) * 60;
          console.log(`  → ${waitTime}秒待機後リトライ...`);
          await this.delay(waitTime * 1000);
          return await this.scrapeCampaignDetail(campaignId, retryCount + 1);
        } else {
          // 失敗として記録
          this.campaigns.set(campaignId, {
            id: campaignId,
            name: '403 Forbidden',
            cashback: 'なし',
            category: 'アプリ',
            url: url,
            conditions: {},
            error: '403 Forbidden'
          });
          return;
        }
      }

      // 正常な場合は連続エラーカウントをリセット
      this.consecutiveErrors = 0;

      const campaign = await page.evaluate(() => {
        const data = {
          id: window.location.pathname.match(/\/ad_details\/(\d+)/)?.[1],
          name: '',
          cashback: '',
          category: 'アプリ',
          url: window.location.href,
          conditions: {},
          debug: { methods: [] }
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

        // 還元率を取得（改良版）
        const findCashback = () => {
          const methods = [];
          
          // 方法1: 既存のセレクタ（改行対応）
          const mainPtElement = document.querySelector('.AdDetails__pt.ItemPtLarge');
          if (mainPtElement) {
            const text = mainPtElement.textContent.trim().replace(/\s+/g, ' ');
            const match = text.match(/(\d+(?:,\d+)?(?:ちょび)?pt|\d+(?:\.\d+)?[%％])/);
            if (match) {
              methods.push({ method: 'AdDetails__pt ItemPtLarge', result: match[1].replace('％', '%') });
            }
            
            // 「ポイント」表記も対応
            const pointMatch = text.match(/(\d+(?:,\d+)?)ポイント/);
            if (pointMatch && !match) {
              methods.push({ method: 'AdDetails__pt ItemPtLarge (ポイント)', result: pointMatch[1] + 'pt' });
            }
          }

          data.debug.methods = methods;
          
          if (methods.length > 0) {
            return methods[0].result;
          }

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
      
      const debugInfo = campaign.debug.methods.length > 0 
        ? ` (${campaign.debug.methods.length}種類の方法で検出)`
        : '';
      
      console.log(`✓ ${campaignId}: ${campaign.name} - ${campaign.cashback}${debugInfo}`);

    } catch (error) {
      this.consecutiveErrors++;
      console.error(`エラー (${campaignId}):`, error.message);
      
      if (error.message.includes('403') && retryCount < 1) {
        await page.close();
        console.log(`  → 60秒待機後リトライ...`);
        await this.delay(60000);
        return await this.scrapeCampaignDetail(campaignId, retryCount + 1);
      }
    } finally {
      await page.close();
    }
  }

  // 既存データから読み込み
  async loadExistingData() {
    try {
      const files = [
        'chobirich_mobile_apps_improved_data.json',
        'chobirich_mobile_apps_data.json',
        'chobirich_mobile_apps_final_data.json'
      ];
      
      for (const file of files) {
        try {
          const data = JSON.parse(await fs.readFile(file, 'utf8'));
          data.campaigns.forEach(campaign => {
            this.campaigns.set(campaign.id, campaign);
          });
          console.log(`${file}から${data.campaigns.length}件を読み込み`);
          break;
        } catch (e) {
          // ファイルが存在しない場合は次を試す
        }
      }
      
      console.log(`既存データ合計: ${this.campaigns.size}件`);
    } catch (error) {
      console.log('既存データなし - 新規開始');
    }
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
      'chobirich_complete_apps_data.json',
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
      errors: 0
    };

    this.campaigns.forEach(campaign => {
      if (campaign.error) {
        stats.errors++;
      } else if (campaign.cashback === 'なし') {
        stats.noCashback++;
      } else if (campaign.cashback.includes('%')) {
        stats.withPercentage++;
      } else if (campaign.cashback.includes('pt')) {
        stats.withPoints++;
      }
    });

    console.log('\n=== 最終統計情報 ===');
    console.log(`総案件数: ${stats.total}`);
    console.log(`％還元: ${stats.withPercentage}件`);
    console.log(`ポイント還元: ${stats.withPoints}件`);
    console.log(`還元率表示なし: ${stats.noCashback}件`);
    console.log(`エラー: ${stats.errors}件`);
    console.log(`成功率: ${((stats.total - stats.errors) / stats.total * 100).toFixed(1)}%`);
  }
}

// メイン実行
async function main() {
  const scraper = new CompleteAppScraper();
  
  try {
    await scraper.init();
    await scraper.loadExistingData();
    
    // 全アプリIDを再収集
    const allIds = await scraper.collectAllAppIds(10);
    
    // 未処理のIDのみ処理
    const unprocessedIds = allIds.filter(id => !scraper.campaigns.has(id));
    console.log(`\n未処理ID: ${unprocessedIds.length}件`);
    
    if (unprocessedIds.length > 0) {
      let count = 0;
      for (const id of unprocessedIds) {
        await scraper.scrapeCampaignDetail(id);
        count++;
        
        if (count % 5 === 0) {
          await scraper.saveResults();
          console.log(`[進捗] ${count}/${unprocessedIds.length}件完了 - 10秒休憩中...`);
          await scraper.delay(10000);
        }
        
        // 基本的なアクセス間隔
        await scraper.delay(6000);
      }
    }
    
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