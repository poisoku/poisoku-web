const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pjjhyzbnnslaauwzknrr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqamh5emJubnNsYWF1d3prbnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5ODg4MzksImV4cCI6MjA2NjU2NDgzOX0.qcrcwNpwX83dCNbhxFaks2E68K_wp2W8urdYwfenDtM';

async function checkSupabaseSchema() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('🔍 Supabaseデータベーススキーマを確認中...');
  console.log('='.repeat(60));
  
  try {
    // テーブル一覧を取得
    const { data: tables, error: tablesError } = await supabase.rpc('get_schema_info');
    
    if (tablesError) {
      console.log('RPC関数が利用できません。SQL Editorを使用して確認します...');
      
      // 代替方法：直接SQLクエリを実行
      const { data: tablesList, error: listError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_type', 'BASE TABLE');
      
      if (listError) {
        console.error('テーブル一覧の取得に失敗:', listError);
        
        // 更に代替方法：pg_catalog を使用
        console.log('\n代替方法でテーブル一覧を確認...');
        const { data: pgTables, error: pgError } = await supabase
          .from('pg_catalog.pg_tables')
          .select('tablename')
          .eq('schemaname', 'public');
        
        if (pgTables) {
          console.log('\n📋 公開テーブル一覧:');
          pgTables.forEach(table => {
            console.log(`  - ${table.tablename}`);
          });
          
          // 各テーブルの詳細を確認
          for (const table of pgTables) {
            await checkTableStructure(supabase, table.tablename);
          }
        } else {
          console.error('pg_catalog からもテーブル取得に失敗:', pgError);
        }
      } else {
        console.log('\n📋 テーブル一覧:');
        tablesList.forEach(table => {
          console.log(`  - ${table.table_name}`);
        });
        
        // 各テーブルの詳細を確認
        for (const table of tablesList) {
          await checkTableStructure(supabase, table.table_name);
        }
      }
    }
    
  } catch (error) {
    console.error('スキーマ確認エラー:', error);
    
    // 最終手段：既知のテーブル名で確認
    console.log('\n最終手段：一般的なテーブル名で確認中...');
    const commonTableNames = [
      'campaigns', 'chobirich_campaigns', 'app_campaigns', 'shopping_campaigns', 
      'service_campaigns', 'sites', 'categories', 'users', 'rankings', 'points',
      'site_rankings', 'campaign_rankings', 'point_sites', 'apps', 'services'
    ];
    
    for (const tableName of commonTableNames) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
        
        if (!error) {
          console.log(`✅ テーブル発見: ${tableName}`);
          await checkTableStructure(supabase, tableName);
        }
      } catch (e) {
        // テーブルが存在しない場合は無視
      }
    }
  }
}

async function checkTableStructure(supabase, tableName) {
  console.log(`\n📊 テーブル: ${tableName}`);
  console.log('-'.repeat(40));
  
  try {
    // カラム情報を取得
    const { data: columns, error } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_name', tableName)
      .eq('table_schema', 'public')
      .order('ordinal_position');
    
    if (columns && columns.length > 0) {
      columns.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
        console.log(`  ${col.column_name}: ${col.data_type} ${nullable}${defaultVal}`);
      });
      
      // サンプルデータを取得
      const { data: sample, error: sampleError } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
      
      if (sample && sample.length > 0) {
        console.log('\n  📝 サンプルデータ:');
        console.log(`    ${JSON.stringify(sample[0], null, 4)}`);
      }
      
      // レコード数を取得
      const { count, error: countError } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });
      
      if (!countError) {
        console.log(`\n  📊 レコード数: ${count}件`);
      }
      
    } else {
      console.log('  カラム情報を取得できませんでした');
    }
  } catch (error) {
    console.log(`  エラー: ${error.message}`);
  }
}

// 実行
checkSupabaseSchema().catch(console.error);