const fs = require('fs').promises;

class PointIncomeSearchDataGenerator {
  constructor() {
    this.inputFile = 'sample-fixed-campaigns.json'; // 修正版テストデータ
    this.outputIndexFile = 'public/pointincome-search-index-fixed.json';
    this.outputDataFile = 'public/pointincome-search-data-fixed.json';
  }

  async generateSearchData() {
    console.log('🚀 ポイントインカム検索データ生成開始');
    console.log('='.repeat(60));

    try {
      // ポイントインカムのデータを読み込み
      console.log('📂 ポイントインカムデータを読み込み中...');
      const rawData = await fs.readFile(this.inputFile, 'utf8');
      const pointIncomeData = JSON.parse(rawData);

      console.log(`📊 取得されたキャンペーン数: ${pointIncomeData.campaigns.length}件`);

      // 検索用データに変換
      const searchData = this.transformToSearchFormat(pointIncomeData.campaigns);

      // 検索インデックス生成
      const searchIndex = this.generateSearchIndex(searchData);

      // ファイル出力
      await this.saveSearchFiles(searchIndex, searchData);

      console.log('✅ ポイントインカム検索データ生成完了！');
      console.log(`📄 出力ファイル: ${this.outputIndexFile}, ${this.outputDataFile}`);
      console.log(`📊 総データ数: ${searchData.length}件`);

    } catch (error) {
      console.error('❌ エラー:', error);
      throw error;
    }
  }

  transformToSearchFormat(campaigns) {
    console.log('🔄 検索用フォーマットに変換中...');
    
    return campaigns.map((campaign, index) => {
      // cashbackの値を解析
      let cashbackInfo = this.parseCashback(campaign.cashback, campaign.cashbackYen);
      
      return {
        id: campaign.id || `pi_${index}`,
        name: campaign.title || campaign.displayName,
        site: 'ポイントインカム',
        siteUrl: campaign.url || campaign.campaignUrl,
        description: campaign.title || campaign.displayName,
        cashback: cashbackInfo.display,
        cashbackYen: cashbackInfo.yen,
        cashbackType: cashbackInfo.type,
        device: campaign.device || 'すべて',
        category: campaign.category || 'その他',
        lastUpdated: campaign.scrapedAt || new Date().toISOString(),
        isActive: true
      };
    });
  }

  parseCashback(cashback, cashbackYen) {
    if (!cashback) {
      return {
        display: '不明',
        yen: 0,
        type: 'unknown'
      };
    }

    // パーセント形式の場合
    if (cashback.includes('%')) {
      const percentValue = parseFloat(cashback.replace('%', ''));
      return {
        display: cashback,
        yen: 0, // パーセントは金額換算不可
        type: 'percentage'
      };
    }

    // ポイント形式の場合
    if (cashback.includes('pt')) {
      const pointValue = parseInt(cashback.replace(/[,pt]/g, ''));
      const yenValue = Math.floor(pointValue / 10); // 10pt = 1円
      
      return {
        display: cashback,
        yen: yenValue,
        type: 'points'
      };
    }

    // 円形式の場合
    if (cashback.includes('円') || cashbackYen) {
      const yenValue = parseInt((cashbackYen || cashback).replace(/[,円]/g, ''));
      return {
        display: cashbackYen || cashback,
        yen: yenValue,
        type: 'yen'
      };
    }

    return {
      display: cashback,
      yen: 0,
      type: 'other'
    };
  }

  generateSearchIndex(searchData) {
    console.log('🔍 検索インデックス生成中...');
    
    const index = {
      metadata: {
        totalCampaigns: searchData.length,
        lastUpdated: new Date().toISOString(),
        sites: ['ポイントインカム'],
        version: '1.0.0'
      },
      categories: [...new Set(searchData.map(item => item.category))],
      devices: [...new Set(searchData.map(item => item.device))],
      sites: ['ポイントインカム'],
      campaigns: searchData.map(item => ({
        id: item.id,
        name: item.name,
        nameNormalized: this.normalizeForSearch(item.name),
        site: item.site,
        cashback: item.cashback,
        cashbackYen: item.cashbackYen,
        category: item.category,
        device: item.device
      }))
    };

    return index;
  }

  normalizeForSearch(text) {
    return text
      .toLowerCase()
      .replace(/[（）()【】\[\]]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async saveSearchFiles(searchIndex, searchData) {
    console.log('💾 検索ファイル保存中...');

    // ディレクトリが存在しない場合は作成
    try {
      await fs.access('public');
    } catch {
      await fs.mkdir('public', { recursive: true });
    }

    // 検索インデックス保存
    await fs.writeFile(
      this.outputIndexFile,
      JSON.stringify(searchIndex, null, 2),
      'utf8'
    );

    // 検索データ保存
    await fs.writeFile(
      this.outputDataFile,
      JSON.stringify({
        metadata: searchIndex.metadata,
        campaigns: searchData
      }, null, 2),
      'utf8'
    );

    console.log(`✅ ファイル保存完了:`);
    console.log(`   📄 ${this.outputIndexFile} (${Math.round(JSON.stringify(searchIndex).length / 1024)}KB)`);
    console.log(`   📄 ${this.outputDataFile} (${Math.round(JSON.stringify(searchData).length / 1024)}KB)`);
  }
}

// 実行
(async () => {
  const generator = new PointIncomeSearchDataGenerator();
  await generator.generateSearchData();
})();