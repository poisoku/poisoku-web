#!/usr/bin/env node

require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

/**
 * ポイントインカム モバイル版スクレイパー（最適化版）
 * 全83カテゴリの案件を無限スクロールで取得
 */
class PointIncomeOptimized {
  constructor() {
    this.browser = null;
    this.results = [];
    this.seenCampaignIds = new Set();
    this.stats = {
      startTime: null,
      endTime: null,
      categoriesProcessed: 0,
      totalScrolls: 0,
      totalPages: 0,
      duplicatesSkipped: 0,
      errors: [],
      categoryBreakdown: {},
      highVolumeCategories: 0
    };
  }

  // 設定を一元管理
  get config() {
    return {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      viewport: { width: 375, height: 812, isMobile: true, hasTouch: true },
      timeout: 45000,
      scrollWaitTime: 2500,
      maxRetriesPerCategory: 2,
      maxScrollsPerCategory: 30,
      browserRestartInterval: 15,
      browserStartupWait: 1000,
      pageLoadWait: 3000,
      stableScrollCount: 2,
      highVolumeThreshold: 50 // 大量案件の閾値
    };
  }

  // カテゴリデータを簡潔に定義
  get categories() {
    const categoryData = {
      shopping: [
        66, 161, 160, 229, 244, 245, 246, 177, 179, 247, 178, 248, 249, 262, 250,
        251, 184, 185, 263, 252, 264, 265, 183, 253, 169, 166, 168, 167, 255, 256,
        261, 254, 171, 162, 163, 164, 173, 174, 175, 176, 230, 225, 195, 257, 258,
        194, 196, 193, 259, 260, 180
      ],
      service: [
        69, 70, 75, 281, 73, 74, 276, 78, 235, 79, 240, 72, 76, 81, 274, 237,
        209, 271, 232, 269, 234, 238, 280, 272, 278, 277, 283, 279, 77, 236, 270, 82
      ]
    };

    const result = {};
    Object.entries(categoryData).forEach(([type, ids]) => {
      ids.forEach(id => {
        result[`${type}_${id}`] = {
          id,
          name: `${type === 'shopping' ? 'ショッピング' : 'サービス'}カテゴリ${id}`,
          url: `https://pointi.jp/list.php?category=${id}`,
          type
        };
      });
    });
    return result;
  }

