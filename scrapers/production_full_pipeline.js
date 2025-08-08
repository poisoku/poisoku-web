#!/usr/bin/env node

/**
 * ポイ速本番環境：ちょびリッチ全案件取得～検索反映パイプライン
 * 
 * 実行フロー:
 * 1. 拡張版システム（ショッピング・サービス20カテゴリ）
 * 2. スマホアプリシステム（iOS・Android）
 * 3. データ統合・重複除去
 * 4. ポイ速検索システムへの反映
 * 5. 動作確認テスト
 */

const ExtendedChobirichScraper = require('./src/sites/chobirich/ExtendedChobirichScraper');
const MobileAppScraper = require('./src/sites/chobirich/MobileAppScraper');
const fs = require('fs').promises;
const path = require('path');

class ProductionFullPipeline {
  constructor() {
    this.results = {
      extended: [],
      mobileApp: [],
      combined: [],
      stats: {
        startTime: null,
        endTime: null,
        totalCampaigns: 0,
        duplicatesRemoved: 0,
        categories: {
          shopping: 0,
          service: 0,
          mobileApp: 0
        }
      }
    };
  }

  /**
   * メインパイプライン実行
   */
  async run() {
    console.log('🚀 ポイ速本番環境：ちょびリッチ全案件取得パイプライン開始');
    console.log('='.repeat(80));
    console.log('📋 実行内容:');
    console.log('  1️⃣ 拡張版システム（ショッピング・サービス20カテゴリ）');
    console.log('  2️⃣ スマホアプリシステム（iOS・Android）');
    console.log('  3️⃣ データ統合・重複除去');
    console.log('  4️⃣ 検索システムへの反映');
    console.log('  5️⃣ 動作確認テスト');
    console.log('='.repeat(80));

    this.results.stats.startTime = new Date();

    try {
      // Step 1: 拡張版システム実行
      await this.runExtendedSystem();

      // Step 2: スマホアプリシステム実行
      await this.runMobileAppSystem();

      // Step 3: データ統合
      await this.combineData();

      // Step 4: 検索システムへの反映（ファイル出力）
      await this.saveToSearchSystem();

      // Step 5: 動作確認
      await this.verifyResults();

      this.results.stats.endTime = new Date();
      this.displayFinalReport();

    } catch (error) {
      console.error('💥 パイプライン実行エラー:', error);
      throw error;
    }
  }

  /**
   * Step 1: 拡張版システム実行
   */
  async runExtendedSystem() {
    console.log('\n🎯 Step 1: 拡張版システム（ショッピング・サービス）実行中...');
    console.log('-'.repeat(60));

    const scraper = new ExtendedChobirichScraper();
    
    try {
      // 全カテゴリ取得（本番環境用）
      this.results.extended = await scraper.scrape();
      
      console.log(`✅ 拡張版システム完了: ${this.results.extended.length}件取得`);
      
      // カテゴリ別統計
      this.results.stats.categories.shopping = this.results.extended.filter(c => c.categoryType === 'shopping').length;
      this.results.stats.categories.service = this.results.extended.filter(c => c.categoryType === 'service').length;
      
      console.log(`   📊 ショッピング: ${this.results.stats.categories.shopping}件`);
      console.log(`   📊 サービス: ${this.results.stats.categories.service}件`);

    } catch (error) {
      console.error('💥 拡張版システムエラー:', error);
      throw error;
    }
  }

  /**
   * Step 2: スマホアプリシステム実行
   */
  async runMobileAppSystem() {
    console.log('\n🎯 Step 2: スマホアプリシステム（iOS・Android）実行中...');
    console.log('-'.repeat(60));

    const scraper = new MobileAppScraper();
    
    try {
      await scraper.initialize();
      
      // iOS・Android両方取得
      const mobileResults = await scraper.scrape(['ios', 'android']);
      
      // 統一フォーマットに変換
      this.results.mobileApp = mobileResults.map(campaign => ({
        id: campaign.id,
        title: campaign.title,
        url: campaign.url,
        points: campaign.points,
        categoryType: 'mobile_app',
        platform: campaign.os,
        method: campaign.method || '',
        scrapedAt: campaign.scrapedAt || new Date().toISOString(),
        source: 'mobile_app_system'
      }));

      await scraper.cleanup();
      
      console.log(`✅ スマホアプリシステム完了: ${this.results.mobileApp.length}件取得`);
      
      this.results.stats.categories.mobileApp = this.results.mobileApp.length;
      
      // OS別統計
      const iosCount = this.results.mobileApp.filter(c => c.platform === 'ios').length;
      const androidCount = this.results.mobileApp.filter(c => c.platform === 'android').length;
      
      console.log(`   📊 iOS: ${iosCount}件`);
      console.log(`   📊 Android: ${androidCount}件`);

    } catch (error) {
      console.error('💥 スマホアプリシステムエラー:', error);
      throw error;
    }
  }

