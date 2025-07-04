const puppeteer = require('puppeteer');

async function findMainCashback() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const campaigns = [
      { id: '1701350', name: 'ANAのふるさと納税' },
      { id: '36796', name: '楽天市場（正常例）' }
    ];

    for (const campaign of campaigns) {
      console.log(`\n=== ${campaign.name} ===`);
      
      const page = await browser.newPage();
      await page.goto(`https://www.chobirich.com/ad_details/${campaign.id}/`, {
        waitUntil: 'networkidle2'
      });

      // AdDetailsエリア内のみを詳細調査
      const analysis = await page.evaluate(() => {
        const result = {
          adDetailsElements: [],
          mainContentElements: []
        };

        // AdDetailsエリア内の要素のみを調査
        const adDetailsArea = document.querySelector('.AdDetails');
        if (adDetailsArea) {
          // AdDetailsエリア内のすべてのテキストノードを調査
          const walker = document.createTreeWalker(
            adDetailsArea,
            NodeFilter.SHOW_TEXT,
            null,
            false
          );

          let node;
          while (node = walker.nextNode()) {
            const text = node.textContent.trim();
            if (/\d+(?:\.\d+)?%|\d+(?:,\d+)?pt/.test(text)) {
              const parent = node.parentElement;
              const rect = parent.getBoundingClientRect();
              
              result.adDetailsElements.push({
                text: text,
                parentTag: parent.tagName,
                parentClass: parent.className,
                fontSize: parseInt(window.getComputedStyle(parent).fontSize),
                isVisible: rect.width > 0 && rect.height > 0,
                position: { top: Math.round(rect.top), left: Math.round(rect.left) }
              });
            }
          }

          // AdDetailsエリア内の要素も調査
          adDetailsArea.querySelectorAll('*').forEach(el => {
            const text = el.textContent?.trim() || '';
            const exactMatch = text.match(/^(\d+(?:\.\d+)?%|\d+(?:,\d+)?pt)$/);
            
            if (exactMatch) {
              const rect = el.getBoundingClientRect();
              result.mainContentElements.push({
                text: exactMatch[1],
                tag: el.tagName,
                className: el.className,
                fontSize: parseInt(window.getComputedStyle(el).fontSize),
                isVisible: rect.width > 0 && rect.height > 0,
                position: { top: Math.round(rect.top), left: Math.round(rect.left) },
                innerHTML: el.innerHTML
              });
            }
          });
        }

        // ソート
        result.adDetailsElements.sort((a, b) => b.fontSize - a.fontSize);
        result.mainContentElements.sort((a, b) => b.fontSize - a.fontSize);

        return result;
      });

      console.log('\n--- AdDetailsエリア内のテキストノード ---');
      analysis.adDetailsElements.slice(0, 5).forEach((el, i) => {
        console.log(`${i + 1}. "${el.text}" (${el.fontSize}px) - ${el.parentTag}.${el.parentClass}`);
      });

      console.log('\n--- AdDetailsエリア内の要素 ---');
      analysis.mainContentElements.slice(0, 5).forEach((el, i) => {
        console.log(`${i + 1}. "${el.text}" (${el.fontSize}px) - ${el.tag}.${el.className}`);
        console.log(`   位置: (${el.position.left}, ${el.position.top})`);
      });

      await page.close();
    }

  } finally {
    await browser.close();
  }
}

findMainCashback().catch(console.error);