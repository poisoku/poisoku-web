const puppeteer = require('puppeteer');

// 案件名取得の詳細デバッグ
async function debugCampaignName() {
  console.log('🔍 案件名取得デバッグ開始\n');
  
  const browser = await puppeteer.launch({
    headless: false, // ブラウザを表示
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

    await page.waitForTimeout(3000);

    // 詳細なデバッグ情報を取得
    const debug = await page.evaluate(() => {
      const result = {
        title: document.title,
        selectors: {}
      };
      
      // 様々なセレクタを試す
      const selectors = [
        'h1.AdDetails__title',
        'h1',
        '.AdDetails__title',
        '.title',
        'h1.title',
        '.campaign-title',
        '.ad-title',
        '[class*="title"]',
        '[class*="Title"]'
      ];
      
      selectors.forEach(selector => {
        const element = document.querySelector(selector);
        result.selectors[selector] = {
          found: !!element,
          text: element ? element.textContent.trim() : null,
          html: element ? element.innerHTML.trim() : null,
          className: element ? element.className : null
        };
      });
      
      // ページ内のすべてのh1要素を取得
      const h1Elements = document.querySelectorAll('h1');
      result.allH1 = Array.from(h1Elements).map(h1 => ({
        text: h1.textContent.trim(),
        className: h1.className,
        html: h1.innerHTML.trim()
      }));
      
      // titleタグの値も確認
      result.documentTitle = document.title;
      
      return result;
    });
    
    console.log('=== デバッグ結果 ===');
    console.log(`Document Title: ${debug.documentTitle}`);
    console.log('\n--- セレクタ別結果 ---');
    
    Object.entries(debug.selectors).forEach(([selector, info]) => {
      console.log(`${selector}:`);
      console.log(`  Found: ${info.found}`);
      console.log(`  Text: "${info.text}"`);
      console.log(`  Class: ${info.className}`);
      console.log('');
    });
    
    console.log('--- すべてのh1要素 ---');
    debug.allH1.forEach((h1, index) => {
      console.log(`H1[${index}]: "${h1.text}" (class: ${h1.className})`);
    });
    
    // 5秒待機（手動確認用）
    console.log('\n⏸️ 5秒待機中（ブラウザで確認してください）...');
    await page.waitForTimeout(5000);
    
  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await browser.close();
  }
}

debugCampaignName().catch(console.error);