const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;

const supabaseUrl = 'https://pjjhyzbnnslaauwzknrr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqamh5emJubnNsYWF1d3prbnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5ODg4MzksImV4cCI6MjA2NjU2NDgzOX0.qcrcwNpwX83dCNbhxFaks2E68K_wp2W8urdYwfenDtM';

class DataDiscrepancyInvestigator {
  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.chobirichSiteId = 'f944d469-99a2-4285-8f7c-82027dddbc77';
  }

  async investigateDiscrepancy() {
    console.log('🔍 データベースとファイルの差異調査開始');
    console.log('='.repeat(60));

    try {
      // 1. Supabaseからちょびリッチ案件数を取得
      console.log('📊 Supabaseデータ分析中...');
      const { data: dbCampaigns, error: dbError } = await this.supabase
        .from('campaigns')
        .select('id, name, is_active, created_at, updated_at')
        .eq('point_site_id', this.chobirichSiteId);

      if (dbError) {
        throw new Error(`Supabase取得エラー: ${dbError.message}`);
      }

      const activeCampaigns = dbCampaigns.filter(c => c.is_active);
      const inactiveCampaigns = dbCampaigns.filter(c => !c.is_active);

      console.log(`  総案件数: ${dbCampaigns.length}`);
      console.log(`  有効案件: ${activeCampaigns.length}`);
      console.log(`  無効案件: ${inactiveCampaigns.length}`);

      // 2. 検索データファイルを読み込み
      console.log('\n📄 検索ファイル分析中...');
      const searchDataContent = await fs.readFile('/Users/kn/poisoku-web/public/search-data.json', 'utf8');
      const searchData = JSON.parse(searchDataContent);
      
      const chobirichSearchCampaigns = searchData.campaigns.filter(c => c.siteName === 'ちょびリッチ');
      console.log(`  検索ファイル内ちょびリッチ案件数: ${chobirichSearchCampaigns.length}`);

      // 3. 差異分析
      console.log('\n🔬 差異分析...');
      const dbCount = dbCampaigns.length;
      const activeDbCount = activeCampaigns.length;
      const searchCount = chobirichSearchCampaigns.length;
      
      const totalDifference = dbCount - searchCount;
      const activeDifference = activeDbCount - searchCount;

      console.log(`  データベース総数: ${dbCount}`);
      console.log(`  データベース有効数: ${activeDbCount}`);
      console.log(`  検索ファイル数: ${searchCount}`);
      console.log(`  総差異: ${totalDifference}`);
      console.log(`  有効案件差異: ${activeDifference}`);

      // 4. 無効案件の詳細確認
      if (inactiveCampaigns.length > 0) {
        console.log('\n⚠️ 無効案件の詳細:');
        inactiveCampaigns.slice(0, 5).forEach((campaign, index) => {
          console.log(`  ${index + 1}. ${campaign.name} (作成: ${campaign.created_at})`);
        });
        if (inactiveCampaigns.length > 5) {
          console.log(`  ... および他${inactiveCampaigns.length - 5}件`);
        }
      }

      // 5. 検索データ生成スクリプトの確認
      console.log('\n🔍 検索データ生成ロジック確認...');
      
      // generate-search-data.jsのフィルタリング条件を確認
      try {
        const generateScript = await fs.readFile('/Users/kn/poisoku-web/scripts/generate-search-data.js', 'utf8');
        
        if (generateScript.includes('is_active')) {
          console.log('  ✅ generate-search-data.jsでis_activeフィルタを使用している可能性');
        } else {
          console.log('  ⚠️ generate-search-data.jsでis_activeフィルタを使用していない可能性');
        }

        if (generateScript.includes('where') || generateScript.includes('filter')) {
          console.log('  ✅ 何らかのフィルタリング条件が設定されている');
        }
      } catch (scriptError) {
        console.log('  ⚠️ generate-search-data.js読み込みエラー');
      }

      // 6. 結論と推奨事項
      console.log('\n📋 調査結果サマリー:');
      console.log('='.repeat(60));
      
      if (Math.abs(activeDifference) <= 5) {
        console.log('✅ 差異は許容範囲内（5件以下）');
        console.log('   原因: データ処理中のタイミング差異またはフィルタリング条件');
      } else if (inactiveCampaigns.length === totalDifference) {
        console.log('✅ 差異の原因が特定されました');
        console.log('   原因: 無効案件(is_active=false)が検索データから除外されている');
        console.log('   これは正常な動作です');
      } else {
        console.log('⚠️ 予期しない差異が発生しています');
        console.log('   詳細な調査が必要です');
      }

      return {
        dbTotal: dbCount,
        dbActive: activeDbCount,
        searchFile: searchCount,
        difference: totalDifference,
        inactiveCount: inactiveCampaigns.length
      };

    } catch (error) {
      console.error('調査エラー:', error);
      throw error;
    }
  }
}

// 実行
async function runInvestigation() {
  const investigator = new DataDiscrepancyInvestigator();
  await investigator.investigateDiscrepancy();
}

runInvestigation().catch(console.error);