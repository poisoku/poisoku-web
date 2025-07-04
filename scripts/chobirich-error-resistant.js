const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class ChobirichErrorResistant {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.campaigns = new Map();
    this.allCampaignIds = null;
    this.browser = null;
    this.errorCounts = {
      connectionClosed: 0,
      timeout: 0,
      forbidden403: 0,
      other: 0
    };
    this.maxRetries = 3;
    this.currentBatch = 0;
    this.maxConnectionsPerBrowser = 100; // ブラウザ再起動の閾値
    this.connectionCount = 0;
  }

  async init() {
    console.log('エラー耐性スクレイパー起動中...\n');
    
    // より安定したブラウザ設定
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-features=VizDisplayCompositor',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-background-timer-throttling',
        '--disable-ipc-flooding-protection',
        '--max_old_space_size=4096' // メモリ制限を拡張
      ],
      timeout: 60000,
      protocolTimeout: 60000
    });
    
    this.connectionCount = 0;
    console.log('ブラウザ初期化完了');
  }

  async close() {
    if (this.browser) {
      try {
        await this.browser.close();
        console.log('ブラウザ終了');
      } catch (error) {
        console.log('ブラウザ終了時エラー（無視）:', error.message);
      }
      this.browser = null;
    }
  }

  // ブラウザの健康状態をチェック
  async checkBrowserHealth() {
    try {
      if (!this.browser || !this.browser.isConnected()) {
        console.log('⚠️ ブラウザ接続切れ - 再起動します');
        await this.close();
        await this.init();
        return false;
      }
      return true;
    } catch (error) {
      console.log('⚠️ ブラウザ健康チェック失敗 - 再起動します');
      await this.close();
      await this.init();
      return false;
    }
  }

  // 接続数管理
  async manageConnections() {
    this.connectionCount++;
    
    if (this.connectionCount >= this.maxConnectionsPerBrowser) {
      console.log(`🔄 ${this.maxConnectionsPerBrowser}回接続到達 - ブラウザ再起動`);
      await this.close();
      await this.init();
    }
  }

  // エラー分析と対処
  analyzeError(error) {
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('connection closed') || errorMessage.includes('protocol error')) {
      this.errorCounts.connectionClosed++;
      return {
        type: 'connection_closed',
        severity: 'high',
        action: 'restart_browser',
        waitTime: 5000
      };
    }
    
    if (errorMessage.includes('timeout') || errorMessage.includes('navigation timeout')) {
      this.errorCounts.timeout++;
      return {
        type: 'timeout',
        severity: 'medium',
        action: 'retry_with_longer_timeout',
        waitTime: 10000
      };
    }
    
    if (errorMessage.includes('403') || errorMessage.includes('forbidden')) {
      this.errorCounts.forbidden403++;
      return {
        type: 'forbidden',
        severity: 'low',
        action: 'wait_and_retry',
        waitTime: 60000
      };
    }
    
    this.errorCounts.other++;
    return {
      type: 'other',
      severity: 'medium',
      action: 'retry',
      waitTime: 5000
    };
  }

  // 既存データを読み込み
  async loadExistingData() {
    try {
      // IDリストを読み込み
      const idData = JSON.parse(await fs.readFile('chobirich_all_ids.json', 'utf8'));
      this.allCampaignIds = new Map(idData.campaigns.map(c => [c.id, c]));
      console.log(`IDリスト読み込み: ${this.allCampaignIds.size}件`);
      
      // 詳細データを読み込み
      const detailData = JSON.parse(await fs.readFile('chobirich_android_ios_apps_data.json', 'utf8'));
      detailData.campaigns.forEach(campaign => {
        this.campaigns.set(campaign.id, campaign);
      });
      console.log(`既存詳細データ: ${this.campaigns.size}件`);
      
    } catch (error) {
      console.log('既存データ読み込みエラー:', error.message);
      throw new Error('必要なデータファイルが見つかりません');
    }
  }

  // エラー耐性案件取得
  async scrapeCampaignDetailWithRetry(campaignInfo, retryCount = 0) {
    const campaignId = campaignInfo.id;
    
    if (this.campaigns.has(campaignId)) {
      return { success: true, fromCache: true };
    }

    // ブラウザ健康チェック
    const isHealthy = await this.checkBrowserHealth();
    if (!isHealthy) {
      console.log(`🔄 ブラウザ再起動後に案件${campaignId}を処理`);
    }

    let page = null;
    
    try {
      // 接続数管理
      await this.manageConnections();
      
      page = await this.browser.newPage();
      
      // ページ設定
      const useAndroid = campaignInfo.detectedOS === 'android';
      const userAgent = useAndroid 
        ? 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36'
        : 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
      
      await page.setUserAgent(userAgent);
      
      if (useAndroid) {
        await page.setViewport({ width: 412, height: 915, isMobile: true });
      } else {
        await page.setViewport({ width: 375, height: 812, isMobile: true });
      }

      // リソース最適化
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      const url = `${this.baseUrl}/ad_details/${campaignId}/`;
      
      // タイムアウトを動的に調整
      const timeout = retryCount > 0 ? 90000 : 60000;
      
      await page.goto(url, {
        waitUntil: 'domcontentloaded', // より軽い待機条件
        timeout: timeout
      });

      await this.delay(1000);

      // ページ評価
      const result = await page.evaluate(() => {
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

      if (result.is403) {
        this.campaigns.set(campaignId, {
          id: campaignId,
          name: campaignInfo.name || '403 Forbidden',
          cashback: 'なし',
          category: 'アプリ',
          os: campaignInfo.detectedOS,
          error: '403'
        });
        return { success: true, error: '403' };
      }

      // データ処理
      const campaign = result.data;
      if (campaign.os === 'unknown' && campaignInfo.detectedOS !== 'unknown') {
        campaign.os = campaignInfo.detectedOS;
      }
      
      this.campaigns.set(campaignId, campaign);
      console.log(`✓ ${campaignId}: ${campaign.name} - ${campaign.cashback} [${campaign.os.toUpperCase()}]`);
      
      return { success: true };

    } catch (error) {
      const errorAnalysis = this.analyzeError(error);
      console.log(`❌ ${errorAnalysis.type.toUpperCase()}エラー (${campaignId}) - 試行${retryCount + 1}/${this.maxRetries}`);
      console.log(`   エラー詳細: ${error.message.substring(0, 100)}`);
      
      // エラー別対処
      if (errorAnalysis.action === 'restart_browser') {
        await this.close();
        await this.init();
      }
      
      // リトライ判定
      if (retryCount < this.maxRetries - 1) {
        console.log(`   → ${errorAnalysis.waitTime / 1000}秒待機後リトライ...`);
        await this.delay(errorAnalysis.waitTime);
        return await this.scrapeCampaignDetailWithRetry(campaignInfo, retryCount + 1);
      } else {
        // 最大リトライ到達
        this.campaigns.set(campaignId, {
          id: campaignId,
          name: campaignInfo.name || 'エラー',
          cashback: 'なし',
          category: 'アプリ',
          os: campaignInfo.detectedOS,
          error: errorAnalysis.type
        });
        console.log(`   → 最大リトライ到達 - スキップ`);
        return { success: false, error: errorAnalysis.type };
      }

    } finally {
      if (page) {
        try {
          await page.close();
        } catch (e) {
          // ページクローズエラーは無視
        }
      }
    }
  }

  // バッチ処理（エラー耐性版）
  async processBatch(batch, batchNum, totalBatches) {
    console.log(`\n=== バッチ ${batchNum}/${totalBatches} (${batch.length}件) ===`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < batch.length; i++) {
      const campaignInfo = batch[i];
      
      try {
        const result = await this.scrapeCampaignDetailWithRetry(campaignInfo);
        
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
        
        // 進捗表示
        if ((i + 1) % 10 === 0) {
          console.log(`  進捗: ${i + 1}/${batch.length} (成功:${successCount}, エラー:${errorCount})`);
        }
        
        // アクセス間隔
        await this.delay(3000);
        
      } catch (error) {
        console.error(`案件${campaignInfo.id}で予期しないエラー:`, error.message);
        errorCount++;
      }
    }
    
    // バッチ完了
    await this.saveResults();
    console.log(`バッチ${batchNum}完了 - 成功:${successCount}, エラー:${errorCount}`);
    
    // バッチ間休憩
    if (batchNum < totalBatches) {
      console.log('次のバッチまで30秒休憩...');
      await this.delay(30000);
    }
  }

  // メイン処理
  async processRemaining(batchSize = 30) {
    await this.loadExistingData();
    
    // 未処理IDを特定
    const unprocessedIds = [];
    this.allCampaignIds.forEach((value, key) => {
      if (!this.campaigns.has(key)) {
        unprocessedIds.push(value);
      }
    });
    
    console.log(`\n未処理: ${unprocessedIds.length}件`);
    console.log(`既存: ${this.campaigns.size}件`);
    console.log(`合計: ${this.allCampaignIds.size}件\n`);
    
    if (unprocessedIds.length === 0) {
      console.log('すべて処理済みです');
      return;
    }
    
    // バッチ処理
    const totalBatches = Math.ceil(unprocessedIds.length / batchSize);
    
    for (let i = 0; i < unprocessedIds.length; i += batchSize) {
      const batch = unprocessedIds.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      
      await this.processBatch(batch, batchNum, totalBatches);
    }
    
    // 最終統計
    this.showErrorStats();
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async saveResults() {
    const data = {
      scraped_at: new Date().toISOString(),
      total_campaigns: this.campaigns.size,
      error_stats: this.errorCounts,
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

  showErrorStats() {
    console.log('\n=== エラー統計 ===');
    console.log(`Connection Closed: ${this.errorCounts.connectionClosed}件`);
    console.log(`Timeout: ${this.errorCounts.timeout}件`);
    console.log(`403 Forbidden: ${this.errorCounts.forbidden403}件`);
    console.log(`その他: ${this.errorCounts.other}件`);
    
    const total = this.campaigns.size;
    const errors = Object.values(this.errorCounts).reduce((a, b) => a + b, 0);
    console.log(`\n成功率: ${((total - errors) / total * 100).toFixed(1)}%`);
  }

  showFinalStats() {
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
  }
}

// メイン実行
async function main() {
  const scraper = new ChobirichErrorResistant();
  
  try {
    await scraper.init();
    await scraper.processRemaining(30); // 30件ずつバッチ処理
    await scraper.saveResults();
    scraper.showFinalStats();
    
  } catch (error) {
    console.error('致命的エラー:', error);
    await scraper.saveResults();
  } finally {
    await scraper.close();
    console.log('\n完了！');
  }
}

main().catch(console.error);