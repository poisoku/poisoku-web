const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pjjhyzbnnslaauwzknrr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqamh5emJubnNsYWF1d3prbnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5ODg4MzksImV4cCI6MjA2NjU2NDgzOX0.qcrcwNpwX83dCNbhxFaks2E68K_wp2W8urdYwfenDtM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkShishiInDatabase() {
  console.log('🔍 Checking database for 獅子の如く campaigns...');
  
  try {
    // Search for campaigns containing 獅子の如く
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select(`
        id,
        name,
        cashback_rate,
        device,
        campaign_url,
        description,
        category,
        is_active,
        created_at,
        updated_at,
        point_sites (
          id,
          name,
          url
        )
      `)
      .ilike('name', '%獅子の如く%');

    if (error) {
      throw new Error(`Database query error: ${error.message}`);
    }

    console.log(`📊 Found ${campaigns.length} campaigns with '獅子の如く' in name`);
    
    if (campaigns.length > 0) {
      console.log('\n📋 獅子の如く campaigns in database:');
      campaigns.forEach((campaign, index) => {
        console.log(`\n${index + 1}. Campaign:`);
        console.log(`   ID: ${campaign.id}`);
        console.log(`   Name: ${campaign.name}`);
        console.log(`   Site: ${campaign.point_sites?.name || 'Unknown'}`);
        console.log(`   Cashback: ${campaign.cashback_rate}`);
        console.log(`   Device: ${campaign.device}`);
        console.log(`   Category: ${campaign.category}`);
        console.log(`   Active: ${campaign.is_active}`);
        console.log(`   Updated: ${campaign.updated_at}`);
        console.log(`   URL: ${campaign.campaign_url}`);
      });
      
      // Check how many are active
      const activeCampaigns = campaigns.filter(c => c.is_active);
      console.log(`\n✅ Active 獅子の如く campaigns: ${activeCampaigns.length}/${campaigns.length}`);
      
      // Check cashback rates for filtering issues
      console.log('\n💰 Cashback rate analysis:');
      campaigns.forEach((campaign, index) => {
        const cashback = campaign.cashback_rate || '';
        const invalidPatterns = ['要確認', '不明', 'なし', '未定', 'TBD', '確認中'];
        const isInvalid = invalidPatterns.some(pattern => cashback.includes(pattern));
        console.log(`   ${index + 1}. "${cashback}" - ${isInvalid ? '❌ FILTERED OUT' : '✅ VALID'}`);
      });
      
    } else {
      console.log('\n❌ No 獅子の如く campaigns found in database');
      
      // Let's search for broader patterns
      console.log('\n🔍 Searching for game-related campaigns...');
      const { data: gameCampaigns } = await supabase
        .from('campaigns')
        .select('id, name, point_sites(name)')
        .or('name.ilike.%ゲーム%,name.ilike.%アプリ%,category.eq.app')
        .limit(10);
        
      if (gameCampaigns && gameCampaigns.length > 0) {
        console.log('🎮 Sample game/app campaigns:');
        gameCampaigns.forEach((campaign, index) => {
          console.log(`   ${index + 1}. ${campaign.name} (${campaign.point_sites?.name})`);
        });
      }
    }
    
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

checkShishiInDatabase();