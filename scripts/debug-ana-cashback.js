const puppeteer = require('puppeteer');

async function debugAnaCashback() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    console.log('ANAのふるさと納税で0.3%を探索...\n');
    await page.goto('https://www.chobirich.com/ad_details/1701350/', {
      waitUntil: 'networkidle2'
    });

    const analysis = await page.evaluate(() => {
      const result = {
        pageTitle: document.title,
        foundCashback: [],
        adDetailsContent: []
      };

      // 0.3%を含むすべての要素を探す
      document.querySelectorAll('*').forEach(el => {
        const text = el.textContent?.trim() || '';
        
        // 0.3%を含む要素を特定
        if (text.includes('0.3%')) {
          const rect = el.getBoundingClientRect();
          result.foundCashback.push({
            text: text,
            fullText: text.substring(0, 200),
            tagName: el.tagName,
            className: el.className,
            id: el.id,
            fontSize: parseInt(window.getComputedStyle(el).fontSize),
            isVisible: rect.width > 0 && rect.height > 0,
            position: { top: Math.round(rect.top), left: Math.round(rect.left) },
            innerHTML: el.innerHTML.substring(0, 100)
          });
        }
      });

      // AdDetailsエリア内のすべてのテキストを詳細調査
      const adDetailsArea = document.querySelector('.AdDetails');
      if (adDetailsArea) {
        // テキストノードを含むすべての内容をチェック
        const walker = document.createTreeWalker(
          adDetailsArea,
          NodeFilter.SHOW_ALL,
          null,
          false
        );

        let node;
        while (node = walker.nextNode()) {
          if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) {
            const text = node.textContent?.trim() || '';
            if (text.includes('0.3') || text.includes('%')) {
              result.adDetailsContent.push({
                nodeType: node.nodeType === Node.TEXT_NODE ? 'TEXT' : 'ELEMENT',
                text: text.substring(0, 100),
                parentTag: node.parentElement?.tagName || '',
                parentClass: node.parentElement?.className || '',
                fontSize: node.parentElement ? parseInt(window.getComputedStyle(node.parentElement).fontSize) : 0
              });
            }
          }
        }
      }

      // より具体的に0.3%の表示要素を探す
      const specificSearch = () => {
        const percentageElements = [];
        
        // %を含む要素をすべて調査
        document.querySelectorAll('*').forEach(el => {
          const text = el.textContent?.trim() || '';
          const exactMatch = text.match(/(\d+(?:\.\d+)?%)/g);
          
          if (exactMatch) {
            exactMatch.forEach(match => {
              const rect = el.getBoundingClientRect();
              percentageElements.push({
                match: match,
                fullText: text.substring(0, 50),
                tagName: el.tagName,
                className: el.className,
                fontSize: parseInt(window.getComputedStyle(el).fontSize),
                isVisible: rect.width > 0 && rect.height > 0,
                position: { top: Math.round(rect.top), left: Math.round(rect.left) }
              });
            });
          }
        });
        
        return percentageElements;
      };

      result.allPercentages = specificSearch();

      return result;
    });

    console.log('=== 0.3%を含む要素 ===');
    analysis.foundCashback.forEach((el, i) => {
      console.log(`${i + 1}. ${el.tagName}.${el.className}`);
      console.log(`   テキスト: "${el.fullText}"`);
      console.log(`   フォントサイズ: ${el.fontSize}px`);
      console.log(`   位置: (${el.position.left}, ${el.position.top})`);
      console.log(`   表示: ${el.isVisible}`);
      console.log('');
    });

    console.log('=== AdDetailsエリア内のテキスト（0.3または%を含む） ===');
    analysis.adDetailsContent.slice(0, 10).forEach((content, i) => {
      console.log(`${i + 1}. [${content.nodeType}] "${content.text}"`);
      console.log(`   親要素: ${content.parentTag}.${content.parentClass} (${content.fontSize}px)`);
      console.log('');
    });

    console.log('=== すべての%表記要素（フォントサイズ順） ===');
    analysis.allPercentages
      .sort((a, b) => b.fontSize - a.fontSize)
      .slice(0, 10)
      .forEach((el, i) => {
        console.log(`${i + 1}. "${el.match}" - ${el.fontSize}px (${el.tagName}.${el.className})`);
        console.log(`   フルテキスト: "${el.fullText}"`);
        console.log(`   位置: (${el.position.left}, ${el.position.top})`);
        console.log('');
      });

  } finally {
    await browser.close();
  }
}

debugAnaCashback().catch(console.error);