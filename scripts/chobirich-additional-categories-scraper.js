const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class ChobirichAdditionalCategoriesScraper {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.iosUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
    
    // 新しく発見された追加カテゴリURL
    this.additionalCategories = [
      { name: 'ショッピング105', url: 'https://www.chobirich.com/shopping/shop/105', type: 'shopping', id: 'shop_105' },
      { name: 'ショッピング112', url: 'https://www.chobirich.com/shopping/shop/112', type: 'shopping', id: 'shop_112' },
      { name: 'ショッピング113', url: 'https://www.chobirich.com/shopping/shop/113', type: 'shopping', id: 'shop_113' },
      { name: 'サービス102', url: 'https://www.chobirich.com/earn/apply/102', type: 'service', id: 'earn_102' },
      { name: 'サービス105', url: 'https://www.chobirich.com/earn/apply/105', type: 'service', id: 'earn_105' },
      { name: 'サービス112', url: 'https://www.chobirich.com/earn/apply/112', type: 'service', id: 'earn_112' },
      { name: 'ゲーム', url: 'https://www.chobirich.com/game/', type: 'game', id: 'game' },
      { name: 'サービス総合', url: 'https://www.chobirich.com/earn/', type: 'service', id: 'earn_top' }
    ];
    
    this.allCampaigns = [];
    this.categoryStats = [];
    this.browser = null;
    this.outputFile = `chobirich_additional_categories_${Date.now()}.json`;
    this.progressFile = 'chobirich_additional_categories_progress.json';
  }

  async initBrowser() {
    console.log('🚀 ブラウザ初期化中...');
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ],
      timeout: 60000
    });
    console.log('✅ ブラウザ初期化完了');
  }

  async loadProgress() {
    try {
      const data = await fs.readFile(this.progressFile, 'utf8');
      const progress = JSON.parse(data);
      this.allCampaigns = progress.campaigns || [];
      this.categoryStats = progress.categoryStats || [];
      console.log(`📋 進捗読み込み: ${this.allCampaigns.length}件`);
      return progress.completedCategories || [];
    } catch {
      console.log('📋 新規実行開始');
      return [];
    }
  }

  async saveProgress(completedCategories = []) {
    const progress = {
      timestamp: new Date().toISOString(),
      completedCategories: completedCategories,
      totalCampaigns: this.allCampaigns.length,
      campaigns: this.allCampaigns,
      categoryStats: this.categoryStats
    };
    
    await fs.writeFile(this.progressFile, JSON.stringify(progress, null, 2));
    console.log(`💾 進捗保存: ${this.allCampaigns.length}件`);
  }

  async detectCategoryName(url, page) {
    try {
      const categoryInfo = await page.evaluate(() => {
        const title = document.title;
        const breadcrumbs = Array.from(document.querySelectorAll('.breadcrumb a, .bread a, nav a')).map(a => a.innerText?.trim()).filter(Boolean);
        const headers = Array.from(document.querySelectorAll('h1, h2, .title, .category-title, .page-title')).map(h => h.innerText?.trim()).filter(Boolean);
        
        return {
          title,
          breadcrumbs,
          headers
        };
      });
      
      let detectedName = '';
      if (categoryInfo.headers.length > 0) {
        detectedName = categoryInfo.headers[0];
      } else if (categoryInfo.breadcrumbs.length > 0) {
        detectedName = categoryInfo.breadcrumbs[categoryInfo.breadcrumbs.length - 1];
      } else if (categoryInfo.title) {
        // タイトルからカテゴリ名を抽出
        const titleMatch = categoryInfo.title.match(/(.+?)(?:で貯める|\/|｜)/);
        detectedName = titleMatch ? titleMatch[1] : categoryInfo.title;
      }
      
      return detectedName || '不明';
    } catch {
      return '不明';
    }
  }

  async scrapeCategory(category) {
    console.log(`\n📂 カテゴリ処理開始: ${category.name}`);
    console.log(`🔗 URL: ${category.url}`);
    
    const campaigns = [];
    let pageNum = 1;
    let hasMorePages = true;
    let detectedCategoryName = category.name;
    
    const maxPages = 20; // 各カテゴリ最大20ページまで
    while (hasMorePages && pageNum <= maxPages) {
      const page = await this.browser.newPage();
      
      try {
        await page.setUserAgent(this.iosUserAgent);
        await page.setViewport({ width: 390, height: 844 });
        
        const url = pageNum === 1 ? category.url : `${category.url}?page=${pageNum}`;
        console.log(`  📄 ${category.name} ページ ${pageNum} 処理中...`);
        
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 最初のページでカテゴリ名を検出
        if (pageNum === 1) {
          detectedCategoryName = await this.detectCategoryName(url, page);
          console.log(`  🏷️ 検出されたカテゴリ名: ${detectedCategoryName}`);
        }
        
        const pageData = await page.evaluate(() => {
          const links = document.querySelectorAll('a[href*="/ad_details/"]');
          const campaigns = [];
          
          links.forEach(link => {
            const href = link.href;
            const id = href.match(/\/ad_details\/(\d+)/)?.[1];
            if (!id) return;
            
            const title = link.innerText?.trim() || '';
            const parent = link.closest('li, .item, .campaign, .campaign-item, div[class*="item"]');
            const parentText = parent ? parent.innerText : '';
            
            // キャッシュバック情報の抽出
            const cashbackPatterns = [
              /(\d+(?:,\d+)?)\s*(?:ポイント|pt)/i,
              /(\d+(?:,\d+)?)\s*円/i,
              /(\d+(?:\.\d+)?)\s*%/i,
              /最大\s*(\d+(?:,\d+)?)\s*(?:ポイント|pt|円)/i
            ];
            
            let cashback = '';
            for (const pattern of cashbackPatterns) {
              const match = parentText.match(pattern);
              if (match) {
                cashback = match[0];
                break;
              }
            }
            
            // 条件情報の抽出
            let method = '';
            const methodPatterns = [
              /(?:獲得条件|条件|成果条件)[：:]?\s*([^\n]+)/,
              /(?:新規.*?登録)([^\n]+)/,
              /(?:初回.*?)([^\n]+)/,
              /(?:申込|申し込み)([^\n]+)/,
              /(?:利用)([^\n]+)/
            ];
            
            for (const pattern of methodPatterns) {
              const match = parentText.match(pattern);
              if (match && match[1]) {
                method = match[1].trim().substring(0, 200);
                break;
              }
            }
            
            campaigns.push({
              id: id,
              name: title,
              url: href,
              cashback: cashback || '不明',
              method: method || '不明',
              parentText: parentText.substring(0, 400)
            });
          });
          
          // 次ページの存在確認
          const currentPage = parseInt(window.location.search.match(/page=(\d+)/)?.[1] || '1');
          const nextPageSelectors = [
            `a[href*="page=${currentPage + 1}"]`,
            'a[href*="次"]',
            'a[href*="next"]',
            '.next a',
            '.pagination a'
          ];
          
          let hasNext = false;
          for (const selector of nextPageSelectors) {
            if (document.querySelector(selector)) {
              hasNext = true;
              break;
            }
          }
          
          return { campaigns, hasNext };
        });
        
        if (pageData.campaigns.length === 0) {
          console.log(`    → 案件なし - 終了`);
          hasMorePages = false;
          break;
        }
        
        // カテゴリ情報を追加して保存
        pageData.campaigns.forEach(campaign => {
          campaigns.push({
            ...campaign,
            category: detectedCategoryName,
            categoryType: category.type,
            categoryId: category.id,
            sourceUrl: category.url,
            timestamp: new Date().toISOString()
          });
        });
        
        console.log(`    → ${pageData.campaigns.length}件取得`);
        hasMorePages = pageData.hasNext;
        pageNum++;
        
      } catch (error) {
        console.log(`    ❌ ページ ${pageNum} エラー: ${error.message}`);
        hasMorePages = false;
      } finally {
        await page.close();
      }
    }
    
    console.log(`✅ ${detectedCategoryName} 完了: 合計 ${campaigns.length}件`);
    
    // カテゴリ統計を記録
    this.categoryStats.push({
      originalName: category.name,
      detectedName: detectedCategoryName,
      type: category.type,
      id: category.id,
      url: category.url,
      campaignCount: campaigns.length,
      pagesScraped: pageNum - 1
    });
    
    return campaigns;
  }

  async run() {
    console.log('🌟 ちょびリッチ追加カテゴリスクレイピング開始\n');
    
    try {
      await this.initBrowser();
      const completedCategories = await this.loadProgress();
      
      // 未完了カテゴリのみ処理
      const remainingCategories = this.additionalCategories.filter(cat => 
        !completedCategories.includes(cat.id)
      );
      
      console.log(`📋 処理予定カテゴリ: ${remainingCategories.length}件`);
      remainingCategories.forEach(cat => {
        console.log(`  - ${cat.name} (${cat.type})`);
      });
      console.log('');
      
      // 各カテゴリを順次処理
      for (const category of remainingCategories) {
        console.log(`\n🔄 残り ${remainingCategories.length - remainingCategories.indexOf(category)} カテゴリ`);
        
        const campaigns = await this.scrapeCategory(category);
        this.allCampaigns = this.allCampaigns.concat(campaigns);
        
        // 進捗保存
        completedCategories.push(category.id);
        await this.saveProgress(completedCategories);
        
        // 中間結果表示
        console.log(`📊 累計: ${this.allCampaigns.length}件 (完了カテゴリ: ${completedCategories.length}/${this.additionalCategories.length})`);
        
        // 少し休憩
        if (remainingCategories.indexOf(category) < remainingCategories.length - 1) {
          console.log('⏸️ 3秒休憩...\n');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      
      // 最終結果の保存
      await this.saveFinalResults();
      
      console.log('\n🎉 追加カテゴリスクレイピング完了！');
      this.displaySummary();
      
    } catch (error) {
      console.error('💥 エラー:', error);
      await this.saveProgress();
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  async saveFinalResults() {
    // 重複除去（IDベース）
    const uniqueCampaigns = [];
    const seenIds = new Set();
    
    this.allCampaigns.forEach(campaign => {
      const key = `${campaign.id}_${campaign.categoryId}`;
      if (!seenIds.has(key)) {
        seenIds.add(key);
        uniqueCampaigns.push(campaign);
      }
    });
    
    const finalData = {
      scrape_date: new Date().toISOString(),
      strategy: 'additional_categories_scraper',
      summary: {
        total_campaigns: uniqueCampaigns.length,
        raw_campaigns: this.allCampaigns.length,
        duplicates_removed: this.allCampaigns.length - uniqueCampaigns.length,
        categories_processed: this.categoryStats.length
      },
      category_stats: this.categoryStats,
      campaigns: uniqueCampaigns
    };
    
    await fs.writeFile(this.outputFile, JSON.stringify(finalData, null, 2));
    console.log(`💾 最終結果保存: ${this.outputFile}`);
  }

  displaySummary() {
    console.log(`\n📊 === 最終統計 ===`);
    console.log(`総案件数: ${this.allCampaigns.length}件`);
    console.log(`カテゴリ数: ${this.categoryStats.length}件`);
    console.log(`出力ファイル: ${this.outputFile}`);
    
    console.log(`\n📑 カテゴリ別詳細:`);
    this.categoryStats.forEach(stat => {
      console.log(`  ${stat.detectedName}: ${stat.campaignCount}件 (${stat.pagesScraped}ページ)`);
    });
    
    // カテゴリタイプ別集計
    const typeStats = {};
    this.categoryStats.forEach(stat => {
      if (!typeStats[stat.type]) {
        typeStats[stat.type] = { count: 0, campaigns: 0 };
      }
      typeStats[stat.type].count++;
      typeStats[stat.type].campaigns += stat.campaignCount;
    });
    
    console.log(`\n📈 タイプ別集計:`);
    Object.entries(typeStats).forEach(([type, stats]) => {
      console.log(`  ${type}: ${stats.campaigns}件 (${stats.count}カテゴリ)`);
    });
  }
}

// 実行
if (require.main === module) {
  const scraper = new ChobirichAdditionalCategoriesScraper();
  scraper.run().catch(console.error);
}

module.exports = ChobirichAdditionalCategoriesScraper;