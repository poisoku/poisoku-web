#!/usr/bin/env node

require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

/**
 * ポイントインカム モバイル版無限スクロール（完全版）
 * 主要カテゴリで全案件を確実に取得
 */
class PointIncomeMobileComplete {
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
      totalScrolls: 0,
      totalPages: 0,
      duplicatesSkipped: 0,
      errors: [],
      categoryBreakdown: {},
      highVolumeCategories: 0 // 50件以上のカテゴリ数
    };
  }

  getConfig() {
    return {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      viewport: { width: 375, height: 812, isMobile: true, hasTouch: true },
      timeout: 45000,
      scrollWaitTime: 2500, // 少し短縮
      maxRetriesPerCategory: 2,
      maxScrollsPerCategory: 30, // 制限を設ける
      browserRestartInterval: 15,
      browserStartupWait: 1000,
      pageLoadWait: 3000,
      stableScrollCount: 2 // 短縮
    };
  }

  initializeCategories() {
    // 完全なカテゴリリスト（83カテゴリ）
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
    console.log('🎯 ポイントインカム モバイル版完全取得開始');
    console.log('='.repeat(70));
    console.log(`📊 対象主要カテゴリ数: ${Object.keys(this.categories).length}`);

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
        const progress = (categoryIndex / Object.keys(this.categories).length * 100).toFixed(1);
        console.log(`📈 進捗: ${categoryIndex}/${Object.keys(this.categories).length} (${progress}%) - 現在の取得数: ${this.results.length}件`);
        
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
    console.log(`\\n📂 ${categoryConfig.type.toUpperCase()}: ${categoryConfig.name}`);

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

        // 無限スクロールで全案件を取得
        const scrollResult = await this.performInfiniteScroll(page, categoryConfig);
        
        // 最終的に取得されたすべての案件を抽出
        const allCampaigns = await this.extractAllCampaigns(page, categoryConfig);
        
        let newCampaigns = 0;
        allCampaigns.forEach(campaign => {
          if (!this.seenCampaignIds.has(campaign.id)) {
            this.seenCampaignIds.add(campaign.id);
            categoryResults.push(campaign);
            this.results.push(campaign);
            newCampaigns++;
          } else {
            this.stats.duplicatesSkipped++;
          }
        });

        console.log(`      ✅ 完了: ${scrollResult.totalScrolls}回スクロール, ${scrollResult.pagesLoaded}ページ`);
        console.log(`      📊 取得: ${allCampaigns.length}件 (新規: ${newCampaigns}件)`);

        // 大量取得カテゴリの記録
        if (allCampaigns.length >= 50) {
          this.stats.highVolumeCategories++;
          console.log(`      🎯 大量取得カテゴリ: ${allCampaigns.length}件`);
        }

        this.stats.totalScrolls += scrollResult.totalScrolls;
        this.stats.totalPages += scrollResult.pagesLoaded;

        if (page) {
          await page.close();
        }
        break;

      } catch (error) {
        retryCount++;
        console.log(`      ⚠️ エラー (リトライ ${retryCount}/${this.config.maxRetriesPerCategory}): ${error.message}`);
        
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

  async performInfiniteScroll(page, categoryConfig) {
    let scrollCount = 0;
    let pagesLoaded = 1;
    let noChangeCount = 0;
    let previousCampaignCount = 0;
    
    const initialCount = await this.getCampaignCount(page);
    previousCampaignCount = initialCount;

    while (scrollCount < this.config.maxScrollsPerCategory && noChangeCount < this.config.stableScrollCount) {
      scrollCount++;
      
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      
      await new Promise(resolve => setTimeout(resolve, this.config.scrollWaitTime));
      
      const currentCount = await this.getCampaignCount(page);
      
      if (currentCount > previousCampaignCount) {
        pagesLoaded++;
        noChangeCount = 0;
        const increase = currentCount - previousCampaignCount;
        if (scrollCount % 3 === 0) { // 3回に1回だけ詳細ログ
          console.log(`      📄 ページ${pagesLoaded}: ${previousCampaignCount} → ${currentCount}件 (+${increase})`);
        }
      } else {
        noChangeCount++;
      }
      
      previousCampaignCount = currentCount;
    }

    return {
      totalScrolls: scrollCount,
      pagesLoaded: pagesLoaded,
      finalCampaignCount: previousCampaignCount
    };
  }

  async getCampaignCount(page) {
    return await page.evaluate(() => {
      const elements = document.querySelectorAll('.box01');
      return elements.length;
    });
  }

  async extractAllCampaigns(page, categoryConfig) {
    return await page.evaluate((config) => {
      const campaigns = [];
      
      function normalizePointsForPointIncome(pointsText) {
        if (!pointsText) return '';
        
        const percentageMatch = pointsText.match(/購入金額の(\\d+(?:\\.\\d+)?)%/);
        if (percentageMatch) {
          return `${percentageMatch[1]}%`;
        }
        
        const pointMatch = pointsText.match(/(\\d+(?:,\\d+)?)pt/);
        if (pointMatch) {
          const points = parseInt(pointMatch[1].replace(/,/g, ''));
          const yen = Math.floor(points / 10);
          return `${yen.toLocaleString()}円`;
        }
        
        return pointsText;
      }
      
      const campaignElements = document.querySelectorAll('.box01');
      
      campaignElements.forEach((element, index) => {
        try {
          const titleElement = element.querySelector('.title');
          const title = titleElement ? titleElement.textContent.trim() : '';
          
          const linkElement = element.querySelector('a[href*=\"/ad/\"], a[href*=\"ad_details\"]');
          const relativeUrl = linkElement ? linkElement.getAttribute('href') : '';
          
          const pointElement = element.querySelector('.point, .point2');
          let points = pointElement ? pointElement.textContent.trim() : '';
          points = normalizePointsForPointIncome(points);
          
          let id = '';
          if (relativeUrl) {
            const idMatch = relativeUrl.match(/\/ad\/(\d+)\/|ad_details\/(\d+)/); 
            id = idMatch ? (idMatch[1] || idMatch[2]) : `gen_${Date.now()}_${index}`;
          } else {
            id = `gen_${Date.now()}_${index}`;
          }
          
          let absoluteUrl = '';
          if (relativeUrl) {
            if (relativeUrl.startsWith('http')) {
              absoluteUrl = relativeUrl;
            } else if (relativeUrl.startsWith('/')) {
              absoluteUrl = `https://pointi.jp${relativeUrl}`;
            } else {
              absoluteUrl = `https://pointi.jp/${relativeUrl}`;
            }
          }

          if (title && id) {
            campaigns.push({
              id,
              title,
              url: absoluteUrl,
              points,
              device: 'すべて', // スマホアプリ案件以外は「すべて」
              category_id: config ? config.id : null,
              category_type: config ? config.type : null,
              scrape_method: 'mobile_infinite_scroll',
              timestamp: new Date().toISOString()
            });
          }
        } catch (e) {
          console.error('Mobile campaign extraction error:', e);
        }
      });

      return campaigns;
    }, categoryConfig);
  }

  async generateReport() {
    console.log('\\n' + '='.repeat(70));
    console.log('📊 モバイル版完全取得完了レポート');
    console.log('='.repeat(70));

    const duration = (this.stats.endTime - this.stats.startTime) / 1000 / 60;
    
    console.log(`⏱️ 実行時間: ${duration.toFixed(2)}分`);
    console.log(`📂 処理カテゴリ数: ${this.stats.categoriesProcessed}/${Object.keys(this.categories).length}`);
    console.log(`🔄 総スクロール回数: ${this.stats.totalScrolls}`);
    console.log(`📄 総読み込みページ数: ${this.stats.totalPages}`);
    console.log(`🎯 取得案件数: ${this.results.length}`);
    console.log(`🔁 重複スキップ数: ${this.stats.duplicatesSkipped}`);
    console.log(`📈 大量取得カテゴリ数: ${this.stats.highVolumeCategories}個 (50件以上)`);
    
    console.log(`\\n📊 上位取得カテゴリ:`);
    const sortedCategories = Object.entries(this.stats.categoryBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    sortedCategories.forEach(([cat, count], i) => {
      console.log(`   ${i + 1}. ${cat}: ${count}件`);
    });

    if (this.stats.errors.length > 0) {
      console.log(`\\n⚠️ エラー: ${this.stats.errors.length}件`);
      this.stats.errors.forEach((error, i) => {
        console.log(`   ${i + 1}. ${error.category || error.phase}: ${error.error}`);
      });
    }

    // 重要案件の確認
    console.log(`\\n🔍 重要案件確認:`);
    const inuNekoCampaign = this.results.find(c => 
      c.title.includes('いぬのきもち') || c.title.includes('ねこのきもち') || c.id === '12069'
    );
    
    if (inuNekoCampaign) {
      console.log(`   🎉 「いぬのきもち・ねこのきもち」案件発見！`);
      console.log(`   タイトル: ${inuNekoCampaign.title}`);
      console.log(`   ID: ${inuNekoCampaign.id}`);
      console.log(`   ポイント: ${inuNekoCampaign.points}`);
      console.log(`   カテゴリ: ${inuNekoCampaign.category_type}_${inuNekoCampaign.category_id}`);
    } else {
      console.log(`   ❓ 「いぬのきもち・ねこのきもち」案件は主要カテゴリでは見つかりませんでした`);
    }

    await this.saveResults();
  }

  async saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.join(__dirname, '../../../data/pointincome', `pointincome_mobile_complete_${timestamp}.json`);
    
    const data = {
      scrape_date: new Date().toISOString(),
      version: 'mobile_infinite_scroll_complete',
      strategy: 'major_categories_complete_extraction',
      stats: this.stats,
      total_campaigns: this.results.length,
      campaigns: this.results,
      notes: [
        'モバイル版無限スクロールで主要カテゴリの全案件取得',
        'スマホアプリ案件以外のデバイスは「すべて」に設定',
        '大量案件カテゴリを重点的に処理'
      ]
    };

    await fs.writeFile(filename, JSON.stringify(data, null, 2));
    console.log(`\\n💾 データ保存完了: ${filename}`);
    
    return filename;
  }
}

if (require.main === module) {
  const scraper = new PointIncomeMobileComplete();
  scraper.execute().then(() => {
    console.log('\\n✅ 全処理完了');
    process.exit(0);
  }).catch(error => {
    console.error('\\n💥 致命的エラー:', error);
    process.exit(1);
  });
}

module.exports = PointIncomeMobileComplete;