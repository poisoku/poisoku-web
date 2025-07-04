const puppeteer = require('puppeteer');

async function debugChobirich() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // 楽天市場の案件で詳細調査
    console.log('楽天市場案件のHTML構造を詳細調査...\n');
    await page.goto('https://www.chobirich.com/ad_details/36796/', {
      waitUntil: 'networkidle2'
    });

    const analysis = await page.evaluate(() => {
      const result = {
        pageTitle: document.title,
        url: window.location.href,
        headings: [],
        cashbackElements: [],
        allTextNodes: []
      };

      // すべての見出し要素
      ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(tag => {
        document.querySelectorAll(tag).forEach((el, i) => {
          result.headings.push({
            tag: tag,
            index: i,
            text: el.textContent.trim(),
            className: el.className,
            id: el.id
          });
        });
      });

      // 還元率らしい要素を詳しく調査
      document.querySelectorAll('*').forEach(el => {
        const text = el.textContent?.trim() || '';
        const style = window.getComputedStyle(el);
        const fontSize = parseInt(style.fontSize);
        
        // ポイントや%の表記を探す
        if (/\d+/.test(text) && (text.includes('%') || text.includes('pt') || text.includes('ポイント'))) {
          result.cashbackElements.push({
            text: text,
            fontSize: fontSize,
            fontWeight: style.fontWeight,
            color: style.color,
            className: el.className,
            tagName: el.tagName,
            parent: el.parentElement?.tagName || '',
            rect: {
              width: el.getBoundingClientRect().width,
              height: el.getBoundingClientRect().height
            }
          });
        }
      });

      // サイズでソート
      result.cashbackElements.sort((a, b) => b.fontSize - a.fontSize);

      // テキストノードで案件名候補を探す
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      let node;
      while (node = walker.nextNode()) {
        const text = node.textContent.trim();
        if (text.length > 5 && text.length < 50 && 
            !text.includes('ちょびリッチ') && 
            !text.includes('ログイン') &&
            !text.match(/^\d+/)) {
          result.allTextNodes.push(text);
        }
      }

      return result;
    });

    console.log('=== ページ情報 ===');
    console.log('タイトル:', analysis.pageTitle);
    console.log('URL:', analysis.url);

    console.log('\n=== 見出し要素 ===');
    analysis.headings.forEach(h => {
      console.log(`${h.tag}: "${h.text}" (class: ${h.className})`);
    });

    console.log('\n=== 還元率候補要素（フォントサイズ順） ===');
    analysis.cashbackElements.slice(0, 10).forEach((el, i) => {
      console.log(`${i + 1}. "${el.text}" - ${el.fontSize}px (${el.tagName}.${el.className})`);
    });

    console.log('\n=== 案件名候補テキスト ===');
    analysis.allTextNodes.slice(0, 10).forEach((text, i) => {
      console.log(`${i + 1}. "${text}"`);
    });

    // スクリーンショット
    await page.screenshot({ path: 'debug-chobirich.png', fullPage: true });
    console.log('\nスクリーンショット保存: debug-chobirich.png');

  } finally {
    await browser.close();
  }
}

debugChobirich().catch(console.error);