const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

class FastPointIncomeScraper {
  constructor() {
    this.baseUrl = 'https://pointi.jp';
    this.allResults = []; // 全てのデータを累積保存
    this.browser = null;
    this.processedUrls = new Set();
    this.processedCount = 0;
    this.errorCount = 0;
    this.maxRetries = 3;
    
    // 高速化設定
    this.batchSize = 3; // 小さなバッチサイズ
    this.rateLimitMs = 1500; // 1.5秒に短縮
    this.pageTimeoutMs = 60000; // 1分タイムアウト
    this.maxPagesPerGroup = 20; // ページ数制限
    
    // 累積保存システム
    this.finalOutputFile = 'pointincome_fast_complete.json';
    this.checkpointFile = 'fast_checkpoint.json';
    this.completedCategories = new Set();
    this.currentCategoryData = [];
    
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
    console.log('🚀 高速ポイントインカム スクレイピングシステム開始');
    console.log(`📊 総計${this.allCategories.length}カテゴリ（${this.batchSize}カテゴリごとにブラウザ再起動）`);
    console.log(`⏱️ 高速レート制限: ${this.rateLimitMs / 1000}秒間隔\n`);
    
    await this.loadCheckpoint();
    await this.loadExistingData();
    await this.initBrowser();
  }

  async loadExistingData() {
    try {
      if (await this.fileExists(this.finalOutputFile)) {
        const data = await fs.readFile(this.finalOutputFile, 'utf8');
        const parsed = JSON.parse(data);
        this.allResults = parsed.campaigns || [];
        console.log(`📋 既存データ読み込み: ${this.allResults.length}件の案件`);
      }
    } catch (error) {
      console.log('📋 既存データなし - 新規開始');
      this.allResults = [];
    }
  }

  async loadCheckpoint() {
    try {
      if (await this.fileExists(this.checkpointFile)) {
        const data = await fs.readFile(this.checkpointFile, 'utf8');
        const checkpoint = JSON.parse(data);
        this.completedCategories = new Set(checkpoint.completedCategories || []);
        console.log(`📋 チェックポイント読み込み: ${this.completedCategories.size}カテゴリ完了済み`);
      }
    } catch (error) {
      console.log('📋 チェックポイントなし - 全カテゴリを処理対象に設定');
    }
  }

  async saveCheckpoint() {
    const checkpoint = {
      completedCategories: Array.from(this.completedCategories),
      lastUpdated: new Date().toISOString(),
      totalProcessed: this.allResults.length
    };

    await fs.writeFile(
      this.checkpointFile,
      JSON.stringify(checkpoint, null, 2),
      'utf8'
    );
  }

  async saveCompleteData() {
    const data = {
      siteName: 'ポイントインカム',
      scrapingType: 'fast-complete-processing',
      scrapedAt: new Date().toISOString(),
      isComplete: true,
      summary: {
        total_campaigns: this.allResults.length,
        total_processed: this.processedCount,
        errors: this.errorCount,
        completed_categories: this.completedCategories.size,
        total_categories: this.allCategories.length,
        rate_limit_ms: this.rateLimitMs,
        batch_size: this.batchSize
      },
      campaigns: this.allResults
    };

    await fs.writeFile(
      this.finalOutputFile,
      JSON.stringify(data, null, 2),
      'utf8'
    );

    console.log(`💾 完全データ保存完了: ${this.allResults.length}件`);
  }

  async fileExists(filepath) {
    try {
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  }

  async initBrowser() {
    if (this.browser) {
      try {
        await this.browser.close();
        await this.sleep(1000);
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
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ],
      timeout: 30000
    });
    
    // ブラウザが正常に起動したか確認
    if (!this.browser) {
      throw new Error('ブラウザの初期化に失敗しました');
    }
    
    console.log('✅ ブラウザ初期化完了');
  }

