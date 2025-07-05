const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pjjhyzbnnslaauwzknrr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqamh5emJubnNsYWF1d3prbnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5ODg4MzksImV4cCI6MjA2NjU2NDgzOX0.qcrcwNpwX83dCNbhxFaks2E68K_wp2W8urdYwfenDtM';

async function checkExistingTables() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('🔍 既存テーブルを探索中...');
  console.log('='.repeat(60));
  
  // ポイ速で使われていそうなテーブル名のリスト
  const possibleTableNames = [
    // 一般的なテーブル名
    'campaigns', 'sites', 'users', 'rankings', 'categories',
    
    // ちょびリッチ関連
    'chobirich_campaigns', 'chobirich_sites', 'chobirich_data',
    
    // カテゴリ別
    'app_campaigns', 'shopping_campaigns', 'service_campaigns',
    
    // ポイントサイト関連
    'point_sites', 'site_rankings', 'campaign_rankings', 'points',
    
    // 検索関連
    'search_rankings', 'popular_searches', 'search_logs',
    
    // システム関連
    'apps', 'services', 'products', 'deals', 'offers',
    
    // 日本語系
    'サイト', 'キャンペーン', 'ランキング'
  ];
  
  const existingTables = [];
  
  for (const tableName of possibleTableNames) {
    try {
      console.log(`テスト中: ${tableName}`);
      
      // テーブルが存在するかチェック（1行だけ取得）
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
      
      if (!error) {
        console.log(`✅ 発見: ${tableName}`);
        existingTables.push({
          name: tableName,
          sampleData: data,
          recordCount: data ? data.length : 0
        });
        
        // レコード数も取得
        try {
          const { count, error: countError } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: true });
          
          if (!countError) {
            console.log(`   📊 レコード数: ${count}件`);
            existingTables[existingTables.length - 1].totalCount = count;
          }
        } catch (e) {
          console.log(`   レコード数取得エラー: ${e.message}`);
        }
        
        console.log(`   サンプルデータ: ${JSON.stringify(data, null, 2)}`);
        console.log('');
        
      } else if (error.code !== '42P01') {
        // テーブルは存在するが、権限エラーなど
        console.log(`⚠️  ${tableName}: ${error.message}`);
      }
      
    } catch (error) {
      // テーブルが存在しない場合は無視
      if (error.code !== '42P01') {
        console.log(`❌ ${tableName}: ${error.message}`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 発見されたテーブル一覧:');
  console.log('='.repeat(60));
  
  if (existingTables.length === 0) {
    console.log('❌ 既存のテーブルが見つかりませんでした。');
    console.log('');
    console.log('考えられる原因:');
    console.log('1. Row Level Security (RLS) が有効');
    console.log('2. テーブルが存在しない');
    console.log('3. 異なる命名規則を使用');
    console.log('4. スキーマが "public" 以外');
  } else {
    existingTables.forEach((table, index) => {
      console.log(`${index + 1}. ${table.name} (${table.totalCount || '?'}件)`);
    });
  }
}

checkExistingTables().catch(console.error);