const puppeteer = require('puppeteer');
const fs = require('fs').promises;

async function forceRescrapeTargetCampaigns() {
  console.log('🔄 Force re-scraping specific Android campaigns with fixed regex...');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const targetCampaigns = [
    { id: '1832094', url: 'https://www.chobirich.com/ad_details/1832094' },
    { id: '1838585', url: 'https://www.chobirich.com/ad_details/1838585' }
  ];

  const updatedCampaigns = [];

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36');

    for (const target of targetCampaigns) {
      console.log(`📄 Processing: ${target.id} - ${target.url}`);
      
      try {
        await page.goto(target.url, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 2000));

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
            id: target.id,
            name: result.title,
            url: target.url,
            cashback: result.cashback || '不明',
            os: 'android',
            method: result.method || '不明',
            timestamp: new Date().toISOString()
          });
          
          console.log(`✅ ${target.id}: ${result.cashback} (was showing incorrectly before)`);
        } else {
          console.log(`❌ Failed to scrape ${target.id}`);
        }

      } catch (error) {
        console.error(`❌ Error processing ${target.id}:`, error.message);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }

  if (updatedCampaigns.length > 0) {
    await fs.writeFile('android-fixed-campaigns.json', JSON.stringify(updatedCampaigns, null, 2));
    console.log(`💾 Saved ${updatedCampaigns.length} updated campaigns to android-fixed-campaigns.json`);
  }

  return updatedCampaigns;
}

forceRescrapeTargetCampaigns();