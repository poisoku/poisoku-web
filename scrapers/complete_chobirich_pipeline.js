#!/usr/bin/env node

/**
 * ちょびリッチ完全案件取得システム
 * 
 * 403エラー対策:
 * - 長い待機時間（5-10秒）
 * - ランダムUser-Agent
 * - リクエスト間隔の調整
 * - エラー時の自動リトライ
 * - セッション管理の最適化
 */

const ExtendedChobirichScraper = require('./src/sites/chobirich/ExtendedChobirichScraper');
const MobileAppScraper = require('./src/sites/chobirich/MobileAppScraper');
const fs = require('fs').promises;
const path = require('path');

class CompleteChobirichPipeline {
  constructor() {
    this.results = {
      extended: [],
      mobileApp: [],
      combined: [],
      stats: {
        startTime: null,
        endTime: null,
        totalCampaigns: 0,
        successfulCategories: 0,
        failedCategories: 0,
        retryAttempts: 0
      }
    };
    
    // 堅牢化設定
    this.config = {
      maxRetries: 3,
      baseDelay: 8000,        // 8秒基本待機
      randomDelay: 5000,      // ランダム0-5秒追加
      sessionTimeout: 300000, // 5分でセッション更新
      categories: [
        'shopping_101', 'shopping_102', 'shopping_103', 'shopping_104',
        'service_101', 'service_103', 'service_106', 'service_107'
      ]
    };
  }

  /**
   * メインパイプライン実行
   */
  async run() {
    console.log('🚀 ちょびリッチ完全案件取得システム（403エラー対策版）');
    console.log('='.repeat(80));
    console.log('🛡️ エラー対策:');
    console.log('  - 8秒基本待機 + ランダム待機');
    console.log('  - セッション管理最適化');
    console.log('  - 自動リトライ機能');
    console.log('  - User-Agent分散');
    console.log('='.repeat(80));

    this.results.stats.startTime = new Date();

    try {
      // Step 1: 段階的な拡張版システム実行
      await this.runExtendedSystemGradual();

      // Step 2: スマホアプリシステム実行（長い待機時間で）
      await this.runMobileAppSystemRobust();

      // Step 3: データ統合と検索システム反映
      await this.combineAndReflectToSearch();

      this.results.stats.endTime = new Date();
      await this.generateFinalReport();

    } catch (error) {
      console.error('💥 パイプライン実行エラー:', error);
      throw error;
    }
  }

  /**
   * Step 1: 段階的拡張版システム実行（403エラー対策）
   */
  async runExtendedSystemGradual() {
    console.log('\n🎯 Step 1: 段階的拡張版システム実行中...');
    console.log('-'.repeat(60));

    const scraper = new ExtendedChobirichScraper();
    
    // 優先度の高いカテゴリから順次実行
    const priorityCategories = [
      'shopping_101', // 総合通販（最重要）
      'shopping_103', // コスメ・美容
      'shopping_104', // グルメ・食品
      'service_101',  // エンタメ
      'service_107'   // 不動産（高額案件）
    ];

    for (const categoryKey of priorityCategories) {
      console.log(`\n🎯 処理中: ${categoryKey}`);
      
      let success = false;
      for (let retry = 0; retry < this.config.maxRetries; retry++) {
        try {
          // カテゴリ別に個別実行
          const categoryResults = await scraper.scrape([categoryKey]);
          
          if (categoryResults.length > 0) {
            this.results.extended.push(...categoryResults);
            this.results.stats.successfulCategories++;
            console.log(`✅ ${categoryKey}: ${categoryResults.length}件取得成功`);
            success = true;
            break;
          }
        } catch (error) {
          this.results.stats.retryAttempts++;
          console.log(`⚠️ ${categoryKey} リトライ ${retry + 1}/${this.config.maxRetries}`);
          
          if (retry < this.config.maxRetries - 1) {
            // 指数バックオフで待機時間を増加
            const backoffDelay = this.config.baseDelay * Math.pow(2, retry);
            await this.smartWait(backoffDelay);
          }
        }
      }
      
      if (!success) {
        console.log(`❌ ${categoryKey}: 最大リトライ回数に達しました`);
        this.results.stats.failedCategories++;
      }
      
      // カテゴリ間の長い待機
      await this.smartWait(this.config.baseDelay);
    }
    
    console.log(`\n✅ 拡張版システム完了: ${this.results.extended.length}件取得`);
    console.log(`📊 成功カテゴリ: ${this.results.stats.successfulCategories}/${priorityCategories.length}`);
  }

