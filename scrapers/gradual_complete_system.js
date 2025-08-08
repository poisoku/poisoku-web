#!/usr/bin/env node

/**
 * ちょびリッチ段階的完全取得システム
 * 403エラー回避のため、カテゴリを分割して段階実行
 */

const ExtendedChobirichScraper = require('./src/sites/chobirich/ExtendedChobirichScraper');
const fs = require('fs').promises;
const path = require('path');

class GradualChobirichSystem {
  constructor() {
    this.results = {
      campaigns: [],
      stats: {
        startTime: null,
        endTime: null,
        totalCampaigns: 0,
        successfulCategories: 0,
        failedCategories: 0,
        batchesCompleted: 0
      }
    };
    
    // カテゴリを5つずつのバッチに分割
    this.batches = [
      ['shopping_101', 'shopping_102', 'shopping_103', 'shopping_104', 'shopping_105'],
      ['shopping_106', 'shopping_107', 'shopping_108', 'shopping_109', 'shopping_110'],
      ['shopping_111', 'service_101', 'service_103', 'service_104', 'service_106'],
      ['service_107', 'service_108', 'service_109', 'service_110', 'service_111']
    ];
  }

  async execute() {
    console.log('🚀 ちょびリッチ段階的完全取得システム');
    console.log('='.repeat(70));
    console.log('🛡️ 403エラー回避戦略:');
    console.log('   • 5カテゴリずつ分割実行');
    console.log('   • バッチ間60秒待機');
    console.log('   • エラー時の自動停止・待機');
    console.log('='.repeat(70));

    this.results.stats.startTime = new Date();

    try {
      // 各バッチを段階的に実行
      for (let i = 0; i < this.batches.length; i++) {
        const batch = this.batches[i];
        console.log(`\n🎯 Batch ${i + 1}/${this.batches.length}: ${batch.length}カテゴリ`);
        console.log(`📋 対象: ${batch.join(', ')}`);
        
        await this.executeBatch(batch, i + 1);
        
        // 次のバッチまで待機（最後のバッチ以外）
        if (i < this.batches.length - 1) {
          console.log('\n⏳ 次バッチまで60秒待機中...');
          await this.wait(60000);
        }
      }

      await this.generateFinalData();
      this.results.stats.endTime = new Date();
      await this.generateReport();

    } catch (error) {
      console.error('💥 システムエラー:', error);
      throw error;
    }
  }

  /**
   * バッチ実行
   */
  async executeBatch(categories, batchNumber) {
    const scraper = new ExtendedChobirichScraper();
    
    try {
      await scraper.initialize();
      
      for (const categoryKey of categories) {
        const category = scraper.categories[categoryKey];
        if (!category) continue;

        console.log(`\n📂 ${categoryKey}: ${category.name}`);
        
        try {
          // 個別カテゴリ取得（1ページずつ安全に）
          const results = await this.scrapeCategySafely(scraper, category, categoryKey);
          
          if (results.length > 0) {
            this.results.campaigns.push(...results);
            this.results.stats.successfulCategories++;
            console.log(`   ✅ ${results.length}件取得成功`);
          } else {
            console.log(`   ⚠️ 0件（403エラーまたは案件なし）`);
            this.results.stats.failedCategories++;
          }
          
          // カテゴリ間待機
          console.log('   ⏳ 次カテゴリまで15秒待機...');
          await this.wait(15000);
          
        } catch (error) {
          console.log(`   ❌ エラー: ${error.message}`);
          this.results.stats.failedCategories++;
          
          // 403エラー時は長時間待機
          if (error.message.includes('403')) {
            console.log('   🚫 403エラー検知 - 120秒待機中...');
            await this.wait(120000);
          }
        }
      }
      
      this.results.stats.batchesCompleted++;
      console.log(`\n✅ Batch ${batchNumber} 完了`);
      
    } finally {
      await scraper.cleanup();
    }
  }

  /**
   * カテゴリ安全取得
   */
  async scrapeCategySafely(scraper, category, categoryKey) {
    const results = [];
    let page = 1;
    let consecutiveErrors = 0;
    const maxPages = 10; // 安全のため最大10ページまで

    while (page <= maxPages && consecutiveErrors < 2) {
      try {
        const url = page === 1 ? category.baseUrl : `${category.baseUrl}?page=${page}`;
        console.log(`     📄 ページ${page}: ${url}`);
        
        const pageResults = await scraper.scrapeCategoryPage(url, page, category.type);
        
        if (pageResults.length === 0) {
          console.log(`     ➡️ ページ${page}: 案件なし（終了）`);
          break;
        }
        
        results.push(...pageResults);
        console.log(`     ✅ ページ${page}: ${pageResults.length}件取得`);
        
        page++;
        consecutiveErrors = 0;
        
        // ページ間待機
        if (page <= maxPages) {
          await this.wait(8000);
        }
        
      } catch (error) {
        consecutiveErrors++;
        console.log(`     ❌ ページ${page}エラー: ${error.message}`);
        
        if (error.message.includes('403')) {
          console.log(`     🚫 403エラー - カテゴリ取得中断`);
          break;
        }
        
        if (consecutiveErrors >= 2) {
          console.log(`     🛑 連続エラー - カテゴリ取得中断`);
          break;
        }
        
        page++;
      }
    }

    return results;
  }

