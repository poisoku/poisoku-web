const fs = require('fs').promises;
const path = require('path');

class IntegrateAllCategories {
  constructor() {
    this.outputFile = 'pointincome_all_categories_complete.json';
    this.searchIndexFile = 'public/search-index.json';
    this.searchDataFile = 'public/search-data.json';
  }

  async integrateAllData() {
    console.log('🚀 全カテゴリデータ統合開始');
    console.log('='.repeat(60));

    try {
      // 個別JSONファイルを検索
      console.log('📂 個別JSONファイルを検索中...');
      const files = await fs.readdir('.');
      const categoryFiles = files.filter(file => 
        file.startsWith('pointincome_') && 
        (file.includes('group_') || file.includes('category_')) &&
        file.endsWith('.json')
      );

      console.log(`📊 発見されたファイル: ${categoryFiles.length}件`);
      categoryFiles.forEach((file, i) => {
        console.log(`  ${i+1}. ${file}`);
      });

      // 全データを統合
      const allCampaigns = [];
      const categoryStats = [];
      let totalProcessed = 0;

      for (const file of categoryFiles) {
        try {
          console.log(`\n📂 読み込み中: ${file}`);
          const data = JSON.parse(await fs.readFile(file, 'utf8'));
          
          if (data.campaigns && Array.isArray(data.campaigns)) {
            allCampaigns.push(...data.campaigns);
            totalProcessed += data.campaigns.length;
            
            categoryStats.push({
              category: data.category,
              categoryId: data.categoryId,
              categoryType: data.categoryType,
              campaignCount: data.campaigns.length,
              file: file
            });
            
            console.log(`   ✅ ${data.campaigns.length}件のキャンペーンを統合`);
          } else {
            console.log(`   ⚠️ キャンペーンデータが見つかりません`);
          }
        } catch (error) {
          console.error(`   ❌ ファイル読み込みエラー: ${file} - ${error.message}`);
        }
      }

      // 重複除去（URLベース）
      console.log('\n🔄 重複除去中...');
      const uniqueCampaigns = [];
      const seenUrls = new Set();
      
      for (const campaign of allCampaigns) {
        const url = campaign.url;
        if (!seenUrls.has(url)) {
          seenUrls.add(url);
          uniqueCampaigns.push(campaign);
        }
      }
      
      console.log(`📊 重複除去: ${allCampaigns.length}件 → ${uniqueCampaigns.length}件`);

      // 統合データ保存
      const integratedData = {
        siteName: 'ポイントインカム',
        scrapingType: 'stable-category-by-category-complete',
        scrapedAt: new Date().toISOString(),
        summary: {
          totalCampaigns: uniqueCampaigns.length,
          totalCategories: categoryFiles.length,
          processingStats: {
            rawTotal: totalProcessed,
            duplicatesRemoved: allCampaigns.length - uniqueCampaigns.length,
            uniqueTotal: uniqueCampaigns.length
          }
        },
        categoryStats: categoryStats,
        campaigns: uniqueCampaigns
      };

      await fs.writeFile(this.outputFile, JSON.stringify(integratedData, null, 2));
      console.log(`\n💾 統合データ保存: ${this.outputFile}`);

      // 検索データ更新
      await this.updateSearchData(uniqueCampaigns);

      console.log('\n' + '='.repeat(60));
      console.log('✅ 全カテゴリデータ統合完了！');
      console.log(`📊 最終結果: ${uniqueCampaigns.length}件のポイントインカム案件`);
      console.log(`📁 統合ファイル: ${this.outputFile}`);
      console.log(`🔍 検索データ更新: ${this.searchDataFile}`);
      
      // カテゴリ別サマリー
      console.log('\n📋 カテゴリ別サマリー:');
      categoryStats
        .sort((a, b) => b.campaignCount - a.campaignCount)
        .forEach((stat, i) => {
          console.log(`  ${i+1}. ${stat.category}: ${stat.campaignCount}件`);
        });

    } catch (error) {
      console.error('❌ エラー:', error);
      throw error;
    }
  }

