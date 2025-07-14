const fs = require('fs');

async function checkShishiCampaigns() {
  try {
    console.log('🔍 Checking for 獅子の如く campaigns in search-data.json');
    
    // Read the search data file
    const searchDataRaw = fs.readFileSync('public/search-data.json', 'utf8');
    const searchData = JSON.parse(searchDataRaw);
    
    console.log(`📊 Total campaigns in search data: ${searchData.campaigns.length}`);
    
    // Search for 獅子の如く campaigns
    const shishiCampaigns = searchData.campaigns.filter(campaign => 
      campaign.description.includes('獅子の如く') || 
      campaign.searchKeywords.includes('獅子の如く')
    );
    
    console.log(`🦁 Found ${shishiCampaigns.length} 獅子の如く campaigns`);
    
    if (shishiCampaigns.length > 0) {
      console.log('\n📋 獅子の如く campaigns found:');
      shishiCampaigns.slice(0, 5).forEach((campaign, index) => {
        console.log(`\n${index + 1}. Campaign:`);
        console.log(`   Name: ${campaign.description}`);
        console.log(`   Site: ${campaign.siteName}`);
        console.log(`   Cashback: ${campaign.cashback}`);
        console.log(`   Device: ${campaign.device}`);
        console.log(`   Category: ${campaign.category}`);
        console.log(`   Search Keywords: ${campaign.searchKeywords}`);
        console.log(`   Last Updated: ${campaign.lastUpdated}`);
      });
    } else {
      console.log('\n❌ No 獅子の如く campaigns found in search data');
      
      // Let's check some random campaigns to see the data structure
      console.log('\n📝 Sample campaigns in search data:');
      searchData.campaigns.slice(0, 3).forEach((campaign, index) => {
        console.log(`\n${index + 1}. Sample Campaign:`);
        console.log(`   Name: ${campaign.description}`);
        console.log(`   Site: ${campaign.siteName}`);
        console.log(`   Search Keywords: ${campaign.searchKeywords}`);
      });
    }
    
    // Check if any campaigns contain keywords related to games or apps
    const gameRelatedCampaigns = searchData.campaigns.filter(campaign => 
      campaign.description.toLowerCase().includes('ゲーム') ||
      campaign.description.toLowerCase().includes('アプリ') ||
      campaign.category === 'app'
    );
    
    console.log(`\n🎮 Game/App related campaigns: ${gameRelatedCampaigns.length}`);
    if (gameRelatedCampaigns.length > 0) {
      console.log('📱 Sample game/app campaigns:');
      gameRelatedCampaigns.slice(0, 3).forEach((campaign, index) => {
        console.log(`   ${index + 1}. ${campaign.description} (${campaign.siteName})`);
      });
    }
    
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

checkShishiCampaigns();