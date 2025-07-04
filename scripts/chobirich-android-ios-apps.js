const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class ChobirichAndroidIOSApps {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.campaigns = new Map();
    
    // iOS用ユーザーエージェント
    this.iosUserAgents = [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 15_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1'
    ];
    
    // Android用ユーザーエージェント
    this.androidUserAgents = [
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
      'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
      'Mozilla/5.0 (Linux; Android 11; SM-A515F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36'
    ];
    
    this.currentUserAgentIndex = 0;
    this.consecutiveErrors = 0;
  }

  async init() {
    console.log('ちょびリッチ Android/iOS両対応アプリスクレイパー起動中...\n');
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  }

  async close() {
    await this.browser.close();
  }

  getNextUserAgent(isAndroid = false) {
    const agents = isAndroid ? this.androidUserAgents : this.iosUserAgents;
    const userAgent = agents[this.currentUserAgentIndex % agents.length];
    this.currentUserAgentIndex++;
    return userAgent;
  }

  // OSごとにアプリIDを収集
  async collectAppIdsByOS(osType = 'ios', maxPages = 10) {
    console.log(`\n=== ${osType.toUpperCase()}アプリIDを収集中 ===`);
    const allIds = new Map(); // IDとOS情報を保持
    
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const page = await this.browser.newPage();
      
      try {
        // OS別のユーザーエージェント設定
        const userAgent = this.getNextUserAgent(osType === 'android');
        await page.setUserAgent(userAgent);
        
        // デバイスに応じたビューポート設定
        if (osType === 'android') {
          await page.setViewport({ width: 412, height: 915, isMobile: true });
        } else {
          await page.setViewport({ width: 375, height: 812, isMobile: true });
        }
        
        const url = pageNum === 1 
          ? `${this.baseUrl}/smartphone?sort=point`
          : `${this.baseUrl}/smartphone?sort=point&page=${pageNum}`;
        
        console.log(`[${osType.toUpperCase()}] ページ${pageNum}を収集中: ${url}`);
        
        await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: 60000
        });

        await this.delay(2000);

        const pageInfo = await page.evaluate(() => {
          const is403 = document.title.includes('403') || 
                       document.body.textContent.includes('Forbidden');
          
          if (is403) return { is403: true, campaignData: [] };
          
          const campaignData = [];
          const campaignElements = document.querySelectorAll('a[href*="/ad_details/"]');
          
          campaignElements.forEach(link => {
            const match = link.href.match(/\/ad_details\/(\d+)/);
            if (match) {
              const campaignId = match[1];
              const parentElement = link.closest('.item') || link.parentElement;
              let campaignName = '';
              
              // 案件名を取得
              if (parentElement) {
                const nameElement = parentElement.querySelector('.item_name, .campaign_name, h3, h4');
                if (nameElement) {
                  campaignName = nameElement.textContent.trim();
                } else {
                  campaignName = link.textContent.trim();
                }
              }
              
              // OS判定（案件名から）
              const isIOS = campaignName.includes('iOS') || campaignName.includes('iPhone');
              const isAndroid = campaignName.includes('Android') || campaignName.includes('アンドロイド');
              
              campaignData.push({
                id: campaignId,
                name: campaignName,
                detectedOS: isIOS ? 'ios' : (isAndroid ? 'android' : 'unknown')
              });
            }
          });
          
          // 重複を除去
          const uniqueData = campaignData.filter((item, index, self) =>
            index === self.findIndex((t) => t.id === item.id)
          );
          
          return {
            is403: false,
            campaignData: uniqueData
          };
        });

        if (pageInfo.is403) {
          console.log(`  → 403エラー - 120秒待機中...`);
          await this.delay(120000);
          continue;
        }

        if (pageInfo.campaignData.length === 0) {
          console.log(`  → ページ${pageNum}で終了（案件なし）`);
          break;
        }

        // IDとOS情報を記録
        pageInfo.campaignData.forEach(campaign => {
          if (!allIds.has(campaign.id)) {
            allIds.set(campaign.id, {
              id: campaign.id,
              name: campaign.name,
              detectedOS: campaign.detectedOS,
              accessedOS: osType
            });
          }
        });
        
        console.log(`  → ${pageInfo.campaignData.length}件のID取得 (累計: ${allIds.size}件)`);
        
        // OS別の内訳を表示
        const osBreakdown = {
          ios: pageInfo.campaignData.filter(c => c.detectedOS === 'ios').length,
          android: pageInfo.campaignData.filter(c => c.detectedOS === 'android').length,
          unknown: pageInfo.campaignData.filter(c => c.detectedOS === 'unknown').length
        };
        console.log(`     OS内訳: iOS=${osBreakdown.ios}, Android=${osBreakdown.android}, 不明=${osBreakdown.unknown}`);
        
        await this.delay(5000);
        
      } catch (error) {
        console.error(`[${osType.toUpperCase()}] ページ${pageNum}エラー:`, error.message);
        
        if (error.message.includes('403')) {
          console.log(`  → 403エラー - 120秒待機中...`);
          await this.delay(120000);
        }
      } finally {
        await page.close();
      }
    }
    
    return allIds;
  }

  // 案件詳細を取得（OS情報付き）
  async scrapeCampaignDetail(campaignInfo, retryCount = 0) {
    const campaignId = campaignInfo.id;
    
    if (this.campaigns.has(campaignId)) {
      return;
    }

    if (this.consecutiveErrors >= 3) {
      console.log(`⚠️ 連続エラー${this.consecutiveErrors}回 - 3分間休憩中...`);
      await this.delay(180000);
      this.consecutiveErrors = 0;
    }

    const page = await this.browser.newPage();
    
    try {
      // アクセス時のOSに応じたUser-Agentを使用
      const useAndroid = campaignInfo.accessedOS === 'android' || campaignInfo.detectedOS === 'android';
      const userAgent = this.getNextUserAgent(useAndroid);
      await page.setUserAgent(userAgent);
      
      if (useAndroid) {
        await page.setViewport({ width: 412, height: 915, isMobile: true });
      } else {
        await page.setViewport({ width: 375, height: 812, isMobile: true });
      }
      
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
          await this.delay(60000);
          return await this.scrapeCampaignDetail(campaignInfo, retryCount + 1);
        } else {
          this.campaigns.set(campaignId, {
            id: campaignId,
            name: campaignInfo.name || '403 Forbidden',
            cashback: 'なし',
            category: 'アプリ',
            os: campaignInfo.detectedOS,
            url: url,
            conditions: {},
            error: '403 Forbidden'
          });
          return;
        }
      }

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

        // OS判定
        data.os = 'unknown';
        if (data.name.includes('iOS') || data.name.includes('iPhone')) {
          data.os = 'ios';
        } else if (data.name.includes('Android') || data.name.includes('アンドロイド')) {
          data.os = 'android';
        } else if (data.name.includes('多段階')) {
          // 多段階は通常両OS対応
          data.os = 'both';
        }

        // 還元率を取得
        const findCashback = () => {
          const methods = [];
          
          const mainPtElement = document.querySelector('.AdDetails__pt.ItemPtLarge');
          if (mainPtElement) {
            const text = mainPtElement.textContent.trim().replace(/\s+/g, ' ');
            const match = text.match(/(\d+(?:,\d+)?(?:ちょび)?pt|\d+(?:\.\d+)?[%％])/);
            if (match) {
              methods.push({ method: 'AdDetails__pt ItemPtLarge', result: match[1].replace('％', '%') });
            }
            
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

      // 検出されたOS情報を優先的に使用
      if (campaign.os === 'unknown' && campaignInfo.detectedOS !== 'unknown') {
        campaign.os = campaignInfo.detectedOS;
      }

      this.campaigns.set(campaignId, campaign);
      
      const debugInfo = campaign.debug.methods.length > 0 
        ? ` (${campaign.debug.methods.length}種類の方法で検出)`
        : '';
      
      console.log(`✓ ${campaignId}: ${campaign.name} - ${campaign.cashback} [${campaign.os.toUpperCase()}]${debugInfo}`);

    } catch (error) {
      this.consecutiveErrors++;
      console.error(`エラー (${campaignId}):`, error.message);
    } finally {
      await page.close();
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async saveResults() {
    const data = {
      scraped_at: new Date().toISOString(),
      total_campaigns: this.campaigns.size,
      os_breakdown: {
        ios: 0,
        android: 0,
        both: 0,
        unknown: 0
      },
      campaigns: Array.from(this.campaigns.values())
    };

    // OS別集計
    data.campaigns.forEach(campaign => {
      if (campaign.os) {
        data.os_breakdown[campaign.os]++;
      }
    });

    await fs.writeFile(
      'chobirich_android_ios_apps_data.json',
      JSON.stringify(data, null, 2),
      'utf8'
    );
    
    console.log(`[保存] ${this.campaigns.size}件のアプリ案件データを保存`);
  }

  showStats() {
    const stats = {
      total: this.campaigns.size,
      byOS: {
        ios: 0,
        android: 0,
        both: 0,
        unknown: 0
      },
      withPercentage: 0,
      withPoints: 0,
      noCashback: 0,
      errors: 0
    };

    this.campaigns.forEach(campaign => {
      // OS別集計
      if (campaign.os) {
        stats.byOS[campaign.os]++;
      }
      
      // 還元率タイプ別集計
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
    console.log('\n=== OS別内訳 ===');
    console.log(`iOS専用: ${stats.byOS.ios}件`);
    console.log(`Android専用: ${stats.byOS.android}件`);
    console.log(`両OS対応: ${stats.byOS.both}件`);
    console.log(`OS不明: ${stats.byOS.unknown}件`);
    console.log('\n=== 還元率タイプ別 ===');
    console.log(`％還元: ${stats.withPercentage}件`);
    console.log(`ポイント還元: ${stats.withPoints}件`);
    console.log(`還元率表示なし: ${stats.noCashback}件`);
    console.log(`エラー: ${stats.errors}件`);
    console.log(`成功率: ${((stats.total - stats.errors) / stats.total * 100).toFixed(1)}%`);
  }
}

// メイン実行
async function main() {
  const scraper = new ChobirichAndroidIOSApps();
  
  try {
    await scraper.init();
    
    // 1. iOSでアクセスしてID収集
    const iosIds = await scraper.collectAppIdsByOS('ios', 10);
    
    // 2. Androidでアクセスしてさらに収集
    const androidIds = await scraper.collectAppIdsByOS('android', 10);
    
    // 3. すべてのIDを統合（重複除去）
    const allCampaigns = new Map();
    
    iosIds.forEach((value, key) => {
      allCampaigns.set(key, value);
    });
    
    androidIds.forEach((value, key) => {
      if (!allCampaigns.has(key)) {
        allCampaigns.set(key, value);
      } else {
        // 既存の場合はOS情報を更新
        const existing = allCampaigns.get(key);
        if (existing.detectedOS === 'unknown' && value.detectedOS !== 'unknown') {
          existing.detectedOS = value.detectedOS;
        }
      }
    });
    
    console.log(`\n=== 統合結果 ===`);
    console.log(`総案件数: ${allCampaigns.size}件`);
    
    // OS別の内訳表示
    const osStats = {
      ios: 0,
      android: 0,
      unknown: 0
    };
    
    allCampaigns.forEach(campaign => {
      osStats[campaign.detectedOS]++;
    });
    
    console.log(`iOS案件: ${osStats.ios}件`);
    console.log(`Android案件: ${osStats.android}件`);
    console.log(`OS不明: ${osStats.unknown}件`);
    
    // 4. 各案件の詳細を取得
    console.log(`\n=== 詳細取得開始 ===`);
    let count = 0;
    const campaignArray = Array.from(allCampaigns.values());
    
    for (const campaignInfo of campaignArray) {
      await scraper.scrapeCampaignDetail(campaignInfo);
      count++;
      
      if (count % 5 === 0) {
        await scraper.saveResults();
        console.log(`[進捗] ${count}/${campaignArray.length}件完了 - 10秒休憩中...`);
        await scraper.delay(10000);
      }
      
      await scraper.delay(6000);
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