  /**
   * 最終データ生成
   */
  async generateFinalData() {
    console.log('\n🎯 最終データ生成中');
    console.log('-'.repeat(50));

    this.results.stats.totalCampaigns = this.results.campaigns.length;

    // 重複除去
    const uniqueCampaigns = new Map();
    this.results.campaigns.forEach(campaign => {
      if (campaign.id) {
        uniqueCampaigns.set(campaign.id, campaign);
      }
    });

    const finalCampaigns = Array.from(uniqueCampaigns.values());
    console.log(`📊 重複除去: ${this.results.campaigns.length}件 → ${finalCampaigns.length}件`);

    // 検索システム用データ
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '_');
    const searchData = {
      site: 'chobirich',
      siteName: 'ちょびリッチ',
      lastUpdated: new Date().toISOString(),
      totalCampaigns: finalCampaigns.length,
      systemInfo: {
        version: 'gradual_system_v1.0',
        executionMode: 'batch_processing',
        batchCount: this.batches.length,
        batchSize: 5,
        antiDetection: true,
        successfulCategories: this.results.stats.successfulCategories,
        failedCategories: this.results.stats.failedCategories
      },
      campaigns: finalCampaigns.map(campaign => ({
        id: campaign.id,
        title: campaign.title,
        url: campaign.url,
        points: campaign.points,
        category: campaign.categoryType || 'unknown',
        platform: 'pc',
        method: campaign.method || '',
        scrapedAt: campaign.scrapedAt || new Date().toISOString()
      }))
    };

    // ファイル保存
    const searchFile = path.join(__dirname, 'data', `chobirich_gradual_search_${timestamp}.json`);
    const productionFile = path.join(__dirname, 'data', 'chobirich_production_gradual.json');

    await fs.writeFile(searchFile, JSON.stringify(searchData, null, 2));
    await fs.writeFile(productionFile, JSON.stringify(searchData, null, 2));

    console.log(`💾 検索データ: ${path.basename(searchFile)}`);
    console.log(`🚀 本番用: ${path.basename(productionFile)}`);
    console.log('✅ ポイ速検索システム反映準備完了');

    return searchData;
  }

  /**
   * 最終レポート
   */
  async generateReport() {
    const duration = (this.results.stats.endTime - this.results.stats.startTime) / 1000;

    console.log('\n' + '='.repeat(70));
    console.log('📊 段階的取得システム実行完了');
    console.log('='.repeat(70));

    console.log(`⏱️  総実行時間: ${Math.floor(duration / 60)}分${Math.floor(duration % 60)}秒`);
    console.log(`📊 総取得案件数: ${this.results.stats.totalCampaigns}件`);
    console.log(`✅ 成功カテゴリ: ${this.results.stats.successfulCategories}`);
    console.log(`❌ 失敗カテゴリ: ${this.results.stats.failedCategories}`);
    console.log(`📦 完了バッチ: ${this.results.stats.batchesCompleted}/${this.batches.length}`);

    // データ品質
    const validCampaigns = this.results.campaigns.filter(c => 
      c.id && c.title && c.url && c.points
    ).length;

    console.log('\n📈 データ品質:');
    console.log(`   有効データ率: ${((validCampaigns/this.results.stats.totalCampaigns)*100).toFixed(1)}%`);

    // カテゴリ統計
    const categoryStats = {};
    this.results.campaigns.forEach(campaign => {
      const cat = campaign.categoryType || 'unknown';
      categoryStats[cat] = (categoryStats[cat] || 0) + 1;
    });

    console.log('\n📊 カテゴリ別取得数:');
    Object.entries(categoryStats).forEach(([category, count]) => {
      console.log(`   ${category}: ${count}件`);
    });

    // 成功率分析
    const totalCategories = this.batches.flat().length;
    const successRate = ((this.results.stats.successfulCategories / totalCategories) * 100).toFixed(1);
    
    console.log('\n📈 実行成功率:');
    console.log(`   カテゴリ成功率: ${successRate}% (${this.results.stats.successfulCategories}/${totalCategories})`);
    
    if (successRate < 100) {
      console.log('\n💡 改善提案:');
      console.log('   • 待機時間をさらに延長');
      console.log('   • バッチサイズを3カテゴリに縮小');
      console.log('   • 時間帯を夜間に変更');
    }

    console.log('\n🔍 検索システム:');
    console.log('   ✅ データファイル生成完了');
    console.log('   🚀 ポイ速反映準備完了');

    console.log('\n✅ 段階的取得完了！');
  }

  /**
   * 待機
   */
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 実行
async function main() {
  const system = new GradualChobirichSystem();
  
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