const puppeteer = require('puppeteer');
const fs = require('fs').promises;

async function rescrapeAllAndroidCampaigns() {
  console.log('🔄 Re-scraping ALL Android campaigns with fixed cashback extraction...');
  
  let existingData = [];
  try {
    const data = await fs.readFile('chobirich_android_app_campaigns.json', 'utf8');
    const parsed = JSON.parse(data);
    existingData = parsed.app_campaigns || [];
    console.log(`📋 Found ${existingData.length} existing Android campaigns to re-process`);
  } catch (error) {
    console.log('📋 No existing data found, starting fresh');
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const updatedCampaigns = [];
  let processedCount = 0;
  let errorCount = 0;

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36');

    for (const campaign of existingData) {
      processedCount++;
      
      if (processedCount % 50 === 0) {
        console.log(`📄 Progress: ${processedCount}/${existingData.length} campaigns processed`);
      }

      try {
        await page.goto(campaign.url, { waitUntil: 'networkidle2', timeout: 25000 });
        await new Promise(resolve => setTimeout(resolve, 1500));

        const result = await page.evaluate(() => {
          let title = '';
          const h1Element = document.querySelector('h1.AdDetails__title');
          if (h1Element) {
            title = h1Element.textContent.trim();
          }

          let cashback = '';
          const pointElement = document.querySelector('.AdDetails__pt.ItemPtLarge');
          if (pointElement) {
            const text = pointElement.textContent.trim();
            // Fixed pattern: handles both comma-separated and non-comma formats
            const match = text.match(/((?:\d{1,3}(?:,\d{3})*|\d+)(?:ちょび)?(?:ポイント|pt))/);
            if (match) {
              cashback = match[0];
            }
          }

          let method = '';
          const bodyText = document.body.innerText;
          
          const specificPatterns = [
            /新規アプリインストール後.*?レベル\s*\d+[^\n。]{0,60}/,
            /レベル\s*\d+[^\n。]{0,60}/,
            /\d+日間[^\n。]{0,60}/,
            /チュートリアル完了[^\n。]{0,60}/,
            /初回ログイン[^\n。]{0,60}/,
            /アプリ初回起動[^\n。]{0,60}/
          ];

          for (const pattern of specificPatterns) {
            const match = bodyText.match(pattern);
            if (match) {
              method = match[0];
              break;
            }
          }

          return {
            title: title || '',
            cashback: cashback || '',
            method: method || '',
            pageValid: !!title && title !== 'エラー'
          };
        });

        if (result.pageValid) {
          updatedCampaigns.push({
            id: campaign.id,
            name: result.title,
            url: campaign.url,
            cashback: result.cashback || '不明',
            os: campaign.os || 'android',
            method: result.method || '不明',
            timestamp: new Date().toISOString()
          });
          
          // Log significant cashback changes
          if (campaign.cashback !== result.cashback && result.cashback) {
            console.log(`🔄 ${campaign.id}: ${campaign.cashback} → ${result.cashback}`);
          }
        } else {
          // Keep original data if page failed to load
          updatedCampaigns.push(campaign);
          errorCount++;
        }

      } catch (error) {
        console.error(`❌ Error processing ${campaign.id}:`, error.message);
        // Keep original data on error
        updatedCampaigns.push(campaign);
        errorCount++;
      }
      
      await new Promise(resolve => setTimeout(resolve, 800));
    }

  } catch (error) {
    console.error('Critical error:', error.message);
  } finally {
    await browser.close();
  }

  // Save updated data
  const finalData = {
    scrape_date: new Date().toISOString(),
    strategy: "android_app_scraper_fixed_cashback",
    summary: {
      total_processed: updatedCampaigns.length,
      app_campaigns_found: updatedCampaigns.length,
      errors: errorCount,
      os_breakdown: {
        android: updatedCampaigns.filter(c => c.os === 'android').length,
        ios: updatedCampaigns.filter(c => c.os === 'ios').length,
        both: updatedCampaigns.filter(c => c.os === 'both').length,
        unknown: updatedCampaigns.filter(c => !c.os || c.os === 'unknown').length
      }
    },
    app_campaigns: updatedCampaigns
  };

  await fs.writeFile('chobirich_android_app_campaigns.json', JSON.stringify(finalData, null, 2));
  console.log(`💾 Updated ${updatedCampaigns.length} Android campaigns with fixed cashback extraction`);
  console.log(`📊 Errors: ${errorCount}`);

  return finalData;
}

rescrapeAllAndroidCampaigns();