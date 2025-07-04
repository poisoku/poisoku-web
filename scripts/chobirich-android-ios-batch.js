const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class ChobirichAndroidIOSBatch {
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
      'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36'
    ];
    
    this.currentUserAgentIndex = 0;
    this.consecutiveErrors = 0;
    this.allCampaignIds = null; // ID情報を保持
  }

  async init() {
    console.log('ちょびリッチ Android/iOS バッチ処理スクレイパー起動中...\n');
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process'
      ]
    });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  getNextUserAgent(isAndroid = false) {
    const agents = isAndroid ? this.androidUserAgents : this.iosUserAgents;
    const userAgent = agents[this.currentUserAgentIndex % agents.length];
    this.currentUserAgentIndex++;
    return userAgent;
  }

  // ステップ1: ID収集フェーズ
  async collectAllIds() {
    console.log('=== ステップ1: ID収集フェーズ ===\n');
    
    // 既存のIDリストファイルをチェック
    try {
      const existingData = JSON.parse(await fs.readFile('chobirich_all_ids.json', 'utf8'));
      console.log(`既存のIDリスト読み込み: ${existingData.total}件`);
      this.allCampaignIds = new Map(existingData.campaigns.map(c => [c.id, c]));
      return;
    } catch (e) {
      console.log('新規ID収集を開始します...');
    }
    
    const allIds = new Map();
    
    // iOS収集
    console.log('iOS用User-Agentで収集...');
    const iosIds = await this.collectIdsByOS('ios', 10);
    iosIds.forEach((value, key) => allIds.set(key, value));
    
    // ブラウザを再起動（メモリ解放）
    await this.close();
    await this.init();
    
    // Android収集
    console.log('\nAndroid用User-Agentで収集...');
    const androidIds = await this.collectIdsByOS('android', 10);
    androidIds.forEach((value, key) => {
      if (!allIds.has(key)) {
        allIds.set(key, value);
      } else {
        const existing = allIds.get(key);
        if (existing.detectedOS === 'unknown' && value.detectedOS !== 'unknown') {
          existing.detectedOS = value.detectedOS;
        }
      }
    });
    
    // ID情報を保存
    const idData = {
      scraped_at: new Date().toISOString(),
      total: allIds.size,
      campaigns: Array.from(allIds.values())
    };
    
    await fs.writeFile('chobirich_all_ids.json', JSON.stringify(idData, null, 2), 'utf8');
    console.log(`\nIDリストを保存: ${allIds.size}件`);
    
    this.allCampaignIds = allIds;
  }

  // OSごとのID収集（既存メソッドを簡略化）
  async collectIdsByOS(osType, maxPages) {
    const allIds = new Map();
    
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const page = await this.browser.newPage();
      
      try {
        const userAgent = this.getNextUserAgent(osType === 'android');
        await page.setUserAgent(userAgent);
        
        if (osType === 'android') {
          await page.setViewport({ width: 412, height: 915, isMobile: true });
        } else {
          await page.setViewport({ width: 375, height: 812, isMobile: true });
        }
        
        const url = pageNum === 1 
          ? `${this.baseUrl}/smartphone?sort=point`
          : `${this.baseUrl}/smartphone?sort=point&page=${pageNum}`;
        
        console.log(`[${osType.toUpperCase()}] ページ${pageNum}: ${url}`);
        
        await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: 60000
        });

        await this.delay(2000);

        const pageInfo = await page.evaluate((currentOsType) => {
          const is403 = document.title.includes('403') || 
                       document.body.textContent.includes('Forbidden');
          
          if (is403) return { is403: true, campaignData: [] };
          
          const campaignData = [];
          const links = document.querySelectorAll('a[href*="/ad_details/"]');
          
          links.forEach(link => {
            const match = link.href.match(/\/ad_details\/(\d+)/);
            if (match) {
              const campaignId = match[1];
              let campaignName = link.textContent.trim();
              
              // 親要素から名前を取得
              const parent = link.closest('[class*="item"], li, div');
              if (parent) {
                const nameEl = parent.querySelector('[class*="name"], h3, h4, span');
                if (nameEl) campaignName = nameEl.textContent.trim();
              }
              
              const isIOS = campaignName.includes('iOS') || campaignName.includes('iPhone');
              const isAndroid = campaignName.includes('Android') || campaignName.includes('アンドロイド');
              
              campaignData.push({
                id: campaignId,
                name: campaignName,
                detectedOS: isIOS ? 'ios' : (isAndroid ? 'android' : 'unknown'),
                accessedOS: currentOsType
              });
            }
          });
          
          const uniqueData = campaignData.filter((item, index, self) =>
            index === self.findIndex((t) => t.id === item.id)
          );
          
          return { is403: false, campaignData: uniqueData };
        }, osType);

        if (pageInfo.is403) {
          console.log(`  → 403エラー - 120秒待機中...`);
          await this.delay(120000);
          continue;
        }

        if (pageInfo.campaignData.length === 0) {
          console.log(`  → 終了（案件なし）`);
          break;
        }

        pageInfo.campaignData.forEach(campaign => {
          allIds.set(campaign.id, campaign);
        });
        
        console.log(`  → ${pageInfo.campaignData.length}件取得`);
        
        await this.delay(5000);
        
      } catch (error) {
        console.error(`エラー:`, error.message);
        if (error.message.includes('403')) {
          await this.delay(120000);
        }
      } finally {
        await page.close();
      }
    }
    
    return allIds;
  }

  // ステップ2: 詳細取得フェーズ（バッチ処理）
  async scrapeDetailsInBatches(batchSize = 50) {
    console.log('\n=== ステップ2: 詳細取得フェーズ ===\n');
    
    // 既存の詳細データを読み込み
    try {
      const existingData = JSON.parse(await fs.readFile('chobirich_android_ios_apps_data.json', 'utf8'));
      existingData.campaigns.forEach(campaign => {
        this.campaigns.set(campaign.id, campaign);
      });
      console.log(`既存データ: ${this.campaigns.size}件`);
    } catch (e) {
      console.log('新規詳細取得を開始...');
    }
    
    // 未処理のIDを特定
    const unprocessedIds = [];
    this.allCampaignIds.forEach((value, key) => {
      if (!this.campaigns.has(key)) {
        unprocessedIds.push(value);
      }
    });
    
    console.log(`未処理: ${unprocessedIds.length}件\n`);
    
    if (unprocessedIds.length === 0) {
      console.log('すべての案件が処理済みです');
      return;
    }
    
    // バッチ処理
    for (let i = 0; i < unprocessedIds.length; i += batchSize) {
      const batch = unprocessedIds.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(unprocessedIds.length / batchSize);
      
      console.log(`\n=== バッチ ${batchNum}/${totalBatches} (${batch.length}件) ===`);
      
      // 各バッチの処理
      for (const campaignInfo of batch) {
        await this.scrapeCampaignDetail(campaignInfo);
        await this.delay(5000); // 5秒間隔
      }
      
      // バッチ完了後の処理
      await this.saveResults();
      console.log(`バッチ${batchNum}完了 - 進捗: ${this.campaigns.size}/${this.allCampaignIds.size}件`);
      
      // バッチ間で長めの休憩
      if (i + batchSize < unprocessedIds.length) {
        console.log('次のバッチまで30秒休憩...');
        await this.delay(30000);
        
        // ブラウザを再起動（メモリ解放）
        await this.close();
        await this.init();
      }
    }
  }

  // 案件詳細取得（簡略版）
  async scrapeCampaignDetail(campaignInfo) {
    const campaignId = campaignInfo.id;
    
    if (this.campaigns.has(campaignId)) {
      return;
    }

    const page = await this.browser.newPage();
    
    try {
      const useAndroid = campaignInfo.detectedOS === 'android';
      const userAgent = this.getNextUserAgent(useAndroid);
      await page.setUserAgent(userAgent);
      
      if (useAndroid) {
        await page.setViewport({ width: 412, height: 915, isMobile: true });
      } else {
        await page.setViewport({ width: 375, height: 812, isMobile: true });
      }
      
      const url = `${this.baseUrl}/ad_details/${campaignId}/`;
      
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      await this.delay(1000);

      const pageInfo = await page.evaluate(() => {
        const is403 = document.title.includes('403') || 
                     document.body.textContent.includes('Forbidden');
        
        if (is403) return { is403: true };
        
        const data = {
          id: window.location.pathname.match(/\/ad_details\/(\d+)/)?.[1],
          name: '',
          cashback: '',
          category: 'アプリ',
          url: window.location.href,
          conditions: {}
        };

        // 案件名
        const titleEl = document.querySelector('h1.AdDetails__title, h1');
        if (titleEl) data.name = titleEl.textContent.trim();

        // OS判定
        data.os = 'unknown';
        if (data.name.includes('iOS')) data.os = 'ios';
        else if (data.name.includes('Android')) data.os = 'android';
        else if (data.name.includes('多段階')) data.os = 'both';

        // 還元率
        const ptEl = document.querySelector('.AdDetails__pt.ItemPtLarge');
        if (ptEl) {
          const text = ptEl.textContent.trim().replace(/\s+/g, ' ');
          const match = text.match(/(\d+(?:,\d+)?(?:ちょび)?pt|\d+(?:\.\d+)?[%％])/);
          if (match) {
            data.cashback = match[1].replace('％', '%');
          } else {
            const pointMatch = text.match(/(\d+(?:,\d+)?)ポイント/);
            if (pointMatch) {
              data.cashback = pointMatch[1] + 'pt';
            }
          }
        }
        
        if (!data.cashback) data.cashback = 'なし';

        return { is403: false, data };
      });

      if (pageInfo.is403) {
        console.log(`❌ 403エラー (${campaignId})`);
        this.campaigns.set(campaignId, {
          id: campaignId,
          name: campaignInfo.name || '403 Forbidden',
          cashback: 'なし',
          category: 'アプリ',
          os: campaignInfo.detectedOS,
          error: '403'
        });
      } else {
        const campaign = pageInfo.data;
        if (campaign.os === 'unknown' && campaignInfo.detectedOS !== 'unknown') {
          campaign.os = campaignInfo.detectedOS;
        }
        this.campaigns.set(campaignId, campaign);
        console.log(`✓ ${campaignId}: ${campaign.name} - ${campaign.cashback} [${campaign.os.toUpperCase()}]`);
      }

    } catch (error) {
      console.error(`エラー (${campaignId}):`, error.message);
      this.campaigns.set(campaignId, {
        id: campaignId,
        name: campaignInfo.name || 'エラー',
        cashback: 'なし',
        category: 'アプリ',
        os: campaignInfo.detectedOS,
        error: error.message
      });
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
    
    console.log(`[保存] ${this.campaigns.size}件のデータを保存`);
  }

  showStats() {
    const stats = {
      total: this.campaigns.size,
      byOS: { ios: 0, android: 0, both: 0, unknown: 0 },
      withPoints: 0,
      noCashback: 0,
      errors: 0
    };

    this.campaigns.forEach(campaign => {
      if (campaign.os) stats.byOS[campaign.os]++;
      if (campaign.error) stats.errors++;
      else if (campaign.cashback === 'なし') stats.noCashback++;
      else if (campaign.cashback.includes('pt') || campaign.cashback.includes('%')) stats.withPoints++;
    });

    console.log('\n=== 最終統計情報 ===');
    console.log(`総案件数: ${stats.total}`);
    console.log('\n=== OS別内訳 ===');
    console.log(`iOS専用: ${stats.byOS.ios}件`);
    console.log(`Android専用: ${stats.byOS.android}件`);
    console.log(`両OS対応: ${stats.byOS.both}件`);
    console.log(`OS不明: ${stats.byOS.unknown}件`);
    console.log('\n=== 還元率 ===');
    console.log(`ポイント/％還元: ${stats.withPoints}件`);
    console.log(`還元なし: ${stats.noCashback}件`);
    console.log(`エラー: ${stats.errors}件`);
    console.log(`成功率: ${((stats.total - stats.errors) / stats.total * 100).toFixed(1)}%`);
  }
}

// メイン実行
async function main() {
  const scraper = new ChobirichAndroidIOSBatch();
  
  try {
    await scraper.init();
    
    // ステップ1: ID収集
    await scraper.collectAllIds();
    
    // ステップ2: 詳細取得（50件ずつバッチ処理）
    await scraper.scrapeDetailsInBatches(50);
    
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