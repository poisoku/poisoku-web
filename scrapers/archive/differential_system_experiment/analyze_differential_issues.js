#!/usr/bin/env node

/**
 * 差分取得システムの問題分析ツール
 * ベースライン vs 現在取得データの詳細比較
 */

const fs = require('fs').promises;
const path = require('path');

class DifferentialAnalyzer {
  constructor() {
    this.baselineFile = path.join(__dirname, 'data', 'chobirich_baseline.json');
    this.deltaFile = path.join(__dirname, 'data', 'chobirich_delta.json');
    this.v3File = path.join(__dirname, 'data', 'chobirich_production_complete_v3.json');
  }

  async analyze() {
    console.log('🔍 差分取得システム問題分析');
    console.log('='.repeat(60));

    try {
      // データ読み込み
      const baseline = JSON.parse(await fs.readFile(this.baselineFile, 'utf8'));
      const delta = JSON.parse(await fs.readFile(this.deltaFile, 'utf8'));
      const v3Data = JSON.parse(await fs.readFile(this.v3File, 'utf8'));

      // 基本統計
      console.log('📊 基本統計:');
      console.log(`   ベースライン: ${baseline.totalCampaigns}件`);
      console.log(`   現在スキャン: ${delta.summary.totalScanned}件`);
      console.log(`   v3完全データ: ${v3Data.totalCampaigns}件`);
      
      // 取得漏れ分析
      await this.analyzeMissingCampaigns(baseline, delta);
      
      // カテゴリ別分析
      await this.analyzeCategoryBreakdown(baseline, v3Data);
      
      // プラットフォーム別分析
      await this.analyzePlatformBreakdown(baseline, v3Data);
      
      // サンプル比較
      await this.analyzeSampleComparison(baseline, delta);

    } catch (error) {
      console.error('💥 分析エラー:', error);
    }
  }

  /**
   * 取得漏れ分析
   */
  async analyzeMissingCampaigns(baseline, delta) {
    console.log('\n🕳️ 取得漏れ分析:');
    console.log('-'.repeat(40));

    // ベースラインのID一覧
    const baselineIds = new Set(baseline.campaigns.map(c => c.id));
    
    // 現在取得のID一覧（新規 + 更新 + 変更なし）
    const currentIds = new Set();
    
    // 新規案件ID
    delta.differences.new.forEach(c => currentIds.add(c.id));
    
    // 更新案件ID（afterのID）
    delta.differences.updated.forEach(update => currentIds.add(update.after.id));
    
    // 削除でない案件ID = 変更なし + 新規 + 更新
    const unchangedCount = delta.summary.unchangedCampaigns;
    const estimatedUnchangedIds = baseline.totalCampaigns - delta.differences.deleted.length;
    
    console.log(`✅ 現在取得成功ID: ${currentIds.size}件`);
    console.log(`❌ ベースラインで未検出: ${baselineIds.size - currentIds.size}件`);
    
    // 取得漏れの詳細分析
    const missingIds = [];
    for (const id of baselineIds) {
      if (!currentIds.has(id)) {
        const baselineCampaign = baseline.campaigns.find(c => c.id === id);
        if (baselineCampaign) {
          missingIds.push(baselineCampaign);
        }
      }
    }

    console.log(`🔍 取得漏れサンプル（最初の10件）:`);
    missingIds.slice(0, 10).forEach((campaign, i) => {
      console.log(`   ${i+1}. ID:${campaign.id} - ${campaign.title} (${campaign.platform})`);
    });

    // プラットフォーム別取得漏れ
    const missingByPlatform = {};
    missingIds.forEach(campaign => {
      missingByPlatform[campaign.platform] = (missingByPlatform[campaign.platform] || 0) + 1;
    });

    console.log(`\n📱 プラットフォーム別取得漏れ:`);
    Object.entries(missingByPlatform).forEach(([platform, count]) => {
      console.log(`   ${platform}: ${count}件`);
    });
  }

  /**
   * カテゴリ別分析
   */
  async analyzeCategoryBreakdown(baseline, v3Data) {
    console.log('\n📂 カテゴリ別分析:');
    console.log('-'.repeat(40));

    // v3データからカテゴリ情報取得
    const categoryBreakdown = {};
    
    v3Data.campaigns.forEach(campaign => {
      const category = campaign.category || campaign.platform || 'unknown';
      categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1;
    });

    console.log('v3完全取得データのカテゴリ内訳:');
    Object.entries(categoryBreakdown)
      .sort(([,a], [,b]) => b - a)
      .forEach(([category, count]) => {
        console.log(`   ${category}: ${count}件`);
      });
  }

  /**
   * プラットフォーム別分析
   */
  async analyzePlatformBreakdown(baseline, v3Data) {
    console.log('\n📱 プラットフォーム別分析:');
    console.log('-'.repeat(40));

    const platformBreakdown = {};
    
    v3Data.campaigns.forEach(campaign => {
      const platform = campaign.platform || 'web';
      platformBreakdown[platform] = (platformBreakdown[platform] || 0) + 1;
    });

    console.log('v3完全取得データのプラットフォーム内訳:');
    Object.entries(platformBreakdown)
      .sort(([,a], [,b]) => b - a)
      .forEach(([platform, count]) => {
        console.log(`   ${platform}: ${count}件`);
      });

    // モバイル案件の詳細
    const mobileCampaigns = v3Data.campaigns.filter(c => c.platform && c.platform !== 'web');
    console.log(`\n📱 モバイル案件詳細（最初の5件）:`);
    mobileCampaigns.slice(0, 5).forEach((campaign, i) => {
      console.log(`   ${i+1}. ${campaign.title} (${campaign.platform}) - ${campaign.points}`);
    });
  }

  /**
   * サンプル比較
   */
  async analyzeSampleComparison(baseline, delta) {
    console.log('\n🔬 サンプル比較分析:');
    console.log('-'.repeat(40));

    // 新規案件サンプル
    console.log('🆕 新規案件サンプル:');
    delta.differences.new.slice(0, 3).forEach((campaign, i) => {
      console.log(`   ${i+1}. ID:${campaign.id} - ${campaign.title}`);
      console.log(`      Points: ${campaign.points} | Platform: ${campaign.platform}`);
    });

    // 更新案件サンプル
    console.log('\n🔄 更新案件サンプル:');
    delta.differences.updated.slice(0, 3).forEach((update, i) => {
      console.log(`   ${i+1}. ID:${update.after.id} - ${update.after.title}`);
      console.log(`      Before: ${update.before.points} → After: ${update.after.points}`);
      console.log(`      Changes: ${update.changes.join(', ')}`);
    });

    // 削除案件サンプル（疑わしいもの）
    console.log('\n🗑️ 削除案件サンプル（疑わしい）:');
    delta.differences.deleted.slice(0, 5).forEach((campaign, i) => {
      console.log(`   ${i+1}. ID:${campaign.id} - ${campaign.title}`);
      console.log(`      Platform: ${campaign.platform} | Points: ${campaign.points}`);
    });
  }
}

// 実行
async function main() {
  const analyzer = new DifferentialAnalyzer();
  
  try {
    await analyzer.analyze();
    console.log('\n✅ 分析完了');
    
    console.log('\n💡 推奨対策:');
    console.log('   1. モバイル案件取得の修正');
    console.log('   2. 複数ページスキャンの実装');
    console.log('   3. 軽量スクレイパーのセレクタ改善');
    console.log('   4. ID一致ロジックの検証');
    
  } catch (error) {
    console.error('💥 実行失敗:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}