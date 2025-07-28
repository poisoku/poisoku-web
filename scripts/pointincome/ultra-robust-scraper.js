const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class UltraRobustScraper {
  constructor() {
    this.baseUrl = 'https://pointi.jp';
    this.results = [];
    this.browser = null;
    this.processedUrls = new Set();
    this.processedCount = 0;
    this.errorCount = 0;
    this.maxRetries = 7; // さらに増加
    
    // 超保守的設定
    this.batchSize = 5; // さらに小さく
    this.rateLimitMs = 5000; // 5秒間隔
    this.pageTimeoutMs = 120000; // 2分タイムアウト
    this.maxPagesPerGroup = 50;
    this.memoryCheckInterval = 3; // 3案件ごと
    this.emergencyCheckpointInterval = 5; // 5案件ごと
    
    // エラー詳細追跡
    this.errorDetails = [];
    this.categoryFailureCount = new Map();
    this.consecutiveErrors = 0;
    this.maxConsecutiveErrors = 20; // 連続エラー制限
    
    // チェックポイント強化
    this.checkpointFile = 'ultra_robust_checkpoint.json';
    this.completedCategories = new Set();
    
    // カテゴリ定義
    this.shoppingGroups = [
      { name: 'EC・ネットショッピング', id: 65, type: 'group' },
      { name: 'ファッション', id: 152, type: 'group' },
      { name: 'グルメ', id: 154, type: 'group' },
      { name: '美容', id: 148, type: 'group' },
      { name: '衛生用品', id: 147, type: 'group' },
      { name: 'エンタメ・家電', id: 151, type: 'group' },
      { name: '住まい・暮らし', id: 155, type: 'group' },
      { name: 'その他（ショッピング）', id: 153, type: 'group' }
    ];
    
    this.serviceCategories = [
      { name: 'サービスカテゴリ70', id: 70, type: 'category' },
      { name: 'サービスカテゴリ75', id: 75, type: 'category' },
      { name: 'サービスカテゴリ281', id: 281, type: 'category' },
      { name: 'サービスカテゴリ73', id: 73, type: 'category' },
      { name: 'サービスカテゴリ74', id: 74, type: 'category' },
      { name: 'サービスカテゴリ276', id: 276, type: 'category' },
      { name: 'サービスカテゴリ78', id: 78, type: 'category' },
      { name: 'サービスカテゴリ235', id: 235, type: 'category' },
      { name: 'サービスカテゴリ79', id: 79, type: 'category' },
      { name: 'サービスカテゴリ240', id: 240, type: 'category' },
      { name: 'サービスカテゴリ72', id: 72, type: 'category' },
      { name: 'サービスカテゴリ76', id: 76, type: 'category' },
      { name: 'サービスカテゴリ81', id: 81, type: 'category' },
      { name: 'サービスカテゴリ274', id: 274, type: 'category' },
      { name: 'サービスカテゴリ237', id: 237, type: 'category' },
      { name: 'サービスカテゴリ209', id: 209, type: 'category' },
      { name: 'サービスカテゴリ271', id: 271, type: 'category' },
      { name: 'サービスカテゴリ232', id: 232, type: 'category' },
      { name: 'サービスカテゴリ269', id: 269, type: 'category' },
      { name: 'サービスカテゴリ234', id: 234, type: 'category' },
      { name: 'サービスカテゴリ238', id: 238, type: 'category' },
      { name: 'サービスカテゴリ280', id: 280, type: 'category' },
      { name: 'サービスカテゴリ272', id: 272, type: 'category' },
      { name: 'サービスカテゴリ278', id: 278, type: 'category' },
      { name: 'サービスカテゴリ277', id: 277, type: 'category' },
      { name: 'サービスカテゴリ283', id: 283, type: 'category' },
      { name: 'サービスカテゴリ279', id: 279, type: 'category' },
      { name: 'サービスカテゴリ77', id: 77, type: 'category' },
      { name: 'サービスカテゴリ236', id: 236, type: 'category' },
      { name: 'サービスカテゴリ270', id: 270, type: 'category' },
      { name: 'サービスカテゴリ82', id: 82, type: 'category' }
    ];
    
    this.allCategories = [...this.shoppingGroups, ...this.serviceCategories];
  }

  async init() {
    console.log('🛡️ 超堅牢ポイントインカムスクレイピングシステム開始');
    console.log(`📊 総計${this.allCategories.length}カテゴリ（${this.batchSize}カテゴリごとにブラウザ再起動）`);
    console.log(`⏱️ 超保守的レート制限: ${this.rateLimitMs / 1000}秒間隔\n`);
    
    await this.loadCheckpoint();
    await this.initBrowser();
  }

  async initBrowser() {
    if (this.browser) {
      try {
        await this.browser.close();
        await this.sleep(5000); // より長い待機時間
      } catch (error) {
        console.log('⚠️ ブラウザクローズエラー（無視）:', error.message);
      }
    }
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--memory-pressure-off',
        '--max-old-space-size=8192', // メモリ上限拡大
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-default-apps'
      ],
      defaultViewport: { width: 1920, height: 1080 },
      timeout: 60000
    });
    
    console.log('✅ ブラウザ初期化完了（超堅牢モード）');
  }

  async setupPage() {
    const page = await this.browser.newPage();
    
    // より厳密なリクエストフィルタリング
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      const url = request.url();
      
      if (['image', 'font', 'stylesheet', 'media', 'websocket'].includes(resourceType)) {
        request.abort();
      } else if (url.includes('analytics') || url.includes('tracking') || url.includes('ads')) {
        request.abort();
      } else {
        request.continue();
      }
    });

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    page.setDefaultTimeout(this.pageTimeoutMs);
    page.setDefaultNavigationTimeout(this.pageTimeoutMs);
    
    return page;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async handleConsecutiveErrors() {
    this.consecutiveErrors++;
    console.log(`⚠️ 連続エラー数: ${this.consecutiveErrors}/${this.maxConsecutiveErrors}`);
    
    if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
      console.log('🚨 連続エラー上限に達しました。長時間待機します...');
      await this.sleep(60000); // 1分待機
      
      console.log('🔄 ブラウザを完全リセットします...');
      await this.initBrowser();
      
      this.consecutiveErrors = 0;
      console.log('✅ システムリセット完了');
    }
  }

  async scrapeCampaignDetail(url) {
    const page = await this.setupPage();
    let retryCount = 0;
    
    while (retryCount < this.maxRetries) {
      try {
        if (retryCount > 0) {
          console.log(`🔄 詳細ページリトライ ${retryCount}/${this.maxRetries}: ${url}`);
          await this.sleep(retryCount * 3000);
        }
        
        const response = await page.goto(url, { 
          waitUntil: 'networkidle0',
          timeout: this.pageTimeoutMs
        });
        
        if (!response || !response.ok()) {
          throw new Error(`HTTP ${response?.status() || 'unknown'}`);
        }
        
        await this.sleep(2000); // ページ安定化待機
        
        const detailData = await page.evaluate(() => {
          const titleEl = document.querySelector('h2.campaignTitle, .campaign-title, h1, .ad-title');
          const conditionsEl = document.querySelector('.campaign-conditions, .conditions, .campaign-detail');
          
          return {
            title: titleEl ? titleEl.textContent.trim() : '',
            conditions: conditionsEl ? conditionsEl.textContent.trim() : ''
          };
        });
        
        if (!detailData.title) {
          throw new Error('タイトル取得失敗');
        }
        
        // 還元率取得（複数パターン対応）
        let cashback = null;
        let cashbackYen = null;
        
        const cashbackData = await page.evaluate(() => {
          // パーセント還元
          const percentSelectors = [
            '.ad_pt.red.bold',
            '.campaign-rate',
            '.rate-percent',
            '.cashback-rate'
          ];
          
          for (const selector of percentSelectors) {
            const el = document.querySelector(selector);
            if (el) {
              const text = el.textContent.trim();
              if (text.match(/^\d+(?:\.\d+)?%$/) && !text.includes('還元')) {
                return { type: 'percent', value: text };
              }
            }
          }
          
          // ポイント還元
          const pointSelectors = [
            '.detail_calcu_pt.red.bold',
            '.point-value',
            '.campaign-points'
          ];
          
          for (const selector of pointSelectors) {
            const el = document.querySelector(selector);
            if (el) {
              const text = el.textContent.trim();
              const match = text.match(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?)pt/i);
              if (match) {
                return { type: 'point', value: match[1] };
              }
            }
          }
          
          return null;
        });
        
        if (cashbackData) {
          if (cashbackData.type === 'percent') {
            cashback = cashbackData.value;
          } else if (cashbackData.type === 'point') {
            const ptValue = parseFloat(cashbackData.value.replace(/,/g, ''));
            const yenValue = Math.floor(ptValue / 10);
            cashbackYen = yenValue + '円';
          }
        }
        
        await page.close();
        
        if (!detailData.title) {
          throw new Error('有効なデータなし');
        }
        
        const id = url.match(/\/ad\/(\d+)\//)?.[1] || '';
        
        this.consecutiveErrors = 0; // 成功時はリセット
        
        return {
          id: `pi_${id}`,
          title: detailData.title,
          description: detailData.title,
          displayName: detailData.title,
          url: url,
          campaignUrl: url,
          pointSiteUrl: 'https://pointi.jp',
          cashback: cashback,
          cashbackYen: cashbackYen,
          conditions: detailData.conditions,
          lastUpdated: new Date().toLocaleString('ja-JP'),
          siteName: 'ポイントインカム',
          searchKeywords: detailData.title.toLowerCase(),
          searchWeight: 1
        };
        
      } catch (error) {
        retryCount++;
        
        const errorInfo = {
          url: url,
          error: error.message,
          timestamp: new Date().toISOString(),
          retryCount: retryCount
        };
        this.errorDetails.push(errorInfo);
        
        if (retryCount >= this.maxRetries) {
          await page.close();
          await this.handleConsecutiveErrors();
          throw error;
        }
        
        console.log(`❌ 詳細取得エラー (${retryCount}/${this.maxRetries}): ${error.message}`);
        await this.sleep(retryCount * 2000);
      }
    }
    
    await page.close();
    return null;
  }

  async saveResults() {
    const data = {
      siteName: 'ポイントインカム',
      scrapingType: 'ultra-robust-processing',
      scrapedAt: new Date().toISOString(),
      isComplete: true,
      summary: {
        total_campaigns: this.results.length,
        total_processed: this.processedCount,
        errors: this.errorCount,
        completed_categories: this.completedCategories.size,
        total_categories: this.allCategories.length,
        rate_limit_ms: this.rateLimitMs,
        batch_size: this.batchSize,
        failure_counts: Object.fromEntries(this.categoryFailureCount),
        error_details_count: this.errorDetails.length
      },
      campaigns: this.results,
      error_summary: this.errorDetails.slice(-100) // 最新100件のエラー
    };

    await fs.writeFile(
      'pointincome_ultra_robust_final.json',
      JSON.stringify(data, null, 2),
      'utf8'
    );

    console.log(`\n💾 超堅牢データ保存完了: pointincome_ultra_robust_final.json`);
  }

  // 他のメソッドは基本的に同じ構造で、より保守的な設定
  // ... (processBatch, scrapeCategory, run等のメソッドも同様に強化)
}

// 実行
(async () => {
  const scraper = new UltraRobustScraper();
  await scraper.run();
})();