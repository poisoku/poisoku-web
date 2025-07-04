const puppeteer = require('puppeteer');

async function debugSpecificCampaign() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // Yahoo!ショッピング（22,000ptになってしまう案件）を調査
    console.log('Yahoo!ショッピング（ID: 41250）を詳細調査...\n');
    await page.goto('https://www.chobirich.com/ad_details/41250/', {
      waitUntil: 'networkidle2'
    });

    const analysis = await page.evaluate(() => {
      const result = {
        pageTitle: document.title,
        mainCashback: '',
        allCashbackElements: []
      };

      // AdDetailsエリア内の還元率を探す
      const mainContent = document.querySelector('.AdDetails') || document.body;
      
      mainContent.querySelectorAll('*').forEach(el => {
        const text = el.textContent?.trim() || '';
        const rect = el.getBoundingClientRect();
        
        if (/^\d+(?:\.\d+)?%$/.test(text) || /^\d+(?:,\d+)?(?:ちょび)?pt$/.test(text)) {
          const fontSize = parseInt(window.getComputedStyle(el).fontSize);
          const isVisible = rect.width > 0 && rect.height > 0;
          
          if (isVisible) {
            result.allCashbackElements.push({
              text: text,
              fontSize: fontSize,
              className: el.className,
              tagName: el.tagName,
              isInSideCol: el.className.includes('SideCol'),
              isInRecommend: el.className.includes('Recommend'),
              parent: el.parentElement?.className || ''
            });
          }
        }
      });

      // フォントサイズでソート
      result.allCashbackElements.sort((a, b) => b.fontSize - a.fontSize);

      // 現在のロジックをシミュレート
      const filtered = result.allCashbackElements.filter(item => 
        !item.className.includes('SideCol') && 
        !item.className.includes('Recommend')
      );
      
      result.mainCashback = filtered.length > 0 ? filtered[0].text : 
                           (result.allCashbackElements.length > 0 ? result.allCashbackElements[0].text : '');

      return result;
    });

    console.log('=== Yahoo!ショッピング分析結果 ===');
    console.log('ページタイトル:', analysis.pageTitle);
    console.log('現在のロジックで取得される還元率:', analysis.mainCashback);

    console.log('\n=== 全還元率要素（フォントサイズ順） ===');
    analysis.allCashbackElements.slice(0, 10).forEach((el, i) => {
      console.log(`${i + 1}. "${el.text}" - ${el.fontSize}px (${el.className})`);
      console.log(`   SideCol: ${el.isInSideCol}, Recommend: ${el.isInRecommend}`);
    });

    // スクリーンショット
    await page.screenshot({ path: 'yahoo-shopping-debug.png', fullPage: true });
    console.log('\nスクリーンショット保存: yahoo-shopping-debug.png');

  } finally {
    await browser.close();
  }
}

debugSpecificCampaign().catch(console.error);