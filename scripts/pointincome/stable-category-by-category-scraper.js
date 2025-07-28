const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class StableCategoryByCategoryScraper {
  constructor() {
    this.baseUrl = 'https://pointi.jp';
    this.browser = null;
    
    // 安定性最重視の設定
    this.rateLimitMs = 3000; // 3秒間隔（余裕を持つ）
    this.pageTimeoutMs = 30000; // 30秒
    this.maxPagesPerCategory = 20; // カテゴリあたり最大20ページ
    this.maxRetries = 3;
    
    // 出力ファイル
    this.progressFile = 'stable_category_progress.json';
    this.currentCategoryIndex = 0;
    
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
      
      // サービスカテゴリ（主要なもののみ）
      { name: 'クレジットカード', id: 70, type: 'category' },
      { name: '証券・FX', id: 75, type: 'category' },
      { name: '銀行', id: 281, type: 'category' },
      { name: '保険', id: 73, type: 'category' },
      { name: 'ローン', id: 74, type: 'category' },
      { name: '不動産', id: 276, type: 'category' },
      { name: '旅行', id: 78, type: 'category' },
      { name: 'グルメ予約', id: 235, type: 'category' },
      { name: '通信・プロバイダ', id: 79, type: 'category' },
      { name: '電気・ガス', id: 240, type: 'category' },
      { name: '教育・資格', id: 72, type: 'category' },
      { name: '美容・エステ', id: 76, type: 'category' },
      { name: '結婚・恋愛', id: 81, type: 'category' },
      { name: '車・バイク', id: 274, type: 'category' },
      { name: 'ゲーム', id: 237, type: 'category' },
      { name: '動画配信', id: 209, type: 'category' },
      { name: '電子書籍', id: 271, type: 'category' },
      { name: 'ふるさと納税', id: 232, type: 'category' },
      { name: 'ポイントサイト', id: 269, type: 'category' },
      { name: 'アンケート', id: 234, type: 'category' },
      { name: 'その他サービス', id: 238, type: 'category' }
    ];
  }

  async init() {
    console.log('🛡️ 安定版カテゴリ別スクレイピングシステム開始');
    console.log(`📊 対象: ${this.allCategories.length}カテゴリ`);
    console.log(`⏱️ 安定レート: ${this.rateLimitMs / 1000}秒間隔`);
    console.log('🎯 戦略: 1カテゴリずつ確実に処理\n');
    
    await this.loadProgress();
  }

  async loadProgress() {
    try {
      if (await this.fileExists(this.progressFile)) {
        const progress = JSON.parse(await fs.readFile(this.progressFile, 'utf8'));
        this.currentCategoryIndex = progress.currentCategoryIndex || 0;
        console.log(`📋 進捗復元: ${this.currentCategoryIndex}/${this.allCategories.length}カテゴリ完了`);
      }
    } catch (error) {
      console.log('📋 新規スクレイピング開始');
    }
  }

  async saveProgress() {
    const progress = {
      currentCategoryIndex: this.currentCategoryIndex,
      lastUpdated: new Date().toISOString(),
      completedCategories: this.allCategories.slice(0, this.currentCategoryIndex).map(c => c.name)
    };
    await fs.writeFile(this.progressFile, JSON.stringify(progress, null, 2));
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async initBrowser() {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (e) {
        // ignore
      }
    }
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--single-process'
      ]
    });
  }

  async setupPage() {
    const page = await this.browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // タイムアウト設定
    page.setDefaultNavigationTimeout(this.pageTimeoutMs);
    page.setDefaultTimeout(this.pageTimeoutMs);
    
    return page;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async scrapeCategory(category) {
    console.log(`\n🎯 カテゴリ処理開始: ${category.name}`);
    
    let retryCount = 0;
    while (retryCount < this.maxRetries) {
      try {
        await this.initBrowser();
        const page = await this.setupPage();
        
        const campaigns = [];
        let pageNum = 1;
        
        // カテゴリトップページ
        const categoryUrl = category.type === 'group' 
          ? `${this.baseUrl}/list.php?group=${category.id}`
          : `${this.baseUrl}/list.php?category=${category.id}`;
        
        await page.goto(categoryUrl, { waitUntil: 'networkidle2' });
        await this.sleep(2000);
        
        // ページネーション処理
        while (pageNum <= this.maxPagesPerCategory) {
          console.log(`  📄 ページ ${pageNum} 処理中...`);
          
          // 案件リンク取得
          const pageData = await page.evaluate(() => {
            const campaigns = [];
            const links = document.querySelectorAll('a[href*="/ad/"]');
            
            links.forEach(link => {
              const href = link.href;
              if (href.includes('/ad/') && !campaigns.find(c => c.url === href)) {
                // 親要素から情報取得
                const container = link.closest('.offer-box, .campaign-item, li, div');
                let title = link.textContent.trim();
                let cashback = '';
                
                if (container) {
                  // タイトル取得
                  const titleEl = container.querySelector('h3, .title, .campaign-name');
                  if (titleEl) title = titleEl.textContent.trim();
                  
                  // 還元率取得
                  const cashbackEl = container.querySelector('.point, .cashback, .reward');
                  if (cashbackEl) {
                    cashback = cashbackEl.textContent.trim();
                  } else {
                    // テキストから抽出
                    const text = container.textContent;
                    const ptMatch = text.match(/(\d{1,3}(?:,\d{3})*)\s*pt/);
                    const percentMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
                    
                    if (ptMatch) cashback = ptMatch[0];
                    else if (percentMatch) cashback = percentMatch[0];
                  }
                }
                
                campaigns.push({
                  url: href,
                  title: title,
                  cashback: cashback
                });
              }
            });
            
            return campaigns;
          });
          
          if (pageData.length === 0) {
            console.log(`    ⚠️ 案件が見つかりません - カテゴリ終了`);
            break;
          }
          
          campaigns.push(...pageData);
          console.log(`    ✅ ${pageData.length}件発見（累計: ${campaigns.length}件）`);
          
          // 次ページへ
          const hasNextPage = await page.evaluate(() => {
            const nextLinks = Array.from(document.querySelectorAll('a'));
            for (const link of nextLinks) {
              if (link.textContent.includes('次へ') || link.textContent === '>') {
                link.click();
                return true;
              }
            }
            return false;
          });
          
          if (!hasNextPage) {
            console.log(`    📄 最終ページに到達`);
            break;
          }
          
          await this.sleep(3000);
          pageNum++;
        }
        
        await page.close();
        await this.browser.close();
        
        // 結果保存
        const outputFile = `pointincome_${category.type}_${category.id}.json`;
        const outputData = {
          category: category.name,
          categoryId: category.id,
          categoryType: category.type,
          scrapedAt: new Date().toISOString(),
          totalCampaigns: campaigns.length,
          campaigns: campaigns
        };
        
        await fs.writeFile(outputFile, JSON.stringify(outputData, null, 2));
        console.log(`✅ ${category.name} 完了: ${campaigns.length}件保存 → ${outputFile}`);
        
        return campaigns.length;
        
      } catch (error) {
        console.error(`❌ エラー: ${error.message}`);
        retryCount++;
        
        if (retryCount < this.maxRetries) {
          console.log(`🔄 リトライ ${retryCount}/${this.maxRetries}...`);
          await this.sleep(5000);
        }
      }
    }
    
    throw new Error(`${category.name}: ${this.maxRetries}回の試行後も失敗`);
  }

  async run() {
    try {
      await this.init();
      
      let totalCampaigns = 0;
      const startTime = Date.now();
      
      // 未処理カテゴリから開始
      for (let i = this.currentCategoryIndex; i < this.allCategories.length; i++) {
        const category = this.allCategories[i];
        
        console.log(`\n📊 進捗: ${i}/${this.allCategories.length} (${Math.round(i / this.allCategories.length * 100)}%)`);
        
        try {
          const count = await this.scrapeCategory(category);
          totalCampaigns += count;
          
          // 進捗更新
          this.currentCategoryIndex = i + 1;
          await this.saveProgress();
          
          // カテゴリ間で休憩
          if (i < this.allCategories.length - 1) {
            console.log('⏸️ 10秒休憩...');
            await this.sleep(10000);
          }
          
        } catch (error) {
          console.error(`❌ カテゴリ失敗: ${category.name}`);
          console.error(error);
          
          // エラーでも次のカテゴリへ
          this.currentCategoryIndex = i + 1;
          await this.saveProgress();
        }
      }
      
      const elapsedMinutes = Math.round((Date.now() - startTime) / 1000 / 60);
      
      console.log('\n' + '='.repeat(60));
      console.log('🎉 全カテゴリ処理完了！');
      console.log(`📊 総取得案件数: ${totalCampaigns}件`);
      console.log(`⏱️ 処理時間: ${elapsedMinutes}分`);
      console.log('💡 次のステップ: 個別JSONファイルを統合してください');
      
    } catch (error) {
      console.error('❌ 致命的エラー:', error);
      throw error;
    }
  }
}

// 使用方法
console.log('📌 安定版スクレイピングシステム');
console.log('特徴:');
console.log('  ✅ 1カテゴリずつ処理（ブラウザ再起動）');
console.log('  ✅ 3秒間隔の余裕を持ったアクセス');
console.log('  ✅ カテゴリごとに個別JSON保存');
console.log('  ✅ エラー時も次カテゴリへ継続');
console.log('  ✅ いつでも中断・再開可能');
console.log('\n実行コマンド:');
console.log('  node stable-category-by-category-scraper.js');
console.log('\n');

// 直接実行の場合
if (require.main === module) {
  (async () => {
    const scraper = new StableCategoryByCategoryScraper();
    await scraper.run();
  })();
}