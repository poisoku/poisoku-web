const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class TimeoutFreeScraper {
  constructor() {
    this.baseUrl = 'https://pointi.jp';
    this.allResults = [];
    this.browser = null;
    this.processedUrls = new Set();
    this.processedCount = 0;
    this.errorCount = 0;
    this.maxRetries = 3;
    
    // タイムアウトフリー設定
    this.rateLimitMs = 1500; // 1.5秒（速度重視）
    this.pageTimeoutMs = 60000; // 1分（余裕をもって）
    this.maxPagesPerGroup = 50; // ページ数上限拡張
    this.browserRestartInterval = 30; // 30案件ごとにブラウザ再起動
    
    // 進捗管理
    this.finalOutputFile = 'pointincome_timeout_free_all_campaigns.json';
    this.progressFile = 'timeout_free_progress.json';
    this.completedCategories = new Set();
    this.currentCategoryIndex = 0;
    this.totalCategories = 0;
    this.startTime = Date.now();
    
    // カテゴリ内進捗管理（タイムアウト対策）
    this.processedUrlsInCategory = new Set();
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
    
    this.totalCategories = this.allCategories.length;
  }

  async init() {
    console.log('🚀 タイムアウトフリー ポイントインカム完全スクレイピングシステム開始');
    console.log(`📊 対象: ${this.totalCategories}カテゴリ`);
    console.log(`⏱️ 高速レート制限: ${this.rateLimitMs / 1000}秒間隔`);
    console.log(`🔄 ブラウザ再起動間隔: ${this.browserRestartInterval}案件ごと`);
    console.log('💪 タイムアウト制限なし - 全案件確実取得\n');
    
    await this.loadProgress();
    await this.loadExistingData();
    await this.initBrowser();
  }

  async loadProgress() {
    try {
      if (await this.fileExists(this.progressFile)) {
        const progress = JSON.parse(await fs.readFile(this.progressFile, 'utf8'));
        this.currentCategoryIndex = progress.currentCategoryIndex || 0;
        this.completedCategories = new Set(progress.completedCategories || []);
        this.processedCount = progress.processedCount || 0;
        this.errorCount = progress.errorCount || 0;
        
        // カテゴリ内進捗復元（タイムアウト対策）
        if (progress.currentCategoryProgress) {
          this.currentCategoryProgress = progress.currentCategoryProgress;
          this.processedUrlsInCategory = new Set(this.currentCategoryProgress.processedUrls || []);
          console.log(`📋 カテゴリ内進捗復元: ${this.processedUrlsInCategory.size}/${this.currentCategoryProgress.totalUrls}件処理済み`);
        }
        
        console.log(`📋 進捗復元: ${this.currentCategoryIndex}/${this.totalCategories}カテゴリ`);
        console.log(`📊 完了済み: ${this.completedCategories.size}カテゴリ`);
        console.log(`📊 処理済み案件: ${this.processedCount}件`);
      }
    } catch (error) {
      console.log('📋 進捗ファイルなし - 新規開始');
    }
  }

  async saveProgress() {
    const progress = {
      currentCategoryIndex: this.currentCategoryIndex,
      completedCategories: Array.from(this.completedCategories),
      processedCount: this.processedCount,
      errorCount: this.errorCount,
      totalResults: this.allResults.length,
      elapsedTime: Date.now() - this.startTime,
      lastUpdated: new Date().toISOString(),
      
      // カテゴリ内進捗保存（タイムアウト対策）
      currentCategoryProgress: {
        ...this.currentCategoryProgress,
        processedUrls: Array.from(this.processedUrlsInCategory)
      }
    };

    await fs.writeFile(this.progressFile, JSON.stringify(progress, null, 2), 'utf8');
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
        await this.sleep(2000);
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
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ],
      timeout: 30000
    });
    
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
      await this.init();
      
      const remainingCategories = this.allCategories.slice(this.currentCategoryIndex);
      
      console.log(`🎯 処理開始: ${remainingCategories.length}カテゴリ残り`);
      console.log(`📊 完了済み: ${this.completedCategories.size}カテゴリ\n`);

      for (let i = 0; i < remainingCategories.length; i++) {
        const category = remainingCategories[i];
        const globalIndex = this.currentCategoryIndex + i;
        
        console.log(`\n📍 [${globalIndex + 1}/${this.totalCategories}] 処理開始: ${category.name}`);
        
        const categoryKey = `${category.type}_${category.id}`;
        
        if (this.completedCategories.has(categoryKey)) {
          console.log(`⏭️ スキップ: ${category.name}（完了済み）`);
          continue;
        }

        try {
          const categoryStartTime = Date.now();
          
          // カテゴリ内進捗初期化または復元
          if (this.currentCategoryProgress.categoryKey !== categoryKey) {
            // 新しいカテゴリ開始
            this.currentCategoryProgress = {
              categoryKey: categoryKey,
              processedUrls: [],
              totalUrls: 0,
              results: []
            };
            this.processedUrlsInCategory = new Set();
            console.log(`🆕 新カテゴリ開始: ${category.name}`);
          } else {
            // 既存カテゴリ継続
            console.log(`🔄 カテゴリ継続: ${category.name} (${this.processedUrlsInCategory.size}件処理済み)`);
          }
          
          const categoryResults = await this.scrapeCategory(category);
          const categoryDuration = Math.round((Date.now() - categoryStartTime) / 1000);
          
          // カテゴリ完了時に累積保存
          this.allResults.push(...categoryResults);
          this.completedCategories.add(categoryKey);
          this.currentCategoryIndex = globalIndex + 1;
          
          // カテゴリ内進捗クリア（完了）
          this.currentCategoryProgress = {
            categoryKey: null,
            processedUrls: [],
            totalUrls: 0,
            results: []
          };
          this.processedUrlsInCategory = new Set();
          
          console.log(`✅ ${category.name}: ${categoryResults.length}件取得完了 (${categoryDuration}秒)`);
          
          // 進捗保存
          await this.saveProgress();
          await this.saveCompleteData(false);
          
          // 定期的な統計表示
          const totalElapsed = Math.round((Date.now() - this.startTime) / 1000);
          const avgTimePerCategory = totalElapsed / (globalIndex + 1);
          const estimatedRemaining = avgTimePerCategory * (this.totalCategories - globalIndex - 1);
          
          console.log(`📊 進捗: ${globalIndex + 1}/${this.totalCategories} (${Math.round((globalIndex + 1) / this.totalCategories * 100)}%)`);
          console.log(`⏱️ 経過時間: ${Math.round(totalElapsed / 60)}分`);
          console.log(`📈 推定残り時間: ${Math.round(estimatedRemaining / 60)}分`);
          console.log(`📊 累計案件数: ${this.allResults.length}件`);
          
          // ブラウザ再起動（メモリリーク対策）
          if (this.processedCount % this.browserRestartInterval === 0) {
            console.log('🔄 ブラウザ再起動（メモリリーク対策）...');
            await this.initBrowser();
          }
          
        } catch (error) {
          console.error(`❌ ${category.name} エラー:`, error.message);
          this.errorCount++;
          
          // エラー時も進捗を保存（カテゴリ内進捗含む）
          await this.saveProgress();
        }

        // カテゴリ間の待機
        await this.sleep(2000);
      }

      await this.saveCompleteData(true);
      console.log('\n🎉 全カテゴリ処理完了！');
      
      // 最終統計
      const totalTime = Math.round((Date.now() - this.startTime) / 1000);
      console.log(`⏱️ 総実行時間: ${Math.round(totalTime / 60)}分`);
      console.log(`📊 総案件数: ${this.allResults.length}件`);
      console.log(`❌ エラー数: ${this.errorCount}件`);

    } catch (error) {
      console.error('❌ 致命的エラー:', error);
      await this.saveCompleteData(false);
    } finally {
      await this.close();
    }
  }

  async scrapeCategory(category) {
    const page = await this.setupPage();
    const categoryResults = [];
    
    try {
      let allCampaignLinks = [];
      let pageNum = 1;
      
      const firstUrl = category.type === 'group' 
        ? `${this.baseUrl}/list.php?group=${category.id}`
        : `${this.baseUrl}/list.php?category=${category.id}`;
      
      await page.goto(firstUrl, { waitUntil: 'networkidle2', timeout: this.pageTimeoutMs });
      await this.sleep(500);
      
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
        
        await this.sleep(800);
        pageNum++;
      }
      
      const uniqueLinks = Array.from(
        new Map(allCampaignLinks.map(link => [link.url, link])).values()
      );
      
      console.log(`📊 ${category.name}: ${uniqueLinks.length}件の案件を詳細取得開始`);
      
      // カテゴリ内進捗管理の更新
      this.currentCategoryProgress.totalUrls = uniqueLinks.length;
      
      // 詳細データ取得
      for (let i = 0; i < uniqueLinks.length; i++) {
        const campaign = uniqueLinks[i];
        
        // カテゴリ内進捗チェック（既に処理済みの場合はスキップ）
        if (this.processedUrls.has(campaign.url) || this.processedUrlsInCategory.has(campaign.url)) {
          console.log(`  ⏭️ スキップ: ${campaign.url} (処理済み)`);
          continue;
        }
        
        try {
          const detailData = await this.scrapeCampaignDetail(campaign.url);
          if (detailData && detailData.title !== 'タイトル取得失敗') {
            let device = 'すべて';
            const title = detailData.title.toLowerCase();
            
            if (title.includes('ios用') || title.includes('iphone') || title.includes('ipad') || title.includes('app store')) {
              device = 'iOS';
            } else if (title.includes('android用') || title.includes('google play') || title.includes('アンドロイド')) {
              device = 'Android';
            } else if (title.includes('pcのみ') || title.includes('pc限定') || title.includes('パソコン限定')) {
              device = 'PC';
            }
            
            const resultData = {
              ...detailData,
              category: category.name,
              categoryType: category.type,
              device: device
            };
            
            categoryResults.push(resultData);
            this.currentCategoryProgress.results.push(resultData);
            
            this.processedUrls.add(campaign.url);
            this.processedUrlsInCategory.add(campaign.url);
            this.processedCount++;
            
            // カテゴリ内進捗の定期保存（10件ごと）
            if ((this.processedUrlsInCategory.size) % 10 === 0) {
              await this.saveProgress();
              console.log(`  💾 カテゴリ内進捗保存: ${this.processedUrlsInCategory.size}/${uniqueLinks.length}件`);
            }
            
            // 進捗表示を簡潔に
            if ((this.processedUrlsInCategory.size) % 20 === 0 || this.processedUrlsInCategory.size === uniqueLinks.length) {
              const processed = this.processedUrlsInCategory.size;
              console.log(`  📊 進捗: ${processed}/${uniqueLinks.length} (${Math.round(processed / uniqueLinks.length * 100)}%)`);
            }
          }
        } catch (error) {
          console.error(`❌ [${i + 1}/${uniqueLinks.length}] 詳細エラー: ${campaign.url}`);
          this.errorCount++;
        }
        
        await this.sleep(this.rateLimitMs);
      }
      
      return categoryResults;
      
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
      
      await this.sleep(300);
      
      const detailData = await page.evaluate(() => {
        // タイトル取得
        let title = '';
        const titleSelectors = ['h1', '.ad-title', '.campaign-title', '.title', 'h2', 'h3'];
        
        for (const selector of titleSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim() && 
              element.textContent.trim() !== 'TOP' && 
              element.textContent.trim().length > 3) {
            title = element.textContent.trim();
            break;
          }
        }
        
        if (!title) {
          const titleElement = document.querySelector('title');
          if (titleElement) {
            const titleText = titleElement.textContent.trim();
            if (titleText && !titleText.includes('TOP') && !titleText.includes('ポイントサイト')) {
              title = titleText.split('|')[0].trim();
            }
          }
        }
        
        // 改良版還元率取得ロジック（final-sample-testerから移植）
        let cashback = '';
        let cashbackYen = '';
        let debugInfo = {
          foundPercentages: [],
          foundPoints: [],
          foundYen: [],
          strategy: ''
        };
        
        const allText = document.body.textContent;
        
        // 1. すべてのパーセント表記を検索
        const percentMatches = allText.match(/(\d+(?:\.\d+)?)\s*%/g);
        if (percentMatches) {
          debugInfo.foundPercentages = percentMatches;
        }
        
        // 2. すべてのポイント表記を検索（大きな数字を優先）
        const pointMatches = allText.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*pt/g);
        if (pointMatches) {
          debugInfo.foundPoints = pointMatches;
        }
        
        // 3. すべての円表記を検索
        const yenMatches = allText.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*円/g);
        if (yenMatches) {
          debugInfo.foundYen = yenMatches;
        }
        
        // 戦略A0: 矢印表記での特別還元率（最優先）
        const arrowPercentMatch = allText.match(/(\d+(?:\.\d+)?)\s*%[^0-9]*(?:⇒|→)[^0-9]*(\d+(?:\.\d+)?)\s*%/);
        if (arrowPercentMatch) {
          // 矢印の後の値を採用（特別還元率）
          cashback = arrowPercentMatch[2] + '%';
          debugInfo.strategy = 'arrow_percentage';
        }
        
        // 戦略A: 「購入金額の◯%」形式をチェック
        if (!cashback) {
          const purchasePercentMatch = allText.match(/購入金額の\s*(\d+(?:\.\d+)?)\s*%/);
          if (purchasePercentMatch) {
            cashback = purchasePercentMatch[1] + '%';
            debugInfo.strategy = 'purchase_percentage';
          }
        }
        
        // 戦略B: 固定ポイント案件かチェック（特定のコンテキストで抽出）
        if (!cashback && pointMatches) {
          let selectedPoints = 0;
          let bestPointMatch = '';
          let extractionMethod = '';
          
          // 方法1: 還元や獲得という文脈の近くにあるポイントを優先
          const contextualPatterns = [
            /還元[^\d]*?(\d{1,3}(?:,\d{3})*)\s*pt/,
            /獲得[^\d]*?(\d{1,3}(?:,\d{3})*)\s*pt/,
            /\b(\d{1,3}(?:,\d{3})*)\s*pt\s*(?:還元|獲得)/,
            /\b(\d{1,3}(?:,\d{3})*)\s*pt\s*(?:プレゼント|もらえる)/
          ];
          
          for (const pattern of contextualPatterns) {
            const match = allText.match(pattern);
            if (match && match[1]) {
              const pointValue = parseInt(match[1].replace(/,/g, ''));
              if (pointValue >= 1000 && pointValue > selectedPoints) {
                selectedPoints = pointValue;
                bestPointMatch = match[1] + 'pt';
                extractionMethod = 'contextual';
                break;
              }
            }
          }
          
          // 方法2: コンテキストで見つからない場合、頻出するポイント数を特定
          if (!bestPointMatch) {
            const pointCounts = {};
            for (const match of pointMatches) {
              const pointValue = parseInt(match.replace(/[,pt\s]/g, ''));
              if (pointValue >= 1000 && pointValue <= 50000) {
                pointCounts[pointValue] = (pointCounts[pointValue] || 0) + 1;
              }
            }
            
            // 最も頻出するポイント数を選択（複数回言及されるものは重要な可能性が高い）
            let maxCount = 0;
            let mostFrequentPoint = 0;
            for (const [points, count] of Object.entries(pointCounts)) {
              const pointValue = parseInt(points);
              if (count > maxCount || (count === maxCount && pointValue < mostFrequentPoint)) {
                maxCount = count;
                mostFrequentPoint = pointValue;
              }
            }
            
            if (mostFrequentPoint > 0) {
              selectedPoints = mostFrequentPoint;
              bestPointMatch = mostFrequentPoint.toLocaleString() + 'pt';
              extractionMethod = 'frequency';
            }
          }
          
          // 方法3: どちらでも見つからない場合、中程度のポイント数を選択（過度に大きくない値）
          if (!bestPointMatch) {
            const reasonablePoints = pointMatches
              .map(match => parseInt(match.replace(/[,pt\s]/g, '')))
              .filter(points => points >= 1000 && points <= 30000)
              .sort((a, b) => a - b);
            
            if (reasonablePoints.length > 0) {
              // 中央値付近を選択
              const midIndex = Math.floor(reasonablePoints.length / 2);
              selectedPoints = reasonablePoints[midIndex];
              bestPointMatch = selectedPoints.toLocaleString() + 'pt';
              extractionMethod = 'median';
            }
          }
          
          if (bestPointMatch) {
            cashback = bestPointMatch;
            const yenValue = Math.floor(selectedPoints / 10);
            cashbackYen = yenValue + '円';
            debugInfo.strategy = 'fixed_points_large';
            debugInfo.extractionMethod = extractionMethod;
          }
        }
        
        // 戦略C: 小さなポイント案件（1000pt未満）
        if (!cashback && pointMatches) {
          let maxPoints = 0;
          let bestPointMatch = '';
          
          for (const match of pointMatches) {
            const pointValue = parseInt(match.replace(/[,pt\s]/g, ''));
            if (pointValue > maxPoints) {
              maxPoints = pointValue;
              bestPointMatch = match.trim();
            }
          }
          
          if (bestPointMatch) {
            cashback = bestPointMatch;
            // 10pt = 1円でレート変換
            const yenValue = Math.floor(maxPoints / 10);
            if (yenValue > 0) {
              cashbackYen = yenValue + '円';
            }
            debugInfo.strategy = 'fixed_points_small';
          }
        }
        
        // 戦略D: パーセント形式（購入金額のパーセントでない場合）
        if (!cashback && percentMatches) {
          // 最初に見つかったパーセントを使用（広告メインエリアの可能性が高い）
          const firstPercent = percentMatches[0];
          const percentValue = parseFloat(firstPercent.replace('%', ''));
          if (percentValue > 0 && percentValue <= 100) {
            cashback = firstPercent;
            debugInfo.strategy = 'general_percentage';
          }
        }
        
        // 獲得条件は不要のため削除
        
        // デバイス情報（PC環境で確認できる案件は「すべて」に分類）
        let device = 'すべて';
        const titleLower = title.toLowerCase();
        const allTextLower = allText.toLowerCase();
        
        // iOSアプリ専用案件のみ「iOS」に分類
        if ((titleLower.includes('ios') || titleLower.includes('iphone') || titleLower.includes('ipad') || 
             titleLower.includes('app store') || allTextLower.includes('app store')) &&
            !titleLower.includes('android') && !titleLower.includes('pc')) {
          device = 'iOS';
        }
        // Androidアプリ専用案件のみ「Android」に分類
        else if ((titleLower.includes('android') || titleLower.includes('google play') || 
                  titleLower.includes('アンドロイド')) &&
                 !titleLower.includes('ios') && !titleLower.includes('pc')) {
          device = 'Android';
        }
        // その他すべて（Webサイト、両対応アプリ、PC専用等）は「すべて」
        
        return {
          title: title || 'タイトル取得失敗',
          cashback: cashback,
          cashbackYen: cashbackYen,
          device: device,
          scrapedAt: new Date().toISOString()
        };
      });
      
      const urlParts = url.split('/');
      const adId = urlParts[urlParts.length - 2] || urlParts[urlParts.length - 1];
      
      return {
        id: `pi_${adId}`,
        url: url,
        campaignUrl: url,
        displayName: detailData.title,
        ...detailData
      };
      
    } finally {
      await page.close();
    }
  }

  async saveCompleteData(isComplete = false) {
    const data = {
      siteName: 'ポイントインカム',
      scrapingType: 'timeout-free-complete-scraping',
      scrapedAt: new Date().toISOString(),
      isComplete: isComplete,
      summary: {
        total_campaigns: this.allResults.length,
        total_processed: this.processedCount,
        errors: this.errorCount,
        completed_categories: this.completedCategories.size,
        total_categories: this.totalCategories,
        completion_rate: Math.round((this.completedCategories.size / this.totalCategories) * 100),
        elapsed_time_minutes: Math.round((Date.now() - this.startTime) / 60000),
        rate_limit_ms: this.rateLimitMs
      },
      campaigns: this.allResults
    };

    await fs.writeFile(this.finalOutputFile, JSON.stringify(data, null, 2), 'utf8');
    
    const sizeKB = Math.round(JSON.stringify(data).length / 1024);
    console.log(`💾 データ保存完了: ${this.allResults.length}件 (${sizeKB}KB)`);
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
  const scraper = new TimeoutFreeScraper();
  await scraper.run();
})();