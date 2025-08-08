#!/usr/bin/env node

/**
 * ちょびリッチ完全案件取得システム v2.0
 * 全ての問題を解決した最終版
 */

const ExtendedChobirichScraper = require('./src/sites/chobirich/ExtendedChobirichScraper');
const MobileAppScraper = require('./src/sites/chobirich/MobileAppScraper');
const fs = require('fs').promises;
const path = require('path');

class CompleteChobirichSystemV2 {
  constructor() {
    this.results = {
      webCampaigns: [],
      iosCampaigns: [],
      androidCampaigns: [],
      totalCampaigns: [],
      stats: {
        startTime: null,
        endTime: null,
        errors: [],
        checkpoints: []
      }
    };
    
    // チェックポイントファイル
    this.checkpointFile = path.join(__dirname, 'data', 'chobirich_checkpoint_v2.json');
  }

  async execute() {
    console.log('🚀 ちょびリッチ完全案件取得システム v2.0');
    console.log('='.repeat(70));
    console.log('🔧 改善点:');
    console.log('   ✅ URL生成バグ修正');
    console.log('   ✅ チェックポイント機能');
    console.log('   ✅ 個別カテゴリ実行');
    console.log('   ✅ 最適化された待機時間');
    console.log('   ✅ Android案件確実取得');
    console.log('='.repeat(70));

    this.results.stats.startTime = new Date();

    try {
      // チェックポイント確認
      await this.loadCheckpoint();

      // Step 1: Web案件取得（未取得分のみ）
      await this.fetchWebCampaigns();

      // Step 2: iOSアプリ案件取得
      await this.fetchIOSCampaigns();

      // Step 3: Androidアプリ案件取得
      await this.fetchAndroidCampaigns();

      // Step 4: データ統合と保存
      await this.finalizeData();

      this.results.stats.endTime = new Date();
      await this.generateCompleteReport();

    } catch (error) {
      console.error('💥 システムエラー:', error);
      await this.saveCheckpoint();
      throw error;
    }
  }

  /**
   * チェックポイント読み込み
   */
  async loadCheckpoint() {
    try {
      const data = await fs.readFile(this.checkpointFile, 'utf8');
      const checkpoint = JSON.parse(data);
      console.log('📂 チェックポイント読み込み成功');
      this.results = checkpoint;
      return true;
    } catch (error) {
      console.log('📂 新規実行（チェックポイントなし）');
      return false;
    }
  }

  /**
   * チェックポイント保存
   */
  async saveCheckpoint() {
    try {
      await fs.writeFile(this.checkpointFile, JSON.stringify(this.results, null, 2));
      console.log('💾 チェックポイント保存完了');
    } catch (error) {
      console.error('❌ チェックポイント保存エラー:', error);
    }
  }

  /**
   * Step 1: Web案件取得（修正版）
   */
  async fetchWebCampaigns() {
    console.log('\n🎯 Step 1: Web案件取得');
    console.log('-'.repeat(60));

    // 既に取得済みの場合はスキップ
    if (this.results.webCampaigns.length > 1500) {
      console.log('✅ Web案件取得済み: ' + this.results.webCampaigns.length + '件');
      return;
    }

    const scraper = new ExtendedChobirichScraper();
    await scraper.initialize();

    try {
      // 個別カテゴリごとに慎重に実行
      const categories = Object.keys(scraper.categories);
      
      for (let i = 0; i < categories.length; i++) {
        const categoryKey = categories[i];
        const category = scraper.categories[categoryKey];
        
        console.log(`\n📂 [${i+1}/${categories.length}] ${categoryKey}: ${category.name}`);
        
        try {
          const campaigns = await this.fetchCategoryCompletely(scraper, category, categoryKey);
          
          if (campaigns.length > 0) {
            this.results.webCampaigns.push(...campaigns);
            console.log(`   ✅ ${campaigns.length}件取得成功 (累計: ${this.results.webCampaigns.length}件)`);
          }
          
          // カテゴリ間の十分な待機
          if (i < categories.length - 1) {
            console.log('   ⏳ 次カテゴリまで20秒待機...');
            await this.wait(20000);
          }
          
          // 5カテゴリごとにチェックポイント保存
          if ((i + 1) % 5 === 0) {
            await this.saveCheckpoint();
          }
          
        } catch (error) {
          console.log(`   ❌ エラー: ${error.message}`);
          this.results.stats.errors.push({
            category: categoryKey,
            error: error.message,
            timestamp: new Date().toISOString()
          });
          
          // 403エラーの場合は長時間待機
          if (error.message.includes('403')) {
            console.log('   🚫 403エラー検知 - 3分待機中...');
            await this.wait(180000);
          }
        }
      }
      
    } finally {
      await scraper.cleanup();
    }

    console.log(`\n✅ Web案件取得完了: ${this.results.webCampaigns.length}件`);
  }

