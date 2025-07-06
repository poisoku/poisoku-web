const puppeteer = require('puppeteer');

async function testSingleAndroidCampaign() {
  console.log('Testing single Android campaign with fixed regex...');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // Android User Agent
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36');
    
    const url = 'https://www.chobirich.com/ad_details/1832094';
    console.log(`Testing URL: ${url}`);
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
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
        
        // Test both patterns
        const oldMatch = text.match(/(?:最大)?([\d,]+)(?:ちょび)?(?:ポイント|pt)/);
        const newMatch = text.match(/((?:\d{1,3}(?:,\d{3})*|\d+)(?:ちょび)?(?:ポイント|pt))/);
        
        return {
          title: title,
          rawText: text,
          oldPattern: oldMatch ? oldMatch[1] + 'ポイント' : 'なし',
          newPattern: newMatch ? newMatch[0] : 'なし',
          oldFullMatch: oldMatch ? oldMatch[0] : null,
          newFullMatch: newMatch ? newMatch[0] : null
        };
      }
      
      return { error: 'Point element not found', title: title };
    });
    
    console.log('\n=== RESULTS ===');
    console.log('Title:', result.title);
    console.log('Raw text:', result.rawText);
    console.log('OLD pattern (broken):', result.oldPattern);
    console.log('NEW pattern (fixed):', result.newPattern);
    console.log('OLD full match:', result.oldFullMatch);
    console.log('NEW full match:', result.newFullMatch);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

testSingleAndroidCampaign();