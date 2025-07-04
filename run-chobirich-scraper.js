// Puppeteerスクレイパーを実行
console.log('ちょびリッチスクレイピング開始...\n');

try {
  const scraper = require('./scripts/chobirich-puppeteer.js');
  console.log('スクレイパーを読み込みました');
} catch (error) {
  console.error('エラー:', error.message);
  console.log('\nPuppeteerスクレイパーを直接実行します...');
  
  // インラインで実行
  const puppeteer = require('puppeteer');
  
  async function quickTest() {
    console.log('Puppeteer起動中...');
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    console.log('楽天市場の案件ページ（ID: 36796）にアクセス...');
    const page = await browser.newPage();
    await page.goto('https://www.chobirich.com/ad_details/36796/', {
      waitUntil: 'networkidle2'
    });
    
    console.log('データ抽出中...');
    const data = await page.evaluate(() => {
      const result = {
        title: document.querySelector('h1')?.textContent?.trim() || '',
        url: window.location.href,
        cashback: ''
      };
      
      // 大きく表示されている還元率を探す
      const elements = Array.from(document.querySelectorAll('*'));
      elements.forEach(el => {
        const text = el.textContent?.trim() || '';
        if (text.match(/^\d+(?:\.\d+)?%$/) || text.match(/^\d+(?:,\d+)?pt$/)) {
          const fontSize = parseInt(window.getComputedStyle(el).fontSize);
          if (fontSize > 20) { // 20px以上のフォントサイズ
            result.cashback = text;
          }
        }
      });
      
      return result;
    });
    
    console.log('\n取得したデータ:');
    console.log(JSON.stringify(data, null, 2));
    
    await browser.close();
    console.log('\n完了！');
  }
  
  quickTest().catch(console.error);
}