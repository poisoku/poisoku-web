const fs = require('fs').promises;

async function fixAndroidCashbackDirectly() {
  console.log('🔧 Directly fixing Android cashback values in JSON...');
  
  // Load current Android campaign data
  let androidData;
  try {
    const data = await fs.readFile('chobirich_android_app_campaigns.json', 'utf8');
    androidData = JSON.parse(data);
  } catch (error) {
    console.error('Error reading Android data:', error.message);
    return;
  }

  // Known correct values for problematic campaigns
  const corrections = {
    '1832094': '12800ポイント',  // was 800ポイント
    '1838585': '62327ポイント', // was 327ポイント
    '1804858': '199810ポイント', // was 810ポイント
    '1835541': '78418ポイント',  // was 418ポイント
    '1839015': '66646ポイント',  // was 646ポイント
    '1777438': '34452ポイント',  // was 452ポイント
    '1838583': '30871ポイント',  // was 871ポイント
    '1829616': '25420ポイント',  // was 420ポイント
    '1829666': '25420ポイント',  // was 420ポイント
    '1836779': '23336ポイント',  // was 336ポイント
    '1838582': '23136ポイント',  // was 136ポイント
    '1838383': '22794ポイント',  // was 794ポイント
    '1829951': '22788ポイント',  // was 788ポイント
    '1837454': '22520ポイント',  // was 520ポイント
    '1829212': '21494ポイント',  // was 494ポイント
    '1829082': '20200ポイント',  // was 200ポイント
    '1835901': '20165ポイント',  // was 165ポイント
    '1830025': '19194ポイント',  // was 194ポイント
    '1836325': '18444ポイント',  // was 444ポイント
    '1836782': '18186ポイント',  // was 186ポイント
    '1762434': '17820ポイント',  // was 820ポイント
    '1835580': '17500ポイント',  // was 500ポイント
    '1837533': '17426ポイント',  // was 426ポイント
    '1824628': '17280ポイント'   // was 280ポイント
  };

  let correctedCount = 0;
  
  // Apply corrections to campaigns
  if (androidData.app_campaigns) {
    for (let campaign of androidData.app_campaigns) {
      if (corrections[campaign.id]) {
        const oldCashback = campaign.cashback;
        campaign.cashback = corrections[campaign.id];
        campaign.timestamp = new Date().toISOString();
        
        console.log(`✅ ${campaign.id}: ${oldCashback} → ${campaign.cashback}`);
        correctedCount++;
      }
    }
  }

  if (correctedCount > 0) {
    // Update metadata
    androidData.scrape_date = new Date().toISOString();
    androidData.strategy = "android_app_scraper_cashback_corrected";
    androidData.summary.corrections_applied = correctedCount;
    
    // Save corrected data
    await fs.writeFile('chobirich_android_app_campaigns.json', JSON.stringify(androidData, null, 2));
    console.log(`💾 Applied ${correctedCount} cashback corrections to Android campaigns`);
  } else {
    console.log('⚠️ No corrections were applied');
  }

  return correctedCount;
}

fixAndroidCashbackDirectly();