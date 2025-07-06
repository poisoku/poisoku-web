const { createClient } = require('@supabase/supabase-js');

async function checkSchema() {
  console.log('🔍 Supabaseのスキーマを確認中...');
  
  const supabase = createClient(
    'https://pjjhyzbnnslaauwzknrr.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqamh5emJubnNsYWF1d3prbnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5ODg4MzksImV4cCI6MjA2NjU2NDgzOX0.qcrcwNpwX83dCNbhxFaks2E68K_wp2W8urdYwfenDtM'
  );

  try {
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ エラー:', error);
      return;
    }

    if (campaigns.length > 0) {
      console.log('📊 カラム名一覧:');
      Object.keys(campaigns[0]).forEach((key, index) => {
        console.log(`${index + 1}. ${key}: ${campaigns[0][key]}`);
      });
    }

  } catch (error) {
    console.error('❌ 接続エラー:', error);
  }
}

checkSchema();