  async setupPage() {
    if (!this.browser) {
      throw new Error('ブラウザが初期化されていません');
    }
    
    const page = await this.browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    return page;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async run() {
    try {
      const remainingCategories = this.allCategories.filter(cat => 
        !this.completedCategories.has(`${cat.type}_${cat.id}`)
      );

      console.log(`🎯 処理対象: ${remainingCategories.length}カテゴリ（全${this.allCategories.length}カテゴリ中）`);
      console.log(`📊 完了済み: ${this.completedCategories.size}カテゴリ\n`);

      // 小バッチで処理
      const batches = [];
      for (let i = 0; i < remainingCategories.length; i += this.batchSize) {
        batches.push(remainingCategories.slice(i, i + this.batchSize));
      }

      console.log(`🚀 ${batches.length}バッチで処理開始（${this.batchSize}カテゴリ/バッチ）\n`);

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        console.log(`📍 バッチ ${batchIndex + 1}/${batches.length} 進行中...`);
        
        await this.processBatch(batches[batchIndex], batchIndex);
        
        // バッチ間でブラウザ再起動
        if (batchIndex < batches.length - 1) {
          console.log('🔄 ブラウザ再起動...');
          await this.initBrowser();
          await this.sleep(2000);
        }
      }

      await this.saveCompleteData();
      console.log('\n🎉 全カテゴリ処理完了！');

    } catch (error) {
      console.error('❌ 致命的エラー:', error);
      await this.saveCompleteData(); // 緊急保存
    } finally {
      await this.close();
    }
  }

  async processBatch(categories, batchIndex) {
    console.log(`\n🔥 バッチ ${batchIndex + 1} 開始（${categories.length}カテゴリ）\n`);

    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      console.log(`🛍️ [${i + 1}/${categories.length}] 処理開始: ${category.name}`);

      const categoryKey = `${category.type}_${category.id}`;
      
      if (this.completedCategories.has(categoryKey)) {
        console.log(`⏭️ スキップ: ${category.name}（完了済み）`);
        continue;
      }

      this.currentCategoryData = [];

      try {
        const startTime = Date.now();
        await this.scrapeCategory(category);
        const duration = Math.round((Date.now() - startTime) / 1000);
        
        // カテゴリ完了時に累積保存
        this.allResults.push(...this.currentCategoryData);
        this.completedCategories.add(categoryKey);
        
        console.log(`✅ ${category.name}: ${this.currentCategoryData.length}件取得完了 (${duration}秒)`);
        
        // チェックポイント保存
        await this.saveCheckpoint();
        await this.saveCompleteData();
        
      } catch (error) {
        console.error(`❌ ${category.name} エラー:`, error.message);
        this.errorCount++;
      }

      if (i < categories.length - 1) {
        await this.sleep(this.rateLimitMs);
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
      
      await page.goto(firstUrl, { waitUntil: 'networkidle2', timeout: this.pageTimeoutMs });
      await this.sleep(1000); // 短縮
      
      // ページネーション処理
      while (pageNum <= this.maxPagesPerGroup) {
        console.log(`  📄 ページ ${pageNum} を処理中...`);
        
        const campaignLinks = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a[href*="/ad/"]'));
          return links.map(link => ({
            url: link.href,
            title: link.textContent.trim()
          })).filter(link => link.url.includes('/ad/'));
        });
        
        if (campaignLinks.length === 0) {
          console.log(`    ⚠️ 案件が見つかりません - ページ終了`);
          break;
        }
        
        allCampaignLinks.push(...campaignLinks);
        console.log(`    ✅ ${campaignLinks.length}件発見（累計: ${allCampaignLinks.length}件）`);
        
        // 次ページボタンをクリック
        const nextPageResult = await page.evaluate(() => {
          const nextButtons = Array.from(document.querySelectorAll('a, input[type="button"], input[type="submit"]'));
          let nextButton = null;
          
          for (let btn of nextButtons) {
            const text = btn.textContent || btn.value || '';
            if (text.includes('次へ') || text === '>' || text.includes('next')) {
              nextButton = btn;
              break;
            }
          }
          
          if (nextButton && nextButton.onclick) {
            try {
              nextButton.click();
              return { success: true };
            } catch (error) {
              return { success: false, error: error.message };
            }
          }
          
          return { success: false, reason: 'no_button' };
        });
        
        if (!nextPageResult.success) {
          console.log(`    📝 最終ページ ${pageNum} で終了`);
          break;
        }
        
        await this.sleep(1000); // 短縮
        pageNum++;
      }
      
