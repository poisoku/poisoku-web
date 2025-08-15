#!/usr/bin/env node

/**
 * モッピーデータをポイ速検索システムに統合
 * 2025-08-15
 */

const fs = require('fs').promises;
const path = require('path');

class MoppyDataIntegrator {
  constructor() {
    this.searchDataPath = path.join(__dirname, '..', 'public', 'search-data.json');
    this.moppyDataPath = path.join(__dirname, '..', 'scrapers', 'data', 'moppy');
  }

  /**
   * 最新のモッピーデータファイルを取得
   */
  async getLatestMoppyData() {
    try {
      const files = await fs.readdir(this.moppyDataPath);
      const moppyFiles = files
        .filter(f => f.includes('moppy_production_optimized_') && f.endsWith('.json'))
        .sort((a, b) => b.localeCompare(a)); // 最新順

      if (moppyFiles.length === 0) {
        throw new Error('モッピーデータファイルが見つかりません');
      }

      const latestFile = path.join(this.moppyDataPath, moppyFiles[0]);
      console.log(`📄 最新モッピーデータ: ${moppyFiles[0]}`);
      
      const content = await fs.readFile(latestFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error('モッピーデータ読込エラー:', error);
      throw error;
    }
  }

  /**
   * 既存の検索データを読み込み
   */
  async loadSearchData() {
    try {
      const content = await fs.readFile(this.searchDataPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error('検索データ読込エラー:', error);
      throw error;
    }
  }

  /**
   * モッピーキャンペーンをポイ速形式に変換
   */
  convertMoppyCampaign(campaign) {
    // ポイント情報の変換
    let cashback = null;
    let cashbackYen = null;

    if (campaign.points) {
      const pointStr = campaign.points.toString();
      
      if (pointStr.includes('%') || pointStr.includes('％')) {
        // パーセント表記
        cashback = pointStr;
      } else if (pointStr.includes('P') || pointStr.includes('p') || pointStr.includes('ポイント')) {
        // ポイント表記 → 円換算（モッピーは1pt=1円）
        const pointMatch = pointStr.match(/(\d{1,6}(?:,\d{3})*)/);
        if (pointMatch) {
          const points = parseInt(pointMatch[1].replace(/,/g, ''));
          cashbackYen = points;
          cashback = `${points}円`;
        }
      } else if (pointStr.includes('円')) {
        // 円表記
        const yenMatch = pointStr.match(/(\d{1,6}(?:,\d{3})*)/);
        if (yenMatch) {
          const yen = parseInt(yenMatch[1].replace(/,/g, ''));
          cashbackYen = yen;
          cashback = `${yen}円`;
        }
      }
    }

    // デバイス情報（モッピーは基本的にAll）
    const device = campaign.device || 'All';
    let deviceDisplay = 'すべて';
    let deviceIcon = '🌐';

    return {
      id: campaign.id,
      title: campaign.title,
      site: 'モッピー',
      siteId: 'moppy',
      url: campaign.url,
      cashback: cashback || '',
      cashbackYen: cashbackYen,
      device: deviceDisplay,
      deviceIcon: deviceIcon,
      category: campaign.urlId || 'その他',
      lastUpdated: campaign.scrapedAt || new Date().toISOString(),
      // 検索に必要なフィールドを追加
      siteName: 'モッピー',
      description: campaign.title,
      displayName: campaign.title,
      campaignUrl: campaign.url,
      pointSiteUrl: 'https://pc.moppy.jp',
      searchKeywords: `${campaign.title} モッピー`,
      searchWeight: 1
    };
  }

  /**
   * データ統合実行
   */
  async integrate() {
    console.log('🔄 モッピーデータ統合開始...');

    try {
      // 1. 既存データ読み込み
      console.log('📖 既存検索データ読み込み中...');
      const searchData = await this.loadSearchData();
      console.log(`✅ 既存案件数: ${searchData.campaigns.length}件`);

      // 2. モッピーデータ読み込み
      console.log('📖 モッピーデータ読み込み中...');
      const moppyData = await this.getLatestMoppyData();
      console.log(`✅ モッピー案件数: ${moppyData.campaigns.length}件`);

      // 3. 既存のモッピーデータを除去
      console.log('🗑️ 既存モッピーデータ除去中...');
      const nonMoppyCampaigns = searchData.campaigns.filter(c => c.siteId !== 'moppy');
      console.log(`✅ 除去完了: ${searchData.campaigns.length - nonMoppyCampaigns.length}件削除`);

      // 4. モッピーデータを変換
      console.log('🔄 モッピーデータ変換中...');
      const convertedMoppyCampaigns = moppyData.campaigns.map(c => this.convertMoppyCampaign(c));
      console.log(`✅ 変換完了: ${convertedMoppyCampaigns.length}件`);

      // 5. データ統合
      const allCampaigns = [...nonMoppyCampaigns, ...convertedMoppyCampaigns];
      console.log(`🔗 統合完了: ${allCampaigns.length}件`);

      // 6. 統計更新
      const newSearchData = {
        version: "3.1",
        generated: new Date().toISOString(),
        stats: {
          total: allCampaigns.length,
          sites: {
            ...searchData.stats.sites,
            moppy: {
              total: convertedMoppyCampaigns.length,
              web: convertedMoppyCampaigns.length
            }
          }
        },
        campaigns: allCampaigns
      };

      // 7. バックアップ作成
      const backupPath = `${this.searchDataPath}.backup.${Date.now()}`;
      await fs.copyFile(this.searchDataPath, backupPath);
      console.log(`💾 バックアップ作成: ${path.basename(backupPath)}`);

      // 8. 新データ保存
      await fs.writeFile(this.searchDataPath, JSON.stringify(newSearchData, null, 2));
      console.log(`💾 検索データ更新完了: ${this.searchDataPath}`);

      // 9. 結果レポート
      this.generateReport(searchData, newSearchData, moppyData);

    } catch (error) {
      console.error('💥 統合エラー:', error);
      throw error;
    }
  }

  /**
   * 統合結果レポート生成
   */
  generateReport(oldData, newData, moppyData) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 モッピーデータ統合完了レポート');
    console.log('='.repeat(80));

    console.log('\n📈 統合前後比較:');
    console.log(`統合前: ${oldData.campaigns.length}件`);
    console.log(`統合後: ${newData.campaigns.length}件`);
    console.log(`増加: +${newData.campaigns.length - oldData.campaigns.length}件`);

    console.log('\n🏢 サイト別案件数:');
    Object.entries(newData.stats.sites).forEach(([site, stats]) => {
      console.log(`${site}: ${stats.total}件`);
    });

    console.log('\n📊 モッピーデータ詳細:');
    console.log(`取得案件数: ${moppyData.campaigns.length}件`);
    console.log(`ポイント検出率: ${moppyData.stats.pointDetectionRate}%`);
    console.log(`処理URL: ${moppyData.stats.totalUrls}個`);
    console.log(`実行時間: ${moppyData.stats.executionTime}秒`);

    // カテゴリ別統計
    const categoryStats = {};
    moppyData.campaigns.forEach(c => {
      const category = c.urlId || 'その他';
      categoryStats[category] = (categoryStats[category] || 0) + 1;
    });

    console.log('\n📁 モッピーカテゴリ別案件数:');
    Object.entries(categoryStats)
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, count]) => {
        console.log(`${category}: ${count}件`);
      });

    console.log('\n✅ モッピーデータ統合完了！');
    console.log('🔍 ポイ速検索画面でモッピー案件が検索可能になりました');
  }
}

// 実行
if (require.main === module) {
  const integrator = new MoppyDataIntegrator();
  integrator.integrate().catch(console.error);
}

module.exports = MoppyDataIntegrator;