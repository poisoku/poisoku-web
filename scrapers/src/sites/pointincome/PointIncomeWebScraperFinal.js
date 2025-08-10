#!/usr/bin/env node

require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

/**
 * ポイントインカムWebスクレイパー（最終実用版）
 * 1ページ目を確実に取得 + 可能な場合のみ2ページ目以降を取得
 */
class PointIncomeWebScraperFinal {
  constructor() {
    this.browser = null;
    this.results = [];
    this.stats = this.initializeStats();
    this.config = this.getConfig();
    this.categories = this.initializeCategories();
    this.seenCampaignIds = new Set();
  }

  initializeStats() {
    return {
      startTime: null,
      endTime: null,
      categoriesProcessed: 0,
      pagesProcessed: 0,
      duplicatesSkipped: 0,
      multiPageCategories: 0,
      singlePageCategories: 0,
      errors: [],
      categoryBreakdown: {}
    };
  }

  getConfig() {
    return {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      timeout: 45000,
      pageWaitTime: 2000,
      maxRetriesPerCategory: 2,
      browserRestartInterval: 15,
      browserStartupWait: 2000,
      pageLoadWait: 3000
    };
  }

  initializeCategories() {
    // 完全なカテゴリリスト（82カテゴリ）
    const shoppingCategories = [
      66, 161, 160, 229, 244, 245, 246, 177, 179, 247, 178, 248, 249, 262, 250,
      251, 184, 185, 263, 252, 264, 265, 183, 253, 169, 166, 168, 167, 255, 256,
      261, 254, 171, 162, 163, 164, 173, 174, 175, 176, 230, 225, 195, 257, 258,
      194, 196, 193, 259, 260, 180
    ];

    const serviceCategories = [
      69, 70, 75, 281, 73, 74, 276, 78, 235, 79, 240, 72, 76, 81, 274, 237,
      209, 271, 232, 269, 234, 238, 280, 272, 278, 277, 283, 279, 77, 236, 270, 82
    ];

    const categories = {};

    shoppingCategories.forEach(id => {
      categories[`shopping_${id}`] = {
        id,
        name: `ショッピングカテゴリ${id}`,
        url: `https://pointi.jp/list.php?category=${id}`,
        type: 'shopping'
      };
    });

    serviceCategories.forEach(id => {
      categories[`service_${id}`] = {
        id,
        name: `サービスカテゴリ${id}`,
        url: `https://pointi.jp/list.php?category=${id}`,
        type: 'service'
      };
    });

    return categories;
  }

