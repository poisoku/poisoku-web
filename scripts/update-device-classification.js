#!/usr/bin/env node

/**
 * デバイス分類統一スクリプト
 * "All" → "Web" に変更（スマホアプリ案件は除く）
 * 2025-08-15
 */

const fs = require('fs').promises;
const path = require('path');

class DeviceClassificationUpdater {
  constructor() {
    this.searchDataPath = path.join(__dirname, '..', 'public', 'search-data.json');
  }

  async updateDeviceClassification() {
    console.log('🔄 デバイス分類統一開始...');

    try {
      // 1. 検索データ読み込み
      console.log('📖 検索データ読み込み中...');
      const content = await fs.readFile(this.searchDataPath, 'utf8');
      const searchData = JSON.parse(content);
      console.log(`✅ 総案件数: ${searchData.campaigns.length}件`);

      // 2. 変更前の統計
      const beforeStats = this.getDeviceStats(searchData.campaigns);
      console.log('\n📊 変更前デバイス分類:');
      Object.entries(beforeStats).forEach(([device, count]) => {
        console.log(`${device}: ${count}件`);
      });

      // 3. デバイス分類を更新
      console.log('\n🔄 デバイス分類更新中...');
      let updatedCount = 0;
      
      searchData.campaigns = searchData.campaigns.map(campaign => {
        // "All" を "Web" に変更（スマホアプリ案件は除く）
        if (campaign.device === 'All') {
          campaign.device = 'Web';
          updatedCount++;
        }
        return campaign;
      });

      console.log(`✅ 更新完了: ${updatedCount}件を "All" → "Web" に変更`);

      // 4. 変更後の統計
      const afterStats = this.getDeviceStats(searchData.campaigns);
      console.log('\n📊 変更後デバイス分類:');
      Object.entries(afterStats).forEach(([device, count]) => {
        console.log(`${device}: ${count}件`);
      });

      // 5. 統計情報も更新
      if (searchData.stats && searchData.stats.sites) {
        Object.keys(searchData.stats.sites).forEach(siteKey => {
          const siteStats = searchData.stats.sites[siteKey];
          if (siteStats.web !== undefined) {
            // webの件数を再計算
            const webCount = searchData.campaigns.filter(c => 
              c.siteId === siteKey && c.device === 'Web'
            ).length;
            siteStats.web = webCount;
          }
        });
      }

      // 6. バックアップ作成
      const backupPath = `${this.searchDataPath}.backup.${Date.now()}`;
      await fs.copyFile(this.searchDataPath, backupPath);
      console.log(`💾 バックアップ作成: ${path.basename(backupPath)}`);

      // 7. 更新データ保存
      searchData.generated = new Date().toISOString();
      await fs.writeFile(this.searchDataPath, JSON.stringify(searchData, null, 2));
      console.log(`💾 検索データ更新完了: ${this.searchDataPath}`);

      // 8. 結果レポート
      this.generateReport(beforeStats, afterStats, updatedCount);

    } catch (error) {
      console.error('💥 更新エラー:', error);
      throw error;
    }
  }

  getDeviceStats(campaigns) {
    const stats = {};
    campaigns.forEach(campaign => {
      const device = campaign.device || 'Unknown';
      stats[device] = (stats[device] || 0) + 1;
    });
    return stats;
  }

  generateReport(beforeStats, afterStats, updatedCount) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 デバイス分類統一完了レポート');
    console.log('='.repeat(80));

    console.log('\n📈 更新サマリー:');
    console.log(`更新件数: ${updatedCount}件 ("All" → "Web")`);
    console.log(`Web案件: ${afterStats.Web || 0}件`);
    console.log(`iOS案件: ${afterStats.iOS || 0}件`);
    console.log(`Android案件: ${afterStats.Android || 0}件`);

    if (beforeStats.All) {
      console.log(`\n✅ 完了: ${beforeStats.All}件の "All" 案件がすべて "Web" に変更されました`);
    }

    console.log('\n🎯 統一後の分類:');
    console.log('- Web: PC・Webブラウザ案件');
    console.log('- iOS: iOSアプリ案件');
    console.log('- Android: Androidアプリ案件');
    console.log('- iOS/Android: 両OS対応アプリ案件');

    console.log('\n✅ デバイス分類統一完了！');
    console.log('🔍 すべてのサイトで統一された分類が表示されます');
  }
}

// 実行
if (require.main === module) {
  const updater = new DeviceClassificationUpdater();
  updater.updateDeviceClassification().catch(console.error);
}

module.exports = DeviceClassificationUpdater;