  /**
   * Step 3: データ統合・重複除去
   */
  async combineData() {
    console.log('\n🎯 Step 3: データ統合・重複除去中...');
    console.log('-'.repeat(60));

    // 全データ結合
    const allCampaigns = [
      ...this.results.extended,
      ...this.results.mobileApp
    ];

    console.log(`📊 結合前総数: ${allCampaigns.length}件`);

    // 重複除去（ID基準）
    const uniqueCampaigns = new Map();
    let duplicates = 0;

    allCampaigns.forEach(campaign => {
      if (uniqueCampaigns.has(campaign.id)) {
        duplicates++;
      } else {
        uniqueCampaigns.set(campaign.id, campaign);
      }
    });

    this.results.combined = Array.from(uniqueCampaigns.values());
    this.results.stats.duplicatesRemoved = duplicates;
    this.results.stats.totalCampaigns = this.results.combined.length;

    console.log(`📊 重複除去後: ${this.results.combined.length}件`);
    console.log(`📊 重複除去数: ${duplicates}件`);

    // データ品質チェック
    const validCampaigns = this.results.combined.filter(c => 
      c.id && c.title && c.url
    ).length;

    console.log(`📊 有効データ: ${validCampaigns}件 (${((validCampaigns/this.results.combined.length)*100).toFixed(1)}%)`);
  }

  /**
   * Step 4: 検索システムへの反映（ファイル出力）
   */
  async saveToSearchSystem() {
    console.log('\n🎯 Step 4: 検索システム用ファイル出力中...');
    console.log('-'.repeat(60));

    const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '_');

    // ポイ速検索システム用フォーマット
    const searchData = {
      site: 'chobirich',
      siteName: 'ちょびリッチ',
      lastUpdated: new Date().toISOString(),
      totalCampaigns: this.results.stats.totalCampaigns,
      categories: {
        shopping: this.results.stats.categories.shopping,
        service: this.results.stats.categories.service,
        mobileApp: this.results.stats.categories.mobileApp
      },
      campaigns: this.results.combined.map(campaign => ({
        id: campaign.id,
        title: campaign.title,
        url: campaign.url,
        points: campaign.points,
        category: campaign.categoryType,
        platform: campaign.platform || 'pc',
        method: campaign.method || '',
        scrapedAt: campaign.scrapedAt,
        source: campaign.source
      }))
    };

    // メインファイル保存
    const mainFile = path.join(__dirname, 'data', `chobirich_production_${timestamp}.json`);
    await fs.writeFile(mainFile, JSON.stringify(searchData, null, 2));
    console.log(`💾 メインファイル: ${path.basename(mainFile)}`);

    // 検索用軽量ファイル（ポイ速本番用）
    const searchFile = path.join(__dirname, 'data', `chobirich_search_data_${timestamp}.json`);
    const lightweightData = {
      site: 'chobirich',
      lastUpdated: searchData.lastUpdated,
      totalCampaigns: searchData.totalCampaigns,
      campaigns: searchData.campaigns.map(c => ({
        id: c.id,
        title: c.title,
        url: c.url,
        points: c.points,
        category: c.category,
        platform: c.platform
      }))
    };
    
    await fs.writeFile(searchFile, JSON.stringify(lightweightData, null, 2));
    console.log(`💾 検索用ファイル: ${path.basename(searchFile)}`);

    // 統計レポート
    const reportFile = path.join(__dirname, 'data', `chobirich_report_${timestamp}.json`);
    await fs.writeFile(reportFile, JSON.stringify({
      executionTime: new Date().toISOString(),
      stats: this.results.stats,
      dataQuality: {
        validCampaigns: this.results.combined.filter(c => c.id && c.title && c.url).length,
        totalCampaigns: this.results.combined.length,
        successRate: ((this.results.combined.filter(c => c.id && c.title && c.url).length / this.results.combined.length) * 100).toFixed(2) + '%'
      },
      categoryBreakdown: this.results.stats.categories
    }, null, 2));
    console.log(`📊 レポートファイル: ${path.basename(reportFile)}`);

