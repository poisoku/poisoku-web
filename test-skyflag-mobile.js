const puppeteer = require('puppeteer');

async function fetchSKYFLAG() {
  console.log('SKYFLAG mobile page fetch test...');
  
  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // モバイルデバイスをエミュレート
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1');
    await page.setViewport({ width: 375, height: 812, isMobile: true });
    
    console.log('Navigating to SKYFLAG page...');
    await page.goto('https://ow.skyflag.jp/ad/p/ow/index?_owp=AdMaGe2BxlEYjkLZE4r5rTvUmY5nAAdMaGe3DAdMaGe3D&suid=t1322517', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // ページのタイトルを取得
    const title = await page.title();
    console.log('Page title:', title);
    
    // ページの内容を取得
    const content = await page.content();
    console.log('Page length:', content.length);
    
    // 案件要素を探す
    const offers = await page.evaluate(() => {
      const results = [];
      
      // 一般的なセレクタで案件を探す
      const selectors = [
        '.offer', '.campaign', '.item', '.card',
        '[class*="offer"]', '[class*="campaign"]', '[class*="item"]',
        'a[href*="click"]', 'a[href*="redirect"]',
        'div[class*="list"] > div', 'ul > li'
      ];
      
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          console.log(`Found ${elements.length} elements with selector: ${selector}`);
          elements.forEach(el => {
            const text = el.textContent.trim();
            if (text && text.length > 10) {
              results.push({
                selector,
                text: text.substring(0, 200),
                html: el.outerHTML.substring(0, 300)
              });
            }
          });
        }
      }
      
      return results;
    });
    
    console.log('\nFound offers:', offers.length);
    offers.slice(0, 5).forEach((offer, i) => {
      console.log(`\nOffer ${i + 1}:`);
      console.log('Selector:', offer.selector);
      console.log('Text:', offer.text);
    });
    
    // スクリーンショットを保存
    await page.screenshot({ path: 'skyflag-mobile.png', fullPage: true });
    console.log('\nScreenshot saved as skyflag-mobile.png');
    
    await browser.close();
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Puppeteerがインストールされているか確認
try {
  require.resolve('puppeteer');
  fetchSKYFLAG();
} catch (e) {
  console.log('Puppeteer is not installed. Installing...');
  console.log('Run: npm install puppeteer');
}