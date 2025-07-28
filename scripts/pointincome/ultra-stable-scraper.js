const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class UltraStableScraper {
  constructor() {
    this.baseUrl = 'https://pointi.jp';
    this.results = [];
    this.browser = null;
    this.processedUrls = new Set();
    this.processedCount = 0;
    this.errorCount = 0;
    this.maxRetries = 3; // リトライ数を抑制
    
    // 超安定設定
    this.batchSize = 3; // さらに小さいバッチ
    this.baseRateLimitMs = 4000; // 基本4秒
    this.humanVarianceMs = 1000; // ±1秒
    this.pageTimeoutMs = 60000; // 1分タイムアウト
    this.maxPagesPerGroup = 15; // ページ数制限
    
    // 安全性重視
    this.checkpointFile = 'ultra_stable_checkpoint.json';
    this.completedCategories = new Set();
    this.errorDetails = [];
    
    // 実在確認済みカテゴリのみ使用
    this.workingCategories = [
      { name: 'ファッション', id: 152, type: 'group' },
      { name: 'グルメ', id: 154, type: 'group' },
      { name: '美容', id: 148, type: 'group' },
      { name: '衛生用品', id: 147, type: 'group' },
      { name: 'エンタメ・家電', id: 151, type: 'group' },
      { name: '住まい・暮らし', id: 155, type: 'group' },
      { name: 'その他（ショッピング）', id: 153, type: 'group' }
    ];
    
    this.allCategories = [...this.workingCategories];
  }

  async init() {
    console.log('🔒 超安定ポイントインカムスクレイピングシステム開始');
    console.log(`📊 検証済み${this.allCategories.length}カテゴリ（${this.batchSize}カテゴリごとにブラウザ再起動）`);
    console.log(`⏱️ 安全レート制限: ${this.baseRateLimitMs / 1000}秒 ± ${this.humanVarianceMs / 1000}秒\n`);
    
    await this.loadCheckpoint();
    await this.initBrowser();
  }

  async initBrowser() {
    if (this.browser) {
      try {
        await this.browser.close();
        await this.sleep(3000);
      } catch (error) {
        console.log('⚠️ ブラウザクローズエラー（無視）');
      }
    }
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ],
      defaultViewport: { width: 1280, height: 720 },
      timeout: 30000
    });
    
    console.log('✅ ブラウザ初期化完了（超安定モード）');
  }

  async loadCheckpoint() {
    try {
      const checkpointData = await fs.readFile(this.checkpointFile, 'utf8');
      const checkpoint = JSON.parse(checkpointData);
      
      if (checkpoint.completedCategories) {
        this.completedCategories = new Set(checkpoint.completedCategories);
        this.processedCount = checkpoint.processedCount || 0;
        this.errorCount = checkpoint.errorCount || 0;
        
        console.log(`📋 チェックポイント読み込み: ${this.completedCategories.size}カテゴリ完了済み`);
        console.log(`📊 前回進捗: 処理${this.processedCount}件、エラー${this.errorCount}件`);
      }
    } catch (error) {
      console.log('📋 新規実行開始（チェックポイントなし）');
    }
  }

  async saveCheckpoint() {
    const checkpoint = {
      completedCategories: Array.from(this.completedCategories),
      processedCount: this.processedCount,
      errorCount: this.errorCount,
      totalResults: this.results.length,
      lastUpdated: new Date().toISOString(),
      timestamp: Date.now()
    };
    
    await fs.writeFile(this.checkpointFile, JSON.stringify(checkpoint, null, 2));
  }

  async setupPage() {
    const page = await this.browser.newPage();
    
    // 軽量なリクエストフィルタリング
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['image', 'font', 'stylesheet'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    page.setDefaultTimeout(this.pageTimeoutMs);
    page.setDefaultNavigationTimeout(this.pageTimeoutMs);
    
    return page;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async humanWait() {
    const variance = Math.random() * this.humanVarianceMs * 2 - this.humanVarianceMs;
    const waitTime = this.baseRateLimitMs + variance;
    const actualWaitTime = Math.max(2000, Math.min(6000, waitTime));
    
    console.log(`⏳ 待機: ${(actualWaitTime / 1000).toFixed(1)}秒`);
    await this.sleep(actualWaitTime);
  }

  async scrapeCategory(category) {
    let page = null;
    
    try {
      page = await this.setupPage();
      const url = `${this.baseUrl}/list.php?group=${category.id}`;
      
      console.log(`📍 アクセス: ${url}`);
      
      const response = await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: this.pageTimeoutMs
      });
      
      if (!response) {
        throw new Error('No response');
      }
      
      if (response.status() === 404) {
        console.log(`⚠️ ${category.name} は存在しません。スキップします。`);
        return;
      }
      
      if (!response.ok()) {
        throw new Error(`HTTP ${response.status()}`);
      }
      
      await this.sleep(2000);
      
      let allCampaignLinks = [];
      let pageNum = 1;
      
      while (pageNum <= this.maxPagesPerGroup) {
        console.log(`  📄 ページ ${pageNum} 処理中...`);
        
        try {
          const campaignLinks = await page.$$eval('.box_ad_inner a[href*="/ad/"]', links => {
            return links.map(link => ({
              url: link.href,
              title: link.querySelector('img') ? link.querySelector('img').alt : ''
            }));
          });
          
          if (campaignLinks.length === 0) {
            console.log(`    ⚠️ 案件なし - ページ終了`);
            break;
          }
          
          allCampaignLinks = allCampaignLinks.concat(campaignLinks);
          console.log(`    ✅ ${campaignLinks.length}件発見（累計: ${allCampaignLinks.length}件）`);
          
          // 次ページチェック（簡略化）
          const hasNext = await page.evaluate((currentPage) => {
            const nextLink = document.querySelector('.pager a[title="次へ"], .pager a:contains("次へ")');
            return !!nextLink;
          }, pageNum);
          
          if (!hasNext) {
            console.log(`    📝 最終ページ ${pageNum} で終了`);
            break;
          }
          
          // 次ページへ（シンプルなURL遷移）
          const nextUrl = `${url}&page=${pageNum + 1}`;
          await page.goto(nextUrl, { waitUntil: 'domcontentloaded' });
          await this.sleep(2000 + Math.random() * 1000);
          
          pageNum++;
        } catch (pageError) {
          console.log(`    ⚠️ ページ ${pageNum} でエラー: ${pageError.message}`);
          break;
        }
      }
      
      const uniqueLinks = Array.from(
        new Map(allCampaignLinks.map(link => [link.url, link])).values()
      );
      
      console.log(`📊 ${category.name}: ${uniqueLinks.length}件の詳細取得開始`);
      
      // 詳細取得（最大50件まで制限）
      const limitedLinks = uniqueLinks.slice(0, 50);
      
      for (let i = 0; i < limitedLinks.length; i++) {
        const campaign = limitedLinks[i];
        
        if (this.processedUrls.has(campaign.url)) {
          continue;
        }
        
        try {
          const detailData = await this.scrapeCampaignDetailSafe(campaign.url);
          if (detailData) {
            this.results.push({
              ...detailData,
              category: category.name,
              categoryType: category.type,
              device: 'すべて'
            });
            
            this.processedUrls.add(campaign.url);
            this.processedCount++;
            
            console.log(`✅ [${i + 1}/${limitedLinks.length}] ${detailData.title.substring(0, 30)}... - ${detailData.cashback || detailData.cashbackYen || '不明'}`);
          }
          
          // 定期保存
          if (this.processedCount % 10 === 0) {
            await this.saveIntermediateResults();
          }
          
          await this.humanWait();
          
        } catch (error) {
          console.error(`❌ [${i + 1}/${limitedLinks.length}] 詳細エラー: ${campaign.url.substring(campaign.url.lastIndexOf('/') + 1)}`);
          this.errorCount++;
          
          this.errorDetails.push({
            url: campaign.url,
            error: error.message,
            timestamp: new Date().toISOString()
          });
          
          // エラー後は少し長めに待機
          await this.sleep(3000);
        }
      }
      
    } finally {
      if (page) {
        try {
          await page.close();
          await this.sleep(500);
        } catch (closeError) {
          // ページクローズエラーは無視
        }
      }
    }
  }

  async scrapeCampaignDetailSafe(url) {
    let page = null;
    
    try {
      page = await this.setupPage();
      
      const response = await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: this.pageTimeoutMs
      });
      
      if (!response || response.status() === 404 || response.status() === 403) {
        return null;
      }
      
      if (!response.ok()) {
        throw new Error(`HTTP ${response.status()}`);
      }
      
      await this.sleep(1000 + Math.random() * 1000);
      
      const detailData = await page.evaluate(() => {
        const titleEl = document.querySelector('h2.campaignTitle, .campaign-title, h1');
        
        return {
          title: titleEl ? titleEl.textContent.trim() : ''
        };
      });
      
      if (!detailData.title) {
        return null;
      }
      
      const id = url.match(/\/ad\/(\d+)\//)?.[1] || '';
      if (!id) return null;
      
      // 簡単な還元率取得
      let cashback = null;
      let cashbackYen = null;
      
      try {
        const percentEl = await page.$('.ad_pt.red.bold');
        if (percentEl) {
          const percentText = await percentEl.evaluate(el => el.textContent.trim());
          if (percentText.includes('%')) {
            cashback = percentText;
          }
        }
      } catch (e) {
        // セレクタエラーは無視
      }
      
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
        conditions: '',
        lastUpdated: new Date().toLocaleString('ja-JP'),
        siteName: 'ポイントインカム',
        searchKeywords: detailData.title.toLowerCase(),
        searchWeight: 1
      };
      
    } finally {
      if (page) {
        try {
          await page.close();
          await this.sleep(300);
        } catch (closeError) {
          // ページクローズエラーは無視
        }
      }
    }
  }

  async saveIntermediateResults() {
    const data = {
      siteName: 'ポイントインカム',
      scrapingType: 'ultra-stable-processing',
      scrapedAt: new Date().toISOString(),
      isIntermediate: true,
      summary: {
        total_campaigns: this.results.length,
        total_processed: this.processedCount,
        errors: this.errorCount,
        completed_categories: this.completedCategories.size,
        total_categories: this.allCategories.length
      },
      campaigns: this.results
    };

    await fs.writeFile(
      'pointincome_ultra_stable_intermediate.json',
      JSON.stringify(data, null, 2),
      'utf8'
    );
    
    console.log(`💾 中間保存完了（${this.results.length}件）`);
  }

  async saveResults() {
    const data = {
      siteName: 'ポイントインカム',
      scrapingType: 'ultra-stable-processing',
      scrapedAt: new Date().toISOString(),
      isComplete: true,
      summary: {
        total_campaigns: this.results.length,
        total_processed: this.processedCount,
        errors: this.errorCount,
        completed_categories: this.completedCategories.size,
        total_categories: this.allCategories.length,
        base_rate_limit_ms: this.baseRateLimitMs,
        batch_size: this.batchSize
      },
      campaigns: this.results,
      error_summary: this.errorDetails.slice(-20)
    };

    await fs.writeFile(
      'pointincome_ultra_stable_final.json',
      JSON.stringify(data, null, 2),
      'utf8'
    );

    console.log(`\n💾 最終データ保存完了: pointincome_ultra_stable_final.json`);
  }

  async close() {
    if (this.browser) {
      try {
        await this.browser.close();
        console.log('✅ ブラウザクローズ完了');
      } catch (error) {
        console.log('⚠️ ブラウザクローズエラー（無視）');
      }
    }
  }

  async run() {
    const startTime = Date.now();
    
    try {
      await this.init();
      
      const remainingCategories = this.allCategories.filter(category => {
        const categoryKey = `${category.type}_${category.id}`;
        return !this.completedCategories.has(categoryKey);
      });
      
      if (remainingCategories.length === 0) {
        console.log('🎉 すべてのカテゴリが完了済みです！');
        return;
      }
      
      console.log(`🎯 処理対象: ${remainingCategories.length}カテゴリ`);
      
      for (let i = 0; i < remainingCategories.length; i++) {
        const category = remainingCategories[i];
        const categoryKey = `${category.type}_${category.id}`;
        
        console.log(`\n🛍️ [${i + 1}/${remainingCategories.length}] ${category.name} 処理開始`);
        
        try {
          await this.scrapeCategory(category);
          this.completedCategories.add(categoryKey);
          await this.saveCheckpoint();
          
          console.log(`✅ ${category.name} 完了`);
          
          // カテゴリ間の休憩
          if (i < remainingCategories.length - 1) {
            await this.humanWait();
          }
          
        } catch (error) {
          console.error(`❌ ${category.name} でエラー: ${error.message}`);
          this.errorCount++;
        }
        
        // 3カテゴリごとにブラウザリセット
        if ((i + 1) % this.batchSize === 0 && i < remainingCategories.length - 1) {
          console.log('\n🔄 ブラウザリセット中...');
          await this.initBrowser();
          await this.sleep(2000);
        }
      }
      
      await this.saveResults();
      
      const endTime = Date.now();
      const durationMinutes = Math.round((endTime - startTime) / 60000);
      
      console.log('\n🎉 超安定スクレイピング完了！');
      console.log('='.repeat(40));
      console.log(`📊 総案件数: ${this.results.length}件`);
      console.log(`✅ 成功数: ${this.processedCount}件`);
      console.log(`❌ エラー数: ${this.errorCount}件`);
      console.log(`📋 完了カテゴリ: ${this.completedCategories.size}/${this.allCategories.length}`);
      console.log(`⏱️ 実行時間: ${durationMinutes}分`);
      
      if (this.processedCount > 0) {
        console.log(`🚀 成功率: ${Math.round((this.processedCount / (this.processedCount + this.errorCount)) * 100)}%`);
      }
      
    } catch (error) {
      console.error('❌ 致命的エラー:', error);
      await this.saveIntermediateResults();
    } finally {
      await this.close();
    }
  }
}

// 実行
(async () => {
  const scraper = new UltraStableScraper();
  await scraper.run();
})();