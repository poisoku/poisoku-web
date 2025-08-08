#!/usr/bin/env node

/**
 * ちょびリッチ差分取得システム v1.0
 * 軽量・高速差分検出専用システム
 * 
 * 機能:
 * - 各カテゴリの軽量スキャン（詳細ページアクセスなし）
 * - MD5ハッシュベースの変更検出
 * - 新規・変更・削除案件の特定
 * - 差分のみの詳細データ取得
 */

const LightweightScraper = require('./src/utils/LightweightScraper');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class ChobirichDifferentialSystem {
  constructor() {
    this.results = {
      newCampaigns: [],
      updatedCampaigns: [],
      deletedCampaigns: [],
      unchangedCount: 0,
      stats: {
        startTime: null,
        endTime: null,
        totalScanned: 0,
        differenceCount: 0,
        processingTime: 0
      }
    };
    
    this.config = {
      lightweightMode: true,         // 軽量モード（詳細ページアクセスなし）
      hashAlgorithm: 'md5',          // ハッシュアルゴリズム
      batchSize: 10,                 // バッチ処理サイズ
      quickRetries: 2,               // クイックリトライ回数
      baselineFile: 'chobirich_baseline.json',  // ベースラインデータ
      deltaOutputFile: 'chobirich_delta.json'   // 差分結果ファイル
    };
    
    this.baselineFile = path.join(__dirname, 'data', this.config.baselineFile);
    this.deltaFile = path.join(__dirname, 'data', this.config.deltaOutputFile);
    this.currentSnapshot = new Map(); // 現在のデータハッシュマップ
    this.baselineSnapshot = new Map(); // ベースラインハッシュマップ
  }

  /**
   * メイン実行
   */
  async execute() {
    console.log('🔄 ちょびリッチ差分取得システム v1.0');
    console.log('='.repeat(60));
    console.log('⚡ 軽量・高速差分検出:');
    console.log('   🔍 カテゴリ軽量スキャン');
    console.log('   🧬 MD5ハッシュ変更検出');
    console.log('   📊 差分のみ詳細取得');
    console.log('   🎯 目標: 5-15分で差分検出完了');
    console.log('');

    this.results.stats.startTime = new Date();

    try {
      // Step 1: ベースラインデータ読み込み
      await this.loadBaseline();
      
      // Step 2: 軽量スキャン実行
      await this.performLightweightScan();
      
      // Step 3: 差分検出
      await this.detectDifferences();
      
      // Step 4: 差分詳細データ取得
      await this.fetchDifferenceDetails();
      
      // Step 5: 結果保存・レポート
      await this.saveResults();
      await this.generateReport();

    } catch (error) {
      console.error('💥 差分取得エラー:', error);
      throw error;
    } finally {
      this.results.stats.endTime = new Date();
      this.results.stats.processingTime = 
        this.results.stats.endTime - this.results.stats.startTime;
    }
  }

  /**
   * ベースラインデータ読み込み
   */
  async loadBaseline() {
    console.log('📂 Step 1: ベースラインデータ読み込み');
    console.log('-'.repeat(40));

    try {
      const data = await fs.readFile(this.baselineFile, 'utf8');
      const baseline = JSON.parse(data);
      
      // ハッシュマップ生成
      baseline.campaigns.forEach(campaign => {
        const hash = this.createCampaignHash(campaign);
        this.baselineSnapshot.set(campaign.id, {
          hash,
          campaign
        });
      });
      
      console.log(`✅ ベースライン読み込み完了: ${baseline.campaigns.length}件`);
      console.log(`   最終更新: ${baseline.lastUpdated}`);
      console.log(`   ハッシュマップ生成: ${this.baselineSnapshot.size}件`);
      
    } catch (error) {
      console.log('⚠️ ベースラインなし（初回実行）');
      // 初回実行時は完全取得を推奨
      console.log('💡 推奨: まずcomplete_chobirich_system_v3.jsを実行してベースライン作成');
    }
  }

  /**
   * 軽量スキャン実行
   */
  async performLightweightScan() {
    console.log('\n⚡ Step 2: 軽量スキャン実行');
    console.log('-'.repeat(40));

    const lightweightScraper = new LightweightScraper();
    
    try {
      console.log('🌐 Web案件軽量スキャン中...');
      const webResults = await lightweightScraper.getLightweightWebCampaigns();
      console.log(`   Web案件: ${webResults.length}件スキャン完了`);
      
      console.log('📱 iOS案件軽量スキャン中...');
      const iosResults = await lightweightScraper.getLightweightMobileCampaigns('ios');
      console.log(`   iOS案件: ${iosResults.length}件スキャン完了`);
      
      console.log('🤖 Android案件軽量スキャン中...');
      const androidResults = await lightweightScraper.getLightweightMobileCampaigns('android');
      console.log(`   Android案件: ${androidResults.length}件スキャン完了`);
      
      // 現在スナップショット生成
      const allResults = [...webResults, ...iosResults, ...androidResults];
      allResults.forEach(campaign => {
        const hash = this.createCampaignHash(campaign);
        this.currentSnapshot.set(campaign.id, {
          hash,
          campaign
        });
      });
      
      this.results.stats.totalScanned = allResults.length;
      console.log(`✅ 軽量スキャン完了: 合計${allResults.length}件`);
      
    } finally {
      await lightweightScraper.cleanup();
    }
  }


  /**
   * 差分検出
   */
  async detectDifferences() {
    console.log('\n🧬 Step 3: 差分検出');
    console.log('-'.repeat(40));

    const newIds = [];
    const updatedIds = [];
    const deletedIds = [];
    let unchangedCount = 0;

    // 新規・更新検出
    for (const [id, currentData] of this.currentSnapshot) {
      const baselineData = this.baselineSnapshot.get(id);
      
      if (!baselineData) {
        // 新規案件
        newIds.push(id);
      } else if (baselineData.hash !== currentData.hash) {
        // 更新案件
        updatedIds.push(id);
      } else {
        // 変更なし
        unchangedCount++;
      }
    }

    // 削除検出
    for (const [id] of this.baselineSnapshot) {
      if (!this.currentSnapshot.has(id)) {
        deletedIds.push(id);
      }
    }

    console.log(`🆕 新規案件: ${newIds.length}件`);
    console.log(`🔄 更新案件: ${updatedIds.length}件`);
    console.log(`🗑️ 削除案件: ${deletedIds.length}件`);
    console.log(`✅ 変更なし: ${unchangedCount}件`);

    this.results.differenceIds = { newIds, updatedIds, deletedIds };
    this.results.unchangedCount = unchangedCount;
    this.results.stats.differenceCount = newIds.length + updatedIds.length + deletedIds.length;
  }

  /**
   * 差分詳細データ取得
   */
  async fetchDifferenceDetails() {
    console.log('\n📊 Step 4: 差分詳細データ取得');
    console.log('-'.repeat(40));

    const { newIds, updatedIds, deletedIds } = this.results.differenceIds;
    
    // 新規案件詳細取得
    if (newIds.length > 0) {
      console.log(`🆕 新規案件詳細取得: ${newIds.length}件`);
      for (const id of newIds) {
        const campaign = this.currentSnapshot.get(id)?.campaign;
        if (campaign) {
          this.results.newCampaigns.push(campaign);
        }
      }
    }

    // 更新案件詳細取得
    if (updatedIds.length > 0) {
      console.log(`🔄 更新案件詳細取得: ${updatedIds.length}件`);
      for (const id of updatedIds) {
        const currentCampaign = this.currentSnapshot.get(id)?.campaign;
        const baselineCampaign = this.baselineSnapshot.get(id)?.campaign;
        
        if (currentCampaign && baselineCampaign) {
          this.results.updatedCampaigns.push({
            before: baselineCampaign,
            after: currentCampaign,
            changes: this.detectCampaignChanges(baselineCampaign, currentCampaign)
          });
        }
      }
    }

    // 削除案件記録
    if (deletedIds.length > 0) {
      console.log(`🗑️ 削除案件記録: ${deletedIds.length}件`);
      for (const id of deletedIds) {
        const campaign = this.baselineSnapshot.get(id)?.campaign;
        if (campaign) {
          this.results.deletedCampaigns.push(campaign);
        }
      }
    }

    console.log('✅ 差分詳細データ取得完了');
  }

  /**
   * 案件ハッシュ生成
   */
  createCampaignHash(campaign) {
    const key = `${campaign.id}|${campaign.title || campaign.name}|${campaign.points}|${campaign.platform || 'web'}`;
    return crypto.createHash(this.config.hashAlgorithm).update(key).digest('hex');
  }

  /**
   * 案件変更内容検出
   */
  detectCampaignChanges(before, after) {
    const changes = [];
    
    if (before.title !== after.title || before.name !== after.name) {
      changes.push('title');
    }
    if (before.points !== after.points) {
      changes.push('points');
    }
    if (before.platform !== after.platform) {
      changes.push('platform');
    }
    
    return changes;
  }

  /**
   * 結果保存
   */
  async saveResults() {
    console.log('\n💾 Step 5: 結果保存');
    console.log('-'.repeat(40));

    const resultData = {
      timestamp: new Date().toISOString(),
      systemInfo: {
        version: '1.0',
        mode: 'differential',
        baselineFile: this.config.baselineFile,
        processingTime: this.results.stats.processingTime
      },
      summary: {
        totalScanned: this.results.stats.totalScanned,
        newCampaigns: this.results.newCampaigns.length,
        updatedCampaigns: this.results.updatedCampaigns.length,
        deletedCampaigns: this.results.deletedCampaigns.length,
        unchangedCampaigns: this.results.unchangedCount,
        differenceCount: this.results.stats.differenceCount
      },
      differences: {
        new: this.results.newCampaigns,
        updated: this.results.updatedCampaigns,
        deleted: this.results.deletedCampaigns
      }
    };

    await fs.writeFile(this.deltaFile, JSON.stringify(resultData, null, 2));
    console.log(`✅ 差分結果保存: ${path.basename(this.deltaFile)}`);
  }

  /**
   * レポート生成
   */
  async generateReport() {
    console.log('\n📋 差分取得完了レポート');
    console.log('='.repeat(60));

    const processingMinutes = Math.round(this.results.stats.processingTime / 1000 / 60 * 10) / 10;
    
    console.log(`⏱️ 処理時間: ${processingMinutes}分`);
    console.log(`🔍 スキャン総数: ${this.results.stats.totalScanned}件`);
    console.log(`🔄 差分検出: ${this.results.stats.differenceCount}件`);
    
    console.log(`\n📊 差分内訳:`);
    console.log(`   🆕 新規: ${this.results.newCampaigns.length}件`);
    console.log(`   🔄 更新: ${this.results.updatedCampaigns.length}件`);
    console.log(`   🗑️ 削除: ${this.results.deletedCampaigns.length}件`);
    console.log(`   ✅ 変更なし: ${this.results.unchangedCount}件`);

    if (this.results.stats.differenceCount === 0) {
      console.log('\n🎉 変更なし - データは最新状態です');
    } else {
      console.log(`\n🚀 ${this.results.stats.differenceCount}件の変更を検出しました`);
      console.log('💡 次のステップ: convert_v3_to_search_data.js で検索データを更新');
    }

    // 効率レポート
    const efficiencyRatio = this.results.unchangedCount / this.results.stats.totalScanned * 100;
    console.log(`\n⚡ 効率性: ${efficiencyRatio.toFixed(1)}%のデータが変更なし`);
    
    if (processingMinutes < 15) {
      console.log('🏆 目標達成: 15分以内での差分検出完了');
    }
  }

  /**
   * スリープ関数
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 実行
async function main() {
  const system = new ChobirichDifferentialSystem();
  
  try {
    await system.execute();
    process.exit(0);
  } catch (error) {
    console.error('💥 差分取得失敗:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = ChobirichDifferentialSystem;