const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * 差分取得システム管理クラス
 */
class DifferentialManager {
  constructor() {
    this.previousData = null;
    this.currentData = [];
    this.hashMap = new Map();
    this.dataDir = path.join(__dirname, '../../data');
    this.hashFile = path.join(this.dataDir, 'campaign_hashes.json');
  }

  /**
   * 前回のデータを読み込み
   */
  async loadPreviousData() {
    try {
      const hashData = await fs.readFile(this.hashFile, 'utf8');
      const parsed = JSON.parse(hashData);
      
      this.previousData = parsed.campaigns || [];
      
      // ハッシュマップを構築
      this.previousData.forEach(campaign => {
        if (campaign.id && campaign.hash) {
          this.hashMap.set(campaign.id, campaign.hash);
        }
      });
      
      console.log(`📚 前回データ読み込み: ${this.previousData.length}件`);
      return true;
      
    } catch (error) {
      console.log('📝 前回データなし。初回実行として処理します');
      return false;
    }
  }

  /**
   * キャンペーンデータのハッシュ生成
   */
  createHash(campaign) {
    const key = `${campaign.title || ''}|${campaign.points || ''}|${campaign.condition || ''}|${campaign.description || ''}`;
    return crypto.createHash('md5').update(key).digest('hex');
  }

  /**
   * 差分を検出
   */
  detectChanges(newCampaigns) {
    const result = {
      newCampaigns: [],
      changedCampaigns: [],
      unchangedCampaigns: [],
      removedCampaigns: []
    };

    // 現在のキャンペーンを処理
    const currentIds = new Set();
    
    newCampaigns.forEach(campaign => {
      currentIds.add(campaign.id);
      const newHash = this.createHash(campaign);
      const previousHash = this.hashMap.get(campaign.id);
      
      if (!previousHash) {
        // 新規キャンペーン
        result.newCampaigns.push({
          ...campaign,
          hash: newHash,
          changeType: 'new'
        });
      } else if (previousHash !== newHash) {
        // 変更されたキャンペーン
        result.changedCampaigns.push({
          ...campaign,
          hash: newHash,
          changeType: 'changed',
          previousHash: previousHash
        });
      } else {
        // 変更なし
        result.unchangedCampaigns.push({
          ...campaign,
          hash: newHash,
          changeType: 'unchanged'
        });
      }
    });

    // 削除されたキャンペーンを検出
    if (this.previousData) {
      this.previousData.forEach(prevCampaign => {
        if (!currentIds.has(prevCampaign.id)) {
          result.removedCampaigns.push({
            ...prevCampaign,
            changeType: 'removed'
          });
        }
      });
    }

    return result;
  }

  /**
   * 差分結果の保存
   */
  async saveDifferentialResult(changes) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // すべてのキャンペーンデータを統合（新規 + 変更 + 変更なし）
    const allCampaigns = [
      ...changes.newCampaigns,
      ...changes.changedCampaigns,
      ...changes.unchangedCampaigns
    ];

    // ハッシュファイルを更新
    const hashData = {
      lastUpdate: new Date().toISOString(),
      totalCampaigns: allCampaigns.length,
      campaigns: allCampaigns.map(c => ({
        id: c.id,
        hash: c.hash,
        title: c.title,
        lastUpdated: c.changeType === 'unchanged' ? c.lastUpdated : new Date().toISOString()
      }))
    };

    await fs.writeFile(this.hashFile, JSON.stringify(hashData, null, 2));

    // 差分レポートを保存
    const diffReport = {
      timestamp: new Date().toISOString(),
      summary: {
        total: allCampaigns.length,
        new: changes.newCampaigns.length,
        changed: changes.changedCampaigns.length,
        unchanged: changes.unchangedCampaigns.length,
        removed: changes.removedCampaigns.length
      },
      changes: changes,
      allCampaigns: allCampaigns
    };

    const reportFile = path.join(this.dataDir, `differential_${timestamp}.json`);
    await fs.writeFile(reportFile, JSON.stringify(diffReport, null, 2));

    console.log(`💾 差分結果保存: ${path.basename(reportFile)}`);
    
    return diffReport;
  }

  /**
   * 差分統計の表示
   */
  displayDifferentialStats(changes) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 差分取得結果');
    console.log('='.repeat(60));
    console.log(`🆕 新規キャンペーン: ${changes.newCampaigns.length}件`);
    console.log(`🔄 変更キャンペーン: ${changes.changedCampaigns.length}件`);
    console.log(`✅ 変更なし: ${changes.unchangedCampaigns.length}件`);
    console.log(`❌ 削除キャンペーン: ${changes.removedCampaigns.length}件`);
    
    const totalProcessed = changes.newCampaigns.length + changes.changedCampaigns.length;
    const totalExisting = changes.unchangedCampaigns.length + totalProcessed;
    
    if (totalExisting > 0) {
      const efficiencyRate = ((totalExisting - totalProcessed) / totalExisting * 100).toFixed(1);
      console.log(`⚡ 効率化率: ${efficiencyRate}% (${totalProcessed}/${totalExisting}件のみ処理)`);
    }

    // 新規キャンペーンの詳細
    if (changes.newCampaigns.length > 0 && changes.newCampaigns.length <= 10) {
      console.log('\n🆕 新規キャンペーン詳細:');
      changes.newCampaigns.forEach(campaign => {
        console.log(`  • ${campaign.title} (ID: ${campaign.id})`);
        if (campaign.points) console.log(`    ポイント: ${campaign.points}`);
      });
    }

    // 変更されたキャンペーンの詳細
    if (changes.changedCampaigns.length > 0 && changes.changedCampaigns.length <= 10) {
      console.log('\n🔄 変更キャンペーン詳細:');
      changes.changedCampaigns.forEach(campaign => {
        console.log(`  • ${campaign.title} (ID: ${campaign.id})`);
        if (campaign.points) console.log(`    ポイント: ${campaign.points}`);
      });
    }
  }

  /**
   * 差分取得が必要なキャンペーンIDリストを取得
   */
  getCampaignIdsToProcess(campaignList) {
    if (!this.previousData) {
      // 初回実行時は全件処理
      return campaignList.map(c => c.id);
    }

    const needProcessing = [];
    
    campaignList.forEach(campaign => {
      const previousHash = this.hashMap.get(campaign.id);
      if (!previousHash) {
        // 新規キャンペーン
        needProcessing.push(campaign.id);
      } else {
        // 既存キャンペーンは軽量チェックのみ
        const quickHash = this.createHash({
          title: campaign.title,
          points: '',  // 軽量チェック時はポイント情報なし
          condition: '',
          description: ''
        });
        if (previousHash !== quickHash) {
          needProcessing.push(campaign.id);
        }
      }
    });

    return needProcessing;
  }

  /**
   * 差分取得モードかどうか判定
   */
  isDifferentialMode() {
    return this.previousData !== null && this.previousData.length > 0;
  }

  /**
   * データディレクトリの初期化
   */
  async ensureDataDirectory() {
    try {
      await fs.access(this.dataDir);
    } catch {
      await fs.mkdir(this.dataDir, { recursive: true });
      console.log('📁 データディレクトリを作成しました');
    }
  }
}

module.exports = DifferentialManager;