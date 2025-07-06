const puppeteer = require('puppeteer');

async function testMafiaAndroidCashback() {
  console.log('Testing Android cashback extraction fix...');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=VizDisplayCompositor'
    ]
  });

  try {
    const page = await browser.newPage();
    
    // Android User Agent
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36');
    
    const url = 'https://www.chobirich.com/ad_details/1832094';
    console.log(`Testing URL: ${url}`);
    
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    
    const result = await page.evaluate(() => {
      let cashback = '';
      const pointElement = document.querySelector('.AdDetails__pt.ItemPtLarge');
      if (pointElement) {
        const text = pointElement.textContent.trim();
        console.log('Found text:', text);
        
        // OLD ANDROID PATTERN (BROKEN)
        const oldMatch = text.match(/(?:最大)?([\d,]+)(?:ちょび)?(?:ポイント|pt)/);
        const oldResult = oldMatch ? oldMatch[1] + 'ポイント' : 'なし';
        
        // NEW PATTERN (iOS style - FIXED)
        const newMatch = text.match(/(\d{1,3}(?:,\d{3})*(?:ちょび)?(?:ポイント|pt))/);
        const newResult = newMatch ? newMatch[0] : 'なし';
        
        return {
          rawText: text,
          oldPattern: oldResult,
          newPattern: newResult,
          oldMatchGroups: oldMatch ? Array.from(oldMatch) : null,
          newMatchGroups: newMatch ? Array.from(newMatch) : null
        };
      }
      return { error: 'Point element not found' };
    });
    
    console.log('\n=== CASHBACK EXTRACTION TEST RESULTS ===');
    console.log('Raw text found:', result.rawText);
    console.log('OLD Android pattern result:', result.oldPattern);
    console.log('NEW iOS pattern result:', result.newPattern);
    console.log('OLD match groups:', result.oldMatchGroups);
    console.log('NEW match groups:', result.newMatchGroups);
    
    // Expected: 12800 points = 6400 yen conversion
    if (result.newPattern && result.newPattern.includes('12800')) {
      console.log('✅ FIXED: Correctly extracted large cashback amount');
    } else {
      console.log('❌ ISSUE: Still not extracting correct amount');
    }
    
  } catch (error) {
    console.error('Error testing:', error.message);
  } finally {
    await browser.close();
  }
}

testMafiaAndroidCashback();