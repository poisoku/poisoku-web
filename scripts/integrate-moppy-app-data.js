#!/usr/bin/env node

/**
 * モッピーアプリ案件データをポイ速検索システムに統合
 * 2025-08-15
 */

const fs = require('fs').promises;
const path = require('path');

class MoppyAppDataIntegrator {
  constructor() {
    this.searchDataPath = path.join(__dirname, '..', 'public', 'search-data.json');
    this.moppyAppDataPath = path.join(__dirname, '..', 'scrapers', 'data', 'moppy');
  }

  /**
   * 最新のモッピーアプリデータファイルを取得
   */
  async getLatestMoppyAppData() {
    try {
      const files = await fs.readdir(this.moppyAppDataPath);
      const moppyAppFiles = files
        .filter(f => f.includes('moppy_mobile_app_campaigns_combined_') && f.endsWith('.json'))
        .sort((a, b) => b.localeCompare(a)); // 最新順

      if (moppyAppFiles.length === 0) {
        throw new Error('モッピーアプリデータファイルが見つかりません');
      }

      const latestFile = path.join(this.moppyAppDataPath, moppyAppFiles[0]);
      console.log(`📄 最新モッピーアプリデータ: ${moppyAppFiles[0]}`);
      
      const content = await fs.readFile(latestFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error('モッピーアプリデータ読込エラー:', error);
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
   * 数値にカンマ区切りを追加
   */
  formatNumberWithCommas(number) {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /**
   * タイトルクリーニング（改行・余分な空白除去）
   */
  cleanTitle(title) {
    return title
      .replace(/\n/g, ' ')
      .replace(/\t/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * モッピーアプリキャンペーンをポイ速形式に変換
   */
  convertMoppyAppCampaign(campaign) {
    // ポイント情報の変換
    let cashback = null;
    let cashbackYen = null;

    if (campaign.points) {
      const pointStr = campaign.points.toString();
      
      if (pointStr.includes('%') || pointStr.includes('％')) {
        // パーセント表記
        cashback = pointStr;
        cashbackYen = pointStr;
      } else {
        // 数値のみの場合（モッピーは1pt=1円）
        const numMatch = pointStr.match(/(\d{1,6}(?:,\d{3})*)/);
        if (numMatch) {
          const points = parseInt(numMatch[1].replace(/,/g, ''));
          const formattedAmount = `${this.formatNumberWithCommas(points)}円`;
          cashbackYen = formattedAmount;
          cashback = formattedAmount;
        }
      }
    }

    // デバイス情報の統一
    let device = 'iOS/Android'; // デフォルト
    
    if (campaign.device === 'iOS') {
      device = 'iOS';
    } else if (campaign.device === 'Android') {
      device = 'Android';
    } else if (campaign.device === 'iOS/Android') {
      device = 'iOS/Android';
    }

    // タイトルクリーニング
    const cleanedTitle = this.cleanTitle(campaign.title || '');

    return {
      id: campaign.id,
      title: cleanedTitle,
      site: 'モッピー',
      siteId: 'moppy',
      url: campaign.url,
      cashback: cashback || '',
      cashbackYen: cashbackYen || '',
      device: device,
      deviceIcon: device === 'iOS' ? '🍎' : device === 'Android' ? '🤖' : '📱',
      category: 'スマホアプリ',
      lastUpdated: campaign.scrapedAt || new Date().toISOString(),
      // 検索に必要なフィールドを追加
      siteName: 'モッピー',
      description: cleanedTitle,
      displayName: cleanedTitle,
      campaignUrl: campaign.url,
      pointSiteUrl: 'https://pc.moppy.jp',
      searchKeywords: `${cleanedTitle} モッピー アプリ`,
      searchWeight: 1
    };
  }

  /**
   * データ統合実行
   */
  async integrate() {
    console.log('🔄 モッピーアプリデータ統合開始...');

    try {
      // 1. 既存データ読み込み
      console.log('📖 既存検索データ読み込み中...');
      const searchData = await this.loadSearchData();
      console.log(`✅ 既存案件数: ${searchData.campaigns.length}件`);

      // 2. モッピーアプリデータ読み込み
      console.log('📖 モッピーアプリデータ読み込み中...');
      const moppyAppData = await this.getLatestMoppyAppData();
      console.log(`✅ モッピーアプリ案件数: ${moppyAppData.campaigns.length}件`);

      // 3. 既存のモッピーアプリデータを除去（重複防止）
      console.log('🗑️ 既存モッピーアプリデータ除去中...');
      const nonMoppyAppCampaigns = searchData.campaigns.filter(c => 
        !(c.siteId === 'moppy' && (c.category === 'スマホアプリ' || 
          (c.device !== 'Web' && c.device !== 'PC')))
      );
      const removedCount = searchData.campaigns.length - nonMoppyAppCampaigns.length;
      console.log(`✅ 除去完了: ${removedCount}件削除`);

      // 4. モッピーアプリデータを変換
      console.log('🔄 モッピーアプリデータ変換中...');
      const convertedMoppyAppCampaigns = moppyAppData.campaigns.map(c => this.convertMoppyAppCampaign(c));
      console.log(`✅ 変換完了: ${convertedMoppyAppCampaigns.length}件`);

      // 5. データ統合
      const allCampaigns = [...nonMoppyAppCampaigns, ...convertedMoppyAppCampaigns];
      console.log(`🔗 統合完了: ${allCampaigns.length}件`);

      // 6. 統計更新
      const newSearchData = {
        version: "3.2",
        generated: new Date().toISOString(),
        stats: {
          total: allCampaigns.length,
          sites: {
            ...searchData.stats.sites,
            moppy: {
              total: (searchData.stats.sites.moppy?.total || 0) + convertedMoppyAppCampaigns.length,
              web: searchData.stats.sites.moppy?.web || 0,
              ios: convertedMoppyAppCampaigns.filter(c => c.device === 'iOS').length,
              android: convertedMoppyAppCampaigns.filter(c => c.device === 'Android').length,
              app: convertedMoppyAppCampaigns.length
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
      this.generateReport(searchData, newSearchData, moppyAppData);

    } catch (error) {
      console.error('💥 統合エラー:', error);
      throw error;
    }
  }

  /**
   * 統合結果レポート生成
   */
  generateReport(oldData, newData, moppyAppData) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 モッピーアプリデータ統合完了レポート');
    console.log('='.repeat(80));

    console.log('\n📈 統合前後比較:');
    console.log(`統合前: ${oldData.campaigns.length}件`);
    console.log(`統合後: ${newData.campaigns.length}件`);
    console.log(`増加: +${newData.campaigns.length - oldData.campaigns.length}件`);

    console.log('\n🏢 サイト別案件数:');
    Object.entries(newData.stats.sites).forEach(([site, stats]) => {
      console.log(`${site}: ${stats.total}件`);
    });

    console.log('\n📊 モッピーアプリデータ詳細:');
    console.log(`取得案件数: ${moppyAppData.campaigns.length}件`);
    
    const iosCount = moppyAppData.campaigns.filter(c => c.device === 'iOS').length;
    const androidCount = moppyAppData.campaigns.filter(c => c.device === 'Android').length;
    const bothCount = moppyAppData.campaigns.filter(c => c.device === 'iOS/Android').length;
    
    console.log(`📱 iOS案件: ${iosCount}件`);
    console.log(`🤖 Android案件: ${androidCount}件`);
    console.log(`📲 両対応案件: ${bothCount}件`);

    // ポイント検出統計
    const withPoints = moppyAppData.campaigns.filter(c => c.points && c.points !== null).length;
    const pointDetectionRate = Math.round((withPoints / moppyAppData.campaigns.length) * 100);
    console.log(`💰 ポイント検出率: ${pointDetectionRate}% (${withPoints}/${moppyAppData.campaigns.length})`);

    console.log('\n✅ モッピーアプリデータ統合完了！');
    console.log('🔍 ポイ速検索画面でモッピーのアプリ案件が検索可能になりました');
  }
}

// 実行
if (require.main === module) {
  const integrator = new MoppyAppDataIntegrator();
  integrator.integrate().catch(console.error);
}

module.exports = MoppyAppDataIntegrator;