  /**
   * Step 2: スマホアプリシステム堅牢実行
   */
  async runMobileAppSystemRobust() {
    console.log('\n🎯 Step 2: スマホアプリシステム堅牢実行中...');
    console.log('-'.repeat(60));

    // 長時間待機後に実行
    console.log('⏳ セッションリセット待機中...');
    await this.smartWait(15000); // 15秒待機

    const scraper = new MobileAppScraper();
    
    try {
      await scraper.initialize();
      
      // iOS先行実行
      console.log('📱 iOS案件取得中...');
      try {
        const iosResults = await scraper.scrape(['ios']);
        const iosFormatted = iosResults.map(this.formatMobileAppCampaign);
        this.results.mobileApp.push(...iosFormatted);
        console.log(`✅ iOS: ${iosFormatted.length}件取得`);
        
        // iOS-Android間の待機
        await this.smartWait(12000);
        
      } catch (error) {
        console.log(`⚠️ iOS取得エラー: ${error.message}`);
      }
      
      // Android実行
      console.log('📱 Android案件取得中...');
      try {
        const androidResults = await scraper.scrape(['android']);
        const androidFormatted = androidResults.map(this.formatMobileAppCampaign);
        this.results.mobileApp.push(...androidFormatted);
        console.log(`✅ Android: ${androidFormatted.length}件取得`);
        
      } catch (error) {
        console.log(`⚠️ Android取得エラー: ${error.message}`);
      }
      
      await scraper.cleanup();
      
    } catch (error) {
      console.log(`⚠️ スマホアプリシステムエラー: ${error.message}`);
    }
    
    console.log(`✅ スマホアプリシステム完了: ${this.results.mobileApp.length}件取得`);
  }

  /**
   * Step 3: データ統合と検索システム反映
   */
  async combineAndReflectToSearch() {
    console.log('\n🎯 Step 3: データ統合と検索システム反映中...');
    console.log('-'.repeat(60));

    // データ統合
    const allCampaigns = [
      ...this.results.extended,
      ...this.results.mobileApp
    ];

    // 重複除去（ID基準）
    const uniqueCampaigns = new Map();
    allCampaigns.forEach(campaign => {
      uniqueCampaigns.set(campaign.id, campaign);
    });

    this.results.combined = Array.from(uniqueCampaigns.values());
    this.results.stats.totalCampaigns = this.results.combined.length;

    console.log(`📊 統合結果: ${this.results.combined.length}件`);

    // ポイ速検索システム用データ生成
    await this.generateSearchSystemData();
    
    console.log('✅ 検索システムへのデータ反映準備完了');
  }

  /**
   * 検索システム用データ生成
   */
  async generateSearchSystemData() {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '_');

