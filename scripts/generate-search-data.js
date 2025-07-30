const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;

const supabaseUrl = 'https://pjjhyzbnnslaauwzknrr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqamh5emJubnNsYWF1d3prbnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5ODg4MzksImV4cCI6MjA2NjU2NDgzOX0.qcrcwNpwX83dCNbhxFaks2E68K_wp2W8urdYwfenDtM';

class SearchDataGenerator {
  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    
    // ポイントサイトごとの円換算レート
    this.conversionRates = {
      'ちょびリッチ': 0.5,      // 2ポイント = 1円
      'ハピタス': 1,            // 1ポイント = 1円
      'モッピー': 1,            // 1ポイント = 1円
      'ポイントインカム': 0.1,  // 10ポイント = 1円
      'ポイントタウン': 0.05,   // 20ポイント = 1円
      'ECナビ': 0.1,            // 10ポイント = 1円
      'げん玉': 0.1,            // 10ポイント = 1円
      'ポイぷる': 0.1,          // 10ポイント = 1円
      'アメフリ': 0.1,          // 10ポイント = 1円
      'ワラウ': 0.1,            // 10ポイント = 1円
      'ニフティポイントクラブ': 1, // 1ポイント = 1円
      'すぐたま': 0.5,          // 2ポイント = 1円
      'GetMoney!': 0.1,         // 10ポイント = 1円
      'Gポイント': 1,           // 1ポイント = 1円
      'colleee': 0.1,           // 10ポイント = 1円
      'Unknown': 1              // デフォルト: 1ポイント = 1円
    };
  }

  async generateSearchData() {
    console.log('🚀 静的サイト用検索データ生成開始');
    console.log('='.repeat(60));

    try {
      // 全ての有効なキャンペーンを取得
      console.log('📂 データベースからキャンペーンデータを取得中...');
      
      // 全データを取得するため、バッチ処理で実行
      let allCampaigns = [];
      let offset = 0;
      const batchSize = 1000;
      
      while (true) {
        const { data: campaigns, error } = await this.supabase
          .from('campaigns')
          .select(`
            id,
            name,
            cashback_rate,
            device,
            campaign_url,
            description,
            category,
            is_active,
            created_at,
            updated_at,
            point_sites (
              id,
              name,
              url
            )
          `)
          .eq('is_active', true)
          .order('updated_at', { ascending: false })
          .range(offset, offset + batchSize - 1);

        if (error) {
          throw new Error(`データ取得エラー: ${error.message}`);
        }

        if (!campaigns || campaigns.length === 0) {
          break;
        }

        allCampaigns.push(...campaigns);
        console.log(`📄 バッチ${Math.floor(offset/batchSize) + 1}: ${campaigns.length}件取得（累計: ${allCampaigns.length}件）`);
        
        if (campaigns.length < batchSize) {
          break; // 最後のバッチ
        }
        
        offset += batchSize;
      }
      
      const campaigns = allCampaigns;

      console.log(`✅ ${campaigns.length}件のキャンペーンを取得`);

      // 無効な還元率の案件を除外
      const validCampaigns = campaigns.filter(campaign => {
        const cashback = campaign.cashback_rate || '';
        
        // 除外パターン
        const invalidPatterns = [
          '要確認',
          '不明',
          'なし',
          '未定',
          'TBD',
          '確認中'
        ];
        
        return !invalidPatterns.some(pattern => cashback.includes(pattern));
      });

      console.log(`🔍 有効な還元率の案件: ${validCampaigns.length}件 (${campaigns.length - validCampaigns.length}件を除外)`);

      // 検索用データフォーマットに変換
      const searchData = validCampaigns.map(campaign => ({
        id: campaign.id,
        siteName: campaign.point_sites?.name || 'Unknown',
        cashback: campaign.cashback_rate,
        cashbackYen: this.convertToYen(campaign.cashback_rate, campaign.point_sites?.name || 'Unknown'),
        device: campaign.device,
        url: campaign.campaign_url || campaign.point_sites?.url || '#',
        lastUpdated: new Date(campaign.updated_at).toLocaleString('ja-JP'),
        description: campaign.name,
        displayName: this.createDisplayName(campaign.name),
        campaignUrl: campaign.campaign_url,
        pointSiteUrl: campaign.point_sites?.url,
        category: campaign.category,
        // 検索用のキーワード（小文字化）
        searchKeywords: campaign.name.toLowerCase(),
        // 検索の重み付け用
        searchWeight: this.calculateSearchWeight(campaign)
      }));

      // カテゴリ別統計を生成
      const categoryStats = this.generateCategoryStats(validCampaigns);
      
      // デバイス別統計を生成
      const deviceStats = this.generateDeviceStats(validCampaigns);
      
      // サイト別統計を生成
      const siteStats = this.generateSiteStats(validCampaigns);

      // 最高還元率データを生成（過去7日間）
      const maxCashbackData = await this.generateMaxCashbackData();

      // 人気キーワードを生成（仮データ）
      const popularKeywords = this.generatePopularKeywords(campaigns);

      // 統合データオブジェクト
      const outputData = {
        campaigns: searchData,
        metadata: {
          totalCampaigns: campaigns.length,
          lastUpdated: new Date().toISOString(),
          categories: categoryStats,
          devices: deviceStats,
          sites: siteStats,
          maxCashbackData,
          popularKeywords
        }
      };

      // publicディレクトリにJSONファイルを出力
      const outputPath = 'public/search-data.json';
      await fs.writeFile(outputPath, JSON.stringify(outputData, null, 2), 'utf8');
      
      console.log(`💾 検索データを保存: ${outputPath}`);
      console.log(`📊 統計情報:`);
      console.log(`   - 総キャンペーン数: ${campaigns.length}件`);
      console.log(`   - カテゴリ数: ${Object.keys(categoryStats).length}個`);
      console.log(`   - ポイントサイト数: ${Object.keys(siteStats).length}個`);
      console.log(`   - ファイルサイズ: ${Math.round((JSON.stringify(outputData).length / 1024 / 1024) * 100) / 100}MB`);

      // 検索インデックス用の軽量版も作成
      const lightweightData = {
        campaigns: searchData.map(campaign => ({
          id: campaign.id,
          siteName: campaign.siteName,
          cashback: campaign.cashback,
          device: campaign.device,
          description: campaign.description.substring(0, 100),
          searchKeywords: campaign.searchKeywords,
          category: campaign.category
        })),
        metadata: {
          totalCampaigns: campaigns.length,
          lastUpdated: new Date().toISOString()
        }
      };

      const lightOutputPath = 'public/search-index.json';
      await fs.writeFile(lightOutputPath, JSON.stringify(lightweightData, null, 2), 'utf8');
      
      console.log(`💾 軽量版検索インデックスを保存: ${lightOutputPath}`);

      console.log('\n' + '='.repeat(60));
      console.log('🎉 検索データ生成完了');

    } catch (error) {
      console.error('💥 検索データ生成エラー:', error);
    }
  }

  // 検索の重み付けを計算
  calculateSearchWeight(campaign) {
    let weight = 1;
    
    // 更新日が新しいほど重み付けを上げる
    const daysSinceUpdate = (Date.now() - new Date(campaign.updated_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate < 7) weight += 0.5;
    if (daysSinceUpdate < 1) weight += 0.3;
    
    // 還元率が高いほど重み付けを上げる
    const cashbackMatch = campaign.cashback_rate.match(/(\d+(?:\.\d+)?)/);
    if (cashbackMatch) {
      const cashbackValue = parseFloat(cashbackMatch[1]);
      if (cashbackValue > 1000) weight += 0.4;
      else if (cashbackValue > 100) weight += 0.2;
    }
    
    return weight;
  }

  // ポイントを円に換算する関数
  convertToYen(cashback, siteName) {
    // 入力値のクリーニング
    const cleanedCashback = cashback.trim();
    
    // %表記の場合はそのまま返す
    if (cleanedCashback.includes('%') || cleanedCashback.includes('％')) {
      return cleanedCashback;
    }
    
    // 「円」が既に含まれている場合はそのまま返す
    if (cleanedCashback.includes('円')) {
      return cleanedCashback;
    }
    
    // 「要確認」などの特殊な値の場合はそのまま返す
    if (cleanedCashback === '要確認' || cleanedCashback === '-' || cleanedCashback === '') {
      return cleanedCashback;
    }
    
    // 数値とポイント/ptを抽出 - 最大表記も対応
    const pointMatch = cleanedCashback.match(/^(?:最大)?(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:ポイント|point|pt|p)$/i);
    
    if (!pointMatch) {
      // 数値が抽出できない場合はそのまま返す
      return cleanedCashback;
    }
    
    // カンマを除去して数値に変換
    const pointValue = parseFloat(pointMatch[1].replace(/,/g, ''));
    
    if (isNaN(pointValue)) {
      return cleanedCashback;
    }
    
    // サイト名から換算レートを取得
    const conversionRate = this.conversionRates[siteName] || this.conversionRates['Unknown'];
    
    // 円に換算
    const yenValue = Math.floor(pointValue * conversionRate);
    
    // 3桁区切りでフォーマット
    const formattedYen = yenValue.toLocaleString('ja-JP');
    
    return `${formattedYen}円`;
  }

  // 表示用の案件名を作成（IDサフィックスを除去）
  createDisplayName(fullName) {
    if (!fullName) return '案件名不明';
    
    // IDサフィックス（_1234567 形式）を除去
    let displayName = fullName.replace(/_\d+$/, '');
    
    // プレフィックス（[ショップ]、[サービス]、[アプリ]）を除去
    displayName = displayName.replace(/^\[(?:ショップ|サービス|アプリ|その他)\]/, '');
    
    // 余分な空白を除去
    displayName = displayName.trim();
    
    // 空になった場合はフォールバック
    if (!displayName || displayName === '') {
      return '案件名不明';
    }
    
    return displayName;
  }

  // カテゴリ別統計を生成
  generateCategoryStats(campaigns) {
    const stats = {};
    campaigns.forEach(campaign => {
      const category = campaign.category || 'other';
      stats[category] = (stats[category] || 0) + 1;
    });
    return stats;
  }

  // デバイス別統計を生成
  generateDeviceStats(campaigns) {
    const stats = {};
    campaigns.forEach(campaign => {
      const device = campaign.device || 'All';
      stats[device] = (stats[device] || 0) + 1;
    });
    return stats;
  }

  // サイト別統計を生成
  generateSiteStats(campaigns) {
    const stats = {};
    campaigns.forEach(campaign => {
      const siteName = campaign.point_sites?.name || 'Unknown';
      stats[siteName] = (stats[siteName] || 0) + 1;
    });
    return stats;
  }

  // 過去7日間の最高還元率データを生成
  async generateMaxCashbackData() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    try {
      const { data: recentCampaigns } = await this.supabase
        .from('campaigns')
        .select(`
          cashback_rate,
          name,
          point_sites (name),
          updated_at
        `)
        .eq('is_active', true)
        .gte('updated_at', sevenDaysAgo.toISOString())
        .order('updated_at', { ascending: false });

      if (!recentCampaigns || recentCampaigns.length === 0) {
        return null;
      }

      // 還元率の数値を抽出して最高額を見つける
      let maxCashback = null;
      let maxValue = 0;

      recentCampaigns.forEach(campaign => {
        const cashbackMatch = campaign.cashback_rate.match(/(\d+(?:\.\d+)?)/);
        if (cashbackMatch) {
          const value = parseFloat(cashbackMatch[1]);
          if (value > maxValue) {
            maxValue = value;
            maxCashback = {
              amount: campaign.cashback_rate,
              site: campaign.point_sites?.name || 'Unknown',
              campaignName: campaign.name.substring(0, 50),
              date: new Date(campaign.updated_at).toLocaleDateString('ja-JP')
            };
          }
        }
      });

      return maxCashback;
    } catch (error) {
      console.error('最高還元率データ生成エラー:', error);
      return null;
    }
  }

  // 人気キーワードを生成（キャンペーン名から抽出）
  generatePopularKeywords(campaigns) {
    const keywordCount = {};
    
    campaigns.forEach(campaign => {
      // キャンペーン名から単語を抽出
      const words = campaign.name
        .replace(/[\[\]【】（）()]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 1)
        .slice(0, 5); // 最初の5単語まで
      
      words.forEach(word => {
        const cleanWord = word.toLowerCase();
        if (cleanWord.length > 1 && !cleanWord.match(/^\d+$/)) {
          keywordCount[cleanWord] = (keywordCount[cleanWord] || 0) + 1;
        }
      });
    });

    // 出現回数でソートして上位20個を返す
    return Object.entries(keywordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20)
      .map(([keyword, count]) => ({ keyword, count }));
  }
}

// 実行
(async () => {
  const generator = new SearchDataGenerator();
  await generator.generateSearchData();
})();