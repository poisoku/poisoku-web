const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class ChobirichAllCategoriesScraper {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.iosUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
    
    // 全カテゴリのURL定義
    this.categories = [
      { name: 'スマートフォンアプリ', url: 'https://www.chobirich.com/smartphone?sort=point', type: 'app' },
      { name: 'ショッピング', url: 'https://www.chobirich.com/shopping/shop/101', type: 'shopping' },
      { name: 'サービス', url: 'https://www.chobirich.com/service/serv/101', type: 'service' },
      { name: 'クレジットカード', url: 'https://www.chobirich.com/creditcard/card/101', type: 'creditcard' },
      { name: '旅行', url: 'https://www.chobirich.com/travel/tra/101', type: 'travel' },
      { name: 'マネー', url: 'https://www.chobirich.com/money/mon/101', type: 'money' },
      { name: 'エンターテイメント', url: 'https://www.chobirich.com/entertainment/ent/101', type: 'entertainment' },
    ];
    
    this.allCampaigns = [];
    this.categoryStats = [];
    this.browser = null;
    this.outputFile = `chobirich_all_categories_${Date.now()}.json`;
    this.progressFile = 'chobirich_all_categories_progress.json';
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

  async scrapeCategory(category) {
    console.log(`\n📂 カテゴリ処理開始: ${category.name}`);
    console.log(`🔗 URL: ${category.url}`);
    
    const campaigns = [];
    let pageNum = 1;
    let hasMorePages = true;
    
    while (hasMorePages && pageNum <= 50) {
      const page = await this.browser.newPage();
      
      try {
        await page.setUserAgent(this.iosUserAgent);
        await page.setViewport({ width: 390, height: 844 });
        
        const url = pageNum === 1 ? category.url : `${category.url}?page=${pageNum}`;
        console.log(`  📄 ${category.name} ページ ${pageNum} 処理中...`);
        
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const pageData = await page.evaluate(() => {
          // 案件リンクを取得
          const links = document.querySelectorAll('a[href*="/ad_details/"]');
          const campaigns = [];
          
          links.forEach(link => {
            const href = link.href;
            const id = href.match(/\/ad_details\/(\d+)/)?.[1];
            if (!id) return;
            
            const title = link.innerText?.trim() || '';
            const parent = link.closest('li, .item, .campaign, div');
            const parentText = parent ? parent.innerText : '';
            
            // キャッシュバック情報の抽出
            const cashbackMatch = parentText.match(/(\d+(?:,\d+)?)\s*(?:ポイント|pt|円|%)/i);
            const cashback = cashbackMatch ? cashbackMatch[0] : '';
            
            // 条件情報の抽出
            let method = '';
            const methodPatterns = [
              /(?:獲得条件|条件|成果条件)[：:]?\s*([^\n]+)/,
              /(?:新規.*?)([^\n]+)/,
              /(?:初回.*?)([^\n]+)/
            ];
            
            for (const pattern of methodPatterns) {
              const match = parentText.match(pattern);
              if (match && match[1]) {
                method = match[1].trim().substring(0, 150);
                break;
              }
            }
            
            campaigns.push({
              id: id,
              name: title,
              url: href,
              cashback: cashback || '不明',
              method: method || '不明',
              parentText: parentText.substring(0, 300)
            });
          });
          
          // 次ページの存在確認
          const currentPage = parseInt(window.location.search.match(/page=(\\d+)/)?.[1] || '1');
          const nextPageLink = document.querySelector(`a[href*="page=${currentPage + 1}"]`);
          const hasNext = !!nextPageLink;
          
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
            category: category.name,
            categoryType: category.type,
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
    
    console.log(`✅ ${category.name} 完了: 合計 ${campaigns.length}件`);
    
    // カテゴリ統計を記録
    this.categoryStats.push({
      name: category.name,
      type: category.type,
      url: category.url,
      campaignCount: campaigns.length,
      pagesScraped: pageNum - 1
    });
    
    return campaigns;
  }

  async testCategoryUrls() {
    console.log('🔍 カテゴリURL有効性テスト開始\n');
    
    const validCategories = [];
    const page = await this.browser.newPage();
    await page.setUserAgent(this.iosUserAgent);
    
    for (const category of this.categories) {
      try {
        console.log(`テスト中: ${category.name} (${category.url})`);
        
        const response = await page.goto(category.url, {
          waitUntil: 'domcontentloaded',
          timeout: 15000
        });
        
        if (response.status() === 200) {
          // ページ内容を確認
          const hasContent = await page.evaluate(() => {
            const links = document.querySelectorAll('a[href*="/ad_details/"]');
            return links.length > 0;
          });
          
          if (hasContent) {
            console.log(`  ✅ 有効 - 案件あり`);
            validCategories.push(category);
          } else {
            console.log(`  ⚠️ 応答あり - 案件なし`);
          }
        } else {
          console.log(`  ❌ ステータス: ${response.status()}`);
        }
        
      } catch (error) {
        console.log(`  ❌ エラー: ${error.message}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    await page.close();
    
    console.log(`\n📊 テスト結果: ${validCategories.length}/${this.categories.length} カテゴリが有効\n`);
    return validCategories;
  }

  async run() {
    console.log('🌟 ちょびリッチ全カテゴリスクレイピング開始\n');
    
    try {
      await this.initBrowser();
      const completedCategories = await this.loadProgress();
      
      // カテゴリURL有効性テスト
      const validCategories = await this.testCategoryUrls();
      
      if (validCategories.length === 0) {
        throw new Error('有効なカテゴリURLが見つかりません');
      }
      
      // 未完了カテゴリのみ処理
      const remainingCategories = validCategories.filter(cat => 
        !completedCategories.includes(cat.name)
      );
      
      console.log(`📋 処理予定カテゴリ: ${remainingCategories.length}件`);
      remainingCategories.forEach(cat => {
        console.log(`  - ${cat.name} (${cat.type})`);
      });
      console.log('');
      
      // 各カテゴリを順次処理
      for (const category of remainingCategories) {
        const campaigns = await this.scrapeCategory(category);
        this.allCampaigns = this.allCampaigns.concat(campaigns);
        
        // 進捗保存
        completedCategories.push(category.name);
        await this.saveProgress(completedCategories);
        
        // 少し休憩
        if (remainingCategories.indexOf(category) < remainingCategories.length - 1) {
          console.log('⏸️ 5秒休憩...\n');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
      
      // 最終結果の保存
      await this.saveFinalResults();
      
      console.log('\n🎉 全カテゴリスクレイピング完了！');
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
    // 重複除去
    const uniqueCampaigns = [];
    const seenIds = new Set();
    
    this.allCampaigns.forEach(campaign => {
      if (!seenIds.has(campaign.id)) {
        seenIds.add(campaign.id);
        uniqueCampaigns.push(campaign);
      }
    });
    
    const finalData = {
      scrape_date: new Date().toISOString(),
      strategy: 'all_categories_scraper',
      summary: {
        total_campaigns: uniqueCampaigns.length,
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
      console.log(`  ${stat.name}: ${stat.campaignCount}件 (${stat.pagesScraped}ページ)`);
    });
  }
}

// 実行
if (require.main === module) {
  const scraper = new ChobirichAllCategoriesScraper();
  scraper.run().catch(console.error);
}

module.exports = ChobirichAllCategoriesScraper;