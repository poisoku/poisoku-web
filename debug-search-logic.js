const fs = require('fs');

function debugSearchLogic() {
  console.log('🔍 Debugging search logic for 獅子の如く');
  
  try {
    // Read the search data file
    const searchDataRaw = fs.readFileSync('public/search-data.json', 'utf8');
    const searchData = JSON.parse(searchDataRaw);
    
    console.log(`📊 Total campaigns in search data: ${searchData.campaigns.length}`);
    
    // Test the exact search logic from staticSearch.ts
    const keyword = '獅子の如く';
    const searchTerms = keyword.toLowerCase().split(/\s+/).filter(term => term.length > 0);
    
    console.log(`🔤 Search terms: [${searchTerms.join(', ')}]`);
    
    // Filter logic from staticSearch.ts
    let results = [...searchData.campaigns];
    
    // First, check invalid cashback filtering
    console.log('\n🔍 Step 1: Filtering invalid cashback rates...');
    const beforeInvalidFilter = results.length;
    results = results.filter(campaign => {
      const cashback = campaign.cashback || '';
      const cashbackYen = campaign.cashbackYen || '';
      
      const invalidPatterns = [
        '要確認',
        '不明', 
        'なし',
        '未定',
        'TBD',
        '確認中'
      ];
      
      const isInvalid = invalidPatterns.some(pattern => 
        cashback.includes(pattern) || cashbackYen.includes(pattern)
      );
      
      return !isInvalid;
    });
    
    console.log(`   Before: ${beforeInvalidFilter}, After: ${results.length}, Filtered out: ${beforeInvalidFilter - results.length}`);
    
    // Then keyword search
    console.log('\n🔍 Step 2: Keyword search...');
    const beforeKeywordFilter = results.length;
    
    // Look for any campaigns that might match
    const potentialMatches = results.filter(campaign => {
      const searchText = `${campaign.description} ${campaign.siteName}`.toLowerCase();
      const keywords = campaign.searchKeywords.toLowerCase();
      
      // Check if any search term is found
      const foundInDescription = searchTerms.some(term => searchText.includes(term));
      const foundInKeywords = searchTerms.some(term => keywords.includes(term));
      
      if (foundInDescription || foundInKeywords) {
        console.log(`   📝 Potential match found:`);
        console.log(`      Description: ${campaign.description}`);
        console.log(`      Search Keywords: ${campaign.searchKeywords}`);
        console.log(`      Search Text: ${searchText}`);
        console.log(`      Found in description: ${foundInDescription}`);
        console.log(`      Found in keywords: ${foundInKeywords}`);
        return true;
      }
      
      return false;
    });
    
    console.log(`   Potential matches: ${potentialMatches.length}`);
    
    // Apply the exact filter logic
    results = results.filter(campaign => {
      const searchText = `${campaign.description} ${campaign.siteName}`.toLowerCase();
      
      return searchTerms.every(term => 
        searchText.includes(term) || campaign.searchKeywords.includes(term)
      );
    });
    
    console.log(`   Final results: ${results.length}`);
    
    if (results.length === 0) {
      console.log('\n❌ No exact matches found');
      
      // Let's try partial matching to see what's close
      console.log('\n🔍 Looking for partial matches...');
      const partialMatches = searchData.campaigns.filter(campaign => {
        const searchText = `${campaign.description} ${campaign.siteName}`.toLowerCase();
        const keywords = campaign.searchKeywords.toLowerCase();
        
        // Check if it contains any kanji from 獅子の如く
        const hasShishi = searchText.includes('獅子') || keywords.includes('獅子');
        const hasGame = searchText.includes('ゲーム') || keywords.includes('ゲーム');
        const hasApp = searchText.includes('アプリ') || keywords.includes('アプリ');
        
        return hasShishi || hasGame || hasApp;
      });
      
      console.log(`   Partial matches: ${partialMatches.length}`);
      partialMatches.slice(0, 5).forEach((campaign, index) => {
        console.log(`   ${index + 1}. ${campaign.description} (${campaign.siteName})`);
      });
    } else {
      console.log('\n✅ Found matches:');
      results.forEach((campaign, index) => {
        console.log(`   ${index + 1}. ${campaign.description} (${campaign.siteName})`);
      });
    }
    
    // Also check metadata
    console.log('\n📊 Search data metadata:');
    console.log(`   Last updated: ${searchData.metadata.lastUpdated}`);
    console.log(`   Total campaigns: ${searchData.metadata.totalCampaigns}`);
    console.log(`   Categories: ${Object.keys(searchData.metadata.categories).join(', ')}`);
    console.log(`   Sites: ${Object.keys(searchData.metadata.sites).join(', ')}`);
    
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

debugSearchLogic();