    console.log(`✅ 検索システム用ファイル出力完了`);
  }

  /**
   * Step 5: 動作確認テスト
   */
  async verifyResults() {
    console.log('\n🎯 Step 5: 動作確認テスト実行中...');
    console.log('-'.repeat(60));

    // データ品質チェック
    const qualityChecks = {
      hasId: this.results.combined.filter(c => c.id && c.id.trim()).length,
      hasTitle: this.results.combined.filter(c => c.title && c.title.trim()).length,
      hasUrl: this.results.combined.filter(c => c.url && c.url.includes('/ad_details/')).length,
      hasPoints: this.results.combined.filter(c => c.points && c.points.trim()).length
    };

    console.log('📊 データ品質チェック結果:');
    console.log(`   ✅ 案件ID: ${qualityChecks.hasId}/${this.results.combined.length}件`);
    console.log(`   ✅ 案件タイトル: ${qualityChecks.hasTitle}/${this.results.combined.length}件`);
    console.log(`   ✅ 案件URL: ${qualityChecks.hasUrl}/${this.results.combined.length}件`);
    console.log(`   ✅ 還元率: ${qualityChecks.hasPoints}/${this.results.combined.length}件`);

    // カテゴリ分布確認
    const categoryDistribution = {};
    this.results.combined.forEach(campaign => {
      const category = campaign.categoryType || 'unknown';
      categoryDistribution[category] = (categoryDistribution[category] || 0) + 1;
    });

    console.log('\n📊 カテゴリ分布:');
    Object.entries(categoryDistribution).forEach(([category, count]) => {
      console.log(`   ${category}: ${count}件`);
    });

    // 高額案件チェック
    const highValueCampaigns = this.results.combined
      .filter(c => {
        if (!c.points) return false;
        const numValue = parseInt(c.points.replace(/[^0-9]/g, ''));
        return numValue >= 10000;
      })
      .slice(0, 5);

    if (highValueCampaigns.length > 0) {
      console.log('\n💎 高額案件サンプル（10,000pt以上）:');
      highValueCampaigns.forEach(c => {
        console.log(`   ${c.points} - ${c.title.substring(0, 40)}...`);
      });
    }

    console.log('\n✅ 動作確認テスト完了');
  }

  /**
   * 最終レポート表示
   */
  displayFinalReport() {
    const duration = (this.results.stats.endTime - this.results.stats.startTime) / 1000;
    
    console.log('\n' + '='.repeat(80));
    console.log('🎉 ポイ速本番環境：ちょびリッチ全案件取得パイプライン完了');
    console.log('='.repeat(80));
    
    console.log(`⏱️  実行時間: ${Math.floor(duration / 60)}分${Math.floor(duration % 60)}秒`);
    console.log(`📊 総取得案件数: ${this.results.stats.totalCampaigns}件`);
    console.log(`🗑️  重複除去数: ${this.results.stats.duplicatesRemoved}件`);
    
    console.log('\n📈 カテゴリ別取得数:');
    console.log(`   🛍️  ショッピング: ${this.results.stats.categories.shopping}件`);
    console.log(`   🏢 サービス: ${this.results.stats.categories.service}件`);
    console.log(`   📱 スマホアプリ: ${this.results.stats.categories.mobileApp}件`);
    
    console.log('\n🎯 データ品質:');
    const validRate = ((this.results.combined.filter(c => c.id && c.title && c.url).length / this.results.combined.length) * 100).toFixed(1);
    console.log(`   有効データ率: ${validRate}%`);
    
    console.log('\n💾 出力ファイル:');
    console.log('   - chobirich_production_[timestamp].json（メインデータ）');
    console.log('   - chobirich_search_data_[timestamp].json（検索用軽量版）');
    console.log('   - chobirich_report_[timestamp].json（統計レポート）');
    
    console.log('\n✅ ポイ速検索システムへの反映準備完了！');
  }
}

// 実行
async function main() {
  const pipeline = new ProductionFullPipeline();
  
  try {
    await pipeline.run();
    console.log('\n🎊 パイプライン実行成功！');
    process.exit(0);
  } catch (error) {
    console.error('💥 パイプライン実行失敗:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}