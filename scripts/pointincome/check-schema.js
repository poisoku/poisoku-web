const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

// 環境変数を.env.localから読み込み
const envPath = path.join(__dirname, '../../.env.local');
let supabaseUrl, supabaseServiceKey;

try {
  const envContent = require('fs').readFileSync(envPath, 'utf8');
  const envVars = {};
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      envVars[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
    }
  });
  supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
  supabaseServiceKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;
} catch (error) {
  console.error('❌ .env.localファイルの読み込みエラー:', error.message);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchema() {
  console.log('🔍 データベーススキーマを確認中...');
  
  try {
    // campaignsテーブルの構造を確認
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ スキーマ確認エラー:', error);
      return;
    }
    
    if (campaigns && campaigns.length > 0) {
      console.log('✅ campaignsテーブルの現在のカラム:');
      Object.keys(campaigns[0]).forEach(column => {
        console.log(`  - ${column}`);
      });
      
      // categoryカラムが存在するかチェック
      if (campaigns[0].hasOwnProperty('category')) {
        console.log('\n✅ categoryカラムは既に存在します');
        
        // 既存のcategoryの値を確認
        const { data: categorySample } = await supabase
          .from('campaigns')
          .select('category')
          .not('category', 'is', null)
          .limit(10);
          
        if (categorySample && categorySample.length > 0) {
          console.log('\n📊 既存のcategory値のサンプル:');
          const categoryValues = [...new Set(categorySample.map(c => c.category))];
          categoryValues.forEach(cat => console.log(`  - ${cat}`));
        }
      } else {
        console.log('\n⚠️ categoryカラムが存在しません');
        console.log('📝 ALTERコマンドでカラムを追加する必要があります:');
        console.log('   ALTER TABLE campaigns ADD COLUMN category text;');
      }
    } else {
      console.log('⚠️ campaignsテーブルにデータがありません');
    }
    
    // ポイントインカムのデータを確認
    const { data: pointSites } = await supabase
      .from('point_sites')
      .select('id, name')
      .eq('name', 'ポイントインカム');
      
    if (pointSites && pointSites.length > 0) {
      const pointSiteId = pointSites[0].id;
      console.log(`\n🔍 ポイントインカム (ID: ${pointSiteId}) のデータを確認中...`);
      
      const { data: piCampaigns } = await supabase
        .from('campaigns')
        .select('name, device, category, cashback_rate')
        .eq('point_site_id', pointSiteId)
        .limit(10);
        
      if (piCampaigns && piCampaigns.length > 0) {
        console.log(`📊 ポイントインカムの案件サンプル (${piCampaigns.length}件):`);
        piCampaigns.forEach((campaign, index) => {
          console.log(`  ${index + 1}. ${campaign.name}`);
          console.log(`     デバイス: ${campaign.device || 'null'}`);
          console.log(`     カテゴリ: ${campaign.category || 'null'}`);
          console.log(`     還元率: ${campaign.cashback_rate || 'null'}`);
        });
        
        // デバイス別統計
        const deviceStats = {};
        const categoryStats = {};
        
        const { data: allPICampaigns } = await supabase
          .from('campaigns')
          .select('device, category')
          .eq('point_site_id', pointSiteId);
          
        if (allPICampaigns) {
          allPICampaigns.forEach(campaign => {
            deviceStats[campaign.device || 'null'] = (deviceStats[campaign.device || 'null'] || 0) + 1;
            categoryStats[campaign.category || 'null'] = (categoryStats[campaign.category || 'null'] || 0) + 1;
          });
          
          console.log('\n📈 ポイントインカムのデバイス別統計:');
          Object.entries(deviceStats).forEach(([device, count]) => {
            console.log(`  ${device}: ${count}件`);
          });
          
          console.log('\n📈 ポイントインカムのカテゴリ別統計:');
          Object.entries(categoryStats).forEach(([category, count]) => {
            console.log(`  ${category}: ${count}件`);
          });
        }
      } else {
        console.log('⚠️ ポイントインカムのデータが見つかりません');
      }
    }
    
  } catch (error) {
    console.error('❌ スキーマ確認エラー:', error);
  }
}

checkSchema();