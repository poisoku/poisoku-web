const puppeteer = require('puppeteer');

async function testAccess() {
  console.log('🔍 Simple access test starting...');
  
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
    
    console.log('Testing top page...');
    await page.goto('https://www.chobirich.com/', { timeout: 30000 });
    
    const title = await page.title();
    console.log(`Page title: ${title}`);
    
    if (title.includes('403') || title.includes('Forbidden')) {
      console.log('❌ Access denied on top page');
      return false;
    }
    
    console.log('✅ Top page access OK');
    
    console.log('Testing campaign page...');
    await page.goto('https://www.chobirich.com/ad_details/1794491/', { timeout: 30000 });
    
    const campaignTitle = await page.title();
    console.log(`Campaign title: ${campaignTitle}`);
    
    if (campaignTitle.includes('403') || campaignTitle.includes('Forbidden')) {
      console.log('❌ Access denied on campaign page');
      return false;
    }
    
    console.log('✅ Campaign page access OK');
    return true;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testAccess().then(success => {
  console.log(success ? '✅ Access test passed' : '❌ Access test failed');
}).catch(console.error);