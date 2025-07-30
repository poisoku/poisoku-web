const { createClient } = require('@supabase/supabase-js');

// Supabase設定
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pjjhyzbnnslaauwzknrr.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqamh5emJubnNsYWF1d3prbnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5ODg4MzksImV4cCI6MjA2NjU2NDgzOX0.qcrcwNpwX83dCNbhxFaks2E68K_wp2W8urdYwfenDtM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkGranadoEspada() {
  console.log('🔍 データベースで「グラナドエスパダ」を検索中...');
  
  // 名前で検索
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .ilike('name', '%グラナドエスパダ%');
    
  if (error) {
    console.error('❌ エラー:', error);
    return;
  }
  
  console.log(`\n📊 検索結果: ${data.length}件\n`);
  
  if (data.length > 0) {
    data.forEach((campaign, index) => {
      console.log(`[${index + 1}] ${campaign.name}`);
      console.log(`  - ID: ${campaign.id}`);
      console.log(`  - ポイントサイト: ${campaign.point_site_id}`);
      console.log(`  - 還元率: ${campaign.cashback_rate}`);
      console.log(`  - デバイス: ${campaign.device}`);
      console.log(`  - URL: ${campaign.campaign_url}`);
      console.log(`  - 作成日: ${campaign.created_at}`);
      console.log('');
    });
  } else {
    console.log('⚠️  「グラナドエスパダ」が見つかりませんでした');
    
    // ちょびリッチの最新案件を確認
    console.log('\n📋 ちょびリッチの最新案件（5件）を確認...');
    const { data: recent } = await supabase
      .from('campaigns')
      .select('*')
      .eq('point_site_id', 'f944d469-99a2-4285-8f7c-82027dddbc77')
      .order('created_at', { ascending: false })
      .limit(5);
      
    if (recent && recent.length > 0) {
      recent.forEach((campaign, index) => {
        console.log(`[${index + 1}] ${campaign.name || '(名前なし)'}`);
        console.log(`  - 作成日: ${campaign.created_at}`);
      });
    }
  }
}

checkGranadoEspada();