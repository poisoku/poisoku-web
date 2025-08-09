#!/usr/bin/env node

/**
 * ポイントインカム ページネーション詳細調査
 */

const puppeteer = require('puppeteer');

async function investigatePagination() {
  console.log('🔍 ポイントインカム ページネーション詳細調査');
  
  const browser = await puppeteer.launch({ 
    headless: false, // 画面を見ながらデバッグ
    devtools: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  try {
    const testUrl = 'https://pointi.jp/list.php?category=66';
    
    console.log('📄 ページアクセス:', testUrl);
    await page.goto(testUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // 1. 現在ページの案件数確認
    const campaignCount = await page.$$eval('.box_ad', elements => elements.length);
    console.log('📊 現在ページの案件数:', campaignCount, '件');

    // 2. ページネーション要素の詳細調査
    console.log('\n🔍 ページネーション要素の詳細調査:');
    
    // すべてのページネーション関連要素を探す
    const paginationInfo = await page.evaluate(() => {
      const results = [];
      
      // 1. 「次へ」を含むテキストを持つ要素
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      let node;
      const nextElements = [];
      while (node = walker.nextNode()) {
        if (node.textContent.includes('次へ') || node.textContent.includes('次') || node.textContent.includes('>')) {
          const parent = node.parentElement;
          if (parent && (parent.tagName === 'A' || parent.tagName === 'BUTTON' || parent.tagName === 'INPUT')) {
            nextElements.push({
              tag: parent.tagName,
              text: parent.textContent.trim(),
              href: parent.getAttribute('href'),
              onclick: parent.getAttribute('onclick'), 
              className: parent.className,
              id: parent.id
            });
          }
        }
      }
      
      results.push({ type: 'nextElements', data: nextElements });
      
      // 2. ページ番号要素
      const pageNumberElements = Array.from(document.querySelectorAll('a, span')).filter(el => {
        const text = el.textContent.trim();
        return /^\d+$/.test(text) && parseInt(text) > 1 && parseInt(text) <= 10;
      }).map(el => ({
        tag: el.tagName,
        text: el.textContent.trim(),
        href: el.getAttribute('href'),
        onclick: el.getAttribute('onclick'),
        className: el.className
      }));
      
      results.push({ type: 'pageNumbers', data: pageNumberElements });
      
      // 3. フォーム要素
      const forms = Array.from(document.querySelectorAll('form')).map(form => ({
        action: form.getAttribute('action'),
        method: form.getAttribute('method'),
        inputs: Array.from(form.querySelectorAll('input')).map(input => ({
          name: input.getAttribute('name'),
          type: input.getAttribute('type'),
          value: input.getAttribute('value')
        }))
      }));
      
      results.push({ type: 'forms', data: forms });
      
      return results;
    });

    // 結果表示
    paginationInfo.forEach(info => {
      console.log(`\n📋 ${info.type}:`);
      if (info.data.length === 0) {
        console.log('  (要素なし)');
      } else {
        info.data.forEach((item, i) => {
          console.log(`  [${i}]`, JSON.stringify(item, null, 2));
        });
      }
    });

    // 4. JavaScriptでの「次へ」ボタンクリック試行
    console.log('\n🖱️ 「次へ」ボタンクリック試行:');
    
    // XPath で「次へ」を含む要素を探す
    const nextButtons = await page.$x("//a[contains(text(), '次へ')] | //input[@value='次へ'] | //button[contains(text(), '次へ')]");
    
    if (nextButtons.length > 0) {
      console.log(`✅ 「次へ」ボタン発見: ${nextButtons.length}個`);
      
      for (let i = 0; i < nextButtons.length; i++) {
        const button = nextButtons[i];
        const tagName = await page.evaluate(el => el.tagName, button);
        const text = await page.evaluate(el => el.textContent.trim(), button);
        const href = await page.evaluate(el => el.getAttribute('href'), button);
        const onclick = await page.evaluate(el => el.getAttribute('onclick'), button);
        
        console.log(`  [${i}] ${tagName}: "${text}", href: ${href}, onclick: ${onclick}`);
        
        // 最初の有効そうなボタンをクリックしてみる
        if (i === 0 && (href === 'javascript:void(0);' || onclick)) {
          console.log('  🖱️ クリック実行...');
          
          // クリック前のURL
          const beforeUrl = page.url();
          console.log('  URL (前):', beforeUrl);
          
          try {
            await button.click();
            await page.waitForTimeout(3000); // 3秒待機
            
            // クリック後のURL
            const afterUrl = page.url();
            console.log('  URL (後):', afterUrl);
            
            // 案件数の変化確認
            const newCampaignCount = await page.$$eval('.box_ad', elements => elements.length).catch(() => 0);
            console.log('  案件数変化:', campaignCount, '→', newCampaignCount);
            
            if (newCampaignCount > 0 && newCampaignCount !== campaignCount) {
              console.log('  ✅ ページネーション成功！');
            } else {
              console.log('  ❌ ページネーション失敗またはデータ未変更');
            }
            
          } catch (error) {
            console.log('  ❌ クリックエラー:', error.message);
          }
        }
      }
    } else {
      console.log('❌ 「次へ」ボタンが見つかりません');
    }

    // 5分間待機（手動確認用）
    console.log('\n⏸️ 5分間ブラウザを開いたまま待機（手動確認してください）...');
    await page.waitForTimeout(300000);

  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await browser.close();
  }
}

investigatePagination().catch(console.error);