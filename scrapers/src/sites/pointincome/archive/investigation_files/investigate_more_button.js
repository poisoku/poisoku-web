#!/usr/bin/env node

const puppeteer = require('puppeteer');

/**
 * 「次の10件を表示」ボタンの調査とクリックテスト
 */
async function investigateMoreButton() {
  console.log('🔍 「次の10件を表示」ボタン調査開始');
  console.log('='.repeat(70));
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // iOSユーザーエージェント設定
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15');
    await page.setViewport({ width: 390, height: 844 });
    
    // カテゴリ285（ゲーム）でテスト
    const url = 'https://sp.pointi.jp/pts_app.php?cat_no=285&sort=&sub=4';
    console.log(`📱 テストURL: ${url}\n`);
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 初期状態の確認
    console.log('📊 初期状態の確認:');
    const initialState = await page.evaluate(() => {
      const campaigns = document.querySelectorAll('.box01');
      return {
        campaignCount: campaigns.length,
        pageHeight: document.body.scrollHeight
      };
    });
    console.log(`  案件数: ${initialState.campaignCount}件`);
    console.log(`  ページ高さ: ${initialState.pageHeight}px\n`);
    
    // 「次の10件を表示」ボタンを探す
    console.log('🔘 ボタン要素の検索:');
    const buttonInfo = await page.evaluate(() => {
      const result = {
        found: false,
        buttons: [],
        possibleSelectors: []
      };
      
      // テキストで検索
      const allElements = [...document.querySelectorAll('button, a, div, span, input[type="button"]')];
      
      // 「次の10件を表示」を含む要素を探す
      const moreButtons = allElements.filter(el => {
        const text = el.textContent || el.value || '';
        return text.includes('次の10件') || 
               text.includes('次の') && text.includes('件') ||
               text.includes('もっと見る') ||
               text.includes('さらに表示');
      });
      
      moreButtons.forEach(btn => {
        result.buttons.push({
          tagName: btn.tagName,
          className: btn.className,
          id: btn.id,
          textContent: (btn.textContent || btn.value || '').trim(),
          onclick: btn.onclick ? btn.onclick.toString() : null,
          href: btn.getAttribute('href'),
          style: {
            display: window.getComputedStyle(btn).display,
            visibility: window.getComputedStyle(btn).visibility,
            backgroundColor: window.getComputedStyle(btn).backgroundColor,
            color: window.getComputedStyle(btn).color
          },
          rect: btn.getBoundingClientRect(),
          isClickable: btn.tagName === 'BUTTON' || btn.tagName === 'A' || btn.onclick !== null
        });
      });
      
      // 青色背景のボタンを探す（スクリーンショットから）
      const blueButtons = allElements.filter(el => {
        const style = window.getComputedStyle(el);
        const bgColor = style.backgroundColor;
        const text = (el.textContent || el.value || '').trim();
        
        // 青色系の背景色をチェック
        return (bgColor.includes('rgb') && bgColor.includes('33')) || 
               bgColor.includes('blue') ||
               (text && text.includes('表示'));
      });
      
      blueButtons.forEach(btn => {
        const text = (btn.textContent || btn.value || '').trim();
        if (text && text.length < 50) {  // 短いテキストのみ
          result.possibleSelectors.push({
            selector: btn.className ? `.${btn.className.split(' ')[0]}` : btn.tagName.toLowerCase(),
            text: text,
            backgroundColor: window.getComputedStyle(btn).backgroundColor
          });
        }
      });
      
      result.found = moreButtons.length > 0;
      return result;
    });
    
    if (buttonInfo.found) {
      console.log('  ✅ ボタンが見つかりました:');
      buttonInfo.buttons.forEach((btn, idx) => {
        console.log(`\n  ボタン${idx + 1}:`);
        console.log(`    テキスト: "${btn.textContent}"`);
        console.log(`    タグ: ${btn.tagName}`);
        console.log(`    クラス: ${btn.className || 'なし'}`);
        console.log(`    表示状態: ${btn.style.display} / ${btn.style.visibility}`);
        console.log(`    背景色: ${btn.style.backgroundColor}`);
        console.log(`    位置: top=${btn.rect.top}px, left=${btn.rect.left}px`);
        console.log(`    クリック可能: ${btn.isClickable ? 'はい' : 'いいえ'}`);
      });
    } else {
      console.log('  ❌ ボタンが見つかりませんでした');
      
      if (buttonInfo.possibleSelectors.length > 0) {
        console.log('\n  🔍 候補となる要素:');
        buttonInfo.possibleSelectors.forEach(sel => {
          console.log(`    ${sel.selector}: "${sel.text}" (${sel.backgroundColor})`);
        });
      }
    }
    
    // ページ最下部までスクロール
    console.log('\n📜 ページ最下部までスクロール:');
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // スクロール後に再度ボタンを探す
    const afterScrollButton = await page.evaluate(() => {
      // より具体的なセレクタで検索
      const selectors = [
        'button:contains("次の10件")',
        'a:contains("次の10件")',
        '.btn-more',
        '.more-button',
        '[class*="more"]',
        'button[class*="btn"]',
        'a[class*="btn"]',
        '.btn',
        'input[type="button"]'
      ];
      
      // CSSセレクタが使えない場合の代替検索
      const allElements = [...document.querySelectorAll('*')];
      const results = [];
      
      allElements.forEach(el => {
        const text = (el.textContent || el.value || '').trim();
        if (text === '次の10件を表示' || text === '次の10件' || text.includes('次の') && text.includes('件')) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 50 && rect.height > 20) {  // 最小サイズチェック
            results.push({
              found: true,
              tagName: el.tagName,
              className: el.className,
              id: el.id,
              text: text,
              rect: rect,
              selector: el.id ? `#${el.id}` : 
                       el.className ? `.${el.className.split(' ').join('.')}` :
                       el.tagName.toLowerCase(),
              isVisible: rect.top < window.innerHeight && rect.bottom > 0
            });
          }
        }
      });
      
      return results.length > 0 ? results[0] : { found: false };
    });
    
    if (afterScrollButton.found) {
      console.log('  ✅ スクロール後にボタンを発見:');
      console.log(`    セレクタ: ${afterScrollButton.selector}`);
      console.log(`    テキスト: "${afterScrollButton.text}"`);
      console.log(`    表示中: ${afterScrollButton.isVisible ? 'はい' : 'いいえ'}`);
      
      // ボタンのクリックを試みる
      console.log('\n🖱️ ボタンクリックテスト:');
      try {
        const beforeClick = await page.evaluate(() => document.querySelectorAll('.box01').length);
        console.log(`  クリック前の案件数: ${beforeClick}件`);
        
        // セレクタでクリック
        await page.evaluate((selector) => {
          const el = document.querySelector(selector);
          if (el) {
            el.click();
            return true;
          }
          return false;
        }, afterScrollButton.selector);
        
        // 読み込み待機
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const afterClick = await page.evaluate(() => document.querySelectorAll('.box01').length);
        console.log(`  クリック後の案件数: ${afterClick}件`);
        
        if (afterClick > beforeClick) {
          console.log(`  ✅ 成功！ ${afterClick - beforeClick}件の新規案件を読み込みました`);
        } else {
          console.log('  ⚠️ クリック後も案件数が変わりませんでした');
        }
        
      } catch (error) {
        console.log(`  ❌ クリックエラー: ${error.message}`);
      }
    } else {
      console.log('  ❌ スクロール後もボタンが見つかりませんでした');
    }
    
    // HTMLソースで直接検索
    console.log('\n📝 HTMLソース検索:');
    const htmlSearch = await page.evaluate(() => {
      const html = document.documentElement.innerHTML;
      const results = {
        hasText: html.includes('次の10件'),
        hasMoreText: html.includes('もっと見る'),
        hasLoadMore: html.includes('load') && html.includes('more'),
        possibleButtons: []
      };
      
      // 次の10件を含む部分を探す
      if (results.hasText) {
        const index = html.indexOf('次の10件');
        const snippet = html.substring(Math.max(0, index - 100), Math.min(html.length, index + 100));
        results.snippet = snippet;
      }
      
      return results;
    });
    
    console.log(`  「次の10件」テキスト: ${htmlSearch.hasText ? '✅ あり' : '❌ なし'}`);
    console.log(`  「もっと見る」テキスト: ${htmlSearch.hasMoreText ? '✅ あり' : '❌ なし'}`);
    
    if (htmlSearch.snippet) {
      console.log(`  HTMLスニペット: ...${htmlSearch.snippet}...`);
    }
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
  } finally {
    await browser.close();
    console.log('\n✅ 調査完了');
  }
}

// 実行
investigateMoreButton().catch(console.error);