      const uniqueLinks = Array.from(
        new Map(allCampaignLinks.map(link => [link.url, link])).values()
      );
      
      console.log(`📊 ${category.name}: ${uniqueLinks.length}件の案件を詳細取得開始`);
      
      // 詳細データ取得
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
            
            this.currentCategoryData.push({
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
      
      await this.sleep(500); // 短縮
      
      const detailData = await page.evaluate(() => {
        // タイトル取得（改良版）
        let title = '';
        
        // より具体的なセレクタから試す
        const titleSelectors = [
          'h1',
          '.ad-title',
          '.campaign-title',
          '.title',
          'h2',
          'h3'
        ];
        
        for (const selector of titleSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim() && 
              element.textContent.trim() !== 'TOP' && 
              element.textContent.trim().length > 3) {
            title = element.textContent.trim();
            break;
          }
        }
        
        // titleタグから取得（フォールバック）
        if (!title) {
          const titleElement = document.querySelector('title');
          if (titleElement) {
            const titleText = titleElement.textContent.trim();
            if (titleText && !titleText.includes('TOP') && !titleText.includes('ポイントサイト')) {
              // パイプ区切りの最初の部分を取得
              title = titleText.split('|')[0].trim();
            }
          }
        }
        
        // 還元率取得
        let cashback = '';
        let cashbackYen = '';
        
        const allText = document.body.textContent;
        
        // パーセンテージ還元率
        const percentMatch = allText.match(/(\d+(?:\.\d+)?)\s*%/);
        if (percentMatch) {
          cashback = percentMatch[1] + '%';
        }
        
        // ポイント還元率
        const pointMatch = allText.match(/(\d+(?:,\d+)*)\s*(?:pt|ポイント)/);
        if (pointMatch) {
          cashback = pointMatch[1] + 'pt';
        }
        
        // 円還元率
        const yenMatch = allText.match(/(\d+(?:,\d+)*)\s*円/);
        if (yenMatch) {
          cashbackYen = yenMatch[1] + '円';
        }
        
        // 説明取得
        let description = title;
        const descriptionSelectors = [
          '.description',
          '.ad-description',
          '.campaign-description',
          'p'
        ];
        
        for (const selector of descriptionSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim().length > 10) {
            description = element.textContent.trim();
            break;
          }
        }
        
        // 獲得条件取得
        let conditions = '';
        const conditionTexts = Array.from(document.querySelectorAll('*')).map(el => el.textContent).join(' ');
        if (conditionTexts.includes('獲得条件') || conditionTexts.includes('条件')) {
          const conditionElements = Array.from(document.querySelectorAll('*')).filter(el => {
            const text = el.textContent;
            return text && (text.includes('獲得条件') || text.includes('成果条件') || text.includes('ポイント獲得'));
          });
          
          if (conditionElements.length > 0) {
            conditions = conditionElements[0].textContent.trim();
          }
        }
        
        return {
          title: title || 'タイトル不明',
          description: description || title || 'タイトル不明',
          displayName: title || 'タイトル不明',
          cashback: cashback,
          cashbackYen: cashbackYen,
          conditions: conditions,
          scrapedAt: new Date().toISOString()
        };
      });
      
      // URL情報を追加
      const urlParts = url.split('/');
      const adId = urlParts[urlParts.length - 2] || urlParts[urlParts.length - 1];
      
      return {
        id: `pi_${adId}`,
        url: url,
        campaignUrl: url,
        ...detailData
      };
      
    } catch (error) {
      console.error(`詳細取得エラー (${url}):`, error.message);
      throw error;
    } finally {
      await page.close();
    }
  }

  async close() {
    if (this.browser) {
      try {
        await this.browser.close();
        console.log('🔒 ブラウザクローズ完了');
      } catch (error) {
        console.log('⚠️ ブラウザクローズエラー:', error.message);
      }
    }
  }
}

// 実行
(async () => {
  const scraper = new FastPointIncomeScraper();
  await scraper.run();
})();