console.log('Testing access to Chobirich...');

const puppeteer = require('puppeteer');

puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
}).then(async browser => {
  console.log('Browser launched');
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
  
  console.log('Going to Chobirich...');
  try {
    await page.goto('https://www.chobirich.com/', { timeout: 30000 });
    const title = await page.title();
    console.log(`Title: ${title}`);
    
    if (title.includes('403') || title.includes('Forbidden')) {
      console.log('❌ BLOCKED');
    } else {
      console.log('✅ ACCESS OK');
    }
    
  } catch (error) {
    console.log('❌ ERROR:', error.message);
  }
  
  await browser.close();
}).catch(error => {
  console.error('Failed to launch browser:', error);
});