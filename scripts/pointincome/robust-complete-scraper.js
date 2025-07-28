const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class RobustCompleteScraper {
  constructor() {
    this.baseUrl = 'https://pointi.jp';
    this.allResults = [];
    this.browser = null;
    this.processedCount = 0;
    this.errorCount = 0;
    
    // 堅牢性向上設定
    this.rateLimitMs = 2000; // 2秒間隔（安定性重視）
    this.pageTimeoutMs = 45000; // 45秒
    this.maxPagesPerGroup = 50;
    this.browserRestartInterval = 20; // 20案件ごとに再起動（頻繁）
    this.maxRetries = 2;
    
    // 出力ファイル
    this.finalOutputFile = 'pointincome_robust_final.json';
    this.progressFile = 'complete_scraping_progress.json';
    this.completedCategories = new Set();
    this.currentCategoryIndex = 0;
    this.startTime = Date.now();
    
    // カテゴリ内進捗管理
    this.currentCategoryProgress = {
      categoryKey: null,
      processedUrls: [],
      totalUrls: 0,
      results: []
    };
    
    // 全39カテゴリ定義
    this.allCategories = [
      // ショッピンググループ
      { name: 'EC・ネットショッピング', id: 65, type: 'group' },
      { name: 'ファッション', id: 152, type: 'group' },
      { name: 'グルメ', id: 154, type: 'group' },
      { name: '美容', id: 148, type: 'group' },
      { name: '衛生用品', id: 147, type: 'group' },
      { name: 'エンタメ・家電', id: 151, type: 'group' },
      { name: '住まい・暮らし', id: 155, type: 'group' },
      { name: 'その他（ショッピング）', id: 153, type: 'group' },
      
      // サービスカテゴリ
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
  }

  async init() {
    console.log('🚀 堅牢版 ポイントインカム完全スクレイピングシステム開始');
    console.log(`📊 対象: ${this.allCategories.length}カテゴリ`);
    console.log(`⏱️ 安定レート制限: ${this.rateLimitMs / 1000}秒間隔`);
    console.log(`🔄 ブラウザ再起動間隔: ${this.browserRestartInterval}案件ごと`);
    console.log('🛡️ 接続エラー対策強化\n');
    
    await this.loadProgress();
    await this.loadExistingData();
    await this.initBrowser();
  }

  async loadProgress() {
    try {
      if (await this.fileExists(this.progressFile)) {
        const progressData = JSON.parse(await fs.readFile(this.progressFile, 'utf8'));
        this.currentCategoryIndex = progressData.currentCategoryIndex || 0;
        this.completedCategories = new Set(progressData.completedCategories || []);
        this.processedCount = progressData.processedCount || 0;
        this.errorCount = progressData.errorCount || 0;
        
        if (progressData.currentCategoryProgress) {
          this.currentCategoryProgress = progressData.currentCategoryProgress;
        }
        
        console.log(`📋 進捗復元: ${this.currentCategoryIndex}/${this.allCategories.length}カテゴリ`);
        console.log(`📊 完了済み: ${this.completedCategories.size}カテゴリ`);
        console.log(`📊 処理済み案件: ${this.processedCount}件`);
        
        if (this.currentCategoryProgress.processedUrls.length > 0) {
          console.log(`📋 カテゴリ内進捗復元: ${this.currentCategoryProgress.processedUrls.length}件処理済み`);
        }
      }
    } catch (error) {
      console.log('📋 新規スクレイピング開始');
    }
  }

  async loadExistingData() {
    try {
      if (await this.fileExists(this.finalOutputFile)) {
        const existingData = JSON.parse(await fs.readFile(this.finalOutputFile, 'utf8'));
        this.allResults = existingData.campaigns || [];
        console.log(`📋 既存データ読み込み: ${this.allResults.length}件の案件`);
      }
    } catch (error) {
      console.log('📋 新規データファイル作成');
    }
  }

  async initBrowser() {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        // ブラウザクローズエラーは無視
      }
    }
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-extensions',
        '--no-first-run',
        '--disable-default-apps',
        '--disable-web-security'
      ],
      defaultViewport: { width: 1366, height: 768 },
      ignoreDefaultArgs: ['--enable-automation']
    });
    
    console.log('✅ ブラウザ初期化完了');
  }

  async setupPage() {
    const page = await this.browser.newPage();
    
    // ページ設定
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // リクエストインターセプション（画像等をブロックして高速化）
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (resourceType === 'image' || resourceType === 'stylesheet' || resourceType === 'font') {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    return page;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async scrapeCategory(category) {
    let page = null;
    let retryCount = 0;
    
    while (retryCount < this.maxRetries) {
      try {
        page = await this.setupPage();
        
        console.log(`\n📍 [${this.currentCategoryIndex + 1}/${this.allCategories.length}] 処理開始: ${category.name}`);
        
        // カテゴリ継続か新規開始かを判定
        const categoryKey = `${category.type}_${category.id}`;
        const isContinuation = this.currentCategoryProgress.categoryKey === categoryKey;
        
        if (isContinuation) {
          console.log(`🔄 カテゴリ継続: ${category.name} (${this.currentCategoryProgress.processedUrls.length}件処理済み)`);
        } else {
          console.log(`🆕 新カテゴリ開始: ${category.name}`);
          this.currentCategoryProgress = {
            categoryKey: categoryKey,
            processedUrls: [],
            totalUrls: 0,
            results: []
          };
        }
        
        // 全URLを取得
        const allUrls = await this.getAllCampaignUrls(page, category);
        
        if (allUrls.length === 0) {
          console.log(`⚠️ ${category.name}: 案件が見つかりませんでした`);
          return [];
        }
        
        console.log(`📊 ${category.name}: ${allUrls.length}件の案件を詳細取得開始`);
        
        // 詳細取得
        const results = await this.scrapeCampaignDetails(page, allUrls, category);
        
        await page.close();
        return results;
        
      } catch (error) {
        console.log(`❌ ${category.name} エラー: ${error.message}`);
        
        if (page) {
          try {
            await page.close();
          } catch (closeError) {
            // ページクローズエラーは無視
          }
        }
        
        retryCount++;
        if (retryCount < this.maxRetries) {
          console.log(`🔄 ${retryCount + 1}回目のリトライ...`);
          await this.sleep(3000);
          
          // ブラウザ再初期化
          await this.initBrowser();
        }
      }
    }
    
    throw new Error(`${category.name}: ${this.maxRetries}回のリトライ後も失敗`);
  }

  async getAllCampaignUrls(page, category) {
    const allCampaignLinks = [];
    let pageNum = 1;
    
    const firstUrl = category.type === 'group' 
      ? `${this.baseUrl}/list.php?group=${category.id}`
      : `${this.baseUrl}/list.php?category=${category.id}`;
    
    await page.goto(firstUrl, { waitUntil: 'networkidle2', timeout: this.pageTimeoutMs });
    await this.sleep(1000);
    
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
        const nextButtons = Array.from(document.querySelectorAll('a'));
        let nextButton = null;
        
        for (let btn of nextButtons) {
          const text = btn.textContent || '';
          if (text.includes('次へ') || text === '>') {
            nextButton = btn;
            break;
          }
        }
        
        if (nextButton && nextButton.href) {
          window.location.href = nextButton.href;
          return { success: true };
        }
        
        return { success: false, reason: 'Next button not found' };
      });
      
      if (!nextPageResult.success) {
        console.log(`    📄 最終ページに到達`);
        break;
      }
      
      await this.sleep(2000);
      await page.waitForSelector('a[href*="/ad/"]', { timeout: 10000 });
      pageNum++;
    }
    
    // 重複除去
    const uniqueUrls = Array.from(new Map(
      allCampaignLinks.map(link => [link.url, link])
    ).values());
    
    return uniqueUrls;
  }

  async scrapeCampaignDetails(page, allUrls, category) {
    const results = [];
    const processedUrls = new Set(this.currentCategoryProgress.processedUrls);
    
    for (let i = 0; i < allUrls.length; i++) {
      const urlData = allUrls[i];
      
      // 既に処理済みかチェック
      if (processedUrls.has(urlData.url)) {
        console.log(`  ⏭️ スキップ: ${urlData.url} (処理済み)`);
        continue;
      }
      
      try {
        await page.goto(urlData.url, { 
          waitUntil: 'networkidle2', 
          timeout: this.pageTimeoutMs 
        });
        await this.sleep(500);
        
        const campaignData = await this.extractCampaignData(page, urlData.url, category.name);
        
        if (campaignData) {
          results.push(campaignData);
          this.allResults.push(campaignData);
        }
        
        processedUrls.add(urlData.url);
        this.currentCategoryProgress.processedUrls.push(urlData.url);
        this.processedCount++;
        
        // 進捗保存（10件ごと）
        if (this.processedCount % 10 === 0) {
          await this.saveProgress();
          console.log(`  💾 カテゴリ内進捗保存: ${processedUrls.size}/${allUrls.length}件`);
          console.log(`  📊 進捗: ${processedUrls.size}/${allUrls.length} (${Math.round(processedUrls.size / allUrls.length * 100)}%)`);
        }
        
        // ブラウザ再起動（安定性確保）
        if (this.processedCount % this.browserRestartInterval === 0) {
          console.log(`  🔄 ブラウザ再起動 (${this.processedCount}件処理済み)`);
          await this.initBrowser();
          page = await this.setupPage();
        }
        
        await this.sleep(this.rateLimitMs);
        
      } catch (error) {
        console.log(`❌ [${processedUrls.size + 1}/${allUrls.length}] 詳細エラー: ${urlData.url}`);
        this.errorCount++;
        
        // エラーでもprocessedUrlsに追加（無限ループ防止）
        processedUrls.add(urlData.url);
        this.currentCategoryProgress.processedUrls.push(urlData.url);
      }
    }
    
    return results;
  }

  async extractCampaignData(page, url, categoryName) {
    return await page.evaluate((url, categoryName) => {
      const allText = document.body.textContent;
      
      // タイトル取得
      const titleElement = document.querySelector('h1') || 
                          document.querySelector('.title') || 
                          document.querySelector('title');
      const title = titleElement ? titleElement.textContent.trim() : 'タイトル不明';
      
      let cashback = '';
      let cashbackYen = '';
      let debugInfo = {
        strategy: '',
        foundPercentages: [],
        foundPoints: []
      };
      
      // パーセント・ポイント検索
      const percentMatches = allText.match(/(\d+(?:\.\d+)?)\s*%/g);
      const pointMatches = allText.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*pt/g);
      
      if (percentMatches) debugInfo.foundPercentages = percentMatches.slice(0, 5);
      if (pointMatches) debugInfo.foundPoints = pointMatches.slice(0, 5);
      
      // 戦略A0: 矢印表記での特別還元率（最優先）
      const arrowPercentMatch = allText.match(/(\d+(?:\.\d+)?)\s*%[^0-9]*(?:⇒|→)[^0-9]*(\d+(?:\.\d+)?)\s*%/);
      if (arrowPercentMatch) {
        cashback = arrowPercentMatch[2] + '%';
        debugInfo.strategy = 'arrow_percentage';
      }
      
      // 戦略A: 「購入金額の◯%」形式
      if (!cashback) {
        const purchasePercentMatch = allText.match(/購入金額の\s*(\d+(?:\.\d+)?)\s*%/);
        if (purchasePercentMatch) {
          cashback = purchasePercentMatch[1] + '%';
          debugInfo.strategy = 'purchase_percentage';
        }
      }
      
      // 戦略B: 固定ポイント案件
      if (!cashback && pointMatches) {
        const largePointMatches = pointMatches.filter(match => {
          const pointValue = parseInt(match.replace(/[,pt\s]/g, ''));
          return pointValue >= 5000;
        });
        
        if (largePointMatches.length > 0) {
          let maxPoints = 0;
          let maxPointMatch = '';
          
          for (const match of largePointMatches) {
            const pointValue = parseInt(match.replace(/[,pt\s]/g, ''));
            if (pointValue > maxPoints) {
              maxPoints = pointValue;
              maxPointMatch = match;
            }
          }
          
          cashback = maxPointMatch;
          cashbackYen = Math.floor(maxPoints / 10) + '円';
          debugInfo.strategy = 'large_points';
        }
      }
      
      // 戦略C: 一般パーセント
      if (!cashback && percentMatches) {
        const firstPercent = percentMatches[0];
        const percentValue = parseFloat(firstPercent.replace('%', ''));
        if (percentValue > 0 && percentValue <= 100) {
          cashback = firstPercent;
          debugInfo.strategy = 'general_percentage';
        }
      }
      
      // デバイス判定（PC環境で確認できる案件は「すべて」）
      const device = 'すべて';
      
      return {
        id: url.split('/ad/')[1]?.split('/')[0] || '',
        url: url,
        title: title,
        cashback: cashback || '不明',
        cashbackYen: cashbackYen || '',
        device: device,
        category: categoryName,
        scrapedAt: new Date().toISOString(),
        debugInfo: debugInfo
      };
    }, url, categoryName);
  }

  async saveProgress() {
    const progressData = {
      currentCategoryIndex: this.currentCategoryIndex,
      completedCategories: Array.from(this.completedCategories),
      processedCount: this.processedCount,
      errorCount: this.errorCount,
      totalResults: this.allResults.length,
      elapsedTime: Date.now() - this.startTime,
      lastUpdated: new Date().toISOString(),
      currentCategoryProgress: this.currentCategoryProgress
    };
    
    await fs.writeFile(this.progressFile, JSON.stringify(progressData, null, 2));
  }

  async saveResults() {
    const outputData = {
      siteName: 'ポイントインカム',
      scrapingType: 'robust_complete_scraper',
      scrapedAt: new Date().toISOString(),
      summary: {
        total_campaigns: this.allResults.length,
        total_categories: this.allCategories.length,
        completed_categories: this.completedCategories.size,
        processing_time_ms: Date.now() - this.startTime,
        error_count: this.errorCount
      },
      campaigns: this.allResults
    };
    
    await fs.writeFile(this.finalOutputFile, JSON.stringify(outputData, null, 2));
    console.log(`\n💾 最終結果保存: ${this.finalOutputFile}`);
    console.log(`📊 総取得件数: ${this.allResults.length}件`);
  }

  async run() {
    try {
      await this.init();
      
      console.log(`🎯 処理開始: ${this.allCategories.length - this.currentCategoryIndex}カテゴリ残り`);
      console.log(`📊 完了済み: ${this.completedCategories.size}カテゴリ\n`);
      
      for (let i = this.currentCategoryIndex; i < this.allCategories.length; i++) {
        const category = this.allCategories[i];
        const categoryKey = `${category.type}_${category.id}`;
        
        if (this.completedCategories.has(categoryKey)) {
          console.log(`✅ スキップ: ${category.name} (完了済み)`);
          continue;
        }
        
        this.currentCategoryIndex = i;
        
        const results = await this.scrapeCategory(category);
        
        // カテゴリ完了
        this.completedCategories.add(categoryKey);
        this.currentCategoryProgress = {
          categoryKey: null,
          processedUrls: [],
          totalUrls: 0,
          results: []
        };
        
        await this.saveProgress();
        
        console.log(`✅ ${category.name} 完了: ${results.length}件取得\n`);
      }
      
      await this.saveResults();
      
      console.log('🎉 全カテゴリスクレイピング完了！');
      console.log(`📊 最終結果: ${this.allResults.length}件の案件を取得`);
      console.log(`⏱️ 総処理時間: ${Math.round((Date.now() - this.startTime) / 1000 / 60)}分`);
      
    } catch (error) {
      console.error('❌ 致命的エラー:', error);
      await this.saveProgress();
      throw error;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

module.exports = RobustCompleteScraper;

// 直接実行の場合
if (require.main === module) {
  (async () => {
    const scraper = new RobustCompleteScraper();
    await scraper.run();
  })();
}