#!/usr/bin/env node

/**
 * ちょびリッチ完全案件取得システム（最終版）
 * - 全20カテゴリ（推定5,980件）
 * - スマホアプリ案件（620件）
 * - ポイ速検索システム反映
 */

const ExtendedChobirichScraper = require('./src/sites/chobirich/ExtendedChobirichScraper');
const MobileAppScraper = require('./src/sites/chobirich/MobileAppScraper');
const fs = require('fs').promises;
const path = require('path');

class CompleteChobirichSystem {
  constructor() {
    this.results = {
      webCampaigns: [],
      mobileCampaigns: [],
      combined: [],
      stats: {
        startTime: null,
        endTime: null,
        totalWebCampaigns: 0,
        totalMobileCampaigns: 0,
        totalCombined: 0,
        categoriesProcessed: 0,
        errors: []
      }
    };
  }

  async execute() {
    console.log('🚀 ちょびリッチ完全案件取得システム（最終版）');
    console.log('='.repeat(80));
    console.log('📊 予想取得数:');
    console.log('   🛍️  Web案件: ~5,980件（20カテゴリ）');
    console.log('   📱 アプリ案件: ~620件（iOS + Android）');
    console.log('   📈 総計: ~6,600件');
    console.log('='.repeat(80));

    this.results.stats.startTime = new Date();

    try {
      // Step 1: 全Webカテゴリ取得
      await this.fetchAllWebCategories();

      // Step 2: スマホアプリ案件取得  
      await this.fetchMobileAppCampaigns();

      // Step 3: データ統合と重複除去
      await this.combineAndDeduplicateData();

      // Step 4: ポイ速検索システム反映
      await this.reflectToSearchSystem();

      this.results.stats.endTime = new Date();
      await this.generateFinalReport();

      console.log('\n🎉 ちょびリッチ完全案件取得・検索システム反映完了！');

    } catch (error) {
      console.error('💥 実行エラー:', error);
      throw error;
    }
  }

  /**
   * Step 1: 全Webカテゴリ取得（20カテゴリ）
   */
  async fetchAllWebCategories() {
    console.log('\n🎯 Step 1: 全Webカテゴリ取得中（20カテゴリ）');
    console.log('-'.repeat(60));

    const scraper = new ExtendedChobirichScraper();
    await scraper.initialize();

    try {
      // 全20カテゴリを取得
      console.log('📊 全カテゴリ処理開始...');
      const allCategories = Object.keys(scraper.categories);
      
      console.log(`📋 対象: ${allCategories.length}カテゴリ`);
      
      // 全カテゴリを一括処理
      this.results.webCampaigns = await scraper.scrape(allCategories);
      this.results.stats.totalWebCampaigns = this.results.webCampaigns.length;
      this.results.stats.categoriesProcessed = allCategories.length;

      console.log(`✅ Web案件取得完了: ${this.results.stats.totalWebCampaigns}件`);

    } catch (error) {
      console.log(`❌ Web案件取得エラー: ${error.message}`);
      this.results.stats.errors.push(`Web scraping: ${error.message}`);
    } finally {
      await scraper.cleanup();
    }
  }

  /**
   * Step 2: スマホアプリ案件取得
   */
  async fetchMobileAppCampaigns() {
    console.log('\n🎯 Step 2: スマホアプリ案件取得中');
    console.log('-'.repeat(60));

    const scraper = new MobileAppScraper();

    try {
      await scraper.initialize();
      
      // iOS案件取得
      console.log('📱 iOS案件取得中...');
      const iosResults = await scraper.scrape(['ios']);
      const iosFormatted = iosResults.map(this.formatMobileAppCampaign);
      
      console.log(`✅ iOS案件: ${iosFormatted.length}件`);

      // Android案件取得
      console.log('📱 Android案件取得中...');
      const androidResults = await scraper.scrape(['android']);
      const androidFormatted = androidResults.map(this.formatMobileAppCampaign);
      
      console.log(`✅ Android案件: ${androidFormatted.length}件`);

      this.results.mobileCampaigns = [...iosFormatted, ...androidFormatted];
      this.results.stats.totalMobileCampaigns = this.results.mobileCampaigns.length;

      console.log(`✅ アプリ案件取得完了: ${this.results.stats.totalMobileCampaigns}件`);

    } catch (error) {
      console.log(`❌ アプリ案件取得エラー: ${error.message}`);
      this.results.stats.errors.push(`Mobile scraping: ${error.message}`);
    } finally {
      await scraper.cleanup();
    }
  }

  /**
   * Step 3: データ統合と重複除去
   */
  async combineAndDeduplicateData() {
    console.log('\n🎯 Step 3: データ統合と重複除去');
    console.log('-'.repeat(60));

    // 全データ統合
    const allCampaigns = [
      ...this.results.webCampaigns,
      ...this.results.mobileCampaigns
    ];

    console.log(`📊 統合前: ${allCampaigns.length}件`);

    // ID基準で重複除去
    const uniqueCampaigns = new Map();
    allCampaigns.forEach(campaign => {
      if (campaign.id) {
        uniqueCampaigns.set(campaign.id, campaign);
      }
    });

    this.results.combined = Array.from(uniqueCampaigns.values());
    this.results.stats.totalCombined = this.results.combined.length;

    console.log(`📊 重複除去後: ${this.results.stats.totalCombined}件`);
    console.log(`✅ データ統合完了`);
  }

  /**
   * Step 4: ポイ速検索システム反映
   */
  async reflectToSearchSystem() {
    console.log('\n🎯 Step 4: ポイ速検索システム反映');
    console.log('-'.repeat(60));

    const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '_');

