#!/usr/bin/env node

require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const PointIncomeScrapingConfig = require('./PointIncomeScrapingConfig');

/**
 * ポイントインカム モバイル版スクレイパー（AJAX最適化版）
 * 全83カテゴリの案件をAJAXページネーションで完全取得
 * 「次の10件を表示」ボタン問題をAJAXエンドポイント直接呼び出しで解決
 */
class PointIncomeOptimized {
  constructor() {
    this.browser = null;
    this.results = [];
    this.seenCampaignIds = new Set();
    this.scrapingConfig = new PointIncomeScrapingConfig();
    this.stats = {
      startTime: null,
      endTime: null,
      categoriesProcessed: 0,
      totalScrolls: 0,
      totalPages: 0,
      duplicatesSkipped: 0,
      errors: [],
      categoryBreakdown: {},
      highVolumeCategories: 0,
      consecutiveTimeouts: 0
    };
  }

  // 設定を統一管理クラスから取得（モバイル環境指定）
  get config() {
    // 通常案件はモバイル版ページを使用するため、ios環境を指定
    const optimizedConfig = this.scrapingConfig.getOptimizedConfig('ios', 'normalCampaigns');
    return {
      ...optimizedConfig,
      maxRetriesPerCategory: 2,
      maxScrollsPerCategory: 500,        // 異常時の安全弁として大幅拡張
      stableScrollCount: 8,              // 真の無限スクロール: 8回連続で新規なし→完了
      categoryTimeout: 1800000,          // カテゴリ別30分タイムアウト
      scrollWaitTime: 2500,              // スクロール間隔維持
      browserStartupWait: 1000,
      highVolumeThreshold: 50,           // 大量案件の閾値
      infiniteScrollMode: true           // 無限スクロール有効化フラグ
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

    // 統一設定クラスを使用してブラウザ作成（モバイル環境）
    this.browser = await this.scrapingConfig.createBrowser('ios');
    await this.sleep(this.config.browserStartupWait);
    
    console.log(`   🚀 ブラウザ再起動完了 - モバイル高負荷対応最適化`);
  }

  async execute() {
    console.log('🎯 ポイントインカム取得開始 (83カテゴリ)');
    console.log('='.repeat(70));
    
    // 設定情報の表示（モバイル環境）
    this.scrapingConfig.logConfiguration('ios', 'normalCampaigns');

    this.stats.startTime = new Date();

    try {
      await this.initializeBrowser();
      const categoryEntries = Object.entries(this.categories);
      
      for (let i = 0; i < categoryEntries.length; i++) {
        const [key, config] = categoryEntries[i];
        await this.processCategory(key, config, i);
        
        // 統一設定による動的ブラウザ再起動（モバイル環境）
        const restartInfo = this.scrapingConfig.shouldRestartBrowser(i, 'ios', 'normalCampaigns');
        if (restartInfo.shouldRestart) {
          console.log(`   🔄 ブラウザ再起動 (${i + 1}/${restartInfo.restartInterval}カテゴリ処理完了) - 高負荷対応最適化`);
          await this.initializeBrowser();
          
          // メモリクリーンアップ実行
          if (restartInfo.needsMemoryCleanup && global.gc) {
            console.log(`   🧹 メモリクリーンアップ実行`);
            await this.sleep(2000);
            global.gc();
          }
        }
        
        // 進捗表示（10カテゴリごと）
        if ((i + 1) % 10 === 0 || i === categoryEntries.length - 1) {
          const progress = ((i + 1) / categoryEntries.length * 100).toFixed(1);
          console.log(`📈 進捗: ${i + 1}/${categoryEntries.length} (${progress}%) - 取得数: ${this.results.length}件`);
        }
        
        await this.sleep(restartInfo.waitTime);
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

  async processCategory(categoryKey, categoryConfig, categoryIndex) {
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
        
        const scrollInfo = scrollResult.completionReason || `${scrollResult.totalScrolls}回スクロール`;
        console.log(`✅ ${categoryKey}: ${campaigns.length}件 (新規: ${newCount}件) [${scrollInfo}]`);
        
        if (campaigns.length >= this.config.highVolumeThreshold) {
          this.stats.highVolumeCategories++;
        }

        this.stats.categoriesProcessed++;
        this.stats.categoryBreakdown[categoryKey] = campaigns.length;
        this.stats.totalScrolls += scrollResult.totalScrolls;
        this.stats.totalPages += scrollResult.pagesLoaded;
        this.stats.consecutiveTimeouts = 0; // 成功時にリセット

        await page.close();
        break;

      } catch (error) {
        retryCount++;
        if (page) await page.close().catch(() => {});
        
        // タイムアウトエラーの特別処理
        if (error.message.includes('timeout') || error.message.includes('Navigation')) {
          this.stats.consecutiveTimeouts++;
          console.log(`⚠️ ${categoryKey}: タイムアウト検出 (連続${this.stats.consecutiveTimeouts}回) - 緊急対応実行`);
          
          // 統一設定による緊急復旧処理（モバイル環境）
          this.browser = await this.scrapingConfig.handleTimeoutError(
            this.browser, 
            'ios', 
            this.stats.consecutiveTimeouts
          );
          
          // 連続タイムアウトが多い場合は追加待機
          if (this.stats.consecutiveTimeouts >= 2) {
            await this.sleep(5000);
          }
        }
        
        if (retryCount >= this.config.maxRetriesPerCategory) {
          console.log(`❌ ${categoryKey}: エラー (${retryCount}回試行) - ${error.message}`);
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
    console.log(`      🔄 真の無限スクロール開始（完了まで継続）`);
    
    let scrollCount = 0;
    let pagesLoaded = 1;
    let noChangeCount = 0;
    let previousCount = await this.getCampaignCount(page);
    const startTime = Date.now();

    console.log(`      📊 初期案件数: ${previousCount}件`);

    while (scrollCount < this.config.maxScrollsPerCategory && noChangeCount < this.config.stableScrollCount) {
      scrollCount++;
      
      // カテゴリ別タイムアウトチェック
      const elapsed = Date.now() - startTime;
      if (elapsed > this.config.categoryTimeout) {
        console.log(`      ⏰ カテゴリタイムアウト (${Math.round(elapsed/60000)}分) - 強制終了`);
        break;
      }
      
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await this.sleep(this.config.scrollWaitTime);
      
      const currentCount = await this.getCampaignCount(page);
      
      if (currentCount > previousCount) {
        const newItems = currentCount - previousCount;
        console.log(`      📈 スクロール${scrollCount}: ${newItems}件追加 (計:${currentCount}件)`);
        pagesLoaded++;
        noChangeCount = 0;
      } else {
        noChangeCount++;
        if (this.config.infiniteScrollMode && scrollCount % 10 === 0) {
          console.log(`      ⏸️  スクロール${scrollCount}: 新規なし(${noChangeCount}/${this.config.stableScrollCount}回連続)`);
        }
      }
      
      previousCount = currentCount;
      
      // 進捗表示（50回毎）
      if (scrollCount % 50 === 0) {
        const timeMin = Math.round(elapsed / 60000);
        console.log(`      📊 無限スクロール進捗: ${scrollCount}回, ${currentCount}件, ${timeMin}分経過`);
      }
    }

    const endReason = noChangeCount >= this.config.stableScrollCount ? 
      `完全取得(${noChangeCount}回連続で新規なし)` : 
      `安全弁作動(${scrollCount}回到達)`;
    
    console.log(`      ✅ 無限スクロール完了: ${endReason}`);
    console.log(`      📊 最終結果: ${previousCount}件 (${scrollCount}回スクロール)`);

    return { 
      totalScrolls: scrollCount, 
      pagesLoaded, 
      finalCount: previousCount,
      completionReason: endReason,
      elapsedTime: Math.round((Date.now() - startTime) / 1000)
    };
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