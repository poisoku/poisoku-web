#!/usr/bin/env node

/**
 * ちょびリッチ完全深堀り取得システム
 * 各カテゴリの全ページを徹底取得
 */

const ExtendedChobirichScraper = require('./src/sites/chobirich/ExtendedChobirichScraper');
const MobileAppScraper = require('./src/sites/chobirich/MobileAppScraper');
const fs = require('fs').promises;
const path = require('path');

class CompleteDeepScrapingSystem {
  constructor() {
    this.results = {
      webCampaigns: [],
      mobileCampaigns: [],
      stats: {
        startTime: null,
        endTime: null,
        totalPages: 0,
        totalCampaigns: 0,
        categoryDetails: {}
      }
    };
  }

  async execute() {
    console.log('🚀 ちょびリッチ完全深堀り取得システム');
    console.log('='.repeat(70));
    console.log('🎯 目標: 全6,600件の案件取得');
    console.log('💡 戦略: 各カテゴリの全ページを徹底取得');
    console.log('⚡ 方式: 3カテゴリずつ + 長時間待機');
    console.log('='.repeat(70));

    this.results.stats.startTime = new Date();

    try {
      // Step 1: Webカテゴリ完全取得
      await this.executeCompleteWebScraping();
      
      // Step 2: スマホアプリ案件取得
      await this.executeMobileAppScraping();
      
      // Step 3: データ統合と反映
      await this.generateFinalSystem();

      this.results.stats.endTime = new Date();
      await this.generateDeepReport();

    } catch (error) {
      console.error('💥 システムエラー:', error);
      throw error;
    }
  }

  /**
   * Step 1: Web全カテゴリ完全取得
   */
  async executeCompleteWebScraping() {
    console.log('\n🎯 Step 1: Web全カテゴリ完全取得');
    console.log('-'.repeat(60));

    const scraper = new ExtendedChobirichScraper();
    await scraper.initialize();

    // より小さいバッチ（3カテゴリずつ）
    const smallBatches = [
      ['shopping_101', 'shopping_102', 'shopping_103'],
      ['shopping_104', 'shopping_105', 'shopping_106'], 
      ['shopping_107', 'shopping_108', 'shopping_109'],
      ['shopping_110', 'shopping_111', 'service_101'],
      ['service_103', 'service_104', 'service_106'],
      ['service_107', 'service_108', 'service_109'],
      ['service_110', 'service_111']
    ];

    try {
      for (let i = 0; i < smallBatches.length; i++) {
        const batch = smallBatches[i];
        console.log(`\n📦 Batch ${i + 1}/${smallBatches.length}: ${batch.join(', ')}`);
        
        await this.executeDeepBatch(scraper, batch);
        
        // バッチ間の長時間待機
        if (i < smallBatches.length - 1) {
          console.log('\n⏳ 次バッチまで90秒待機中...');
          await this.wait(90000);
        }
      }
    } finally {
      await scraper.cleanup();
    }
  }

  /**
   * 深堀りバッチ実行
   */
  async executeDeepBatch(scraper, categories) {
    for (const categoryKey of categories) {
      const category = scraper.categories[categoryKey];
      if (!category) continue;

      console.log(`\n📂 ${categoryKey}: ${category.name}`);
      
      try {
        const results = await this.scrapeAllPagesCompletely(scraper, category, categoryKey);
        
        if (results.length > 0) {
          this.results.webCampaigns.push(...results);
          console.log(`   ✅ 総取得: ${results.length}件`);
          
          this.results.stats.categoryDetails[categoryKey] = {
            campaigns: results.length,
            pages: Math.ceil(results.length / 30),
            status: 'success'
          };
        } else {
          console.log(`   ⚠️ 取得失敗: 403エラーまたは案件なし`);
          this.results.stats.categoryDetails[categoryKey] = {
            campaigns: 0,
            pages: 0,
            status: 'failed'
          };
        }

        // カテゴリ間待機
        console.log('   ⏳ 次カテゴリまで30秒待機...');
        await this.wait(30000);

      } catch (error) {
        console.log(`   ❌ エラー: ${error.message}`);
        this.results.stats.categoryDetails[categoryKey] = {
          campaigns: 0,
          pages: 0,
          status: 'error',
          error: error.message
        };
      }
    }
  }

