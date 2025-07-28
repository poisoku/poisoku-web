const puppeteer = require('puppeteer');

async function debugMobilePt() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox'],
    defaultViewport: { width: 375, height: 812 }
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1');

  // 複数の案件をテスト
  const testUrls = [
    { name: 'TAO（正解: 5,500pt = 550円）', url: 'https://sp.pointi.jp/ad/152504/' },
    { name: 'みんなの銀行（正解: 15,000pt = 1,500円）', url: 'https://sp.pointi.jp/ad/151741/' },
    { name: 'Merge Inn Android（正解: 5,000pt = 500円）', url: 'https://sp.pointi.jp/ad/153335/' }
  ];

  for (const test of testUrls) {
    console.log(`\n🔍 デバッグ: ${test.name}`);
    console.log(`URL: ${test.url}`);
    
    await page.goto(test.url, { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const pageData = await page.evaluate(() => {
      const data = {
        allTexts: [],
        pointTexts: [],
        percentTexts: []
      };

      // 全てのテキストを収集
      document.querySelectorAll('*').forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length < 100) {
          // pt表記を含むテキスト
          if (text.match(/\d{1,3}(?:,\d{3})*(?:\.\d+)?pt/i)) {
            data.pointTexts.push({
              text: text,
              selector: el.className || el.tagName,
              parent: el.parentElement?.className || el.parentElement?.tagName
            });
          }
          // %表記を含むテキスト
          if (text.includes('%') && text.includes('還元')) {
            data.percentTexts.push({
              text: text,
              selector: el.className || el.tagName
            });
          }
        }
      });

      // 特定のセレクターを調査
      const selectors = [
        '.point',
        '.detail_calcu_pt',
        '.ad_pt',
        '.pt_yen',
        '.point-triangle',
        '.box_point_joken'
      ];

      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          const text = el.textContent?.trim();
          if (text) {
            data.allTexts.push({
              selector: selector,
              text: text,
              className: el.className
            });
          }
        });
      });

      return data;
    });

    console.log('\n📊 発見されたpt表記:');
    pageData.pointTexts.forEach(item => {
      console.log(`  - "${item.text}" (${item.selector})`);
    });

    console.log('\n⚠️ 発見された%還元表記:');
    pageData.percentTexts.forEach(item => {
      console.log(`  - "${item.text}" (${item.selector})`);
    });

    // スクリーンショット保存
    await page.screenshot({ 
      path: `debug-mobile-${test.name.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
      fullPage: true 
    });
  }

  await browser.close();
}

debugMobilePt().catch(console.error);