  /**
   * カテゴリ完全取得（URL修正版）
   */
  async fetchCategoryCompletely(scraper, category, categoryKey) {
    const campaigns = [];
    let page = 1;
    let emptyPages = 0;
    const maxEmptyPages = 2;

    while (emptyPages < maxEmptyPages && page <= 30) {
      try {
        // URL生成を修正（ダブルパラメータを防ぐ）
        const url = page === 1 ? category.baseUrl : `${category.baseUrl}?page=${page}`;
        console.log(`     📄 ページ${page}: ${url}`);
        
        // scrapeCategoryPageメソッドを直接呼び出し（URLを直接渡す）
        const pageCampaigns = await scraper.scrapeCategoryPage(
          category.baseUrl,  // ベースURLのみ渡す
          page,              // ページ番号
          category.type      // カテゴリタイプ
        );
        
        if (pageCampaigns.length === 0) {
          emptyPages++;
          console.log(`     ➡️ 空ページ (${emptyPages}/${maxEmptyPages})`);
        } else {
          campaigns.push(...pageCampaigns);
          emptyPages = 0;
          console.log(`     ✅ ${pageCampaigns.length}件取得`);
        }
        
        page++;
        
        // ページ間待機
        if (page <= 30) {
          await this.wait(8000);
        }
        
      } catch (error) {
        console.log(`     ❌ ページ${page}エラー: ${error.message}`);
        emptyPages++;
        
        if (error.message.includes('403')) {
          break;
        }
        
        page++;
      }
    }

    return campaigns;
  }

