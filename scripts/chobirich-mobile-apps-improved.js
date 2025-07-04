const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class ChobirichMobileAppsImproved {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.campaigns = new Map();
    this.userAgents = [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 15_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1'
    ];
    this.currentUserAgentIndex = 0;
  }

  async init() {
    console.log('ちょびリッチ モバイルアプリ案件スクレイパー（改良版）起動中...\n');
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

  // モバイルアプリページから案件IDを収集
  async collectAppCampaignIds(page = 1) {
    const browserPage = await this.browser.newPage();
    
    // ランダムなユーザーエージェントを設定
    const userAgent = this.getNextUserAgent();
    await browserPage.setUserAgent(userAgent);
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

      const pageInfo = await browserPage.evaluate(() => {
        const is404 = document.title.includes('404') || 
                     document.body.textContent.includes('ページが見つかりません');
        
        const is403 = document.title.includes('403') || 
                     document.body.textContent.includes('Forbidden');
        
        const campaignLinks = document.querySelectorAll('a[href*="/ad_details/"]');
        
        return {
          is404: is404,
          is403: is403,
          campaignCount: campaignLinks.length,
          title: document.title
        };
      });

      if (pageInfo.is403) {
        console.log(`  → 403エラー - 60秒待機中...`);
        await this.delay(60000);
        return [];
      }

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
      if (error.message.includes('403')) {
        console.log(`  → 403エラー検知 - 60秒待機中...`);
        await this.delay(60000);
      } else {
        console.error(`エラー (${url}):`, error.message);
      }
      return [];
    } finally {
      await browserPage.close();
    }
  }

  // 案件詳細を取得（改良版 - 還元率検出強化）
  async scrapeCampaignDetail(campaignId) {
    if (this.campaigns.has(campaignId)) {
      return;
    }

    const page = await this.browser.newPage();
    
    // ランダムなユーザーエージェントを設定
    const userAgent = this.getNextUserAgent();
    await page.setUserAgent(userAgent);
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

        // 還元率を取得（複数の方法で試行）
        const findCashback = () => {
          const methods = [];
          
          // 方法1: 既存のセレクタ（改行対応）
          const mainPtElement = document.querySelector('.AdDetails__pt.ItemPtLarge');
          if (mainPtElement) {
            const text = mainPtElement.textContent.trim().replace(/\s+/g, ' '); // 改行・空白を正規化
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

          // 方法3: AdDetailsエリア内の全テキストを調査
          const adDetailsArea = document.querySelector('.AdDetails');
          if (adDetailsArea) {
            const walker = document.createTreeWalker(
              adDetailsArea,
              NodeFilter.SHOW_TEXT,
              null,
              false
            );

            let textNode;
            while (textNode = walker.nextNode()) {
              const text = textNode.textContent.trim();
              const match = text.match(/^(\d+(?:\.\d+)?[%％]|\d+(?:,\d+)?(?:ちょび)?pt)$/);
              if (match && 
                  !textNode.parentElement?.className.includes('Recommend') && 
                  !textNode.parentElement?.className.includes('SideCol')) {
                methods.push({ 
                  method: `text-node: ${textNode.parentElement?.className}`, 
                  result: match[1].replace('％', '%') 
                });
              }
            }
          }

          // 方法4: 特殊なアプリ案件パターン
          const specialPatterns = ['無料', 'ダウンロード', 'インストール', '初回起動', '会員登録'];
          const hasSpecialPattern = specialPatterns.some(pattern => 
            document.body.textContent.includes(pattern)
          );
          
          if (hasSpecialPattern && methods.length === 0) {
            // アプリ案件でよくある固定ポイントパターンを探す
            const fixedPointElements = document.querySelectorAll('*');
            fixedPointElements.forEach(el => {
              const text = el.textContent.trim();
              const match = text.match(/(\d+(?:,\d+)?(?:ちょび)?pt)/);
              if (match && text.length < 20) { // 短いテキストで数値のみ
                methods.push({ method: 'app-fixed-point', result: match[1] });
              }
            });
          }

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
      if (error.message.includes('403')) {
        console.log(`  → 403エラー (${campaignId}) - 60秒待機中...`);
        await this.delay(60000);
      } else {
        console.error(`エラー (${campaignId}):`, error.message);
      }
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
      
      // ページ間の待機時間を延長
      await this.delay(5000);
    }

    console.log(`\n合計: ${allIds.size}件のアプリ案件IDを発見`);
    
    // 各案件の詳細を取得
    let count = 0;
    for (const id of allIds) {
      await this.scrapeCampaignDetail(id);
      count++;
      
      // 進捗保存とより長い休憩
      if (count % 10 === 0) {
        await this.saveResults();
        console.log(`[進捗] ${count}/${allIds.size}件完了 - 10秒休憩中...`);
        await this.delay(10000);
      }
      
      // 基本的なアクセス間隔を延長
      await this.delay(3000);
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
      'chobirich_mobile_apps_improved_data.json',
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
      multipleDetectionMethods: 0
    };

    this.campaigns.forEach(campaign => {
      if (campaign.cashback === 'なし') {
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
    console.log(`複数検出方法: ${stats.multipleDetectionMethods}件`);
    
    console.log('\n=== サンプルデータ ===');
    Array.from(this.campaigns.values()).slice(0, 10).forEach(campaign => {
      console.log(`- ${campaign.name}: ${campaign.cashback}`);
    });
  }
}

// 実行
async function main() {
  const scraper = new ChobirichMobileAppsImproved();
  
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