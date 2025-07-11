const puppeteer = require('puppeteer');
const fs = require('fs').promises;

async function debugMobileDetail() {
  const browser = await puppeteer.launch({
    headless: false, // デバッグのため表示
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 375, height: 812 }
  });

  const page = await browser.newPage();
  
  // モバイルUser-Agent設定
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1');

  // テスト用URL（最初のアプリ）
  const testUrl = 'https://sp.pointi.jp/ad/152504/';
  
  console.log(`📱 デバッグURL: ${testUrl}`);
  await page.goto(testUrl, { waitUntil: 'networkidle2' });
  await new Promise(resolve => setTimeout(resolve, 3000));

  // スクリーンショット保存
  await page.screenshot({ path: 'mobile-detail-debug.png', fullPage: true });
  console.log('📸 スクリーンショット保存: mobile-detail-debug.png');

  // HTML構造を確認
  const pageContent = await page.evaluate(() => {
    const data = {
      url: window.location.href,
      title: document.title,
      h1: document.querySelector('h1')?.textContent,
      h2: document.querySelector('h2')?.textContent,
      h3: document.querySelector('h3')?.textContent,
      // 様々なセレクターを試す
      selectors: {
        '.ad_pt.red.bold': document.querySelector('.ad_pt.red.bold')?.textContent,
        '.pt_yen.bold': document.querySelector('.pt_yen.bold')?.textContent,
        '.box_point_joken': document.querySelector('.box_point_joken')?.textContent,
        // モバイル特有のセレクターを探す
        '.app-title': document.querySelector('.app-title')?.textContent,
        '.app-point': document.querySelector('.app-point')?.textContent,
        '.point': document.querySelector('.point')?.textContent,
        '.cashback': document.querySelector('.cashback')?.textContent,
        // より広範囲な検索
        allClasses: Array.from(document.querySelectorAll('[class*="point"], [class*="pt"], [class*="cash"]')).map(el => ({
          class: el.className,
          text: el.textContent.trim().substring(0, 50)
        }))
      }
    };
    
    return data;
  });

  console.log('\n📋 ページ構造:', JSON.stringify(pageContent, null, 2));

  // HTMLを保存
  const html = await page.content();
  await fs.writeFile('mobile-detail-debug.html', html);
  console.log('💾 HTML保存: mobile-detail-debug.html');

  await browser.close();
}

debugMobileDetail().catch(console.error);