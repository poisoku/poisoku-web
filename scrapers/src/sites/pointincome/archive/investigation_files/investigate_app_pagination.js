#!/usr/bin/env node

const puppeteer = require('puppeteer');

/**
 * スマホアプリ案件ページの構造調査スクリプト
 * 「次の10件を表示」ボタンの存在と動作を確認
 */
async function investigateAppPagination() {
  console.log('🔍 ポイントインカム スマホアプリ案件ページ調査開始');
  console.log('='.repeat(70));
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    // テスト用カテゴリ（最初の3つ）
    const testCategories = [
      { id: 285, name: 'ゲーム' },
      { id: 286, name: 'ショッピング' },
      { id: 287, name: 'エンタメ' }
    ];
    
    const testOSList = ['ios', 'android'];
    
    for (const os of testOSList) {
      console.log(`\n📱 ${os.toUpperCase()} 環境で調査`);
      console.log('-'.repeat(50));
      
      const userAgent = os === 'ios' 
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
        : 'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36';
      
      for (const category of testCategories) {
        const page = await browser.newPage();
        await page.setUserAgent(userAgent);
        await page.setViewport({ 
          width: os === 'ios' ? 390 : 412, 
          height: os === 'ios' ? 844 : 915 
        });
        
        const url = `https://sp.pointi.jp/pts_app.php?cat_no=${category.id}&sort=&sub=4`;
        console.log(`\n🎯 カテゴリ${category.id} (${category.name}): ${url}`);
        
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 初期表示の案件数を確認
        const initialData = await page.evaluate(() => {
          // 案件要素のカウント
          const campaignSelectors = [
            '.box01',
            '.campaign-item',
            '.ad-item',
            'li[class*="app"]',
            'div[class*="campaign"]',
            '.list-item'
          ];
          
          let campaignCount = 0;
          let foundSelector = null;
          
          for (const selector of campaignSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              campaignCount = elements.length;
              foundSelector = selector;
              break;
            }
          }
          
          // 「次の10件を表示」ボタンの検索
          const buttonSelectors = [
            'button:contains("次の10件")',
            'a:contains("次の10件")',
            '[class*="more"]',
            '[id*="more"]',
            'button[class*="load"]',
            'a[class*="load"]',
            '.btn-more',
            '#load-more',
            '[onclick*="load"]',
            '[onclick*="more"]'
          ];
          
          let moreButton = null;
          let buttonInfo = null;
          
          // テキストで検索
          const allButtons = [...document.querySelectorAll('button, a, div[onclick], span[onclick]')];
          const textButton = allButtons.find(el => 
            el.textContent && (
              el.textContent.includes('次の10件') ||
              el.textContent.includes('もっと見る') ||
              el.textContent.includes('さらに表示') ||
              el.textContent.includes('Load More') ||
              el.textContent.includes('more')
            )
          );
          
          if (textButton) {
            moreButton = textButton;
            buttonInfo = {
              tagName: textButton.tagName,
              className: textButton.className,
              id: textButton.id,
              text: textButton.textContent.trim(),
              onclick: textButton.getAttribute('onclick'),
              href: textButton.getAttribute('href')
            };
          }
          
          // セレクタで検索
          if (!moreButton) {
            for (const selector of buttonSelectors) {
              try {
                const el = document.querySelector(selector);
                if (el) {
                  moreButton = el;
                  buttonInfo = {
                    tagName: el.tagName,
                    className: el.className,
                    id: el.id,
                    text: el.textContent.trim(),
                    selector: selector
                  };
                  break;
                }
              } catch (e) {
                // セレクタエラーは無視
              }
            }
          }
          
          // ページネーション要素の検索
          const paginationSelectors = [
            '.pagination',
            '.pager',
            '[class*="page"]',
            'nav'
          ];
          
          let paginationInfo = null;
          for (const selector of paginationSelectors) {
            const el = document.querySelector(selector);
            if (el) {
              paginationInfo = {
                selector: selector,
                className: el.className,
                innerHTML: el.innerHTML.substring(0, 200)
              };
              break;
            }
          }
          
          // JavaScript関数の確認
          const jsInfo = {
            hasLoadMore: typeof window.loadMore === 'function',
            hasLoadNext: typeof window.loadNext === 'function',
            hasShowMore: typeof window.showMore === 'function',
            globalFunctions: Object.keys(window).filter(key => 
              key.toLowerCase().includes('load') || 
              key.toLowerCase().includes('more') ||
              key.toLowerCase().includes('next')
            ).slice(0, 10)
          };
          
          // 隠れたデータの確認
          const hiddenData = {
            hasDataAttributes: document.querySelector('[data-campaigns]') !== null,
            hasJSONScript: [...document.querySelectorAll('script[type="application/json"]')].length,
            windowDataKeys: Object.keys(window).filter(key => 
              key.toLowerCase().includes('campaign') || 
              key.toLowerCase().includes('app') ||
              key.toLowerCase().includes('data')
            ).slice(0, 10)
          };
          
          return {
            campaignCount,
            foundSelector,
            hasMoreButton: !!moreButton,
            buttonInfo,
            paginationInfo,
            jsInfo,
            hiddenData,
            pageHeight: document.body.scrollHeight,
            viewportHeight: window.innerHeight
          };
        });
        
        console.log(`  📊 初期表示案件数: ${initialData.campaignCount}件`);
        console.log(`  📋 案件セレクタ: ${initialData.foundSelector || 'なし'}`);
        console.log(`  🔘 「次の10件」ボタン: ${initialData.hasMoreButton ? '✅ あり' : '❌ なし'}`);
        
        if (initialData.buttonInfo) {
          console.log(`     ボタン詳細:`);
          console.log(`     - タグ: ${initialData.buttonInfo.tagName}`);
          console.log(`     - クラス: ${initialData.buttonInfo.className || 'なし'}`);
          console.log(`     - テキスト: "${initialData.buttonInfo.text}"`);
          if (initialData.buttonInfo.onclick) {
            console.log(`     - onclick: ${initialData.buttonInfo.onclick}`);
          }
        }
        
        if (initialData.paginationInfo) {
          console.log(`  📄 ページネーション要素: あり (${initialData.paginationInfo.selector})`);
        }
        
        if (initialData.jsInfo.globalFunctions.length > 0) {
          console.log(`  🔧 関連JavaScript関数: ${initialData.jsInfo.globalFunctions.join(', ')}`);
        }
        
        if (initialData.hiddenData.windowDataKeys.length > 0) {
          console.log(`  💾 データ関連変数: ${initialData.hiddenData.windowDataKeys.join(', ')}`);
        }
        
        console.log(`  📏 ページ高さ: ${initialData.pageHeight}px (ビューポート: ${initialData.viewportHeight}px)`);
        
        // 無限スクロールテスト
        console.log(`  🔄 無限スクロールテスト...`);
        const scrollResult = await page.evaluate(async () => {
          const initialCount = document.querySelectorAll('.box01, .campaign-item, .ad-item, li[class*="app"]').length;
          
          // スクロール実行
          window.scrollTo(0, document.body.scrollHeight);
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          const afterScrollCount = document.querySelectorAll('.box01, .campaign-item, .ad-item, li[class*="app"]').length;
          
          return {
            initialCount,
            afterScrollCount,
            increased: afterScrollCount > initialCount
          };
        });
        
        console.log(`     スクロール前: ${scrollResult.initialCount}件 → スクロール後: ${scrollResult.afterScrollCount}件`);
        console.log(`     新規読み込み: ${scrollResult.increased ? '✅ あり' : '❌ なし'}`);
        
        await page.close();
      }
    }
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
  } finally {
    await browser.close();
    console.log('\n✅ 調査完了');
  }
}

// 実行
investigateAppPagination().catch(console.error);