const puppeteer = require('puppeteer');

async function debugCashback() {
  console.log('🔍 還元率が取得できない案件を詳しく調査...\n');
  
  const testUrls = [
    'https://pointi.jp/ad/150046/', // シャープ
    'https://pointi.jp/ad/140157/', // スワロフスキー
    'https://pointi.jp/ad/143060/'  // ダイソー
  ];
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    for (const url of testUrls) {
      console.log(`\n📄 調査中: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2' });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const pageInfo = await page.evaluate(() => {
        const info = {
          title: '',
          allPointTexts: [],
          percentTexts: [],
          redTexts: [],
          boldTexts: []
        };
        
        // タイトル
        const h2 = document.querySelector('h2');
        if (h2) info.title = h2.textContent.trim();
        
        // すべてのテキストノードを調査
        const walk = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );
        
        let node;
        while (node = walk.nextNode()) {
          const text = node.textContent.trim();
          if (text.length > 0 && text.length < 100) {
            // ポイント表記
            if (text.match(/\d+\s*pt/i) || text.match(/\d+ポイント/)) {
              info.allPointTexts.push({
                text: text,
                parent: node.parentElement.tagName,
                class: node.parentElement.className
              });
            }
            // パーセント表記
            if (text.match(/\d+(?:\.\d+)?%/)) {
              info.percentTexts.push({
                text: text,
                parent: node.parentElement.tagName,
                class: node.parentElement.className
              });
            }
            // 円表記
            if (text.match(/\d+円/)) {
              info.allPointTexts.push({
                text: text,
                parent: node.parentElement.tagName,
                class: node.parentElement.className
              });
            }
          }
        }
        
        // 赤色のテキストを探す
        const redElements = document.querySelectorAll('[style*="color: red"], [style*="color:#ff0000"], [style*="color:#f00"], .red, [class*="red"]');
        redElements.forEach(el => {
          const text = el.textContent.trim();
          if (text && text.match(/\d/)) {
            info.redTexts.push({
              text: text,
              tag: el.tagName,
              class: el.className
            });
          }
        });
        
        // 太字のテキストを探す
        const boldElements = document.querySelectorAll('b, strong, [style*="font-weight: bold"], .bold, [class*="bold"]');
        boldElements.forEach(el => {
          const text = el.textContent.trim();
          if (text && text.match(/\d/)) {
            info.boldTexts.push({
              text: text,
              tag: el.tagName,
              class: el.className
            });
          }
        });
        
        // メインのポイント表示エリアを探す
        const mainPointArea = document.querySelector('.point_area, .cashback_area, [class*="point_info"], [class*="reward"]');
        if (mainPointArea) {
          info.mainPointArea = mainPointArea.innerHTML.substring(0, 500);
        }
        
        return info;
      });
      
      console.log(`\nタイトル: ${pageInfo.title}`);
      
      if (pageInfo.allPointTexts.length > 0) {
        console.log('\nポイント/円表記:');
        pageInfo.allPointTexts.forEach(item => {
          console.log(`  "${item.text}" (${item.parent}.${item.class})`);
        });
      }
      
      if (pageInfo.percentTexts.length > 0) {
        console.log('\nパーセント表記:');
        pageInfo.percentTexts.forEach(item => {
          console.log(`  "${item.text}" (${item.parent}.${item.class})`);
        });
      }
      
      if (pageInfo.redTexts.length > 0) {
        console.log('\n赤色テキスト:');
        pageInfo.redTexts.forEach(item => {
          console.log(`  "${item.text}" (${item.tag}.${item.class})`);
        });
      }
      
      if (pageInfo.boldTexts.length > 0) {
        console.log('\n太字テキスト:');
        pageInfo.boldTexts.forEach(item => {
          console.log(`  "${item.text}" (${item.tag}.${item.class})`);
        });
      }
      
      // スクリーンショットを撮る
      const id = url.match(/ad\/(\d+)/)[1];
      await page.screenshot({ path: `debug-pi-${id}.png` });
      console.log(`\n📸 スクリーンショット保存: debug-pi-${id}.png`);
    }
    
  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await browser.close();
  }
}

// 実行
debugCashback();