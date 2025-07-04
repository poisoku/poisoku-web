const puppeteer = require('puppeteer');

// 詳細デバッグ：ページ構造を完全分析
async function deepDebug() {
  console.log('🔬 ちょびリッチ ページ構造 詳細分析\n');
  
  const browser = await puppeteer.launch({
    headless: false, // ブラウザ表示
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
    await page.setViewport({ width: 375, height: 812, isMobile: true });
    
    const url = 'https://www.chobirich.com/ad_details/1794491/';
    console.log(`📱 アクセス中: ${url}`);
    
    await page.goto(url, {
      waitUntil: 'networkidle2', // ネットワーク完全停止まで待機
      timeout: 60000
    });

    console.log('⏳ 10秒待機（JavaScript実行完了まで）...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 完全なページ分析
    const analysis = await page.evaluate(() => {
      const result = {
        url: window.location.href,
        title: document.title,
        bodyText: document.body.textContent.substring(0, 500),
        html: document.documentElement.innerHTML.substring(0, 1000),
        
        // すべてのセレクタを詳細チェック
        elements: {},
        
        // すべてのh1-h6要素
        headers: [],
        
        // class名にtitleを含む要素
        titleClasses: [],
        
        // JavaScriptエラー
        jsErrors: []
      };
      
      // セレクタ詳細チェック
      const selectors = [
        'h1', 'h2', 'h3',
        '.title', '.Title',
        '[class*="title"]', '[class*="Title"]',
        '[class*="name"]', '[class*="Name"]',
        '.AdDetails__title',
        '.ad-title', '.campaign-title',
        '.item-title', '.detail-title'
      ];
      
      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        result.elements[selector] = Array.from(elements).map(el => ({
          tagName: el.tagName,
          className: el.className,
          id: el.id,
          text: el.textContent.trim().substring(0, 100),
          innerHTML: el.innerHTML.substring(0, 200)
        }));
      });
      
      // すべてのヘッダー要素
      ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(tag => {
        const headers = document.querySelectorAll(tag);
        Array.from(headers).forEach(h => {
          result.headers.push({
            tag: tag,
            className: h.className,
            text: h.textContent.trim(),
            innerHTML: h.innerHTML.substring(0, 200)
          });
        });
      });
      
      // titleを含むクラス名の要素
      const allElements = document.querySelectorAll('*');
      Array.from(allElements).forEach(el => {
        if (el.className && typeof el.className === 'string' && 
            el.className.toLowerCase().includes('title') &&
            el.textContent.trim()) {
          result.titleClasses.push({
            tagName: el.tagName,
            className: el.className,
            text: el.textContent.trim().substring(0, 100)
          });
        }
      });
      
      return result;
    });
    
    console.log('=== 詳細分析結果 ===');
    console.log(`URL: ${analysis.url}`);
    console.log(`Title: ${analysis.title}`);
    console.log(`Body Text (先頭500文字): ${analysis.bodyText}`);
    
    console.log('\n--- すべてのヘッダー要素 ---');
    analysis.headers.forEach((h, i) => {
      console.log(`${h.tag.toUpperCase()}[${i}]: "${h.text}" (class: ${h.className})`);
    });
    
    console.log('\n--- titleクラスを含む要素 ---');
    analysis.titleClasses.forEach((el, i) => {
      console.log(`${el.tagName}[${i}]: "${el.text}" (class: ${el.className})`);
    });
    
    console.log('\n--- セレクタ別要素数 ---');
    Object.entries(analysis.elements).forEach(([selector, elements]) => {
      console.log(`${selector}: ${elements.length}件`);
      elements.forEach((el, i) => {
        if (el.text) {
          console.log(`  [${i}] ${el.tagName}: "${el.text}" (class: ${el.className})`);
        }
      });
    });
    
    console.log('\n--- HTML構造（先頭1000文字） ---');
    console.log(analysis.html);
    
    // 15秒待機（手動確認用）
    console.log('\n⏸️ 15秒待機中（ブラウザで手動確認してください）...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await browser.close();
  }
}

deepDebug().catch(console.error);