    // メインデータセット
    const mainData = {
      site: 'chobirich',
      siteName: 'ちょびリッチ',
      lastUpdated: new Date().toISOString(),
      totalCampaigns: this.results.stats.totalCampaigns,
      systemInfo: {
        version: 'complete_pipeline_v1.0',
        errorHandling: 'robust_403_mitigation',
        successfulCategories: this.results.stats.successfulCategories,
        retryAttempts: this.results.stats.retryAttempts
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

    // 検索用軽量データ
    const searchData = {
      site: 'chobirich',
      lastUpdated: mainData.lastUpdated,
      totalCampaigns: mainData.totalCampaigns,
      campaigns: mainData.campaigns.map(c => ({
        id: c.id,
        title: c.title,
        url: c.url,
        points: c.points,
        category: c.category,
        platform: c.platform
      }))
    };

    // ファイル出力
    const mainFile = path.join(__dirname, 'data', `chobirich_complete_${timestamp}.json`);
    const searchFile = path.join(__dirname, 'data', `chobirich_search_complete_${timestamp}.json`);

    await fs.writeFile(mainFile, JSON.stringify(mainData, null, 2));
    await fs.writeFile(searchFile, JSON.stringify(searchData, null, 2));

    console.log(`💾 メインファイル: ${path.basename(mainFile)}`);
    console.log(`💾 検索用ファイル: ${path.basename(searchFile)}`);

    return { mainData, searchData };
  }

  /**
   * スマートウェイト（ランダム要素付き）
   */
  async smartWait(baseDelay) {
    const randomDelay = Math.floor(Math.random() * this.config.randomDelay);
    const totalDelay = baseDelay + randomDelay;
    
    console.log(`⏳ ${(totalDelay / 1000).toFixed(1)}秒待機中...`);
    await new Promise(resolve => setTimeout(resolve, totalDelay));
  }

  /**
   * スマホアプリキャンペーン統一フォーマット変換
   */
  formatMobileAppCampaign(campaign) {
    return {
      id: campaign.id,
      title: campaign.title,
      url: campaign.url,
      points: campaign.points,
      categoryType: 'mobile_app',
      platform: campaign.os,
      method: campaign.method || '',
      scrapedAt: campaign.scrapedAt || new Date().toISOString(),
      source: 'mobile_app_system'
    };
  }

  /**
   * 最終レポート生成
   */
  async generateFinalReport() {
    const duration = (this.results.stats.endTime - this.results.stats.startTime) / 1000;
    
    console.log('\n' + '='.repeat(80));
    console.log('🎉 ちょびリッチ完全案件取得システム実行完了');
    console.log('='.repeat(80));
    
    console.log(`⏱️  総実行時間: ${Math.floor(duration / 60)}分${Math.floor(duration % 60)}秒`);
    console.log(`📊 総取得案件数: ${this.results.stats.totalCampaigns}件`);
    console.log(`✅ 成功カテゴリ: ${this.results.stats.successfulCategories}`);
    console.log(`❌ 失敗カテゴリ: ${this.results.stats.failedCategories}`);
    console.log(`🔄 リトライ実行数: ${this.results.stats.retryAttempts}`);
    
    const extendedCount = this.results.extended.length;
    const mobileAppCount = this.results.mobileApp.length;
    
    console.log('\n📈 カテゴリ別取得数:');
    console.log(`   🛍️  拡張版システム: ${extendedCount}件`);
    console.log(`   📱 スマホアプリ: ${mobileAppCount}件`);
    
    // データ品質チェック
    const validCampaigns = this.results.combined.filter(c => 
      c.id && c.title && c.url && c.points
    ).length;
    
    console.log('\n🎯 データ品質:');
    console.log(`   有効データ: ${validCampaigns}/${this.results.stats.totalCampaigns}件 (${((validCampaigns/this.results.stats.totalCampaigns)*100).toFixed(1)}%)`);
    
    // 高額案件サンプル
    const highValueCampaigns = this.results.combined
      .filter(c => {
        if (!c.points) return false;
        const numValue = parseInt(c.points.replace(/[^0-9]/g, ''));
        return numValue >= 10000;
      })
      .slice(0, 5);

    if (highValueCampaigns.length > 0) {
      console.log('\n💎 高額案件サンプル:');
      highValueCampaigns.forEach(c => {
        console.log(`   ${c.points} - ${c.title.substring(0, 40)}...`);
      });
    }
    
    console.log('\n🔍 検索システム反映状況:');
    console.log('   ✅ メインデータファイル生成完了');
    console.log('   ✅ 検索用軽量ファイル生成完了');
    console.log('   ✅ ポイ速検索システム反映準備完了');
    
    // 統計レポート保存
    const reportData = {
      executionTime: new Date().toISOString(),
      duration: duration,
      stats: this.results.stats,
      dataQuality: {
        totalCampaigns: this.results.stats.totalCampaigns,
        validCampaigns: validCampaigns,
        successRate: ((validCampaigns/this.results.stats.totalCampaigns)*100).toFixed(2) + '%'
      },
      highValueCampaigns: highValueCampaigns.length
    };

    const reportFile = path.join(__dirname, 'data', `chobirich_complete_report_${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '_')}.json`);
    await fs.writeFile(reportFile, JSON.stringify(reportData, null, 2));
    
    console.log(`📊 詳細レポート: ${path.basename(reportFile)}`);
    console.log('\n✅ 全ての処理が完了しました！');
  }
}

// 実行
async function main() {
  const pipeline = new CompleteChobirichPipeline();
  
  try {
    await pipeline.run();
    console.log('\n🎊 ちょびリッチ全案件取得・検索システム反映完了！');
    process.exit(0);
  } catch (error) {
    console.error('💥 実行失敗:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}