  /**
   * 全ページ完全取得
   */
  async scrapeAllPagesCompletely(scraper, category, categoryKey) {
    const results = [];
    let page = 1;
    let consecutiveEmptyPages = 0;
    const maxEmptyPages = 3; // 3ページ連続で空の場合は終了
    const maxTotalPages = 50; // 最大50ページまで（安全装置）

    console.log(`   🔍 全ページ探索開始...`);

    while (page <= maxTotalPages && consecutiveEmptyPages < maxEmptyPages) {
      try {
        const url = page === 1 ? category.baseUrl : `${category.baseUrl}?page=${page}`;
        console.log(`     📄 ページ${page}: 取得中...`);
        
        const pageResults = await scraper.scrapeCategoryPage(url, page, category.type);
        
        if (pageResults.length === 0) {
          consecutiveEmptyPages++;
          console.log(`     ➡️ ページ${page}: 空ページ (${consecutiveEmptyPages}/${maxEmptyPages})`);
          
          if (consecutiveEmptyPages >= maxEmptyPages) {
            console.log(`     🛑 ${maxEmptyPages}ページ連続空ページ - 終了`);
            break;
          }
        } else {
          results.push(...pageResults);
          consecutiveEmptyPages = 0; // リセット
          console.log(`     ✅ ページ${page}: ${pageResults.length}件取得 (累計: ${results.length}件)`);
        }
        
        this.results.stats.totalPages++;
        page++;
        
        // ページ間待機（403エラー回避）
        if (page <= maxTotalPages) {
          await this.wait(12000); // 12秒待機
        }
        
      } catch (error) {
        console.log(`     ❌ ページ${page}エラー: ${error.message}`);
        
        if (error.message.includes('403')) {
          console.log(`     🚫 403エラー - 長時間待機中...`);
          await this.wait(180000); // 3分待機
          consecutiveEmptyPages++; // 403エラーも空ページとしてカウント
        } else {
          consecutiveEmptyPages++;
        }
        
        page++;
      }
    }

    console.log(`   📊 ${categoryKey} 完了: ${results.length}件 (${page-1}ページ探索)`);
    return results;
  }

  /**
   * Step 2: スマホアプリ案件取得
   */
  async executeMobileAppScraping() {
    console.log('\n🎯 Step 2: スマホアプリ案件取得');
    console.log('-'.repeat(60));
    console.log('⏳ 403エラー回復待機中（5分）...');
    await this.wait(300000); // 5分待機

    const scraper = new MobileAppScraper();

    try {
      await scraper.initialize();
      
      // iOS案件取得（慎重に）
      console.log('📱 iOS案件取得中...');
      try {
        const iosResults = await scraper.scrape(['ios']);
        const iosFormatted = iosResults.map(this.formatMobileAppCampaign);
        this.results.mobileCampaigns.push(...iosFormatted);
        console.log(`✅ iOS: ${iosFormatted.length}件取得`);
        
        // iOS-Android間の長い待機
        console.log('⏳ iOS-Android間待機中（3分）...');
        await this.wait(180000);
        
      } catch (error) {
        console.log(`❌ iOS取得エラー: ${error.message}`);
      }
      
      // Android案件取得
      console.log('📱 Android案件取得中...');
      try {
        const androidResults = await scraper.scrape(['android']);
        const androidFormatted = androidResults.map(this.formatMobileAppCampaign);
        this.results.mobileCampaigns.push(...androidFormatted);
        console.log(`✅ Android: ${androidFormatted.length}件取得`);
        
      } catch (error) {
        console.log(`❌ Android取得エラー: ${error.message}`);
      }

    } finally {
      await scraper.cleanup();
    }
    
    console.log(`📱 アプリ案件合計: ${this.results.mobileCampaigns.length}件`);
  }

  /**
   * Step 3: 最終システム生成
   */
  async generateFinalSystem() {
    console.log('\n🎯 Step 3: 最終データ統合・検索システム反映');
    console.log('-'.repeat(60));

    // データ統合
    const allCampaigns = [
      ...this.results.webCampaigns,
      ...this.results.mobileCampaigns
    ];

    // 重複除去
    const uniqueCampaigns = new Map();
    allCampaigns.forEach(campaign => {
      if (campaign.id) {
        uniqueCampaigns.set(campaign.id, campaign);
      }
    });

    const finalCampaigns = Array.from(uniqueCampaigns.values());
    this.results.stats.totalCampaigns = finalCampaigns.length;

    console.log(`📊 最終統計:`);
    console.log(`   Web案件: ${this.results.webCampaigns.length}件`);
    console.log(`   アプリ案件: ${this.results.mobileCampaigns.length}件`);
    console.log(`   総案件数: ${finalCampaigns.length}件`);

    // 検索システム用データ生成
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '_');
    const searchData = {
      site: 'chobirich',
      siteName: 'ちょびリッチ',
      lastUpdated: new Date().toISOString(),
      totalCampaigns: finalCampaigns.length,
      systemInfo: {
        version: 'deep_scraping_v1.0',
        executionMode: 'complete_deep_extraction',
        webCategories: 20,
        mobileSupport: true,
        totalPagesScanned: this.results.stats.totalPages,
        webCampaigns: this.results.webCampaigns.length,
        mobileCampaigns: this.results.mobileCampaigns.length
      },
      campaigns: finalCampaigns.map(campaign => ({
        id: campaign.id,
        title: campaign.title,
        url: campaign.url,
        points: campaign.points,
        category: campaign.categoryType || campaign.category || 'unknown',
        platform: campaign.platform || campaign.os || 'pc',
        method: campaign.method || '',
        scrapedAt: campaign.scrapedAt || new Date().toISOString()
      }))
    };

