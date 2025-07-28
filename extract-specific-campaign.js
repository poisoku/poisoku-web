const fs = require('fs');

// Read the mobile data file
const data = fs.readFileSync('scripts/pointincome/pointincome_mobile_batch_final.json', 'utf8');

// Search for "獅子の如く" specifically
const shishiMatches = data.match(/.*獅子の如く.*/g);
console.log('=== Lines containing 獅子の如く ===');
if (shishiMatches) {
    shishiMatches.forEach((match, index) => {
        console.log(`${index + 1}: ${match}`);
    });
} else {
    console.log('No matches found for 獅子の如く');
}

// Search for 2000円
console.log('\n=== Lines containing 2000円 ===');
const cashbackMatches = data.match(/.*2000円.*/g);
if (cashbackMatches) {
    cashbackMatches.forEach((match, index) => {
        console.log(`${index + 1}: ${match}`);
    });
} else {
    console.log('No matches found for 2000円');
}

// Try to parse as JSON and search
try {
    const jsonData = JSON.parse(data);
    console.log('\n=== Analyzing JSON Structure ===');
    console.log(`Total campaigns: ${jsonData.campaigns.length}`);
    
    // Search for 獅子の如く
    const shishiCampaigns = jsonData.campaigns.filter(campaign => 
        campaign.title && campaign.title.includes('獅子の如く')
    );
    
    console.log(`\nFound ${shishiCampaigns.length} campaigns with 獅子の如く:`);
    shishiCampaigns.forEach((campaign, index) => {
        console.log(`\n--- Campaign ${index + 1} ---`);
        console.log(`ID: ${campaign.id}`);
        console.log(`Title: ${campaign.title}`);
        console.log(`Cashback: ${campaign.cashbackYen}`);
        console.log(`Device: ${campaign.device}`);
        console.log(`URL: ${campaign.url}`);
    });
    
    // Search for high cashback campaigns (2000円)
    const highCashbackCampaigns = jsonData.campaigns.filter(campaign => 
        campaign.cashbackYen && campaign.cashbackYen.includes('2000円')
    );
    
    console.log(`\nFound ${highCashbackCampaigns.length} campaigns with 2000円 cashback:`);
    highCashbackCampaigns.forEach((campaign, index) => {
        console.log(`\n--- High Cashback Campaign ${index + 1} ---`);
        console.log(`ID: ${campaign.id}`);
        console.log(`Title: ${campaign.title}`);
        console.log(`Cashback: ${campaign.cashbackYen}`);
        console.log(`Device: ${campaign.device}`);
    });
    
} catch (error) {
    console.log('\nError parsing JSON:', error.message);
}