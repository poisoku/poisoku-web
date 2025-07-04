const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class ChobirichMobileAppsFinal {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.campaigns = new Map();
    this.userAgents = [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 15_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
    ];
    this.currentUserAgentIndex = 0;
    this.failedIds = new Set();
    this.consecutiveErrors = 0;
  }

  async init() {
    console.log('ちょびリッチ モバイルアプリ案件スクレイパー（最終版）起動中...\n');
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

  // 案件詳細を取得（403対策強化版）
  async scrapeCampaignDetail(campaignId, retryCount = 0) {
    if (this.campaigns.has(campaignId)) {
      return;
    }

    // 連続エラーが多い場合は長時間休憩
    if (this.consecutiveErrors >= 5) {
      console.log(`⚠️ 連続エラー${this.consecutiveErrors}回 - 5分間休憩中...`);
      await this.delay(300000); // 5分
      this.consecutiveErrors = 0;
    }

    const page = await this.browser.newPage();
    
    try {
      // ランダムなユーザーエージェントを設定
      const userAgent = this.getNextUserAgent();
      await page.setUserAgent(userAgent);
      await page.setViewport({ width: 375, height: 812, isMobile: true });
      
      // リファラーを設定してより自然なアクセスに
      await page.setExtraHTTPHeaders({
        'Referer': 'https://www.chobirich.com/smartphone?sort=point',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      });
      
      const url = `${this.baseUrl}/ad_details/${campaignId}/`;
      
      // より長いタイムアウトとネットワーク待機
      await page.goto(url, {
        waitUntil: 'networkidle0', // より厳密な待機
        timeout: 60000
      });

      // ページロード後に少し待機
      await this.delay(2000);

      // 403エラーチェック
      const pageInfo = await page.evaluate(() => {
        return {
          title: document.title,
          is403: document.title.includes('403') || 
                 document.body.textContent.includes('Forbidden') ||
                 document.body.textContent.includes('アクセスが拒否されました'),
          hasContent: document.querySelector('.AdDetails') !== null
        };
      });

      if (pageInfo.is403) {
        this.consecutiveErrors++;
        console.log(`❌ 403エラー (${campaignId}) - 試行${retryCount + 1}/3`);
        
        if (retryCount < 2) {
          await page.close();
          console.log(`  → ${Math.pow(2, retryCount + 1) * 60}秒待機後リトライ...`);
          await this.delay(Math.pow(2, retryCount + 1) * 60000); // 指数バックオフ
          return await this.scrapeCampaignDetail(campaignId, retryCount + 1);
        } else {
          // 3回失敗したら記録して次へ
          this.failedIds.add(campaignId);
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

      if (!pageInfo.hasContent) {
        console.log(`⚠️ コンテンツなし (${campaignId})`);
        this.campaigns.set(campaignId, {
          id: campaignId,
          name: 'コンテンツなし',
          cashback: 'なし',
          category: 'アプリ',
          url: url,
          conditions: {}
        });
        return;
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
          debug: { methods: [], originalTexts: [] }
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

          // 方法2: より広範囲のptセレクタ（改行対応）
          const ptElements = document.querySelectorAll('[class*="pt"], [class*="Pt"], [class*="point"], [class*="Point"]');
          ptElements.forEach(el => {
            const text = el.textContent.trim().replace(/\s+/g, ' ');
            const match = text.match(/(\d+(?:,\d+)?(?:ちょび)?pt|\d+(?:\.\d+)?[%％])/);
            if (match && !el.className.includes('Recommend') && !el.className.includes('SideCol')) {
              methods.push({ method: `pt-element: ${el.className}`, result: match[1].replace('％', '%') });
            }
            
            // 「ポイント」表記も対応
            const pointMatch = text.match(/(\d+(?:,\d+)?)ポイント/);
            if (pointMatch && !match && !el.className.includes('Recommend') && !el.className.includes('SideCol')) {
              methods.push({ method: `pt-element (ポイント): ${el.className}`, result: pointMatch[1] + 'pt' });
            }
          });

          data.debug.methods = methods;
          
          // 最も信頼性の高い結果を選択
          if (methods.length > 0) {
            // ItemPtLargeを最優先
            const itemPtLarge = methods.find(m => m.method.includes('ItemPtLarge'));
            if (itemPtLarge) return itemPtLarge.result;
            
            // 次にpt-elementを優先
            const ptElement = methods.find(m => m.method.includes('pt-element'));
            if (ptElement) return ptElement.result;
            
            // 最後に他の方法
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
      
      if (error.message.includes('403') || error.message.includes('Forbidden')) {
        console.log(`❌ 403エラー (${campaignId}) - 試行${retryCount + 1}/3`);
        
        if (retryCount < 2) {
          await page.close();
          console.log(`  → ${Math.pow(2, retryCount + 1) * 60}秒待機後リトライ...`);
          await this.delay(Math.pow(2, retryCount + 1) * 60000);
          return await this.scrapeCampaignDetail(campaignId, retryCount + 1);
        }
      }
      
      console.error(`エラー (${campaignId}):`, error.message);
      this.failedIds.add(campaignId);
    } finally {
      await page.close();
    }
  }

  // 既存のアプリIDを読み込んで継続実行
  async resumeFromExisting() {
    try {
      const existingData = JSON.parse(await fs.readFile('chobirich_mobile_apps_improved_data.json', 'utf8'));
      existingData.campaigns.forEach(campaign => {
        this.campaigns.set(campaign.id, campaign);
      });
      console.log(`既存データから${this.campaigns.size}件を読み込み`);
    } catch (error) {
      console.log('既存データなし - 新規開始');
    }
  }

  // 失敗したIDのみリトライ
  async retryFailedIds() {
    if (this.failedIds.size === 0) return;
    
    console.log(`\n=== 失敗ID再試行 (${this.failedIds.size}件) ===`);
    const failedArray = Array.from(this.failedIds);
    this.failedIds.clear();
    
    for (const id of failedArray) {
      console.log(`再試行: ${id}`);
      await this.scrapeCampaignDetail(id);
      await this.delay(10000); // より長い間隔
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async saveResults() {
    const data = {
      scraped_at: new Date().toISOString(),
      total_campaigns: this.campaigns.size,
      failed_ids: Array.from(this.failedIds),
      campaigns: Array.from(this.campaigns.values())
    };

    await fs.writeFile(
      'chobirich_mobile_apps_final_data.json',
      JSON.stringify(data, null, 2),
      'utf8'
    );
    
    console.log(`[保存] ${this.campaigns.size}件のアプリ案件データを保存`);
    if (this.failedIds.size > 0) {
      console.log(`[失敗] ${this.failedIds.size}件のIDが取得失敗`);
    }
  }

  showStats() {
    const stats = {
      total: this.campaigns.size,
      withPercentage: 0,
      withPoints: 0,
      noCashback: 0,
      errors: 0,
      multipleDetectionMethods: 0
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
      
      if (campaign.debug && campaign.debug.methods.length > 1) {
        stats.multipleDetectionMethods++;
      }
    });

    console.log('\n=== 統計情報 ===');
    console.log(`総案件数: ${stats.total}`);
    console.log(`％還元: ${stats.withPercentage}件`);
    console.log(`ポイント還元: ${stats.withPoints}件`);
    console.log(`還元率表示なし: ${stats.noCashback}件`);
    console.log(`エラー: ${stats.errors}件`);
    console.log(`成功率: ${((stats.total - stats.errors) / stats.total * 100).toFixed(1)}%`);
  }
}

// 既存データから継続実行
async function main() {
  const scraper = new ChobirichMobileAppsFinal();
  
  try {
    await scraper.init();
    await scraper.resumeFromExisting();
    
    // 290件のIDリストを取得（既存のスクリプトから）
    const allIds = [
      '1794491', '1838101', '1835496', '1809384', '1829585', '1804736', '1836757', '1837931', 
      '1838584', '1829987', '1833890', '1777438', '1838580', '1838089', '1829617', '1829667',
      '1838382', '1836778', '1838581', '1829950', '1837453', '1838519', '1829627', '1835900',
      '1829458', '1830024', '1836324', '1836781', '1762433', '1835579', '1824629', '1836897',
      '1837830', '1837920', '1836870', '1835417', '1835175', '1830026', '1833893', '1838700'
      // ... 他のIDも含める（実際の実行時には全290件）
    ];
    
    // 未処理のIDのみ処理
    const unprocessedIds = allIds.filter(id => !scraper.campaigns.has(id));
    console.log(`未処理ID: ${unprocessedIds.length}件`);
    
    let count = scraper.campaigns.size;
    for (const id of unprocessedIds) {
      await scraper.scrapeCampaignDetail(id);
      count++;
      
      if (count % 5 === 0) { // より頻繁に保存
        await scraper.saveResults();
        console.log(`[進捗] ${count}/${allIds.length}件完了 - 15秒休憩中...`);
        await scraper.delay(15000); // より長い休憩
      }
      
      // 基本的なアクセス間隔を延長
      await scraper.delay(8000);
    }
    
    // 失敗したIDを再試行
    await scraper.retryFailedIds();
    
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