const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class RobustBatchScraper {
  constructor() {
    this.baseUrl = 'https://pointi.jp';
    this.results = [];
    this.browser = null;
    this.processedUrls = new Set();
    this.processedCount = 0;
    this.errorCount = 0;
    this.maxRetries = 7; // リトライ回数増加
    
    // バッチ処理設定 - 堅牢性重視
    this.batchSize = 5; // バッチサイズ縮小でメモリ負荷軽減
    this.baseRateLimitMs = 3000; // 基本レート（3秒）
    this.humanVarianceMs = 2000; // ランダム幅（±2秒）
    this.pageTimeoutMs = 120000; // タイムアウト延長（2分）
    this.maxPagesPerGroup = 30; // ページ数上限拡張
    this.memoryCheckInterval = 3; // 3案件ごとにメモリチェック
    this.emergencyCheckpointInterval = 5; // 5案件ごとに緊急保存
    
    // エラー追跡
    this.consecutiveErrors = 0;
    this.maxConsecutiveErrors = 10;
    this.errorDetails = [];
    
    // 強化されたチェックポイント機能
    this.checkpointFile = 'robust_batch_checkpoint.json';
    this.completedCategories = new Set();
    this.lastSaveTime = Date.now();
    this.categoryFailureCount = new Map(); // カテゴリ別失敗回数
    
    // ショッピンググループ一覧
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
    
    // サービスカテゴリ一覧
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
    console.log('🛡️ 堅牢型ポイントインカム バッチスクレイピングシステム開始');
    console.log(`📊 総計${this.allCategories.length}カテゴリ（${this.batchSize}カテゴリごとにブラウザ再起動）`);
    console.log(`⏱️ 保守的レート制限: ${this.baseRateLimitMs / 1000}秒 ± ${this.humanVarianceMs / 1000}秒\n`);
    
    await this.loadCheckpoint();
    await this.initBrowser();
  }

  async initBrowser() {
    if (this.browser) {
      try {
        await this.browser.close();
        await this.sleep(3000); // ブラウザクリーンアップ待機
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
        '--max-old-space-size=4096', // メモリ制限
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-extensions',
        '--disable-plugins'
      ],
      defaultViewport: { width: 1920, height: 1080 },
      timeout: 30000 // ブラウザ起動タイムアウト
    });
    
    console.log('✅ ブラウザ初期化完了（堅牢モード）');
  }

  async loadCheckpoint() {
    try {
      const checkpointData = await fs.readFile(this.checkpointFile, 'utf8');
      const checkpoint = JSON.parse(checkpointData);
      
      if (checkpoint.completedCategories) {
        this.completedCategories = new Set(checkpoint.completedCategories);
        this.processedCount = checkpoint.processedCount || 0;
        this.errorCount = checkpoint.errorCount || 0;
        
        if (checkpoint.failureCounts) {
          this.categoryFailureCount = new Map(Object.entries(checkpoint.failureCounts));
        }
        
        console.log(`📋 チェックポイント読み込み: ${this.completedCategories.size}カテゴリ完了済み`);
        console.log(`📊 前回進捗: 処理${this.processedCount}件、エラー${this.errorCount}件`);
        
        const lastUpdate = new Date(checkpoint.lastUpdated);
        console.log(`⏰ 前回更新: ${lastUpdate.toLocaleString('ja-JP')}`);
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
      failureCounts: Object.fromEntries(this.categoryFailureCount),
      lastUpdated: new Date().toISOString(),
      timestamp: Date.now()
    };
    
    await fs.writeFile(this.checkpointFile, JSON.stringify(checkpoint, null, 2));
  }

  async setupPage() {
    const page = await this.browser.newPage();
    
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['image', 'font', 'stylesheet', 'media'].includes(resourceType)) {
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

  async humanWait() {
    // 人間らしいランダムな待機時間を生成
    const variance = Math.random() * this.humanVarianceMs * 2 - this.humanVarianceMs;
    const waitTime = this.baseRateLimitMs + variance;
    const actualWaitTime = Math.max(1500, Math.min(5000, waitTime)); // 1.5秒〜5秒の範囲
    
    console.log(`⏳ 待機: ${(actualWaitTime / 1000).toFixed(1)}秒`);
    await this.sleep(actualWaitTime);
  }

  async handleConsecutiveErrors() {
    this.consecutiveErrors++;
    console.log(`⚠️ 連続エラー数: ${this.consecutiveErrors}/${this.maxConsecutiveErrors}`);
    
    if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
      console.log('🚨 連続エラー上限に達しました。長時間待機します...');
      // 人間がコーヒーブレイクを取るような待機（20〜40秒）
      const breakTime = 20000 + Math.random() * 20000;
      console.log(`☕ ${Math.round(breakTime / 1000)}秒間の休憩...`);
      await this.sleep(breakTime);
      
      console.log('🔄 ブラウザを完全リセットします...');
      await this.initBrowser();
      
      this.consecutiveErrors = 0;
      console.log('✅ システムリセット完了');
    }
  }

  async processBatch(categories, batchIndex) {
    console.log(`\n🔥 バッチ ${batchIndex + 1} 開始（${categories.length}カテゴリ）`);
    
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      const categoryKey = `${category.type}_${category.id}`;
      
      if (this.completedCategories.has(categoryKey)) {
        console.log(`⏭️ [${i + 1}/${categories.length}] スキップ: ${category.name}（完了済み）`);
        continue;
      }
      
      const typeEmoji = category.type === 'group' ? '🛍️' : '🔧';
      console.log(`\n${typeEmoji} [${i + 1}/${categories.length}] 処理開始: ${category.name}`);
      
      let retryCount = 0;
      let success = false;
      
      while (retryCount < this.maxRetries && !success) {
        try {
          if (retryCount > 0) {
            console.log(`🔄 リトライ ${retryCount}/${this.maxRetries}: ${category.name}`);
            await this.sleep(retryCount * 5000); // 指数関数的バックオフ
          }
          
          // メモリチェック
          if (this.processedCount % this.memoryCheckInterval === 0) {
            await this.checkMemoryUsage();
          }
          
          await this.scrapeCategory(category);
          
          // scrapeCategory内で404処理された場合はすでにcompletedCategoriesに追加済み
          if (!this.completedCategories.has(categoryKey)) {
            this.completedCategories.add(categoryKey);
          }
          
          this.categoryFailureCount.delete(categoryKey);
          await this.saveCheckpoint();
          
          console.log(`✅ ${category.name} 完了`);
          success = true;
          this.consecutiveErrors = 0; // 成功時はリセット
          
        } catch (error) {
          // 404エラーは特別扱い：即座にスキップ
          if (error.message.includes('HTTP 404')) {
            console.log(`⚠️ ${category.name} は404エラーのため完了扱いでスキップします`);
            this.completedCategories.add(categoryKey);
            await this.saveCheckpoint();
            success = true;
            break; // リトライループから抜ける
          }
          
          retryCount++;
          const failureCount = (this.categoryFailureCount.get(categoryKey) || 0) + 1;
          this.categoryFailureCount.set(categoryKey, failureCount);
          
          console.error(`❌ ${category.name} (リトライ${retryCount}): ${error.message}`);
          
          if (retryCount < this.maxRetries) {
            if (retryCount >= 2) {
              console.log('🔄 ブラウザリフレッシュ中...');
              await this.initBrowser();
            }
          } else {
            this.errorCount++;
            console.error(`⚠️ ${category.name} をスキップ（${this.maxRetries}回失敗）`);
            await this.handleConsecutiveErrors();
          }
        }
      }
      
      // 緊急チェックポイント保存
      if (this.processedCount % this.emergencyCheckpointInterval === 0) {
        await this.saveIntermediateResults();
      }
      
      if (i < categories.length - 1) {
        await this.humanWait();
      }
    }
    
    console.log(`\n🎯 バッチ ${batchIndex + 1} 完了`);
    await this.saveIntermediateResults();
  }

  async scrapeCategory(category) {
    const page = await this.setupPage();
    
    try {
      let url;
      if (category.type === 'group') {
        url = `${this.baseUrl}/list.php?group=${category.id}`;
      } else {
        url = `${this.baseUrl}/list.php?site=${category.id}`;
      }
      
      console.log(`📍 アクセス: ${url}`);
      
      const response = await page.goto(url, { 
        waitUntil: 'networkidle0',
        timeout: this.pageTimeoutMs
      });
      
      if (!response) {
        throw new Error('No response');
      }
      
      // 404エラーは即座にスキップ（リトライ不要）
      if (response.status() === 404) {
        console.log(`⚠️ 404エラー: ${category.name} のページが存在しません。スキップします。`);
        try {
          await page.close();
        } catch (closeError) {
          console.log('⚠️ ページクローズエラー（無視）:', closeError.message);
        }
        return; // リトライせずに終了
      }
      
      if (!response.ok()) {
        throw new Error(`HTTP ${response.status()}`);
      }
      
      await this.sleep(3000);
      
      let allCampaignLinks = [];
      let pageNum = 1;
      
      while (pageNum <= this.maxPagesPerGroup) {
        console.log(`  📄 ページ ${pageNum} を処理中...`);
        
        const campaignLinks = await page.$$eval('.box_ad_inner a[href*="/ad/"]', links => {
          return links.map(link => ({
            url: link.href,
            title: link.querySelector('img') ? link.querySelector('img').alt : ''
          }));
        });
        
        if (campaignLinks.length === 0) {
          console.log(`    ⚠️ 案件が見つかりません - ページ終了`);
          break;
        }
        
        allCampaignLinks = allCampaignLinks.concat(campaignLinks);
        console.log(`    ✅ ${campaignLinks.length}件発見（累計: ${allCampaignLinks.length}件）`);
        
        const nextPageResult = await page.evaluate((currentPage) => {
          const pagerLinks = document.querySelectorAll('.pager a');
          let nextButton = null;
          
          const nextPageNum = currentPage + 1;
          for (let link of pagerLinks) {
            const text = link.textContent.trim();
            if (text === String(nextPageNum)) {
              nextButton = link;
              break;
            }
          }
          
          if (!nextButton) {
            for (let link of pagerLinks) {
              const text = link.textContent.trim();
              if (text.includes('次へ') || text === '>') {
                nextButton = link;
                break;
              }
            }
          }
          
          if (nextButton && nextButton.onclick) {
            try {
              nextButton.click();
              return { success: true, buttonText: nextButton.textContent.trim() };
            } catch (error) {
              return { success: false, error: error.message };
            }
          }
          
          return { success: false, reason: 'no_button' };
        }, pageNum);
        
        if (!nextPageResult.success) {
          console.log(`    📝 最終ページ ${pageNum} で終了`);
          break;
        }
        
        // ページ遷移時の人間らしい待機（1.5〜3秒）
        const pageNavWait = 1500 + Math.random() * 1500;
        await this.sleep(pageNavWait);
        pageNum++;
      }
      
      const uniqueLinks = Array.from(
        new Map(allCampaignLinks.map(link => [link.url, link])).values()
      );
      
      console.log(`📊 ${category.name}: ${uniqueLinks.length}件の案件を詳細取得開始`);
      
      for (let i = 0; i < uniqueLinks.length; i++) {
        const campaign = uniqueLinks[i];
        
        if (this.processedUrls.has(campaign.url)) {
          continue;
        }
        
        try {
          const detailData = await this.scrapeCampaignDetail(campaign.url);
          if (detailData) {
            let device = 'すべて';
            const title = detailData.title.toLowerCase();
            
            if (title.includes('ios用') || title.includes('iphone') || title.includes('ipad') || title.includes('app store')) {
              device = 'iOS';
            } else if (title.includes('android用') || title.includes('google play') || title.includes('アンドロイド')) {
              device = 'Android';
            } else if (title.includes('pcのみ') || title.includes('pc限定') || title.includes('パソコン限定')) {
              device = 'PC';
            }
            
            this.results.push({
              ...detailData,
              category: category.name,
              categoryType: category.type,
              device: device
            });
            
            this.processedUrls.add(campaign.url);
            this.processedCount++;
            
            console.log(`✅ [${i + 1}/${uniqueLinks.length}] ${detailData.title} - ${detailData.cashback || detailData.cashbackYen || '不明'}`);
          }
          
          if (i % 10 === 0 && i > 0) {
            console.log(`💾 中間保存（${i}件）`);
            await this.saveIntermediateResults();
          }
          
          await this.humanWait();
          
        } catch (error) {
          console.error(`❌ [${i + 1}/${uniqueLinks.length}] 詳細エラー: ${campaign.url}`);
          this.errorCount++;
          
          const errorInfo = {
            url: campaign.url,
            error: error.message,
            timestamp: new Date().toISOString()
          };
          this.errorDetails.push(errorInfo);
          
          await this.handleConsecutiveErrors();
        }
      }
      
    } finally {
      try {
        await page.close();
      } catch (closeError) {
        console.log('⚠️ ページクローズエラー（無視）:', closeError.message);
      }
    }
  }

  async scrapeCampaignDetail(url) {
    const page = await this.setupPage();
    
    try {
      const response = await page.goto(url, { 
        waitUntil: 'domcontentloaded', // networkidle0より軽量
        timeout: this.pageTimeoutMs
      });
      
      if (!response) {
        throw new Error('No response');
      }
      
      // 404や403エラーは即座にスキップ
      if (response.status() === 404 || response.status() === 403) {
        console.log(`⚠️ ${response.status()}エラーのためスキップ`);
        return null;
      }
      
      if (!response.ok()) {
        throw new Error(`HTTP ${response.status()}`);
      }
      
      // 人間らしい待機（0.5〜2秒のランダム）
      const pageLoadWait = 500 + Math.random() * 1500;
      await this.sleep(pageLoadWait);
      
      const detailData = await page.evaluate(() => {
        const titleEl = document.querySelector('h2.campaignTitle, .campaign-title, h1');
        const conditionsEl = document.querySelector('.campaign-conditions, .conditions, .campaign-detail');
        
        return {
          title: titleEl ? titleEl.textContent.trim() : '',
          conditions: conditionsEl ? conditionsEl.textContent.trim() : ''
        };
      });
      
      if (!detailData.title) {
        return null;
      }
      
      const id = url.match(/\/ad\/(\d+)\//)?.[1] || '';
      if (!id) return null;
      
      let cashback = null;
      let cashbackYen = null;
      
      // パーセント還元（通常の%表記のみ、○○%還元は除外）
      const percentEl = await page.$('.ad_pt.red.bold');
      if (percentEl) {
        const percentText = await percentEl.evaluate(el => el.textContent.trim());
        if (percentText.match(/^\d+(?:\.\d+)?%$/) && !percentText.includes('還元')) {
          cashback = percentText;
        }
      }
      
      // ポイント還元（10pt = 1円で換算）
      const mainPtEl = await page.$('.detail_calcu_pt.red.bold');
      if (mainPtEl) {
        const pointText = await mainPtEl.evaluate(el => el.textContent.trim());
        const pointMatch = pointText.match(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?)pt/i);
        if (pointMatch) {
          const ptValue = parseFloat(pointMatch[1].replace(/,/g, ''));
          const yenValue = Math.floor(ptValue / 10); // 10pt = 1円で換算
          cashbackYen = `${yenValue}円`;
        }
      }
      
      if (!detailData.title || (!cashback && !cashbackYen)) {
        return null;
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
        conditions: detailData.conditions,
        lastUpdated: new Date().toLocaleString('ja-JP'),
        siteName: 'ポイントインカム',
        searchKeywords: detailData.title.toLowerCase(),
        searchWeight: 1
      };
      
    } finally {
      try {
        await page.close();
      } catch (closeError) {
        console.log('⚠️ ページクローズエラー（無視）:', closeError.message);
      }
    }
  }

  async saveIntermediateResults() {
    const data = {
      siteName: 'ポイントインカム',
      scrapingType: 'robust-batch-processing',
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
      'pointincome_robust_intermediate.json',
      JSON.stringify(data, null, 2),
      'utf8'
    );
  }

  async checkMemoryUsage() {
    try {
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
      
      console.log(`📊 メモリ使用量: ${heapUsedMB}MB / ${heapTotalMB}MB`);
      
      // メモリ使用量が3GBを超えたらブラウザ再起動
      if (heapUsedMB > 3000) {
        console.log('⚠️ メモリ使用量が高いためブラウザ再起動');
        await this.initBrowser();
        global.gc && global.gc(); // ガベージコレクション実行（可能なら）
      }
    } catch (error) {
      console.log('⚠️ メモリチェックエラー:', error.message);
    }
  }

  async saveResults() {
    const data = {
      siteName: 'ポイントインカム',
      scrapingType: 'robust-batch-processing',
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
      error_summary: this.errorDetails.slice(-50) // 最新50件のエラー
    };

    await fs.writeFile(
      'pointincome_robust_final.json',
      JSON.stringify(data, null, 2),
      'utf8'
    );

    console.log(`\n💾 最終データ保存完了: pointincome_robust_final.json`);
  }

  async close() {
    if (this.browser) {
      try {
        await this.browser.close();
        console.log('✅ ブラウザクローズ完了');
      } catch (error) {
        console.log('⚠️ ブラウザクローズエラー:', error.message);
      }
    }
  }

  async run() {
    const startTime = Date.now();
    
    try {
      await this.init();
      
      // 未完了カテゴリのみ処理
      const remainingCategories = this.allCategories.filter(category => {
        const categoryKey = `${category.type}_${category.id}`;
        return !this.completedCategories.has(categoryKey);
      });
      
      if (remainingCategories.length === 0) {
        console.log('🎉 すべてのカテゴリが完了済みです！');
        return;
      }
      
      console.log(`🎯 処理対象: ${remainingCategories.length}カテゴリ（全${this.allCategories.length}カテゴリ中）`);
      console.log(`📊 完了済み: ${this.completedCategories.size}カテゴリ`);
      
      const totalBatches = Math.ceil(remainingCategories.length / this.batchSize);
      console.log(`🚀 ${totalBatches}バッチで処理開始（${this.batchSize}カテゴリ/バッチ）\n`);
      
      // バッチ処理実行
      for (let i = 0; i < remainingCategories.length; i += this.batchSize) {
        const batch = remainingCategories.slice(i, i + this.batchSize);
        const batchIndex = Math.floor(i / this.batchSize);
        
        console.log(`📍 バッチ ${batchIndex + 1}/${totalBatches} 進行中...`);
        
        await this.processBatch(batch, batchIndex);
        
        // バッチ間でブラウザ再起動とメモリクリーンアップ
        if (i + this.batchSize < remainingCategories.length) {
          console.log(`\n🔄 バッチ間処理中...`);
          await this.initBrowser();
          await this.checkMemoryUsage();
          await this.sleep(5000); // 安全な待機時間
        }
      }
      
      await this.saveResults();
      
      const endTime = Date.now();
      const durationMinutes = Math.round((endTime - startTime) / 60000);
      
      console.log('\n🎉 全カテゴリスクレイピング完了！');
      console.log('='.repeat(50));
      console.log(`📊 総案件数: ${this.results.length}件`);
      console.log(`✅ 成功数: ${this.processedCount}件`);
      console.log(`❌ エラー数: ${this.errorCount}件`);
      console.log(`📋 完了カテゴリ: ${this.completedCategories.size}/${this.allCategories.length}`);
      console.log(`⏱️ 実行時間: ${durationMinutes}分`);
      console.log(`🚀 成功率: ${Math.round((this.processedCount / (this.processedCount + this.errorCount)) * 100)}%`);
      
      // 失敗したカテゴリの詳細
      if (this.categoryFailureCount.size > 0) {
        console.log('\n⚠️ 失敗したカテゴリ:');
        for (const [category, count] of this.categoryFailureCount) {
          console.log(`  - ${category}: ${count}回失敗`);
        }
      }
      
      // エラー詳細サマリー
      if (this.errorDetails.length > 0) {
        console.log(`\n📋 エラー詳細: ${this.errorDetails.length}件のエラーが記録されました`);
      }
      
    } catch (error) {
      console.error('❌ 致命的エラー:', error);
      await this.saveIntermediateResults(); // 緊急保存
    } finally {
      await this.close();
    }
  }
}

// 実行
(async () => {
  const scraper = new RobustBatchScraper();
  await scraper.run();
})();