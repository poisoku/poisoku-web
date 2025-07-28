const fs = require('fs').promises;

class GenerateSearchDataFromExisting {
  constructor() {
    this.inputFile = 'scripts/pointincome/pointincome_complete_all_campaigns.json';
    this.outputIndexFile = 'public/search-index.json';
    this.outputDataFile = 'public/search-data.json';
  }

  async generateSearchData() {
    console.log('🚀 既存データから検索データ生成開始');
    console.log('='.repeat(60));

    try {
      // 既存のポイントインカムデータを読み込み
      console.log('📂 ポイントインカムデータを読み込み中...');
      const rawData = await fs.readFile(this.inputFile, 'utf8');
      const pointIncomeData = JSON.parse(rawData);

      console.log(`📊 取得されたキャンペーン数: ${pointIncomeData.campaigns.length}件`);
      console.log(`✅ 完了カテゴリ: ${pointIncomeData.summary.completed_categories}/${pointIncomeData.summary.total_categories}`);

      // 検索用データに変換
      const searchData = this.transformToSearchFormat(pointIncomeData.campaigns);

      // 既存の検索データを読み込み（他サイトのデータがある場合）
      let existingSearchData = { campaigns: [] };
      let existingIndex = { campaigns: [] };
      
      try {
        const existingDataRaw = await fs.readFile(this.outputDataFile, 'utf8');
        existingSearchData = JSON.parse(existingDataRaw);
        
        const existingIndexRaw = await fs.readFile(this.outputIndexFile, 'utf8');
        existingIndex = JSON.parse(existingIndexRaw);
        
        console.log(`📋 既存データ: ${existingSearchData.campaigns?.length || 0}件`);
        
        // ポイントインカム以外のデータを保持
        existingSearchData.campaigns = existingSearchData.campaigns.filter(c => c.site !== 'ポイントインカム');
        existingIndex.campaigns = existingIndex.campaigns.filter(c => c.site !== 'ポイントインカム');
        
        console.log(`🔄 他サイトデータ: ${existingSearchData.campaigns.length}件を保持`);
      } catch (error) {
        console.log('📋 新規検索データファイル作成');
      }

      // データを統合
      const allCampaigns = [...existingSearchData.campaigns, ...searchData];
      
      // 検索インデックス生成
      const searchIndex = this.generateSearchIndex(allCampaigns);

      // ファイル出力
      await this.saveSearchFiles(searchIndex, allCampaigns);

      console.log('✅ ポイントインカム検索データ生成完了！');
      console.log(`📄 出力ファイル: ${this.outputIndexFile}, ${this.outputDataFile}`);
      console.log(`📊 総データ数: ${allCampaigns.length}件`);
      console.log(`   - ポイントインカム: ${searchData.length}件`);
      console.log(`   - その他サイト: ${existingSearchData.campaigns.length}件`);

    } catch (error) {
      console.error('❌ エラー:', error);
      throw error;
    }
  }

  transformToSearchFormat(campaigns) {
    console.log('🔄 検索用フォーマットに変換中...');
    
    return campaigns.map((campaign) => {
      // cashbackの値を修正（古いデータの場合）
      let cashbackInfo = this.parseCashback(campaign.cashback, campaign.cashbackYen);
      
      return {
        id: campaign.id,
        name: campaign.title || campaign.displayName,
        site: 'ポイントインカム',
        siteUrl: campaign.url || campaign.campaignUrl,
        description: campaign.description || campaign.title || campaign.displayName,
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
    // 無効な "0pt" の場合、cashbackYenから逆算
    if (cashback === '0pt' && cashbackYen) {
      const yenMatch = cashbackYen.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*円/);
      if (yenMatch) {
        const yenValue = parseInt(yenMatch[1].replace(/,/g, ''));
        const pointValue = yenValue * 10; // 10pt = 1円
        return {
          display: pointValue.toLocaleString() + 'pt',
          yen: yenValue,
          type: 'points'
        };
      }
    }
    
    if (!cashback || cashback === '不明') {
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
        sites: [...new Set(searchData.map(item => item.site))],
        version: '1.0.0'
      },
      categories: [...new Set(searchData.map(item => item.category))],
      devices: [...new Set(searchData.map(item => item.device))],
      sites: [...new Set(searchData.map(item => item.site))],
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
    if (!text) return '';
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
  const generator = new GenerateSearchDataFromExisting();
  await generator.generateSearchData();
})();