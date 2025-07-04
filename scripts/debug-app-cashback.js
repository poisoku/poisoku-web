const puppeteer = require('puppeteer');

async function debugAppCashback() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // モバイルユーザーエージェント設定
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
    await page.setViewport({ width: 375, height: 812, isMobile: true });
    
    console.log('アプリ案件の還元率表示を調査中...\n');
    
    // まずアプリ一覧ページを取得
    await page.goto('https://www.chobirich.com/smartphone?sort=point', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // アプリ案件のIDを取得
    const appIds = await page.evaluate(() => {
      const ids = [];
      document.querySelectorAll('a[href*="/ad_details/"]').forEach(link => {
        const match = link.href.match(/\/ad_details\/(\d+)/);
        if (match) {
          ids.push(match[1]);
        }
      });
      return ids.slice(0, 5); // 最初の5件をテスト
    });

    console.log(`テスト対象: ${appIds.length}件のアプリ案件`);

    // 各アプリ案件の詳細ページを調査
    for (const appId of appIds) {
      console.log(`\n=== 案件ID: ${appId} ===`);
      
      try {
        await page.goto(`https://www.chobirich.com/ad_details/${appId}/`, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        const analysis = await page.evaluate(() => {
          const result = {
            title: document.querySelector('h1.AdDetails__title')?.textContent?.trim() || '不明',
            foundCashback: [],
            allPtElements: [],
            adDetailsContent: []
          };

          // 1. 従来のセレクタをテスト
          const mainPtElement = document.querySelector('.AdDetails__pt.ItemPtLarge');
          if (mainPtElement) {
            result.foundCashback.push({
              method: 'AdDetails__pt ItemPtLarge',
              text: mainPtElement.textContent.trim(),
              className: mainPtElement.className
            });
          }

          // 2. すべてのpt関連要素を調査
          document.querySelectorAll('[class*="pt"], [class*="Pt"], [class*="point"], [class*="Point"]').forEach(el => {
            const text = el.textContent.trim();
            if (text.match(/(\d+(?:\.\d+)?[%％]|\d+(?:,\d+)?(?:ちょび)?pt)/)) {
              result.allPtElements.push({
                text: text,
                className: el.className,
                tagName: el.tagName,
                innerHTML: el.innerHTML.substring(0, 100)
              });
            }
          });

          // 3. AdDetailsエリア内の全テキストを調査
          const adDetailsArea = document.querySelector('.AdDetails');
          if (adDetailsArea) {
            const walker = document.createTreeWalker(
              adDetailsArea,
              NodeFilter.SHOW_TEXT,
              null,
              false
            );

            let textNode;
            while (textNode = walker.nextNode()) {
              const text = textNode.textContent.trim();
              if (text.match(/(\d+(?:\.\d+)?[%％]|\d+(?:,\d+)?(?:ちょび)?pt)/)) {
                result.adDetailsContent.push({
                  text: text,
                  parentTag: textNode.parentElement?.tagName || '',
                  parentClass: textNode.parentElement?.className || ''
                });
              }
            }
          }

          // 4. 特殊なアプリ案件のパターンを調査
          const specialPatterns = [];
          
          // 無料、ダウンロード、インストールなどの文言
          const appKeywords = ['無料', 'ダウンロード', 'インストール', '初回起動', '会員登録'];
          appKeywords.forEach(keyword => {
            if (document.body.textContent.includes(keyword)) {
              specialPatterns.push(keyword);
            }
          });

          result.specialPatterns = specialPatterns;
          result.isAppCampaign = result.title.includes('アプリ') || specialPatterns.length > 0;

          return result;
        });

        console.log(`案件名: ${analysis.title}`);
        console.log(`アプリ案件判定: ${analysis.isAppCampaign}`);
        console.log(`特殊パターン: ${analysis.specialPatterns.join(', ')}`);
        
        if (analysis.foundCashback.length > 0) {
          console.log('従来セレクタで発見:');
          analysis.foundCashback.forEach(item => {
            console.log(`  - ${item.method}: "${item.text}"`);
          });
        } else {
          console.log('従来セレクタでは還元率が見つからない');
        }

        if (analysis.allPtElements.length > 0) {
          console.log('pt関連要素で発見:');
          analysis.allPtElements.slice(0, 3).forEach(item => {
            console.log(`  - ${item.className}: "${item.text}"`);
          });
        }

        if (analysis.adDetailsContent.length > 0) {
          console.log('AdDetailsエリア内のテキストで発見:');
          analysis.adDetailsContent.slice(0, 3).forEach(item => {
            console.log(`  - ${item.parentTag}.${item.parentClass}: "${item.text}"`);
          });
        }

        if (analysis.foundCashback.length === 0 && analysis.allPtElements.length === 0 && analysis.adDetailsContent.length === 0) {
          console.log('⚠️ 還元率が全く見つからない案件');
        }

        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.log(`エラー: ${error.message}`);
      }
    }

  } finally {
    await browser.close();
  }
}

debugAppCashback().catch(console.error);