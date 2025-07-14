const fs = require('fs');

// Search in PointIncome mobile data
console.log('=== Searching in PointIncome Mobile Data ===');
try {
    const mobileData = JSON.parse(fs.readFileSync('scripts/pointincome/pointincome_mobile_batch_final.json', 'utf8'));
    
    const shishiCampaigns = mobileData.campaigns.filter(campaign => 
        campaign.title && campaign.title.includes('獅子の如く')
    );
    
    console.log(`Found ${shishiCampaigns.length} 獅子の如く campaigns in PointIncome mobile data:`);
    shishiCampaigns.forEach((campaign, index) => {
        console.log(`\n--- Campaign ${index + 1} ---`);
        console.log(`ID: ${campaign.id}`);
        console.log(`Title: ${campaign.title}`);
        console.log(`Cashback: ${campaign.cashbackYen}`);
        console.log(`Device: ${campaign.device}`);
        console.log(`Category: ${campaign.category}`);
        console.log(`URL: ${campaign.url}`);
    });
} catch (error) {
    console.log('Error reading PointIncome mobile data:', error.message);
}

// Search in main search data
console.log('\n=== Searching in Main Search Data ===');
try {
    const searchData = JSON.parse(fs.readFileSync('public/search-data.json', 'utf8'));
    
    const shishiCampaigns = searchData.campaigns.filter(campaign => 
        (campaign.description && campaign.description.includes('獅子の如く')) ||
        (campaign.displayName && campaign.displayName.includes('獅子の如く'))
    );
    
    console.log(`Found ${shishiCampaigns.length} 獅子の如く campaigns in main search data:`);
    shishiCampaigns.forEach((campaign, index) => {
        console.log(`\n--- Campaign ${index + 1} ---`);
        console.log(`Site: ${campaign.siteName}`);
        console.log(`Name: ${campaign.displayName}`);
        console.log(`Cashback: ${campaign.cashback}`);
        console.log(`Device: ${campaign.device}`);
        console.log(`Category: ${campaign.category}`);
        console.log(`URL: ${campaign.url}`);
    });
    
    // Also search for campaigns with 2000円 from PointIncome
    console.log('\n=== PointIncome campaigns with 2000円 ===');
    const pointIncome2000 = searchData.campaigns.filter(campaign => 
        campaign.siteName === 'ポイントインカム' && 
        campaign.cashback && campaign.cashback.includes('2000円')
    );
    
    console.log(`Found ${pointIncome2000.length} PointIncome campaigns with 2000円 cashback:`);
    pointIncome2000.forEach((campaign, index) => {
        console.log(`\n--- Campaign ${index + 1} ---`);
        console.log(`Name: ${campaign.displayName}`);
        console.log(`Cashback: ${campaign.cashback}`);
        console.log(`Category: ${campaign.category}`);
        console.log(`Device: ${campaign.device}`);
    });

    // Check categories
    console.log('\n=== Available Categories in Search Data ===');
    const categories = new Set();
    searchData.campaigns.forEach(campaign => {
        categories.add(campaign.category || 'unknown');
    });
    
    [...categories].sort().forEach(cat => {
        const count = searchData.campaigns.filter(campaign => campaign.category === cat).length;
        console.log(`${cat}: ${count} campaigns`);
    });

} catch (error) {
    console.log('Error reading main search data:', error.message);
}