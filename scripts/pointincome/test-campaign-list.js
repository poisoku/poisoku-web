const puppeteer = require('puppeteer');

async function testCampaignList() {
  console.log('🔍 ポイントインカムの案件リストページを調査中...\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // ショッピングカテゴリの案件リストページにアクセス
    const testUrls = [
      { name: 'ショッピング', url: 'https://pointi.jp/list.php?category=67' },
      { name: '即追加', url: 'https://pointi.jp/list.php?category=69' },
      { name: '会員登録', url: 'https://pointi.jp/list.php?category=70' }
    ];
    
    for (const testUrl of testUrls) {
      console.log(`\n📂 ${testUrl.name}カテゴリを確認中...`);
      await page.goto(testUrl.url, { waitUntil: 'networkidle2' });
      
      // ページ構造を詳しく調査
      const pageStructure = await page.evaluate(() => {
        // 案件リストの可能なセレクタを試す
        const listSelectors = [
          '.offer_list',
          '.campaign_list',
          '.item_list',
          'table.list',
          '.content_box',
          '[class*="list"]',
          'article',
          '.item'
        ];
        
        const foundLists = [];
        
        for (const selector of listSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            foundLists.push({
              selector: selector,
              count: elements.length,
              firstHTML: elements[0].outerHTML.substring(0, 1000)
            });
          }
        }
        
        // テーブル構造を確認
        const tables = document.querySelectorAll('table');
        const tableInfo = Array.from(tables).map((table, index) => ({
          index: index,
          className: table.className,
          rows: table.rows.length,
          firstRowHTML: table.rows[0] ? table.rows[0].innerHTML.substring(0, 500) : ''
        }));
        
        // リンク構造を確認
        const campaignLinks = Array.from(document.querySelectorAll('a[href*="detail.php"], a[href*="ad/"], a[href*="offer/"]'))
          .slice(0, 5)
          .map(link => ({
            href: link.href,
            text: link.textContent.trim(),
            parent: link.parentElement.tagName + '.' + link.parentElement.className
          }));
        
        return {
          lists: foundLists,
          tables: tableInfo,
          campaignLinks: campaignLinks,
          bodyHTML: document.body.innerHTML.substring(0, 2000)
        };
      });
      
      console.log('\n発見した要素:');
      if (pageStructure.lists.length > 0) {
        console.log('リスト要素:');
        pageStructure.lists.forEach(list => {
          console.log(`  - ${list.selector}: ${list.count}件`);
        });
      }
      
      if (pageStructure.tables.length > 0) {
        console.log('\nテーブル要素:');
        pageStructure.tables.forEach(table => {
          console.log(`  - Table #${table.index}: ${table.rows}行, class="${table.className}"`);
        });
      }
      
      if (pageStructure.campaignLinks.length > 0) {
        console.log('\n案件リンク例:');
        pageStructure.campaignLinks.forEach(link => {
          console.log(`  - ${link.text}`);
          console.log(`    URL: ${link.href}`);
          console.log(`    親要素: ${link.parent}`);
        });
      }
      
      // 特定の案件詳細ページを開いてみる
      if (pageStructure.campaignLinks.length > 0) {
        const detailUrl = pageStructure.campaignLinks[0].href;
        console.log(`\n📄 詳細ページを確認: ${detailUrl}`);
        
        await page.goto(detailUrl, { waitUntil: 'networkidle2' });
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const detailInfo = await page.evaluate(() => {
          // 詳細ページの構造を調査
          const info = {
            title: '',
            cashback: '',
            yenAmount: '',
            elements: {}
          };
          
          // タイトルを探す
          const h1 = document.querySelector('h1');
          const h2 = document.querySelector('h2');
          const titleEl = document.querySelector('.campaign_title, .offer_title, [class*="title"]');
          
          if (h1) info.title = h1.textContent.trim();
          else if (h2) info.title = h2.textContent.trim();
          else if (titleEl) info.title = titleEl.textContent.trim();
          
          // ポイント情報を探す（画像のような赤い大きな表示）
          const pointElements = document.querySelectorAll('[class*="point"], [class*="cashback"], .reward');
          pointElements.forEach(el => {
            const text = el.textContent;
            if (text.match(/\d/)) {
              info.elements[el.className] = text.trim();
              
              // pt表記を探す
              if (text.match(/\d+\s*pt/i)) {
                info.cashback = text.trim();
              }
              
              // 円分表記を探す
              if (text.match(/[(（]\d{1,3}(?:,\d{3})*円分[)）]/)) {
                info.yenAmount = text.match(/[(（](\d{1,3}(?:,\d{3})*円分)[)）]/)[1];
              }
            }
          });
          
          // ボディ全体からも円分表記を探す
          const bodyText = document.body.textContent;
          const yenMatch = bodyText.match(/[(（](\d{1,3}(?:,\d{3})*円分)[)）]/);
          if (yenMatch && !info.yenAmount) {
            info.yenAmount = yenMatch[1];
          }
          
          return info;
        });
        
        console.log('\n詳細ページ情報:');
        console.log(`  タイトル: ${detailInfo.title}`);
        console.log(`  ポイント: ${detailInfo.cashback}`);
        console.log(`  円換算: ${detailInfo.yenAmount}`);
        console.log(`  発見した要素:`, detailInfo.elements);
      }
      
      // 少し待機
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    console.log('\n✅ 調査完了！');
    
  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await browser.close();
  }
}

// 実行
testCampaignList();