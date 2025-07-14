const fs = require('fs');

// Read and parse the search data
const data = JSON.parse(fs.readFileSync('public/search-data.json', 'utf8'));

// Check unique categories
const categories = new Set();
data.campaigns.forEach(campaign => {
    categories.add(campaign.category || 'unknown');
});

console.log('Available categories:');
[...categories].sort().forEach(cat => {
    console.log(`- ${cat}`);
});

// Count campaigns by category
console.log('\nCampaign count by category:');
[...categories].sort().forEach(cat => {
    const count = data.campaigns.filter(campaign => campaign.category === cat).length;
    console.log(`${cat}: ${count} campaigns`);
});

// Search for app category campaigns
const appCampaigns = data.campaigns.filter(campaign => campaign.category === 'app');
console.log(`\nFound ${appCampaigns.length} app campaigns`);

// Search for campaigns with 獅子の如く
const shishiCampaigns = data.campaigns.filter(campaign => 
    (campaign.description && campaign.description.includes('獅子の如く')) ||
    (campaign.displayName && campaign.displayName.includes('獅子の如く'))
);

console.log(`\nFound ${shishiCampaigns.length} campaigns with 獅子の如く`);
shishiCampaigns.forEach(campaign => {
    console.log(JSON.stringify(campaign, null, 2));
});

// Search for campaigns with 2000円 cashback
const cashback2000Campaigns = data.campaigns.filter(campaign => 
    campaign.cashback && campaign.cashback.includes('2000円')
);

console.log(`\nFound ${cashback2000Campaigns.length} campaigns with 2000円 cashback`);

// Search for PointIncome campaigns with 2000円
const pointIncomeWith2000 = data.campaigns.filter(campaign => 
    campaign.siteName === 'ポイントインカム' && 
    campaign.cashback && campaign.cashback.includes('2000円')
);

console.log(`\nFound ${pointIncomeWith2000.length} PointIncome campaigns with 2000円 cashback`);
pointIncomeWith2000.forEach((campaign, index) => {
    console.log(`\nPointIncome 2000円 Campaign ${index + 1}:`);
    console.log(`Name: ${campaign.displayName}`);
    console.log(`Cashback: ${campaign.cashback}`);
    console.log(`Category: ${campaign.category}`);
    console.log(`Device: ${campaign.device}`);
});