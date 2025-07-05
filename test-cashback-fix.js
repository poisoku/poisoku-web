const puppeteer = require('puppeteer');

async function testCashbackExtraction() {
  const browser = await puppeteer.launch({
    headless: false  // ブラウザを表示してデバッグ
  });
  
  const page = await browser.newPage();
  
  // Android User Agent設定
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36');
  
  // 特定の案件ページにアクセス
  const testUrl = 'https://www.chobirich.com/ad_details/1838585';
  await page.goto(testUrl, { waitUntil: 'networkidle2' });
  
  // ページの内容を評価
  const result = await page.evaluate(() => {
    // ポイント要素の複数の候補をチェック
    const selectors = [
      '.AdDetails__pt.ItemPtLarge',
      '.AdDetails__pt',
      '.ItemPtLarge',
      '[class*="pt"]',
      '[class*="Point"]'
    ];
    
    const results = [];
    
    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((element, index) => {
        const text = element.textContent.trim();
        results.push({
          selector: `${selector}[${index}]`,
          text: text,
          innerHTML: element.innerHTML
        });
      });
    });
    
    // 全体のテキストからポイント情報を探す
    const bodyText = document.body.innerText;
    const pointMatches = bodyText.match(/\d+(?:,\d+)*(?:ちょび)?(?:ポイント|pt)/g);
    
    return {
      url: window.location.href,
      title: document.title,
      elements: results,
      pointMatches: pointMatches || [],
      fullText: bodyText.substring(0, 1000) // 最初の1000文字
    };
  });
  
  console.log('🔍 テスト結果:');
  console.log('URL:', result.url);
  console.log('タイトル:', result.title);
  console.log('\n📍 見つかった要素:');
  result.elements.forEach(el => {
    console.log(`${el.selector}: "${el.text}"`);
  });
  
  console.log('\n💰 ポイントマッチ:');
  result.pointMatches.forEach(match => {
    console.log(`- ${match}`);
  });
  
  await browser.close();
}

testCashbackExtraction().catch(console.error);