#!/usr/bin/env node

const puppeteer = require('puppeteer');

/**
 * 正確なセレクタで「次の10件を表示」ボタンをクリックするテスト
 */
async function testCorrectButtonClick() {
  console.log('🔍 正確なセレクタでボタンクリックテスト');
  console.log('='.repeat(70));
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 390, height: 844 }
  });
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15');
    
    const url = 'https://sp.pointi.jp/pts_app.php?cat_no=285&sort=&sub=4';
    console.log(`📱 URL: ${url}\n`);
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 初期案件数
    let campaignCount = await page.evaluate(() => document.querySelectorAll('.box01').length);
    console.log(`📊 初期案件数: ${campaignCount}件\n`);
    
    // デベロッパーツールで確認されたセレクタを試す
    const possibleSelectors = [
      '#load_sites_cnr_round',
      'div#load_sites_cnr_round',
      '.load_sites_cnr_round',
      '[id*="load_sites"]',
      '[class*="load_sites"]',
      'div[style*="#1994d4"]',  // 背景色で検索
      'div[style*="background-color: #1994d4"]',
      'div[style*="text-align: center"]'
    ];
    
    let totalClicks = 0;
    const maxClicks = 10;
    
    while (totalClicks < maxClicks) {
      console.log(`🖱️ クリック試行 ${totalClicks + 1}:`);
      
      // ページ最下部までスクロール
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      let buttonClicked = false;
      
      // 各セレクタでボタンを探してクリック
      for (const selector of possibleSelectors) {
        console.log(`  試行セレクタ: ${selector}`);
        
        const result = await page.evaluate((sel) => {
          try {
            const element = document.querySelector(sel);
            if (element) {
              const rect = element.getBoundingClientRect();
              const text = element.textContent ? element.textContent.trim() : '';
              
              return {
                found: true,
                text: text.substring(0, 50),
                visible: rect.width > 0 && rect.height > 0,
                rect: {
                  top: rect.top,
                  left: rect.left,
                  width: rect.width,
                  height: rect.height
                },
                tagName: element.tagName,
                className: element.className,
                id: element.id
              };
            }
            return { found: false };
          } catch (e) {
            return { found: false, error: e.message };
          }
        }, selector);
        
        if (result.found) {
          console.log(`    ✅ 要素発見: ${result.tagName}#${result.id}.${result.className}`);
          console.log(`    テキスト: "${result.text}"`);
          console.log(`    表示: ${result.visible} (${result.rect.width}x${result.rect.height})`);
          
          if (result.text.includes('次の10件') || result.text.includes('表示')) {
            // クリック実行
            const clicked = await page.evaluate((sel) => {
              const element = document.querySelector(sel);
              if (element) {
                element.click();
                return true;
              }
              return false;
            }, selector);
            
            if (clicked) {
              console.log(`    ✅ クリック成功: ${selector}`);
              buttonClicked = true;
              break;
            }
          }
        }
      }
      
      if (!buttonClicked) {
        // より汎用的な検索
        console.log('  🔍 汎用検索を実行中...');
        
        const genericResult = await page.evaluate(() => {
          // すべての要素を検索
          const allElements = document.querySelectorAll('*');
          
          for (const el of allElements) {
            const text = (el.textContent || '').trim();
            if (text === '次の10件を表示') {
              const computedStyle = window.getComputedStyle(el);
              return {
                found: true,
                tagName: el.tagName,
                className: el.className,
                id: el.id,
                backgroundColor: computedStyle.backgroundColor,
                display: computedStyle.display,
                visibility: computedStyle.visibility,
                outerHTML: el.outerHTML.substring(0, 200)
              };
            }
          }
          return { found: false };
        });
        
        if (genericResult.found) {
          console.log('  ✅ 汎用検索で発見:');
          console.log(`    タグ: ${genericResult.tagName}`);
          console.log(`    ID: ${genericResult.id}`);
          console.log(`    クラス: ${genericResult.className}`);
          console.log(`    背景色: ${genericResult.backgroundColor}`);
          console.log(`    HTML: ${genericResult.outerHTML}...`);
          
          // 発見した要素をクリック
          const clicked = await page.evaluate((id, className) => {
            let element = null;
            if (id) {
              element = document.getElementById(id);
            } else if (className) {
              element = document.querySelector(`.${className.split(' ')[0]}`);
            }
            
            if (element && element.textContent.includes('次の10件を表示')) {
              element.click();
              return true;
            }
            return false;
          }, genericResult.id, genericResult.className);
          
          if (clicked) {
            console.log('    ✅ 汎用クリック成功');
            buttonClicked = true;
          }
        }
      }
      
      if (!buttonClicked) {
        console.log('  ❌ ボタンが見つからない、またはクリックできませんでした');
        break;
      }
      
      // 読み込み待機
      console.log('  ⏳ 読み込み待機中...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // 案件数の変化を確認
      const newCount = await page.evaluate(() => document.querySelectorAll('.box01').length);
      console.log(`  📊 案件数: ${campaignCount}件 → ${newCount}件`);
      
      if (newCount > campaignCount) {
        const addedCount = newCount - campaignCount;
        console.log(`  ✅ ${addedCount}件の新規案件を読み込みました\n`);
        campaignCount = newCount;
        totalClicks++;
      } else {
        console.log('  ⚠️ 案件数が変わりませんでした - 終了\n');
        break;
      }
    }
    
    console.log(`📊 最終結果:`);
    console.log(`  成功クリック数: ${totalClicks}回`);
    console.log(`  総案件数: ${campaignCount}件`);
    
    // ブラウザを開いたまま10秒待機（確認用）
    console.log('\n⏸️ 10秒後に終了します...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
  } finally {
    await browser.close();
    console.log('\n✅ テスト完了');
  }
}

// 実行
testCorrectButtonClick().catch(console.error);