  async updateSearchData(pointIncomeCampaigns) {
    console.log('\n🔍 検索データ更新中...');

    try {
      // 既存の検索データを読み込み
      let existingSearchData = { campaigns: [] };
      let existingIndex = { campaigns: [] };
      
      try {
        const existingDataRaw = await fs.readFile(this.searchDataFile, 'utf8');
        existingSearchData = JSON.parse(existingDataRaw);
        
        const existingIndexRaw = await fs.readFile(this.searchIndexFile, 'utf8');
        existingIndex = JSON.parse(existingIndexRaw);
        
        console.log(`📋 既存データ: ${existingSearchData.campaigns?.length || 0}件`);
        
        // ポイントインカム以外のデータを保持
        existingSearchData.campaigns = existingSearchData.campaigns.filter(c => c.site !== 'ポイントインカム');
        existingIndex.campaigns = existingIndex.campaigns.filter(c => c.site !== 'ポイントインカム');
        
        console.log(`🔄 他サイトデータ: ${existingSearchData.campaigns.length}件を保持`);
      } catch (error) {
        console.log('📋 新規検索データファイル作成');
      }

      // ポイントインカムデータを検索フォーマットに変換
      const searchFormatData = this.transformToSearchFormat(pointIncomeCampaigns);
      
      // データを統合
      const allCampaigns = [...existingSearchData.campaigns, ...searchFormatData];
      
      // 検索インデックス生成
      const searchIndex = this.generateSearchIndex(allCampaigns);

      // ファイル出力
      await this.saveSearchFiles(searchIndex, allCampaigns);

      console.log(`✅ 検索データ更新完了`);
      console.log(`   - 総案件数: ${allCampaigns.length}件`);
      console.log(`   - ポイントインカム: ${searchFormatData.length}件`);
      console.log(`   - その他サイト: ${existingSearchData.campaigns.length}件`);

    } catch (error) {
      console.error('❌ 検索データ更新エラー:', error);
    }
  }

  transformToSearchFormat(campaigns) {
    return campaigns.map((campaign) => {
      // cashbackの値を解析
      let cashbackInfo = this.parseCashback(campaign.cashback);
      
      return {
        id: campaign.id || `pi_${Math.random().toString(36).substr(2, 9)}`,
        name: campaign.title || 'タイトル不明',
        site: 'ポイントインカム',
        siteUrl: campaign.url,
        description: campaign.title || 'タイトル不明',
        cashback: cashbackInfo.display,
        cashbackYen: cashbackInfo.yen,
        cashbackType: cashbackInfo.type,
        device: 'すべて',
        category: this.mapCategory(campaign.category),
        lastUpdated: new Date().toISOString(),
        isActive: true
      };
    });
  }

  parseCashback(cashback) {
    if (!cashback || cashback === '不明') {
      return {
        display: '不明',
        yen: 0,
        type: 'unknown'
      };
    }

    // パーセント形式の場合
    if (cashback.includes('%')) {
      return {
        display: cashback,
        yen: 0,
        type: 'percentage'
      };
    }

    // ポイント形式の場合
    if (cashback.includes('pt')) {
      const pointValue = parseInt(cashback.replace(/[,pt]/g, '')) || 0;
      const yenValue = Math.floor(pointValue / 10); // 10pt = 1円
      
      return {
        display: cashback,
        yen: yenValue,
        type: 'points'
      };
    }

    // 円形式の場合
    if (cashback.includes('円')) {
      const yenValue = parseInt(cashback.replace(/[,円]/g, '')) || 0;
      return {
        display: cashback,
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

  mapCategory(categoryName) {
    // カテゴリ名のマッピング
    const categoryMapping = {
      'EC・ネットショッピング': 'shopping',
      'ファッション': 'shopping',
      'グルメ': 'shopping',
      '美容': 'shopping',
      '衛生用品': 'shopping',
      'エンタメ・家電': 'shopping',
      '住まい・暮らし': 'shopping',
      'その他（ショッピング）': 'shopping',
      'クレジットカード': 'creditcard',
      '証券・FX': 'money',
      '銀行': 'money',
      '保険': 'money',
      'ローン': 'money',
      '不動産': 'money',
      '旅行': 'travel',
      'グルメ予約': 'travel',
      '通信・プロバイダ': 'other',
      '電気・ガス': 'other',
      '教育・資格': 'other',
      '美容・エステ': 'other',
      '結婚・恋愛': 'other',
      '車・バイク': 'other',
      'ゲーム': 'entertainment',
      '動画配信': 'entertainment',
      '電子書籍': 'entertainment',
      'ふるさと納税': 'other',
      'ポイントサイト': 'other',
      'アンケート': 'other',
      'その他サービス': 'other'
    };

    return categoryMapping[categoryName] || 'other';
  }

  generateSearchIndex(searchData) {
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
    // ディレクトリが存在しない場合は作成
    try {
      await fs.access('public');
    } catch {
      await fs.mkdir('public', { recursive: true });
    }

    // 検索インデックス保存
    await fs.writeFile(
      this.searchIndexFile,
      JSON.stringify(searchIndex, null, 2),
      'utf8'
    );

    // 検索データ保存
    await fs.writeFile(
      this.searchDataFile,
      JSON.stringify({
        metadata: searchIndex.metadata,
        campaigns: searchData
      }, null, 2),
      'utf8'
    );
  }
}

// 実行
(async () => {
  const integrator = new IntegrateAllCategories();
  await integrator.integrateAllData();
})();