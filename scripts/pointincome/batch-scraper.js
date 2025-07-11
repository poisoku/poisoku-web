const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class PointIncomeBatchScraper {
  constructor() {
    this.baseUrl = 'https://pointi.jp';
    this.results = [];
    this.browser = null;
    this.processedUrls = new Set();
    this.processedCount = 0;
    this.errorCount = 0;
    this.maxRetries = 3;
    
    // バッチ処理設定
    this.batchSize = 12; // 12カテゴリごとにブラウザ再起動
    this.rateLimitMs = 2500;
    this.pageTimeoutMs = 60000; // 60秒タイムアウト
    this.maxPagesPerGroup = 20;
    
    // チェックポイント機能
    this.checkpointFile = 'batch_checkpoint.json';
    this.completedCategories = new Set();
    
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
    console.log('🚀 ポイントインカム バッチスクレイピングシステム開始');
    console.log(`📊 総計${this.allCategories.length}カテゴリ（${this.batchSize}カテゴリごとにブラウザ再起動）`);
    console.log(`⏱️ レート制限: ${this.rateLimitMs / 1000}秒間隔\n`);
    
    await this.loadCheckpoint();
    await this.initBrowser();
  }

  async initBrowser() {
    if (this.browser) {
      await this.browser.close();
    }
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--memory-pressure-off'
      ],
      defaultViewport: { width: 1920, height: 1080 }
    });
    
    console.log('🔄 ブラウザインスタンス初期化完了');
  }

  async loadCheckpoint() {
    try {
      const checkpointData = await fs.readFile(this.checkpointFile, 'utf8');
      const checkpoint = JSON.parse(checkpointData);
      
      if (checkpoint.completedCategories) {
        this.completedCategories = new Set(checkpoint.completedCategories);
        console.log(`📋 チェックポイント読み込み: ${this.completedCategories.size}カテゴリ完了済み`);
      }
    } catch (error) {
      console.log('📋 新規実行開始（チェックポイントなし）');
    }
  }

  async saveCheckpoint() {
    const checkpoint = {
      completedCategories: Array.from(this.completedCategories),
      lastUpdated: new Date().toISOString()
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
      
      try {
        await this.scrapeCategory(category);
        this.completedCategories.add(categoryKey);
        await this.saveCheckpoint();
        
        console.log(`✅ ${category.name} 完了`);
        
        if (i < categories.length - 1) {
          await this.sleep(3000); // カテゴリ間待機
        }
      } catch (error) {
        console.error(`❌ ${category.name} でエラー: ${error.message}`);
        this.errorCount++;
      }
    }
    
    console.log(`\n🎯 バッチ ${batchIndex + 1} 完了`);
  }

  async scrapeCategory(category) {
    const page = await this.setupPage();
    
    try {
      let allCampaignLinks = [];
      let pageNum = 1;
      
      const firstUrl = category.type === 'group' 
        ? `${this.baseUrl}/list.php?group=${category.id}`
        : `${this.baseUrl}/list.php?category=${category.id}`;
      
      console.log(`  🌐 URL: ${firstUrl}`);
      await page.goto(firstUrl, { waitUntil: 'networkidle2', timeout: this.pageTimeoutMs });
      await this.sleep(2000);
      
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
        
        await this.sleep(3000);
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
        } catch (error) {
          console.error(`❌ [${i + 1}/${uniqueLinks.length}] 詳細エラー: ${campaign.url}`);
          this.errorCount++;
        }
        
        await this.sleep(this.rateLimitMs);
        
        if (this.processedCount > 0 && this.processedCount % 50 === 0) {
          await this.saveIntermediateResults();
          console.log(`💾 中間保存完了（${this.processedCount}件）`);
        }
      }
      
    } finally {
      await page.close();
    }
  }

  async scrapeCampaignDetail(url) {
    const page = await this.setupPage();
    
    try {
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: this.pageTimeoutMs 
      });
      
      await this.sleep(1000);
      
      const detailData = await page.evaluate(() => {
        const data = {
          title: '',
          percentText: '',
          yenText: '',
          conditions: ''
        };
        
        const titleEl = document.querySelector('h2');
        if (titleEl) {
          data.title = titleEl.textContent.trim();
        }
        
        // パーセント還元（通常の%表記のみ、○○%還元は除外）
        const percentEl = document.querySelector('.ad_pt.red.bold');
        if (percentEl) {
          const percentText = percentEl.textContent.trim();
          // 純粋な%表記のみ取得（例: 3%）、"還元"を含む場合は除外
          if (percentText.match(/^\d+(?:\.\d+)?%$/) && !percentText.includes('還元')) {
            data.percentText = percentText;
          }
        }
        
        // ポイント表記を探す（5,500ptのような表記）
        // 複数の可能性があるセレクターから探す
        const ptSelectors = [
          '.detail_calcu_pt.red.bold',  // 詳細ページの大きなポイント表示
          '.pt_yen.bold',                // 通常のポイント表示
          '.point'                       // その他のポイント表示
        ];
        
        for (const selector of ptSelectors) {
          const elements = document.querySelectorAll(selector);
          for (const el of elements) {
            const text = el.textContent.trim();
            // pt表記を探す（例: 5,500pt）
            const ptMatch = text.match(/^(\d{1,3}(?:,\d{3})*(?:\.\d+)?)pt$/i);
            if (ptMatch) {
              data.yenText = text;
              break;
            }
          }
          if (data.yenText) break;
        }
        
        const conditionEl = document.querySelector('.box_point_joken');
        if (conditionEl) {
          data.conditions = conditionEl.textContent.trim().substring(0, 500);
        }
        
        return data;
      });
      
      const idMatch = url.match(/\/ad\/(\d+)/);
      const id = idMatch ? `pi_${idMatch[1]}` : `pi_${Date.now()}`;
      
      let cashback = null;
      let cashbackYen = null;
      
      if (detailData.percentText && detailData.percentText.match(/\d+(?:\.\d+)?%/)) {
        cashback = detailData.percentText;
      }
      
      // ポイント還元の場合（10pt = 1円で換算）
      if (detailData.yenText) {
        // pt表記を探す (例: 5,500pt または (750pt) )
        const ptMatch = detailData.yenText.match(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?)(?:pt|ポイント)/i);
        if (ptMatch) {
          const ptValue = parseFloat(ptMatch[1].replace(/,/g, ''));
          const yenValue = Math.floor(ptValue / 10); // 10pt = 1円
          cashbackYen = yenValue + '円';
        }
      }
      
      if (!detailData.title || (!cashback && !cashbackYen)) {
        return null;
      }
      
      return {
        id: id,
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
      await page.close();
    }
  }

  async saveIntermediateResults() {
    const data = {
      siteName: 'ポイントインカム',
      scrapingType: 'batch-processing',
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
      'pointincome_batch_intermediate.json',
      JSON.stringify(data, null, 2),
      'utf8'
    );
  }

  async saveResults() {
    const data = {
      siteName: 'ポイントインカム',
      scrapingType: 'batch-processing',
      scrapedAt: new Date().toISOString(),
      isComplete: true,
      summary: {
        total_campaigns: this.results.length,
        total_processed: this.processedCount,
        errors: this.errorCount,
        completed_categories: this.completedCategories.size,
        total_categories: this.allCategories.length,
        rate_limit_ms: this.rateLimitMs,
        batch_size: this.batchSize
      },
      campaigns: this.results
    };

    await fs.writeFile(
      'pointincome_batch_final.json',
      JSON.stringify(data, null, 2),
      'utf8'
    );

    console.log(`\n💾 最終データ保存完了: pointincome_batch_final.json`);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
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
      
      console.log(`🎯 処理対象: ${remainingCategories.length}カテゴリ`);
      
      // バッチ処理実行
      for (let i = 0; i < remainingCategories.length; i += this.batchSize) {
        const batch = remainingCategories.slice(i, i + this.batchSize);
        const batchIndex = Math.floor(i / this.batchSize);
        
        await this.processBatch(batch, batchIndex);
        
        // バッチ間でブラウザ再起動
        if (i + this.batchSize < remainingCategories.length) {
          console.log(`\n🔄 ブラウザ再起動中...`);
          await this.initBrowser();
          await this.sleep(2000);
        }
      }
      
      await this.saveResults();
      
      const endTime = Date.now();
      const durationMinutes = Math.round((endTime - startTime) / 60000);
      
      console.log('\n🎉 バッチスクレイピング完了！');
      console.log(`📊 総案件数: ${this.results.length}件`);
      console.log(`✅ 成功数: ${this.processedCount}件`);
      console.log(`❌ エラー数: ${this.errorCount}件`);
      console.log(`⏱️ 実行時間: ${durationMinutes}分`);
      
    } catch (error) {
      console.error('❌ 致命的エラー:', error);
    } finally {
      await this.close();
    }
  }
}

// 実行
(async () => {
  const scraper = new PointIncomeBatchScraper();
  await scraper.run();
})();