const fs = require('fs');

// Read the search data file
const data = fs.readFileSync('public/search-data.json', 'utf8');
const jsonData = JSON.parse(data);

console.log('Total campaigns in search data:', jsonData.campaigns.length);

// Search for 獅子の如く campaigns
const shishiCampaigns = jsonData.campaigns.filter(campaign => 
  campaign.name && campaign.name.includes('獅子の如く') ||
  campaign.displayName && campaign.displayName.includes('獅子の如く') ||
  campaign.description && campaign.description.includes('獅子の如く') ||
  campaign.searchKeywords && campaign.searchKeywords.includes('獅子の如く')
);

console.log('\n=== 獅子の如く CAMPAIGNS ===');
console.log('Found', shishiCampaigns.length, 'campaigns containing "獅子の如く"');

shishiCampaigns.forEach((campaign, index) => {
  console.log(`\n--- Campaign ${index + 1} ---`);
  console.log('ID:', campaign.id);
  console.log('Site Name:', campaign.siteName);
  console.log('Display Name:', campaign.displayName);
  console.log('Description:', campaign.description);
  console.log('Cashback:', campaign.cashback);
  console.log('Cashback Yen:', campaign.cashbackYen);
  console.log('Device:', campaign.device);
  console.log('Category:', campaign.category);
  console.log('URL:', campaign.url);
  console.log('Last Updated:', campaign.lastUpdated);
});

// Also search for any app-related campaigns
console.log('\n\n=== APP CATEGORY ANALYSIS ===');
const appCampaigns = jsonData.campaigns.filter(campaign => 
  campaign.category === 'app'
);

console.log('Total app category campaigns:', appCampaigns.length);

if (appCampaigns.length > 0) {
  console.log('\nFirst 5 app campaigns:');
  appCampaigns.slice(0, 5).forEach((campaign, index) => {
    console.log(`${index + 1}. ${campaign.displayName} - ${campaign.cashback} (${campaign.device})`);
  });
}

// Search for any campaigns with specific cashback amounts that might be 獅子の如く
const possibleShishi = jsonData.campaigns.filter(campaign => 
  (campaign.cashbackYen === '2000円' || campaign.cashback === '2000円' || 
   campaign.cashbackYen === '2,000円' || campaign.cashback === '2,000円') &&
  (campaign.category === 'app' || 
   campaign.description?.toLowerCase().includes('android') ||
   campaign.description?.toLowerCase().includes('ios'))
);

console.log('\n=== POTENTIAL 獅子の如く CAMPAIGNS (2000円 cashback) ===');
console.log('Found', possibleShishi.length, 'app campaigns with 2000円 cashback');

possibleShishi.forEach((campaign, index) => {
  console.log(`\n--- Potential Match ${index + 1} ---`);
  console.log('Display Name:', campaign.displayName);
  console.log('Description:', campaign.description);
  console.log('Cashback:', campaign.cashback);
  console.log('Device:', campaign.device);
  console.log('Category:', campaign.category);
  console.log('Site:', campaign.siteName);
});

console.log('\n=== CATEGORY BREAKDOWN ===');
const categoryCount = {};
jsonData.campaigns.forEach(campaign => {
  categoryCount[campaign.category] = (categoryCount[campaign.category] || 0) + 1;
});

Object.entries(categoryCount).sort((a, b) => b[1] - a[1]).forEach(([category, count]) => {
  console.log(`${category}: ${count} campaigns`);
});