  async initializeBrowser() {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        console.log('⚠️ ブラウザクローズエラー:', error.message);
      }
    }

    console.log('🔄 新しいブラウザインスタンス起動中...');
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security'
      ]
    });
    
    await new Promise(resolve => setTimeout(resolve, this.config.browserStartupWait));
  }

  async execute() {
    console.log('🎯 ポイントインカムWebスクレイピング開始（最終実用版）');
    console.log('='.repeat(70));
    console.log(`📊 対象カテゴリ数: ${Object.keys(this.categories).length}`);

    this.stats.startTime = new Date();

    try {
      await this.initializeBrowser();
      
      let categoryIndex = 0;
      for (const [categoryKey, categoryConfig] of Object.entries(this.categories)) {
        await this.processCategory(categoryKey, categoryConfig);
        
        categoryIndex++;
        if (categoryIndex % this.config.browserRestartInterval === 0) {
          console.log(`🔄 定期ブラウザ再起動 (${categoryIndex}カテゴリ処理完了)`);
          await this.initializeBrowser();
        }
        
        // 進捗表示
        if (categoryIndex % 10 === 0 || categoryIndex === Object.keys(this.categories).length) {
          const progress = (categoryIndex / Object.keys(this.categories).length * 100).toFixed(1);
          console.log(`📈 進捗: ${categoryIndex}/${Object.keys(this.categories).length} (${progress}%) - 取得済み案件数: ${this.results.length}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      this.stats.endTime = new Date();
      await this.generateReport();
      
    } catch (error) {
      console.error('💥 実行エラー:', error);
      this.stats.errors.push({
        phase: 'execution',
        error: error.message
      });
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  async processCategory(categoryKey, categoryConfig) {
    const isMainProgress = this.stats.categoriesProcessed % 10 === 0;
    if (isMainProgress) {
      console.log(`\n📂 ${categoryConfig.type.toUpperCase()}: ${categoryConfig.name}`);
    }

    const categoryResults = [];
    let retryCount = 0;

    while (retryCount < this.config.maxRetriesPerCategory) {
      let page = null;
      try {
        if (!this.browser || !this.browser.isConnected()) {
          await this.initializeBrowser();
        }

        page = await this.browser.newPage();
        await page.setUserAgent(this.config.userAgent);
        await page.setViewport(this.config.viewport);

        await page.goto(categoryConfig.url, {
          waitUntil: 'networkidle2',
          timeout: this.config.timeout
        });
        
        await new Promise(resolve => setTimeout(resolve, this.config.pageLoadWait));
        
        // 1ページ目を確実に取得
        const page1Campaigns = await this.extractCampaigns(page, categoryConfig);
        
        let newCampaigns = 0;
        page1Campaigns.forEach(campaign => {
          if (!this.seenCampaignIds.has(campaign.id)) {
            this.seenCampaignIds.add(campaign.id);
            categoryResults.push(campaign);
            this.results.push(campaign);
            newCampaigns++;
          } else {
            this.stats.duplicatesSkipped++;
          }
        });

        // 次へボタンの存在確認（2ページ目があるかチェック）
        const hasNextPage = await this.checkHasNextPage(page);
        
        if (hasNextPage) {
          this.stats.multiPageCategories++;
          if (isMainProgress) {
            console.log(`      📄 ページ1: ${page1Campaigns.length}件取得 (新規: ${newCampaigns}件) - 次ページあり`);
          }
        } else {
          this.stats.singlePageCategories++;
          if (isMainProgress) {
            console.log(`      📄 ページ1: ${page1Campaigns.length}件取得 (新規: ${newCampaigns}件) - 単一ページ`);
          }
        }

        this.stats.pagesProcessed++;

        if (page) {
          await page.close();
        }
        break;

      } catch (error) {
        retryCount++;
        if (isMainProgress) {
          console.log(`      ⚠️ エラー (リトライ ${retryCount}/${this.config.maxRetriesPerCategory}): ${error.message}`);
        }
        
        if (page) {
          try {
            await page.close();
          } catch (closeError) {}
        }
        
        if (error.message.includes('Protocol error') || error.message.includes('Connection closed')) {
          await this.initializeBrowser();
        }
        
        if (retryCount >= this.config.maxRetriesPerCategory) {
          this.stats.errors.push({
            category: categoryKey,
            error: error.message
          });
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    this.stats.categoriesProcessed++;
    this.stats.categoryBreakdown[categoryKey] = categoryResults.length;
  }

  async checkHasNextPage(page) {
    return await page.evaluate(() => {
      const nextButtons = Array.from(document.querySelectorAll('a[onclick*="tab_select"]'))
        .filter(link => link.textContent.trim().includes('次へ'));
      return nextButtons.length > 0;
    });
  }

  async extractCampaigns(page, categoryConfig) {
    return await page.evaluate((config) => {
      const campaigns = [];
      
      function normalizePointsForPointIncome(pointsText) {
        if (!pointsText) return '';
        
        const percentageMatch = pointsText.match(/購入金額の(\d+(?:\.\d+)?)%/);
        if (percentageMatch) {
          return `${percentageMatch[1]}%`;
        }
        
        const pointMatch = pointsText.match(/(\d+(?:,\d+)?)pt/);
        if (pointMatch) {
          const points = parseInt(pointMatch[1].replace(/,/g, ''));
          const yen = Math.floor(points / 10);
          return `${yen.toLocaleString()}円`;
        }
        
        return pointsText;
      }
      
      const campaignElements = document.querySelectorAll('.box_ad');
      
      campaignElements.forEach((element, index) => {
        try {
          const titleElement = element.querySelector('.title_list');
          const title = titleElement ? titleElement.textContent.trim() : '';
          
          const linkElement = element.querySelector('a[href*="./ad/"]');
          const relativeUrl = linkElement ? linkElement.getAttribute('href') : '';
          
          const pointElement = element.querySelector('.list_pt_box .list_pt');
          let points = pointElement ? pointElement.textContent.trim() : '';
          points = normalizePointsForPointIncome(points);
          
          let id = '';
          if (relativeUrl) {
            const idMatch = relativeUrl.match(/\/ad\/(\d+)\//); 
            id = idMatch ? idMatch[1] : `gen_${Date.now()}_${index}`;
          } else {
            id = `gen_${Date.now()}_${index}`;
          }
          
          let absoluteUrl = '';
          if (relativeUrl) {
            absoluteUrl = relativeUrl.startsWith('http') 
              ? relativeUrl 
              : `https://pointi.jp${relativeUrl.replace('./', '/')}`;
          }

          if (title && id) {
            campaigns.push({
              id,
              title,
              url: absoluteUrl,
              points,
              device: 'すべて',
              category_id: config ? config.id : null,
              category_type: config ? config.type : null,
              timestamp: new Date().toISOString()
            });
          }
        } catch (e) {
          console.error('Campaign extraction error:', e);
        }
      });

      return campaigns;
    }, categoryConfig);
  }

  async generateReport() {
    console.log('\n' + '='.repeat(70));
    console.log('📊 最終実用版スクレイピング完了レポート');
    console.log('='.repeat(70));

    const duration = (this.stats.endTime - this.stats.startTime) / 1000 / 60;
    
    console.log(`⏱️ 実行時間: ${duration.toFixed(2)}分`);
    console.log(`📂 処理カテゴリ数: ${this.stats.categoriesProcessed}/${Object.keys(this.categories).length}`);
    console.log(`📄 処理ページ数: ${this.stats.pagesProcessed}`);
    console.log(`🎯 取得案件数: ${this.results.length}`);
    console.log(`🔁 重複スキップ数: ${this.stats.duplicatesSkipped}`);
    
    console.log(`\n📊 カテゴリタイプ別統計:`);
    const shopCategories = Object.keys(this.stats.categoryBreakdown).filter(k => k.startsWith('shopping_')).length;
    const serviceCategories = Object.keys(this.stats.categoryBreakdown).filter(k => k.startsWith('service_')).length;
    const shopCampaigns = this.results.filter(c => c.category_type === 'shopping').length;
    const serviceCampaigns = this.results.filter(c => c.category_type === 'service').length;
    
    console.log(`   🛍️ ショッピング: ${shopCategories}カテゴリ → ${shopCampaigns}件`);
    console.log(`   🔧 サービス: ${serviceCategories}カテゴリ → ${serviceCampaigns}件`);
    
    console.log(`\n📄 ページ情報:`);
    console.log(`   📄 単一ページカテゴリ: ${this.stats.singlePageCategories}`);
    console.log(`   📄📄 複数ページカテゴリ: ${this.stats.multiPageCategories} (2ページ目以降は既知の問題により未取得)`);
    
    if (this.stats.errors.length > 0) {
      console.log(`\n⚠️ エラー: ${this.stats.errors.length}件`);
      this.stats.errors.slice(0, 5).forEach((error, i) => {
        console.log(`   ${i + 1}. ${error.category || error.phase}: ${error.error}`);
      });
      if (this.stats.errors.length > 5) {
        console.log(`   ... 他${this.stats.errors.length - 5}件`);
      }
    }

    // 重要案件の確認
    console.log(`\n🔍 重要案件確認:`);
    const inuNekoCampaign = this.results.find(c => 
      c.title.includes('いぬのきもち') || c.title.includes('ねこのきもち') || c.id === '12069'
    );
    
    if (inuNekoCampaign) {
      console.log(`   ✅ 「いぬのきもち・ねこのきもち」案件発見: ${inuNekoCampaign.title} (ID: ${inuNekoCampaign.id})`);
    } else {
      console.log(`   ❌ 「いぬのきもち・ねこのきもち」案件は1ページ目には見つかりませんでした`);
    }

    await this.saveResults();
  }

  async saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.join(__dirname, '../../../data/pointincome', `pointincome_final_${timestamp}.json`);
    
    const data = {
      scrape_date: new Date().toISOString(),
      version: 'final_practical_v1',
      strategy: 'first_page_complete_extraction',
      stats: this.stats,
      total_campaigns: this.results.length,
      campaigns: this.results,
      notes: [
        '1ページ目のデータを確実に取得',
        '2ページ目以降は既知のAJAX問題により未対応',
        '複数ページカテゴリの詳細データは今後の課題'
      ]
    };

    await fs.writeFile(filename, JSON.stringify(data, null, 2));
    console.log(`\n💾 データ保存完了: ${filename}`);
    
    return filename;
  }
}

if (require.main === module) {
  const scraper = new PointIncomeWebScraperFinal();
  scraper.execute().then(() => {
    console.log('\n✅ 全処理完了');
    process.exit(0);
  }).catch(error => {
    console.error('\n💥 致命的エラー:', error);
    process.exit(1);
  });
}

module.exports = PointIncomeWebScraperFinal;