const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

// 環境変数を.env.localから読み込み
const envPath = path.join(__dirname, '../.env.local');
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

async function addCategoryColumn() {
  console.log('🔧 categoryカラムの追加を試行中...');
  
  try {
    // まず現在のテーブル構造を確認
    console.log('\n📊 現在のテーブル構造を確認中...');
    const { data: testData, error: testError } = await supabase
      .from('campaigns')
      .select('*')
      .limit(1);
    
    if (testError) {
      throw new Error(`テーブルアクセスエラー: ${testError.message}`);
    }
    
    if (testData && testData.length > 0) {
      const columns = Object.keys(testData[0]);
      console.log(`✅ 現在のカラム (${columns.length}個):`);
      columns.forEach(col => console.log(`  - ${col}`));
      
      const hasCategoryColumn = columns.includes('category');
      console.log(`\n🔍 categoryカラム: ${hasCategoryColumn ? '✅ 既に存在' : '❌ 存在しません'}`);
      
      if (hasCategoryColumn) {
        console.log('✅ categoryカラムは既に存在します。統合処理に進みます。');
        return true;
      }
    }
    
    // DDL実行の試行（ANON KEYでは権限不足の可能性が高い）
    console.log('\n🔧 categoryカラムの追加を試行中...');
    
    // まず、RPC関数を試行
    try {
      const { data, error } = await supabase.rpc('add_category_column_if_not_exists');
      if (!error) {
        console.log('✅ RPC経由でcategoryカラムを追加しました');
        return true;
      }
      console.log('⚠️ RPC関数が利用できません:', error.message);
    } catch (rpcError) {
      console.log('⚠️ RPC関数の実行に失敗:', rpcError.message);
    }
    
    // 直接SQLクエリを試行
    console.log('\n📝 手動でのSQL実行が必要です');
    console.log('以下の手順を実行してください:');
    console.log('');
    console.log('1. https://app.supabase.com にアクセス');
    console.log('2. プロジェクトを選択');
    console.log('3. 左メニューから「SQL Editor」を選択');
    console.log('4. 以下のSQLを実行:');
    console.log('');
    console.log('-- categoryカラムを追加');
    console.log('ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS category text DEFAULT \'other\';');
    console.log('');
    console.log('-- インデックスを作成');
    console.log('CREATE INDEX IF NOT EXISTS idx_campaigns_category ON campaigns(category);');
    console.log('CREATE INDEX IF NOT EXISTS idx_campaigns_category_device ON campaigns(category, device);');
    console.log('');
    console.log('-- 確認クエリ');
    console.log('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = \'campaigns\' ORDER BY ordinal_position;');
    console.log('');
    
    return false;
    
  } catch (error) {
    console.error('❌ categoryカラム追加エラー:', error);
    console.log('\n📝 手動でのSQL実行が必要です（上記の手順を参照）');
    return false;
  }
}

// 現在のポイントインカムデータの統計を確認
async function checkCurrentData() {
  console.log('\n📊 現在のポイントインカムデータを確認中...');
  
  try {
    const { data: pointSites } = await supabase
      .from('point_sites')
      .select('id, name')
      .eq('name', 'ポイントインカム');
    
    if (pointSites && pointSites.length > 0) {
      const pointSiteId = pointSites[0].id;
      
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('device, name, cashback_rate')
        .eq('point_site_id', pointSiteId);
      
      if (campaigns) {
        const deviceStats = {};
        let mobileAppCount = 0;
        let foundShishi = false;
        
        campaigns.forEach(campaign => {
          deviceStats[campaign.device] = (deviceStats[campaign.device] || 0) + 1;
          
          if (campaign.device === 'iOS' || campaign.device === 'Android') {
            mobileAppCount++;
          }
          
          if (campaign.name.includes('獅子の如く')) {
            foundShishi = true;
            console.log(`🎯 発見: ${campaign.name} (${campaign.device}) - ${campaign.cashback_rate}`);
          }
        });
        
        console.log(`\n📱 ポイントインカムの統計:`);
        console.log(`  総案件数: ${campaigns.length}件`);
        Object.entries(deviceStats).forEach(([device, count]) => {
          console.log(`  ${device}: ${count}件`);
        });
        console.log(`  モバイルアプリ: ${mobileAppCount}件`);
        console.log(`  獅子の如く: ${foundShishi ? '✅ 発見' : '❌ 未発見'}`);
      }
    }
  } catch (error) {
    console.error('データ確認エラー:', error);
  }
}

// 実行
(async () => {
  const categoryAdded = await addCategoryColumn();
  await checkCurrentData();
  
  if (categoryAdded) {
    console.log('\n🎉 categoryカラムが利用可能です。統合処理を実行してください:');
    console.log('node scripts/pointincome/integrate-to-database.js');
  } else {
    console.log('\n⚠️ 手動でのカラム追加後、統合処理を実行してください');
  }
})();