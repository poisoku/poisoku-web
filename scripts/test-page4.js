const puppeteer = require('puppeteer');

async function testPage4() {
  const browser = await puppeteer.launch({ headless: false }); // 確認のためheadless: false
  const page = await browser.newPage();
  
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
  
  const url = 'https://www.chobirich.com/shopping/shop/101?page=4';
  console.log(`テスト対象: ${url}`);
  
  const response = await page.goto(url, { 
    waitUntil: 'domcontentloaded',
    timeout: 15000 
  });
  
  const result = await page.evaluate(() => {
    const bodyText = document.body.innerText;
    const hasNoProductsMessage = bodyText.includes('現在、掲載している商品が存在しません。');
    const campaignLinks = document.querySelectorAll('a[href*="/ad_details/"]');
    const campaignCount = campaignLinks.length;
    
    return {
      hasNoProductsMessage: hasNoProductsMessage,
      campaignCount: campaignCount,
      bodyTextSample: bodyText.substring(0, 1000)
    };
  });
  
  console.log('ステータス:', response.status());
  console.log('「現在、掲載している商品が存在しません。」があるか:', result.hasNoProductsMessage);
  console.log('案件リンク数:', result.campaignCount);
  console.log('ページ内容サンプル:');
  console.log(result.bodyTextSample);
  
  await browser.close();
}

testPage4().catch(console.error);