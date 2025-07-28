const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;

const supabaseUrl = 'https://pjjhyzbnnslaauwzknrr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqamh5emJubnNsYWF1d3prbnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5ODg4MzksImV4cCI6MjA2NjU2NDgzOX0.qcrcwNpwX83dCNbhxFaks2E68K_wp2W8urdYwfenDtM';

class DetailedDataAnalyzer {
  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.chobirichSiteId = 'f944d469-99a2-4285-8f7c-82027dddbc77';
  }

  async analyzeDataSources() {
    console.log('🔬 詳細データ分析開始');
    console.log('='.repeat(60));

    try {
      // 1. Supabaseから全データを段階的に取得
      console.log('📊 Supabaseデータ全量取得中...');
      
      let allDbCampaigns = [];
      let offset = 0;
      const batchSize = 1000;
      
      while (true) {
        const { data: batchData, error } = await this.supabase
          .from('campaigns')
          .select('id, name, point_site_id, is_active, created_at, updated_at')
          .eq('point_site_id', this.chobirichSiteId)
          .range(offset, offset + batchSize - 1);

        if (error) {
          throw new Error(`Supabase取得エラー: ${error.message}`);
        }

        if (!batchData || batchData.length === 0) {
          break;
        }

        allDbCampaigns.push(...batchData);
        console.log(`  取得済み: ${allDbCampaigns.length}件`);
        
        if (batchData.length < batchSize) {
          break;
        }
        
        offset += batchSize;
      }

      console.log(`✅ Supabase総取得数: ${allDbCampaigns.length}件`);

      // 2. 検索データファイル分析
      console.log('\n📄 検索ファイル詳細分析中...');
      const searchDataContent = await fs.readFile('/Users/kn/poisoku-web/public/search-data.json', 'utf8');
      const searchData = JSON.parse(searchDataContent);
      
      const chobirichSearchCampaigns = searchData.campaigns.filter(c => c.siteName === 'ちょびリッチ');
      console.log(`✅ 検索ファイル内ちょびリッチ案件数: ${chobirichSearchCampaigns.length}件`);

      // 3. カテゴリ別分析
      console.log('\n📊 検索ファイルのカテゴリ別分析:');
      const categoryCount = {};
      chobirichSearchCampaigns.forEach(campaign => {
        const category = campaign.category || 'unknown';
        categoryCount[category] = (categoryCount[category] || 0) + 1;
      });
      
      Object.entries(categoryCount).forEach(([category, count]) => {
        console.log(`  ${category}: ${count}件`);
      });

      // 4. データベースの最終更新時間確認
      console.log('\n⏰ データベース更新時間分析:');
      const latestUpdates = allDbCampaigns
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
        .slice(0, 5);
      
      latestUpdates.forEach((campaign, index) => {
        console.log(`  ${index + 1}. ${campaign.name.substring(0, 50)}... (更新: ${campaign.updated_at})`);
      });

      // 5. 検索データ生成時刻確認
      console.log('\n📅 検索データ生成時刻確認:');
      if (searchData.generated_at) {
        console.log(`  生成時刻: ${searchData.generated_at}`);
      } else {
        console.log('  生成時刻情報なし');
      }

      // 6. 実際の差異原因分析
      console.log('\n🔍 差異原因分析:');
      const dbCount = allDbCampaigns.length;
      const searchCount = chobirichSearchCampaigns.length;
      const difference = searchCount - dbCount;

      console.log(`  データベース: ${dbCount}件`);
      console.log(`  検索ファイル: ${searchCount}件`);
      console.log(`  差異: ${difference}件`);

      if (difference > 0) {
        console.log('\n⚠️ 検索ファイルの方が多い理由の可能性:');
        console.log('  1. 検索データ生成時に他のポイントサイトデータが混入');
        console.log('  2. 過去のデータが残存している');
        console.log('  3. generate-search-data.jsで重複データが作成されている');
        console.log('  4. siteName判定ロジックの問題');
      }

      // 7. 実際の検索データ内容サンプル確認
      console.log('\n📝 検索データサンプル（最初の3件）:');
      chobirichSearchCampaigns.slice(0, 3).forEach((campaign, index) => {
        console.log(`  ${index + 1}. ID: ${campaign.id}`);
        console.log(`     サイト名: ${campaign.siteName}`);
        console.log(`     タイトル: ${campaign.description?.substring(0, 50)}...`);
        console.log(`     カテゴリ: ${campaign.category}`);
        console.log('');
      });

      return {
        dbCount,
        searchCount,
        difference,
        categoryBreakdown: categoryCount
      };

    } catch (error) {
      console.error('詳細分析エラー:', error);
      throw error;
    }
  }
}

// 実行
async function runDetailedAnalysis() {
  const analyzer = new DetailedDataAnalyzer();
  await analyzer.analyzeDataSources();
}

runDetailedAnalysis().catch(console.error);