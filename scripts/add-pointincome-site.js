const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pjjhyzbnnslaauwzknrr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqamh5emJubnNsYWF1d3prbnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5ODg4MzksImV4cCI6MjA2NjU2NDgzOX0.qcrcwNpwX83dCNbhxFaks2E68K_wp2W8urdYwfenDtM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function addPointIncomeSite() {
  console.log('🏢 ポイントインカムをpoint_sitesテーブルに追加中...');
  
  try {
    // 既存のポイントインカムを確認
    const { data: existing, error: checkError } = await supabase
      .from('point_sites')
      .select('*')
      .eq('name', 'ポイントインカム')
      .single();
    
    if (existing) {
      console.log('✅ ポイントインカムは既に登録されています');
      console.log(`  ID: ${existing.id}`);
      console.log(`  URL: ${existing.url}`);
      return existing;
    }
    
    // 新規追加
    const { data, error } = await supabase
      .from('point_sites')
      .insert({
        name: 'ポイントインカム',
        url: 'https://pointi.jp',
        description: 'ポイントインカムは高還元率が魅力のポイントサイトです',
        is_active: true
      })
      .select()
      .single();
    
    if (error) {
      console.error('❌ 追加エラー:', error);
      return null;
    }
    
    console.log('✅ ポイントインカムを追加しました');
    console.log(`  ID: ${data.id}`);
    console.log(`  URL: ${data.url}`);
    return data;
    
  } catch (error) {
    console.error('❌ エラー:', error);
    return null;
  }
}

// 実行
(async () => {
  await addPointIncomeSite();
})();