    // ファイル保存
    const searchFile = path.join(__dirname, 'data', `chobirich_complete_deep_${timestamp}.json`);
    const productionFile = path.join(__dirname, 'data', 'chobirich_production_complete.json');

    await fs.writeFile(searchFile, JSON.stringify(searchData, null, 2));
    await fs.writeFile(productionFile, JSON.stringify(searchData, null, 2));

    console.log(`💾 完全版データ: ${path.basename(searchFile)}`);
    console.log(`🚀 本番用データ: ${path.basename(productionFile)}`);
    console.log('✅ ポイ速検索システム完全反映準備完了');

    return searchData;
  }

  /**
   * 最終詳細レポート
   */
  async generateDeepReport() {
    const duration = (this.results.stats.endTime - this.results.stats.startTime) / 1000;

    console.log('\n' + '='.repeat(70));
    console.log('🎉 ちょびリッチ完全深堀り取得システム完了');
    console.log('='.repeat(70));

    console.log(`⏱️  総実行時間: ${Math.floor(duration / 60)}分${Math.floor(duration % 60)}秒`);
    console.log(`📊 Web案件: ${this.results.webCampaigns.length}件`);
    console.log(`📱 アプリ案件: ${this.results.mobileCampaigns.length}件`);
    console.log(`🎯 総案件数: ${this.results.stats.totalCampaigns}件`);
    console.log(`📄 総探索ページ数: ${this.results.stats.totalPages}ページ`);

    // 予想との比較
    const expectedTotal = 6600;
    const achievementRate = ((this.results.stats.totalCampaigns / expectedTotal) * 100).toFixed(1);
    
    console.log('\n📈 目標達成度:');
    console.log(`   予想総数: ${expectedTotal}件`);
    console.log(`   実際取得: ${this.results.stats.totalCampaigns}件`);
    console.log(`   達成率: ${achievementRate}%`);

    // カテゴリ別詳細
    console.log('\n📊 カテゴリ別詳細:');
    Object.entries(this.results.stats.categoryDetails).forEach(([key, detail]) => {
      const statusIcon = detail.status === 'success' ? '✅' : 
                        detail.status === 'failed' ? '⚠️' : '❌';
      console.log(`   ${statusIcon} ${key}: ${detail.campaigns}件 (${detail.pages}ページ)`);
    });

    console.log('\n🔍 ポイ速検索システム:');
    console.log('   ✅ 完全版データファイル生成完了');
    console.log('   🚀 本番反映準備完了');
    console.log(`   📊 検索可能案件数: ${this.results.stats.totalCampaigns}件`);

    if (achievementRate >= 90) {
      console.log('\n🎊 目標達成！ちょびリッチの案件を網羅的に取得しました');
    } else {
      console.log('\n💡 更なる改善提案:');
      console.log('   • より長い待機時間での再実行');
      console.log('   • 時間を置いての補完実行');
      console.log('   • プロキシ活用での追加取得');
    }

    console.log('\n✅ 完全深堀り取得完了！');
  }

  formatMobileAppCampaign(campaign) {
    return {
      id: campaign.id,
      title: campaign.title,
      url: campaign.url,
      points: campaign.points,
      categoryType: 'mobile_app',
      platform: campaign.os || 'mobile',
      method: campaign.method || '',
      scrapedAt: campaign.scrapedAt || new Date().toISOString()
    };
  }

  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 実行
async function main() {
  const system = new CompleteDeepScrapingSystem();
  
  try {
    await system.execute();
    process.exit(0);
  } catch (error) {
    console.error('💥 実行失敗:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}