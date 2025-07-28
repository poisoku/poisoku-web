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

async function addCategoryColumn() {
  console.log('🔧 categoryカラムを追加中...');
  
  try {
    // SQLクエリでカラムを追加
    // 注意: anonキーでは直接DDLを実行できない可能性があるため、
    // Supabaseダッシュボードで手動実行が必要な場合があります
    
    const { data, error } = await supabase.rpc('add_category_column_if_not_exists');
    
    if (error) {
      console.log('⚠️ RPCでの追加が失敗しました:', error.message);
      console.log('\n📝 手動でSupabaseダッシュボードで以下のSQLを実行してください:');
      console.log('');
      console.log('-- campaignsテーブルにcategoryカラムを追加');
      console.log('ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS category text DEFAULT \'other\';');
      console.log('');
      console.log('-- インデックスを追加（検索性能向上のため）');
      console.log('CREATE INDEX IF NOT EXISTS idx_campaigns_category ON campaigns(category);');
      console.log('');
      console.log('-- 既存データのcategoryを更新（必要に応じて）');
      console.log('UPDATE campaigns SET category = \'shopping\' WHERE category IS NULL;');
      console.log('');
      
      return false;
    }
    
    console.log('✅ categoryカラムの追加が完了しました');
    return true;
    
  } catch (error) {
    console.error('❌ カラム追加エラー:', error);
    console.log('\n📝 手動でSupabaseダッシュボードで以下のSQLを実行してください:');
    console.log('');
    console.log('-- campaignsテーブルにcategoryカラムを追加');
    console.log('ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS category text DEFAULT \'other\';');
    console.log('');
    console.log('-- インデックスを追加（検索性能向上のため）');
    console.log('CREATE INDEX IF NOT EXISTS idx_campaigns_category ON campaigns(category);');
    console.log('');
    
    return false;
  }
}

// 実行
addCategoryColumn().then(success => {
  if (success) {
    console.log('🎉 マイグレーション完了');
  } else {
    console.log('⚠️ 手動での作業が必要です');
  }
});