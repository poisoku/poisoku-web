#!/usr/bin/env node

/**
 * ちょびリッチハイブリッド差分取得システム v2.1  
 * v3完全取得 + 差分検出のハイブリッド方式
 * 
 * 戦略:
 * 1. v3システムで完全取得（確実に全件取得）
 * 2. ベースラインとの差分検出
 * 3. 変更のみを特定して効率的に処理
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

class HybridDifferentialSystem {
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
        processingTime: 0,
        v3ExecutionTime: 0,
        diffAnalysisTime: 0
      }
    };
    
    this.config = {
      baselineFile: 'chobirich_baseline.json',
      v3OutputFile: 'chobirich_production_complete_v3.json',
      deltaOutputFile: 'chobirich_hybrid_delta.json'
    };
    
    this.baselineFile = path.join(__dirname, 'data', this.config.baselineFile);
    this.v3File = path.join(__dirname, 'data', this.config.v3OutputFile);
    this.deltaFile = path.join(__dirname, 'data', this.config.deltaOutputFile);
    this.currentSnapshot = new Map();
    this.baselineSnapshot = new Map();
  }

  /**
   * メイン実行
   */
  async execute() {
    console.log('🔄 ちょびリッチハイブリッド差分取得システム v2.1');
    console.log('='.repeat(70));
    console.log('🎯 ハイブリッド戦略:');
    console.log('   1️⃣ v3完全取得で100%確実に全データ取得');
    console.log('   2️⃣ ベースラインとの高速差分検出');
    console.log('   3️⃣ 変更のみを効率的に処理・反映');
    console.log('   ⏱️ 予想時間: v3取得45分 + 差分解析30秒');
    console.log('');

    this.results.stats.startTime = new Date();

    try {
      // Step 1: ベースライン確認・読み込み
      await this.loadBaseline();
      
      // Step 2: v3完全取得実行
      await this.executeV3System();
      
      // Step 3: v3結果読み込み
      await this.loadV3Results();
      
      // Step 4: 高速差分検出
      await this.performRapidDifferentialAnalysis();
      
      // Step 5: 結果保存・レポート
      await this.saveResults();
      await this.generateReport();

    } catch (error) {
      console.error('💥 ハイブリッド差分取得エラー:', error);
      throw error;
    } finally {
      this.results.stats.endTime = new Date();
      this.results.stats.processingTime = 
        this.results.stats.endTime - this.results.stats.startTime;
    }
  }

  /**
   * ベースライン読み込み
   */
  async loadBaseline() {
    console.log('📂 Step 1: ベースライン確認・読み込み');
    console.log('-'.repeat(50));

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
      console.log(`   作成日時: ${baseline.created}`);
      console.log(`   ハッシュマップ生成: ${this.baselineSnapshot.size}件`);
      
    } catch (error) {
      console.log('⚠️ ベースラインなし（初回実行）');
      console.log('💡 初回実行後にベースライン自動生成されます');
    }
  }

  /**
   * v3完全取得実行
   */
  async executeV3System() {
    console.log('\\n⚡ Step 2: v3完全取得システム実行');
    console.log('-'.repeat(50));
    console.log('🚀 complete_chobirich_system_v3.js 実行中...');
    console.log('   ⏱️ 予想時間: 40-50分（全案件確実取得）');
    console.log('');

    const v3StartTime = Date.now();

    return new Promise((resolve, reject) => {
      const child = spawn('node', ['complete_chobirich_system_v3.js'], {
        cwd: __dirname,
        stdio: ['inherit', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      child.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        // リアルタイム進捗表示
        const lines = text.split('\\n').filter(line => line.trim());
        lines.forEach(line => {
          if (line.includes('✅') || line.includes('📊') || line.includes('🎯')) {
            console.log(`   ${line}`);
          }
        });
      });

      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', (code) => {
        this.results.stats.v3ExecutionTime = Date.now() - v3StartTime;
        const v3Minutes = Math.round(this.results.stats.v3ExecutionTime / 1000 / 60 * 10) / 10;
        
        console.log(`\\n⏱️ v3取得完了: ${v3Minutes}分`);
        
        if (code === 0) {
          console.log('✅ v3完全取得成功');
          resolve();
        } else {
          console.error('❌ v3完全取得失敗');
          console.error('エラー出力:', errorOutput);
          reject(new Error(`v3システム終了コード: ${code}`));
        }
      });

      child.on('error', (error) => {
        reject(new Error(`v3システム実行エラー: ${error.message}`));
      });
    });
  }

  /**
   * v3結果読み込み
   */
  async loadV3Results() {
    console.log('\\n📊 Step 3: v3結果読み込み・解析');
    console.log('-'.repeat(50));

    try {
      const data = await fs.readFile(this.v3File, 'utf8');
      const v3Data = JSON.parse(data);
      
      console.log(`✅ v3結果読み込み完了: ${v3Data.totalCampaigns}件`);
      console.log(`   Web案件: ${v3Data.systemInfo.webCampaigns}件`);
      console.log(`   iOS案件: ${v3Data.systemInfo.iosCampaigns}件`);
      console.log(`   Android案件: ${v3Data.systemInfo.androidCampaigns}件`);
      
      // 現在スナップショット生成
      v3Data.campaigns.forEach(campaign => {
        const normalizedCampaign = {
          id: campaign.id,
          title: campaign.title || campaign.name,
          points: campaign.points,
          platform: campaign.platform || 'web',
          url: campaign.url,
          category: campaign.category || 'unknown'
        };
        
        const hash = this.createCampaignHash(normalizedCampaign);
        this.currentSnapshot.set(campaign.id, {
          hash,
          campaign: normalizedCampaign
        });
      });
      
      this.results.stats.totalScanned = v3Data.totalCampaigns;
      console.log(`   ハッシュマップ生成: ${this.currentSnapshot.size}件`);
      
    } catch (error) {
      console.error('❌ v3結果読み込み失敗:', error.message);
      throw error;
    }
  }

  /**
   * 高速差分検出
   */
  async performRapidDifferentialAnalysis() {
    console.log('\\n🧬 Step 4: 高速差分検出');
    console.log('-'.repeat(50));

    const diffStartTime = Date.now();
    
    const newIds = [];
    const updatedIds = [];
    const deletedIds = [];
    let unchangedCount = 0;

    console.log('🔍 新規・更新検出中...');
    
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

    console.log('🔍 削除検出中...');
    
    // 削除検出
    for (const [id] of this.baselineSnapshot) {
      if (!this.currentSnapshot.has(id)) {
        deletedIds.push(id);
      }
    }

    this.results.stats.diffAnalysisTime = Date.now() - diffStartTime;
    const diffSeconds = (this.results.stats.diffAnalysisTime / 1000).toFixed(1);

    console.log(`\\n✅ 差分検出完了（${diffSeconds}秒）`);
    console.log(`🆕 新規案件: ${newIds.length}件`);
    console.log(`🔄 更新案件: ${updatedIds.length}件`);
    console.log(`🗑️ 削除案件: ${deletedIds.length}件`);
    console.log(`✅ 変更なし: ${unchangedCount}件`);

    // 取得率計算
    const totalExpected = this.baselineSnapshot.size || this.currentSnapshot.size;
    const totalFound = this.currentSnapshot.size;
    const recoveryRate = totalExpected > 0 ? ((totalFound / totalExpected) * 100).toFixed(1) : '100.0';
    
    console.log(`\\n📊 取得率: ${recoveryRate}% (${totalFound}/${totalExpected})`);

    // 差分詳細データ生成
    await this.generateDifferenceDetails(newIds, updatedIds, deletedIds);
    
    this.results.unchangedCount = unchangedCount;
    this.results.stats.differenceCount = newIds.length + updatedIds.length + deletedIds.length;
  }

  /**
   * 差分詳細データ生成
   */
  async generateDifferenceDetails(newIds, updatedIds, deletedIds) {
    console.log('\\n📋 差分詳細データ生成中...');
    
    // 新規案件
    for (const id of newIds) {
      const campaign = this.currentSnapshot.get(id)?.campaign;
      if (campaign) {
        this.results.newCampaigns.push(campaign);
      }
    }

    // 更新案件
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

    // 削除案件
    for (const id of deletedIds) {
      const campaign = this.baselineSnapshot.get(id)?.campaign;
      if (campaign) {
        this.results.deletedCampaigns.push(campaign);
      }
    }

    console.log('✅ 差分詳細データ生成完了');
  }

  /**
   * 案件ハッシュ生成
   */
  createCampaignHash(campaign) {
    const key = `${campaign.id}|${campaign.title}|${campaign.points}|${campaign.platform}`;
    return crypto.createHash('md5').update(key).digest('hex');
  }

  /**
   * 案件変更内容検出
   */
  detectCampaignChanges(before, after) {
    const changes = [];
    
    if (before.title !== after.title) {
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
    console.log('\\n💾 Step 5: 結果保存');
    console.log('-'.repeat(50));

    const totalExpected = this.baselineSnapshot.size || this.currentSnapshot.size;
    const recoveryRate = totalExpected > 0 ? 
      ((this.results.stats.totalScanned / totalExpected) * 100).toFixed(1) : '100.0';

    const resultData = {
      timestamp: new Date().toISOString(),
      systemInfo: {
        version: '2.1',
        mode: 'hybrid_differential',
        baselineFile: this.config.baselineFile,
        v3ExecutionTime: this.results.stats.v3ExecutionTime,
        diffAnalysisTime: this.results.stats.diffAnalysisTime,
        totalProcessingTime: this.results.stats.processingTime
      },
      summary: {
        totalScanned: this.results.stats.totalScanned,
        newCampaigns: this.results.newCampaigns.length,
        updatedCampaigns: this.results.updatedCampaigns.length,
        deletedCampaigns: this.results.deletedCampaigns.length,
        unchangedCampaigns: this.results.unchangedCount,
        differenceCount: this.results.stats.differenceCount,
        recoveryRate: parseFloat(recoveryRate)
      },
      differences: {
        new: this.results.newCampaigns,
        updated: this.results.updatedCampaigns,
        deleted: this.results.deletedCampaigns
      }
    };

    await fs.writeFile(this.deltaFile, JSON.stringify(resultData, null, 2));
    console.log(`✅ ハイブリッド差分結果保存: ${path.basename(this.deltaFile)}`);
  }

  /**
   * レポート生成
   */
  async generateReport() {
    console.log('\\n📋 ハイブリッド差分取得完了レポート');
    console.log('='.repeat(70));

    const totalMinutes = Math.round(this.results.stats.processingTime / 1000 / 60 * 10) / 10;
    const v3Minutes = Math.round(this.results.stats.v3ExecutionTime / 1000 / 60 * 10) / 10;
    const diffSeconds = (this.results.stats.diffAnalysisTime / 1000).toFixed(1);
    
    const totalExpected = this.baselineSnapshot.size || this.results.stats.totalScanned;
    const recoveryRate = totalExpected > 0 ? 
      ((this.results.stats.totalScanned / totalExpected) * 100).toFixed(1) : '100.0';
    
    console.log(`⏱️ 総処理時間: ${totalMinutes}分`);
    console.log(`   v3完全取得: ${v3Minutes}分`);
    console.log(`   差分解析: ${diffSeconds}秒`);
    console.log(`🔍 スキャン総数: ${this.results.stats.totalScanned}件`);
    console.log(`📊 取得率: ${recoveryRate}%`);
    console.log(`🔄 差分検出: ${this.results.stats.differenceCount}件`);
    
    console.log(`\\n📊 差分詳細内訳:`);
    console.log(`   🆕 新規: ${this.results.newCampaigns.length}件`);
    console.log(`   🔄 更新: ${this.results.updatedCampaigns.length}件`);
    console.log(`   🗑️ 削除: ${this.results.deletedCampaigns.length}件`);
    console.log(`   ✅ 変更なし: ${this.results.unchangedCount}件`);

    // 成功判定
    if (parseFloat(recoveryRate) >= 99) {
      console.log('\\n🏆 完全成功: 99%以上の取得率を達成');
    } else if (parseFloat(recoveryRate) >= 95) {
      console.log('\\n✅ 成功: 95%以上の取得率を達成');
    } else {
      console.log('\\n⚠️ 要改善: 95%未満の取得率');
    }

    if (this.results.stats.differenceCount === 0) {
      console.log('\\n🎉 変更なし - データは最新状態です');
    } else {
      console.log(`\\n🚀 ${this.results.stats.differenceCount}件の変更を検出しました`);
      
      // 主要な変更をサンプル表示
      if (this.results.newCampaigns.length > 0) {
        console.log('\\n🆕 新規案件サンプル:');
        this.results.newCampaigns.slice(0, 3).forEach((campaign, i) => {
          console.log(`   ${i+1}. ${campaign.title} (${campaign.points})`);
        });
      }
      
      if (this.results.updatedCampaigns.length > 0) {
        console.log('\\n🔄 更新案件サンプル:');
        this.results.updatedCampaigns.slice(0, 3).forEach((update, i) => {
          console.log(`   ${i+1}. ${update.after.title}`);
          console.log(`      ${update.before.points} → ${update.after.points}`);
        });
      }
    }

    // 次回ベースライン更新の提案
    if (this.results.stats.differenceCount > 0) {
      console.log('\\n💡 次のステップ:');
      console.log('   1. create_baseline.js でベースライン更新');
      console.log('   2. convert_v3_to_search_data.js で検索データ更新');
      console.log('   3. Vercelにデプロイして本番反映');
    }
  }
}

// 実行
async function main() {
  const system = new HybridDifferentialSystem();
  
  try {
    await system.execute();
    console.log('\\n🎉 ハイブリッド差分取得完了');
    process.exit(0);
  } catch (error) {
    console.error('💥 ハイブリッド差分取得失敗:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = HybridDifferentialSystem;