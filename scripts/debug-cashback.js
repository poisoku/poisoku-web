const puppeteer = require('puppeteer');

// 還元率取得の詳細デバッグ
async function debugCashback() {
  console.log('💰 還元率取得デバッグ開始\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
    await page.setViewport({ width: 375, height: 812, isMobile: true });
    
    const url = 'https://www.chobirich.com/ad_details/1794491/';
    console.log(`📱 アクセス中: ${url}`);
    
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    const debug = await page.evaluate(() => {
      const result = {
        title: document.title,
        selectors: {}
      };
      
      // 還元率関連のセレクタを幅広く検索
      const selectors = [
        '.AdDetails__pt.ItemPtLarge',
        '.AdDetails__pt',
        '.ItemPtLarge',
        '[class*="pt"]',
        '[class*="Pt"]',
        '[class*="point"]',
        '[class*="Point"]',
        '[class*="cashback"]',
        '[class*="reward"]',
        '.price',
        '.amount',
        '.value'
      ];
      
      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        result.selectors[selector] = Array.from(elements).map(el => ({
          text: el.textContent.trim(),
          html: el.innerHTML.trim(),
          className: el.className
        }));
      });
      
      // ポイント・％を含むテキストを検索
      const allText = document.body.textContent;
      const pointMatches = allText.match(/\d+(?:,\d+)?(?:ちょび)?pt/gi) || [];
      const percentMatches = allText.match(/\d+(?:\.\d+)?[%％]/g) || [];
      
      result.pointMatches = pointMatches;
      result.percentMatches = percentMatches;
      
      // ページ内のすべての数字+pt/％パターン
      const numberElements = document.querySelectorAll('*');
      result.numberElements = [];
      
      Array.from(numberElements).forEach(el => {
        const text = el.textContent.trim();
        if (text.match(/\d+(?:,\d+)?(?:ちょび)?pt|\d+(?:\.\d+)?[%％]/i)) {
          result.numberElements.push({
            tagName: el.tagName,
            className: el.className,
            text: text,
            parent: el.parentElement ? el.parentElement.className : ''
          });
        }
      });
      
      return result;
    });
    
    console.log('=== 還元率デバッグ結果 ===');
    console.log(`Document Title: ${debug.title}`);
    
    console.log('\n--- セレクタ別結果 ---');
    Object.entries(debug.selectors).forEach(([selector, elements]) => {
      if (elements.length > 0) {
        console.log(`${selector}: ${elements.length}件`);
        elements.forEach((el, i) => {
          console.log(`  [${i}] "${el.text}" (class: ${el.className})`);
        });
      }
    });
    
    console.log('\n--- ポイントパターンマッチ ---');
    console.log('pt系:', debug.pointMatches);
    console.log('％系:', debug.percentMatches);
    
    console.log('\n--- 数字を含む要素 ---');
    debug.numberElements.slice(0, 10).forEach((el, i) => {
      console.log(`[${i}] ${el.tagName}.${el.className}: "${el.text}"`);
    });
    
    // 10秒待機
    console.log('\n⏸️ 10秒待機中（ブラウザで確認してください）...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await browser.close();
  }
}

debugCashback().catch(console.error);