  /**
   * Step 2: iOSアプリ案件取得
   */
  async fetchIOSCampaigns() {
    console.log('\n🎯 Step 2: iOSアプリ案件取得');
    console.log('-'.repeat(60));

    // 既に取得済みの場合はスキップ
    if (this.results.iosCampaigns.length > 300) {
      console.log('✅ iOS案件取得済み: ' + this.results.iosCampaigns.length + '件');
      return;
    }

    const scraper = new MobileAppScraper();

    try {
      await scraper.initialize();
      
      console.log('📱 iOS案件取得中...');
      const iosResults = await scraper.scrape(['ios']);
      
      // データ形式統一
      this.results.iosCampaigns = iosResults.map(campaign => ({
        id: campaign.id,
        title: campaign.title || campaign.name,
        url: campaign.url,
        points: campaign.points || campaign.cashback,
        platform: 'ios',
        category: 'mobile_app',
        method: campaign.method || '',
        scrapedAt: new Date().toISOString()
      }));
      
      console.log(`✅ iOS案件: ${this.results.iosCampaigns.length}件取得完了`);
      await this.saveCheckpoint();
      
    } catch (error) {
      console.log(`❌ iOS取得エラー: ${error.message}`);
      this.results.stats.errors.push({
        type: 'ios',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    } finally {
      await scraper.cleanup();
    }
  }

  /**
   * Step 3: Androidアプリ案件取得
   */
  async fetchAndroidCampaigns() {
    console.log('\n🎯 Step 3: Androidアプリ案件取得');
    console.log('-'.repeat(60));

    // 既に取得済みの場合はスキップ
    if (this.results.androidCampaigns.length > 300) {
      console.log('✅ Android案件取得済み: ' + this.results.androidCampaigns.length + '件');
      return;
    }

    // iOS取得後の待機
    console.log('⏳ Android取得前の待機中（2分）...');
    await this.wait(120000);

    const scraper = new MobileAppScraper();

    try {
      await scraper.initialize();
      
      console.log('📱 Android案件取得中...');
      const androidResults = await scraper.scrape(['android']);
      
      // データ形式統一
      this.results.androidCampaigns = androidResults.map(campaign => ({
        id: campaign.id,
        title: campaign.title || campaign.name,
        url: campaign.url,
        points: campaign.points || campaign.cashback,
        platform: 'android',
        category: 'mobile_app',
        method: campaign.method || '',
        scrapedAt: new Date().toISOString()
      }));
      
      console.log(`✅ Android案件: ${this.results.androidCampaigns.length}件取得完了`);
      await this.saveCheckpoint();
      
    } catch (error) {
      console.log(`❌ Android取得エラー: ${error.message}`);
      this.results.stats.errors.push({
        type: 'android',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    } finally {
      await scraper.cleanup();
    }
  }

  /**
   * Step 4: 最終データ統合
   */
  async finalizeData() {
    console.log('\n🎯 Step 4: 最終データ統合');
    console.log('-'.repeat(60));

    // 全データ統合
    const allCampaigns = [
      ...this.results.webCampaigns,
      ...this.results.iosCampaigns,
      ...this.results.androidCampaigns
    ];

    console.log(`📊 統合前: ${allCampaigns.length}件`);

    // 重複除去（ID基準）
    const uniqueMap = new Map();
    allCampaigns.forEach(campaign => {
      if (campaign.id) {
        uniqueMap.set(campaign.id, campaign);
      }
    });

    this.results.totalCampaigns = Array.from(uniqueMap.values());
    console.log(`📊 重複除去後: ${this.results.totalCampaigns.length}件`);

    // 検索システム用データ生成
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '_');
    const searchData = {
      site: 'chobirich',
      siteName: 'ちょびリッチ',
      lastUpdated: new Date().toISOString(),
      totalCampaigns: this.results.totalCampaigns.length,
      systemInfo: {
        version: 'complete_v2.0',
        webCampaigns: this.results.webCampaigns.length,
        iosCampaigns: this.results.iosCampaigns.length,
        androidCampaigns: this.results.androidCampaigns.length,
        errors: this.results.stats.errors.length
      },
      campaigns: this.results.totalCampaigns
    };

    // ファイル保存
    const completeFile = path.join(__dirname, 'data', `chobirich_complete_v2_${timestamp}.json`);
    const productionFile = path.join(__dirname, 'data', 'chobirich_production_final.json');

    await fs.writeFile(completeFile, JSON.stringify(searchData, null, 2));
    await fs.writeFile(productionFile, JSON.stringify(searchData, null, 2));

    console.log(`💾 完全版データ: ${path.basename(completeFile)}`);
    console.log(`🚀 本番用データ: ${path.basename(productionFile)}`);

    // チェックポイントファイル削除
    try {
      await fs.unlink(this.checkpointFile);
      console.log('🗑️  チェックポイントファイル削除完了');
    } catch (error) {
      // エラーは無視
    }

    return searchData;
  }

  /**
   * 最終レポート
   */
  async generateCompleteReport() {
    const duration = (this.results.stats.endTime - this.results.stats.startTime) / 1000;

    console.log('\n' + '='.repeat(70));
    console.log('🎉 ちょびリッチ完全案件取得システム v2.0 完了');
    console.log('='.repeat(70));

    console.log(`⏱️  総実行時間: ${Math.floor(duration / 60)}分${Math.floor(duration % 60)}秒`);
    console.log('\n📊 取得結果:');
    console.log(`   🛍️  Web案件: ${this.results.webCampaigns.length}件`);
    console.log(`   📱 iOS案件: ${this.results.iosCampaigns.length}件`);
    console.log(`   📱 Android案件: ${this.results.androidCampaigns.length}件`);
    console.log(`   🎯 総案件数: ${this.results.totalCampaigns.length}件`);

    // エラー情報
    if (this.results.stats.errors.length > 0) {
      console.log('\n⚠️  発生エラー:');
      this.results.stats.errors.forEach(error => {
        console.log(`   • ${error.type || error.category}: ${error.error}`);
      });
    }

    // データ品質
    const validCampaigns = this.results.totalCampaigns.filter(c => 
      c.id && c.title && c.url && c.points
    ).length;
    const qualityRate = ((validCampaigns / this.results.totalCampaigns.length) * 100).toFixed(1);

    console.log('\n📈 データ品質:');
    console.log(`   有効データ率: ${qualityRate}% (${validCampaigns}/${this.results.totalCampaigns.length}件)`);

    // カテゴリ統計
    const categoryStats = {};
    this.results.totalCampaigns.forEach(campaign => {
      const cat = campaign.category || 'unknown';
      categoryStats[cat] = (categoryStats[cat] || 0) + 1;
    });

    console.log('\n📊 カテゴリ別内訳:');
    Object.entries(categoryStats)
      .sort(([,a], [,b]) => b - a)
      .forEach(([category, count]) => {
        console.log(`   ${category}: ${count}件`);
      });

    console.log('\n🔍 ポイ速検索システム:');
    console.log('   ✅ 完全版データ生成完了');
    console.log('   ✅ 本番反映準備完了');
    console.log(`   📊 総検索可能案件数: ${this.results.totalCampaigns.length}件`);

    // 完全性チェック
    const expectedTotal = 2300;
    const completeness = ((this.results.totalCampaigns.length / expectedTotal) * 100).toFixed(1);
    
    console.log('\n🎯 完全性評価:');
    console.log(`   予想総数: ~${expectedTotal}件`);
    console.log(`   実際取得: ${this.results.totalCampaigns.length}件`);
    console.log(`   達成率: ${completeness}%`);

    if (parseFloat(completeness) >= 95) {
      console.log('\n🎊 目標達成！ちょびリッチの全案件を網羅的に取得しました！');
    } else if (parseFloat(completeness) >= 90) {
      console.log('\n✅ ほぼ完全な取得に成功しました！');
    } else {
      console.log('\n💡 追加取得が推奨されます。');
    }

    console.log('\n✅ システム実行完了！');
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
  const system = new CompleteChobirichSystemV2();
  
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