  async initializeBrowser() {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        // エラーログは省略
      }
    }

    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-web-security']
    });
    
    await this.sleep(this.config.browserStartupWait);
  }

  async execute() {
    console.log('🎯 ポイントインカム取得開始 (83カテゴリ)');
    console.log('='.repeat(70));

    this.stats.startTime = new Date();

    try {
      await this.initializeBrowser();
      const categoryEntries = Object.entries(this.categories);
      
      for (let i = 0; i < categoryEntries.length; i++) {
        const [key, config] = categoryEntries[i];
        await this.processCategory(key, config);
        
        // ブラウザ再起動
        if ((i + 1) % this.config.browserRestartInterval === 0) {
          await this.initializeBrowser();
        }
        
        // 進捗表示（10カテゴリごと）
        if ((i + 1) % 10 === 0 || i === categoryEntries.length - 1) {
          const progress = ((i + 1) / categoryEntries.length * 100).toFixed(1);
          console.log(`📈 進捗: ${i + 1}/${categoryEntries.length} (${progress}%) - 取得数: ${this.results.length}件`);
        }
        
        await this.sleep(1000);
      }

      this.stats.endTime = new Date();
      await this.generateReport();
      
    } catch (error) {
      console.error('💥 実行エラー:', error.message);
      this.stats.errors.push({ phase: 'execution', error: error.message });
    } finally {
      await this.cleanup();
    }
  }

  async processCategory(categoryKey, categoryConfig) {
    let retryCount = 0;

    while (retryCount < this.config.maxRetriesPerCategory) {
      let page = null;
      try {
        page = await this.createPage();
        await page.goto(categoryConfig.url, {
          waitUntil: 'networkidle2',
          timeout: this.config.timeout
        });
        
        await this.sleep(this.config.pageLoadWait);

        // 無限スクロール実行
        const scrollResult = await this.performInfiniteScroll(page);
        
        // 案件抽出
        const campaigns = await this.extractCampaigns(page, categoryConfig);
        
        // 新規案件の追加
        const newCount = this.addNewCampaigns(campaigns);
        
        console.log(`✅ ${categoryKey}: ${campaigns.length}件 (新規: ${newCount}件)`);
        
        if (campaigns.length >= this.config.highVolumeThreshold) {
          this.stats.highVolumeCategories++;
        }

        this.stats.categoriesProcessed++;
        this.stats.categoryBreakdown[categoryKey] = campaigns.length;
        this.stats.totalScrolls += scrollResult.totalScrolls;
        this.stats.totalPages += scrollResult.pagesLoaded;

        await page.close();
        break;

      } catch (error) {
        retryCount++;
        if (page) await page.close().catch(() => {});
        
        if (retryCount >= this.config.maxRetriesPerCategory) {
          console.log(`❌ ${categoryKey}: エラー - ${error.message}`);
          this.stats.errors.push({ category: categoryKey, error: error.message });
        } else {
          await this.sleep(2000);
        }
      }
    }
  }

  async createPage() {
    if (!this.browser || !this.browser.isConnected()) {
      await this.initializeBrowser();
    }

    const page = await this.browser.newPage();
    await page.setUserAgent(this.config.userAgent);
    await page.setViewport(this.config.viewport);
    return page;
  }

  async performInfiniteScroll(page) {
    let scrollCount = 0;
    let pagesLoaded = 1;
    let noChangeCount = 0;
    let previousCount = await this.getCampaignCount(page);

    while (scrollCount < this.config.maxScrollsPerCategory && noChangeCount < this.config.stableScrollCount) {
      scrollCount++;
      
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await this.sleep(this.config.scrollWaitTime);
      
      const currentCount = await this.getCampaignCount(page);
      
      if (currentCount > previousCount) {
        pagesLoaded++;
        noChangeCount = 0;
      } else {
        noChangeCount++;
      }
      
      previousCount = currentCount;
    }

    return { totalScrolls: scrollCount, pagesLoaded, finalCount: previousCount };
  }

  async getCampaignCount(page) {
    return await page.evaluate(() => document.querySelectorAll('.box01').length);
  }

  async extractCampaigns(page, categoryConfig) {
    return await page.evaluate((config) => {
      const campaigns = [];
      const elements = document.querySelectorAll('.box01');
      
      elements.forEach((element, index) => {
        try {
          const title = element.querySelector('.title')?.textContent.trim() || '';
          const linkEl = element.querySelector('a[href*="/ad/"], a[href*="ad_details"]');
          const relativeUrl = linkEl?.getAttribute('href') || '';
          const pointEl = element.querySelector('.point, .point2');
          const points = pointEl?.textContent.trim() || '';
          
          // ID抽出
          let id = '';
          if (relativeUrl) {
            const match = relativeUrl.match(/\/ad\/(\d+)\/|ad_details\/(\d+)/);
            id = match ? (match[1] || match[2]) : `gen_${Date.now()}_${index}`;
          }
          
          // URL生成
          const url = relativeUrl.startsWith('http') ? relativeUrl : 
                     relativeUrl.startsWith('/') ? `https://pointi.jp${relativeUrl}` : 
                     `https://pointi.jp/${relativeUrl}`;

          if (title && id) {
            campaigns.push({
              id,
              title,
              url,
              points: points.replace(/^\d+%⇒/, ''), // 矢印前の%を削除
              device: 'すべて',
              category_id: config.id,
              category_type: config.type,
              timestamp: new Date().toISOString()
            });
          }
        } catch (e) {
          // エラーは無視
        }
      });

      return campaigns;
    }, categoryConfig);
  }

  addNewCampaigns(campaigns) {
    let newCount = 0;
    campaigns.forEach(campaign => {
      if (!this.seenCampaignIds.has(campaign.id)) {
        this.seenCampaignIds.add(campaign.id);
        this.results.push(campaign);
        newCount++;
      } else {
        this.stats.duplicatesSkipped++;
      }
    });
    return newCount;
  }

  async generateReport() {
    const duration = (this.stats.endTime - this.stats.startTime) / 1000 / 60;
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 完了レポート');
    console.log('='.repeat(70));
    console.log(`⏱️ 実行時間: ${duration.toFixed(2)}分`);
    console.log(`📂 処理カテゴリ: ${this.stats.categoriesProcessed}/${Object.keys(this.categories).length}`);
    console.log(`🎯 取得案件数: ${this.results.length}`);
    console.log(`📈 大量取得カテゴリ: ${this.stats.highVolumeCategories}個`);
    
    if (this.stats.errors.length > 0) {
      console.log(`\n⚠️ エラー: ${this.stats.errors.length}件`);
    }

    // 重要案件チェック
    const inuNeko = this.results.find(c => 
      c.title.includes('いぬのきもち') || c.title.includes('ねこのきもち')
    );
    if (inuNeko) {
      console.log(`\n🎉 「いぬのきもち・ねこのきもち」案件: ID ${inuNeko.id}`);
    }

    await this.saveResults();
  }

  async saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.join(__dirname, '../../../data/pointincome', `pointincome_optimized_${timestamp}.json`);
    
    const data = {
      scrape_date: new Date().toISOString(),
      version: 'mobile_optimized_v1',
      stats: this.stats,
      total_campaigns: this.results.length,
      campaigns: this.results
    };

    await fs.writeFile(filename, JSON.stringify(data, null, 2));
    console.log(`\n💾 保存完了: ${filename}`);
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 実行
if (require.main === module) {
  const scraper = new PointIncomeOptimized();
  scraper.execute()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('致命的エラー:', error);
      process.exit(1);
    });
}

module.exports = PointIncomeOptimized;