    // メインデータセット（完全版）
    const mainData = {
      site: 'chobirich',
      siteName: 'ちょびリッチ',
      lastUpdated: new Date().toISOString(),
      totalCampaigns: this.results.stats.totalCombined,
      systemInfo: {
        version: 'complete_system_v2.0',
        webCategories: 20,
        mobileSupport: true,
        webCampaigns: this.results.stats.totalWebCampaigns,
        mobileCampaigns: this.results.stats.totalMobileCampaigns,
        totalUniqueCampaigns: this.results.stats.totalCombined
      },
      campaigns: this.results.combined.map(campaign => ({
        id: campaign.id,
        title: campaign.title,
        url: campaign.url,
        points: campaign.points,
        category: campaign.categoryType || 'unknown',
        platform: campaign.platform || campaign.os || 'pc',
        method: campaign.method || '',
        scrapedAt: campaign.scrapedAt || new Date().toISOString(),
        source: campaign.source || 'web_system'
      }))
    };

    // 検索用軽量データセット
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

    // ファイル保存
    const mainFile = path.join(__dirname, 'data', `chobirich_complete_all_${timestamp}.json`);
    const searchFile = path.join(__dirname, 'data', `chobirich_search_all_${timestamp}.json`);

    await fs.writeFile(mainFile, JSON.stringify(mainData, null, 2));
    await fs.writeFile(searchFile, JSON.stringify(searchData, null, 2));

    console.log(`💾 メインデータ: ${path.basename(mainFile)}`);
    console.log(`💾 検索データ: ${path.basename(searchFile)}`);

    // 本番用ファイル作成（最新版として）
    const productionFile = path.join(__dirname, 'data', 'chobirich_production_latest.json');
    await fs.writeFile(productionFile, JSON.stringify(searchData, null, 2));
    
    console.log(`🚀 本番用: ${path.basename(productionFile)}`);
    console.log('✅ ポイ速検索システム反映準備完了');

    return { mainData, searchData };
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
      platform: campaign.os || 'mobile',
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
    console.log(`📊 Web案件取得数: ${this.results.stats.totalWebCampaigns}件`);
    console.log(`📱 アプリ案件取得数: ${this.results.stats.totalMobileCampaigns}件`);
    console.log(`🎯 総取得案件数: ${this.results.stats.totalCombined}件`);
    console.log(`📋 処理カテゴリ数: ${this.results.stats.categoriesProcessed}`);

    // エラーレポート
    if (this.results.stats.errors.length > 0) {
      console.log('\n⚠️  発生エラー:');
      this.results.stats.errors.forEach(error => {
        console.log(`   • ${error}`);
      });
    }

    // データ品質チェック
    const validCampaigns = this.results.combined.filter(c => 
      c.id && c.title && c.url && c.points
    ).length;

    console.log('\n📈 データ品質:');
    console.log(`   有効データ率: ${((validCampaigns/this.results.stats.totalCombined)*100).toFixed(1)}% (${validCampaigns}/${this.results.stats.totalCombined}件)`);

    // カテゴリ別統計
    const categoryStats = {};
    this.results.combined.forEach(campaign => {
      const cat = campaign.categoryType || campaign.category || 'unknown';
      categoryStats[cat] = (categoryStats[cat] || 0) + 1;
    });

    console.log('\n📊 カテゴリ別統計:');
    Object.entries(categoryStats)
      .sort(([,a], [,b]) => b - a)
      .forEach(([category, count]) => {
        console.log(`   ${category}: ${count}件`);
      });

    // 高額案件トップ5
    const highValueCampaigns = this.results.combined
      .filter(c => {
        if (!c.points) return false;
        const numValue = parseInt(c.points.replace(/[^0-9]/g, ''));
        return numValue >= 10000;
      })
      .sort((a, b) => {
        const aVal = parseInt(a.points.replace(/[^0-9]/g, ''));
        const bVal = parseInt(b.points.replace(/[^0-9]/g, ''));
        return bVal - aVal;
      })
      .slice(0, 5);

    if (highValueCampaigns.length > 0) {
      console.log('\n💎 高額案件トップ5:');
      highValueCampaigns.forEach((c, i) => {
        console.log(`   ${i+1}. ${c.points} - ${c.title.substring(0, 40)}...`);
      });
    }

    console.log('\n🔍 ポイ速検索システム:');
    console.log('   ✅ メインデータファイル生成完了');
    console.log('   ✅ 検索用軽量ファイル生成完了'); 
    console.log('   ✅ 本番用データファイル更新完了');
    console.log('   🚀 検索システム反映準備完了');

    // 統計レポート保存
    const reportData = {
      executionTime: new Date().toISOString(),
      duration: duration,
      stats: this.results.stats,
      dataQuality: {
        totalCampaigns: this.results.stats.totalCombined,
        validCampaigns: validCampaigns,
        successRate: ((validCampaigns/this.results.stats.totalCombined)*100).toFixed(2) + '%'
      },
      categoryBreakdown: categoryStats,
      highValueCampaigns: highValueCampaigns.length,
      systemStatus: 'completed_successfully'
    };

    const reportFile = path.join(__dirname, 'data', `complete_system_report_${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '_')}.json`);
    await fs.writeFile(reportFile, JSON.stringify(reportData, null, 2));

    console.log(`📊 実行レポート: ${path.basename(reportFile)}`);
    console.log('\n✅ 全システム実行完了！');
  }
}

// 実行
async function main() {
  const system = new CompleteChobirichSystem();
  
  try {
    await system.execute();
    process.exit(0);
  } catch (error) {
    console.error('💥 システム実行失敗:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}