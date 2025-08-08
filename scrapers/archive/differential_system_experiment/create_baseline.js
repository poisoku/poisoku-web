#!/usr/bin/env node

/**
 * ちょびリッチ差分取得システム用ベースライン作成
 * v3完全取得データからベースラインハッシュデータを生成
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class BaselineCreator {
  constructor() {
    this.v3DataFile = path.join(__dirname, 'data', 'chobirich_production_complete_v3.json');
    this.baselineFile = path.join(__dirname, 'data', 'chobirich_baseline.json');
  }

  async execute() {
    console.log('🏗️ ちょびリッチ差分取得用ベースライン作成');
    console.log('='.repeat(60));

    try {
      // v3データ読み込み
      const v3Data = await this.loadV3Data();
      
      // ベースライン生成
      const baseline = await this.createBaseline(v3Data);
      
      // 保存
      await this.saveBaseline(baseline);
      
      console.log('\n✅ ベースライン作成完了!');
      console.log('🚀 差分取得システムが利用可能になりました');
      
    } catch (error) {
      console.error('💥 ベースライン作成エラー:', error);
      throw error;
    }
  }

  /**
   * v3データ読み込み
   */
  async loadV3Data() {
    console.log('📂 v3完全取得データ読み込み中...');
    
    try {
      const data = await fs.readFile(this.v3DataFile, 'utf8');
      const v3Data = JSON.parse(data);
      
      console.log(`✅ v3データ読み込み完了: ${v3Data.totalCampaigns}件`);
      return v3Data;
      
    } catch (error) {
      console.error('❌ v3データが見つかりません');
      console.error('💡 まず complete_chobirich_system_v3.js を実行してください');
      throw error;
    }
  }

  /**
   * ベースライン生成
   */
  async createBaseline(v3Data) {
    console.log('🧬 ベースラインハッシュ生成中...');
    
    const campaigns = [];
    const hashMap = new Map();
    
    for (const campaign of v3Data.campaigns) {
      // 統一IDでハッシュ生成
      const normalizedCampaign = {
        id: campaign.id,
        title: campaign.title || campaign.name,
        points: campaign.points,
        platform: campaign.platform || 'web',
        url: campaign.url,
        category: campaign.category || 'unknown'
      };
      
      const hash = this.createCampaignHash(normalizedCampaign);
      
      campaigns.push({
        ...normalizedCampaign,
        hash,
        lastUpdated: v3Data.lastUpdated
      });
      
      hashMap.set(campaign.id, hash);
    }
    
    console.log(`✅ ハッシュ生成完了: ${campaigns.length}件`);
    console.log(`   重複排除: ${hashMap.size}ユニークID`);
    
    return {
      version: '1.0',
      created: new Date().toISOString(),
      sourceFile: 'chobirich_production_complete_v3.json',
      sourceTimestamp: v3Data.lastUpdated,
      totalCampaigns: campaigns.length,
      campaigns,
      hashMap: Object.fromEntries(hashMap)
    };
  }

  /**
   * 案件ハッシュ生成
   */
  createCampaignHash(campaign) {
    const key = `${campaign.id}|${campaign.title}|${campaign.points}|${campaign.platform}`;
    return crypto.createHash('md5').update(key).digest('hex');
  }

  /**
   * ベースライン保存
   */
  async saveBaseline(baseline) {
    console.log('💾 ベースライン保存中...');
    
    await fs.writeFile(this.baselineFile, JSON.stringify(baseline, null, 2));
    
    const fileSizeMB = (JSON.stringify(baseline).length / 1024 / 1024).toFixed(2);
    console.log(`✅ ベースライン保存完了`);
    console.log(`   ファイル: ${path.basename(this.baselineFile)}`);
    console.log(`   サイズ: ${fileSizeMB}MB`);
    console.log(`   ハッシュエントリ: ${baseline.totalCampaigns}件`);
  }
}

// 実行
async function main() {
  const creator = new BaselineCreator();
  
  try {
    await creator.execute();
    process.exit(0);
  } catch (error) {
    console.error('💥 実行失敗:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = BaselineCreator;