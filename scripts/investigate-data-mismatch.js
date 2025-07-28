const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;

const supabaseUrl = 'https://pjjhyzbnnslaauwzknrr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqamh5emJubnNsYWF1d3prbnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5ODg4MzksImV4cCI6MjA2NjU2NDgzOX0.qcrcwNpwX83dCNbhxFaks2E68K_wp2W8urdYwfenDtM';

class DataMismatchInvestigator {
  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.chobirichSiteId = 'f944d469-99a2-4285-8f7c-82027dddbc77';
  }

  async investigateDataMismatch() {
    console.log('🔍 データ不整合調査開始');
    console.log('='.repeat(60));

    try {
      // 1. 本番環境の検索データを取得
      console.log('📡 本番環境の検索データを取得中...');
      const productionResponse = await fetch('https://poisoku.jp/search-data.json?' + Date.now());
      const productionData = await productionResponse.json();
      
      const productionChobirich = productionData.campaigns.filter(c => c.siteName === 'ちょびリッチ');
      console.log(`  本番検索データ: ${productionData.campaigns.length}件`);
      console.log(`  本番ちょびリッチ: ${productionChobirich.length}件`);

      // 2. ローカルの検索データを取得
      console.log('\n📄 ローカルの検索データを取得中...');
      const localSearchData = JSON.parse(await fs.readFile('/Users/kn/poisoku-web/public/search-data.json', 'utf8'));
      const localChobirich = localSearchData.campaigns.filter(c => c.siteName === 'ちょびリッチ');
      console.log(`  ローカル検索データ: ${localSearchData.campaigns.length}件`);
      console.log(`  ローカルちょびリッチ: ${localChobirich.length}件`);

      // 3. Supabaseの最新データを取得
      console.log('\n💾 Supabaseの最新データを取得中...');
      const { data: dbCampaigns, error } = await this.supabase
        .from('campaigns')
        .select('id, name, point_site_id, is_active, updated_at')
        .eq('point_site_id', this.chobirichSiteId)
        .eq('is_active', true);

      if (error) {
        throw new Error(`Supabase取得エラー: ${error.message}`);
      }

      console.log(`  Supabaseちょびリッチ(有効): ${dbCampaigns.length}件`);

      // 4. データの一致性チェック
      console.log('\n🔬 データ一致性分析...');
      
      const isLocalMatchProduction = localChobirich.length === productionChobirich.length;
      const isLocalMatchDatabase = localChobirich.length === dbCampaigns.length;
      const isProductionMatchDatabase = productionChobirich.length === dbCampaigns.length;

      console.log(`  ローカル ⇔ 本番: ${isLocalMatchProduction ? '✅ 一致' : '❌ 不一致'}`);
      console.log(`  ローカル ⇔ DB: ${isLocalMatchDatabase ? '✅ 一致' : '❌ 不一致'}`);
      console.log(`  本番 ⇔ DB: ${isProductionMatchDatabase ? '✅ 一致' : '❌ 不一致'}`);

      // 5. 具体的なデータサンプル比較
      console.log('\n📝 データサンプル比較...');
      
      console.log('  本番データサンプル（最初の3件）:');
      productionChobirich.slice(0, 3).forEach((campaign, index) => {
        console.log(`    ${index + 1}. ${campaign.id} - ${campaign.description?.substring(0, 40)}...`);
      });

      console.log('\n  ローカルデータサンプル（最初の3件）:');
      localChobirich.slice(0, 3).forEach((campaign, index) => {
        console.log(`    ${index + 1}. ${campaign.id} - ${campaign.description?.substring(0, 40)}...`);
      });

      console.log('\n  Supabaseデータサンプル（最初の3件）:');
      dbCampaigns.slice(0, 3).forEach((campaign, index) => {
        console.log(`    ${index + 1}. ${campaign.id} - ${campaign.name?.substring(0, 40)}...`);
      });

      // 6. ID比較による詳細分析
      console.log('\n🆔 ID比較分析...');
      const productionIds = new Set(productionChobirich.map(c => c.id));
      const localIds = new Set(localChobirich.map(c => c.id));
      const dbIds = new Set(dbCampaigns.map(c => c.id));

      const localNotInProduction = [...localIds].filter(id => !productionIds.has(id));
      const productionNotInLocal = [...productionIds].filter(id => !localIds.has(id));
      const dbNotInProduction = [...dbIds].filter(id => !productionIds.has(id));

      console.log(`  ローカルにあって本番にない: ${localNotInProduction.length}件`);
      console.log(`  本番にあってローカルにない: ${productionNotInLocal.length}件`);
      console.log(`  DBにあって本番にない: ${dbNotInProduction.length}件`);

      if (localNotInProduction.length > 0) {
        console.log(`    例: ${localNotInProduction.slice(0, 3).join(', ')}`);
      }

      // 7. Vercelデプロイ状況確認
      console.log('\n🚀 Vercelデプロイ状況確認...');
      try {
        const githubResponse = await fetch('https://api.github.com/repos/poisoku/poisoku-web/commits/main');
        const githubData = await githubResponse.json();
        console.log(`  最新コミット: ${githubData.sha.substring(0, 7)}`);
        console.log(`  コミット時刻: ${githubData.commit.author.date}`);
      } catch (error) {
        console.log('  GitHub API取得エラー');
      }

      // 8. 結論と推奨事項
      console.log('\n📋 調査結果と推奨事項:');
      console.log('='.repeat(60));

      if (!isLocalMatchProduction) {
        console.log('⚠️ 問題発見: ローカルと本番のデータが一致していません');
        console.log('💡 推奨対応:');
        console.log('   1. 検索データを再生成してプッシュ');
        console.log('   2. Vercelでの自動デプロイ完了を待つ');
        console.log('   3. CDNキャッシュのパージ');
      } else if (productionChobirich.length !== dbCampaigns.length) {
        console.log('⚠️ 問題発見: 本番データとデータベースが不一致');
        console.log('💡 推奨対応:');
        console.log('   1. データベースから検索データを再生成');
        console.log('   2. 生成されたファイルをデプロイ');
      } else {
        console.log('✅ データの一致性は保たれています');
        console.log('💡 古いデータが見える原因:');
        console.log('   1. ブラウザの強固なキャッシュ');
        console.log('   2. CDN/エッジキャッシュの残存');
        console.log('   3. Service Workerキャッシュ');
      }

      return {
        production: productionChobirich.length,
        local: localChobirich.length,
        database: dbCampaigns.length,
        mismatch: !isLocalMatchProduction
      };

    } catch (error) {
      console.error('調査エラー:', error);
      throw error;
    }
  }
}

// 実行
async function runInvestigation() {
  const investigator = new DataMismatchInvestigator();
  await investigator.investigateDataMismatch();
}

runInvestigation().catch(console.error);