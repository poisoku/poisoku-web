const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class ChobirichCompleteCategoriesScraper {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.iosUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
    
    // 正しいカテゴリURL定義
    this.categories = [
      // スマートフォンアプリ（既に取得済み）
      { name: 'スマートフォンアプリ', url: 'https://www.chobirich.com/smartphone?sort=point', type: 'app', id: 'smartphone' },
      
      // ショッピングカテゴリ
      { name: 'ショッピング総合', url: 'https://www.chobirich.com/shopping/shop/101', type: 'shopping', id: 'shop_101' },
      { name: 'ショッピング102', url: 'https://www.chobirich.com/shopping/shop/102', type: 'shopping', id: 'shop_102' },
      { name: 'ショッピング103', url: 'https://www.chobirich.com/shopping/shop/103', type: 'shopping', id: 'shop_103' },
      { name: 'ショッピング104', url: 'https://www.chobirich.com/shopping/shop/104', type: 'shopping', id: 'shop_104' },
      { name: 'ショッピング105', url: 'https://www.chobirich.com/shopping/shop/105', type: 'shopping', id: 'shop_105' },
      { name: 'ショッピング106', url: 'https://www.chobirich.com/shopping/shop/106', type: 'shopping', id: 'shop_106' },
      { name: 'ショッピング107', url: 'https://www.chobirich.com/shopping/shop/107', type: 'shopping', id: 'shop_107' },
      { name: 'ショッピング108', url: 'https://www.chobirich.com/shopping/shop/108', type: 'shopping', id: 'shop_108' },
      { name: 'ショッピング109', url: 'https://www.chobirich.com/shopping/shop/109', type: 'shopping', id: 'shop_109' },
      { name: 'ショッピング110', url: 'https://www.chobirich.com/shopping/shop/110', type: 'shopping', id: 'shop_110' },
      { name: 'ショッピング111', url: 'https://www.chobirich.com/shopping/shop/111', type: 'shopping', id: 'shop_111' },
      
      // サービス・クレジットカード・マネーカテゴリ
      { name: 'サービス101', url: 'https://www.chobirich.com/earn/apply/101', type: 'service', id: 'earn_101' },
      { name: 'サービス103', url: 'https://www.chobirich.com/earn/apply/103', type: 'service', id: 'earn_103' },
      { name: 'サービス104', url: 'https://www.chobirich.com/earn/apply/104', type: 'service', id: 'earn_104' },
      { name: 'サービス106', url: 'https://www.chobirich.com/earn/apply/106', type: 'service', id: 'earn_106' },
      { name: 'サービス107', url: 'https://www.chobirich.com/earn/apply/107', type: 'service', id: 'earn_107' },
      { name: 'サービス108', url: 'https://www.chobirich.com/earn/apply/108', type: 'service', id: 'earn_108' },
      { name: 'サービス109', url: 'https://www.chobirich.com/earn/apply/109', type: 'service', id: 'earn_109' },
      { name: 'サービス110', url: 'https://www.chobirich.com/earn/apply/110', type: 'service', id: 'earn_110' },
      { name: 'サービス111', url: 'https://www.chobirich.com/earn/apply/111', type: 'service', id: 'earn_111' }
    ];
    
    this.allCampaigns = [];
    this.categoryStats = [];
    this.browser = null;
    this.outputFile = `chobirich_complete_categories_${Date.now()}.json`;
    this.progressFile = 'chobirich_complete_categories_progress.json';
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
      // ページタイトルやコンテンツから実際のカテゴリ名を検出
      const categoryInfo = await page.evaluate(() => {
        // ページタイトル
        const title = document.title;
        
        // パンくずリスト
        const breadcrumbs = Array.from(document.querySelectorAll('.breadcrumb a, .bread a, nav a')).map(a => a.innerText?.trim()).filter(Boolean);
        
        // ヘッダータイトル
        const headers = Array.from(document.querySelectorAll('h1, h2, .title, .category-title, .page-title')).map(h => h.innerText?.trim()).filter(Boolean);
        
        // カテゴリヒント
        const categoryHints = Array.from(document.querySelectorAll('[class*="category"], [class*="genre"]')).map(el => el.innerText?.trim()).filter(Boolean);
        
        return {
          title,
          breadcrumbs,
          headers,
          categoryHints
        };
      });
      
      // カテゴリ名を推測
      let detectedName = '';
      if (categoryInfo.headers.length > 0) {
        detectedName = categoryInfo.headers[0];
      } else if (categoryInfo.breadcrumbs.length > 0) {
        detectedName = categoryInfo.breadcrumbs[categoryInfo.breadcrumbs.length - 1];
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
    
    // アプリカテゴリは30ページまで、他は20ページまでに制限
    const maxPages = category.type === 'app' ? 30 : 20;
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
          // 案件リンクを取得
          const links = document.querySelectorAll('a[href*="/ad_details/"]');
          const campaigns = [];
          
          links.forEach(link => {
            const href = link.href;
            const id = href.match(/\/ad_details\/(\d+)/)?.[1];
            if (!id) return;
            
            const title = link.innerText?.trim() || '';
            const parent = link.closest('li, .item, .campaign, .campaign-item, div[class*="item"]');
            const parentText = parent ? parent.innerText : '';
            
            // キャッシュバック情報の抽出（改良版）
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
            
            // 条件情報の抽出（改良版）
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
          
          // 次ページの存在確認（改良版）
          const currentPage = parseInt(window.location.search.match(/page=(\\d+)/)?.[1] || '1');
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

  async testCategoryUrls() {
    console.log('🔍 カテゴリURL有効性テスト開始\n');
    
    const validCategories = [];
    const page = await this.browser.newPage();
    await page.setUserAgent(this.iosUserAgent);
    
    for (const category of this.categories) {
      try {
        console.log(`テスト中: ${category.name}`);
        console.log(`  URL: ${category.url}`);
        
        const response = await page.goto(category.url, {
          waitUntil: 'domcontentloaded',
          timeout: 20000
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
    console.log('🌟 ちょびリッチ完全カテゴリスクレイピング開始\n');
    
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
        console.log(`📊 累計: ${this.allCampaigns.length}件 (完了カテゴリ: ${completedCategories.length}/${this.categories.length})`);
        
        // 少し休憩
        if (remainingCategories.indexOf(category) < remainingCategories.length - 1) {
          console.log('⏸️ 3秒休憩...\n');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      
      // 最終結果の保存
      await this.saveFinalResults();
      
      console.log('\n🎉 完全カテゴリスクレイピング完了！');
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
      strategy: 'complete_categories_scraper',
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
    console.log(`重複除去後: ${this.allCampaigns.length}件`);
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
  const scraper = new ChobirichCompleteCategoriesScraper();
  scraper.run().catch(console.error);
}

module.exports = ChobirichCompleteCategoriesScraper;