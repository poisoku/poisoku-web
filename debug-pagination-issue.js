#!/usr/bin/env node

/**
 * ページネーション問題のデバッグ
 */

const puppeteer = require('puppeteer');

async function debugPaginationIssue() {
  console.log('🔍 ページネーション問題のデバッグ');
  console.log('='.repeat(60));
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // 問題があったカテゴリをテスト（2ページ目があるはずなのに取得できていない）
    const problematicCategories = [
      { id: 161, name: 'カテゴリ161（24件、2ページ目あり）' },
      { id: 179, name: 'カテゴリ179（26件、2ページ目あり）' },
      { id: 247, name: 'カテゴリ247（26件、2ページ目あり）' }
    ];
    
    for (const category of problematicCategories) {
      console.log(`\n📂 ${category.name} のページネーション詳細調査`);
      console.log(`URL: https://pointi.jp/list.php?category=${category.id}`);
      
      await page.goto(`https://pointi.jp/list.php?category=${category.id}`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 1ページ目の情報を取得
      const page1Info = await page.evaluate(() => {
        const campaigns = document.querySelectorAll('.box_ad');
        const pageLinks = Array.from(document.querySelectorAll('a[onclick*="tab_select"]'));
        
        return {
          campaignCount: campaigns.length,
          campaignTitles: Array.from(campaigns).slice(0, 3).map(el => {
            const title = el.querySelector('.title_list');
            return title ? title.textContent.trim() : '';
          }),
          pageLinks: pageLinks.map(link => ({
            text: link.textContent.trim(),
            onclick: link.getAttribute('onclick'),
            href: link.getAttribute('href')
          }))
        };
      });
      
      console.log(`📄 1ページ目: ${page1Info.campaignCount}件`);
      console.log(`   最初の3件: ${page1Info.campaignTitles.join(', ')}`);
      console.log(`📊 ページネーションリンク: ${page1Info.pageLinks.length}個`);
      
      if (page1Info.pageLinks.length > 0) {
        console.log('   ページリンク詳細:');
        page1Info.pageLinks.forEach((link, i) => {
          console.log(`      ${i+1}. "${link.text}" - onclick: ${link.onclick}`);
        });
        
        // 「次へ>」ボタンを探す
        const nextButton = page1Info.pageLinks.find(link => 
          link.text.includes('次へ') || link.text === '次へ>'
        );
        
        if (nextButton) {
          console.log(`\n🔍 「次へ」ボタンが存在: "${nextButton.text}"`);
          console.log(`   onclick: ${nextButton.onclick}`);
          
          // ページ遷移のパラメータを解析
          const pageMatch = nextButton.onclick.match(/tab_select\('([^']+)',\s*(\d+),\s*(\d+),\s*(\d+)\)/);
          if (pageMatch) {
            console.log(`   tab_select パラメータ: ('${pageMatch[1]}', ${pageMatch[2]}, ${pageMatch[3]}, ${pageMatch[4]})`);
            
            // 実際にページネーションを試行
            console.log('\n🖱️ 実際にページネーションを実行...');
            
            const beforeCount = page1Info.campaignCount;
            const beforeTitle = page1Info.campaignTitles[0];
            
            console.log(`   クリック前: ${beforeCount}件 (最初: "${beforeTitle}")`);
            
            // tab_select関数を実行
            const clickResult = await page.evaluate((tab, param2, param3, param4) => {
              if (typeof window.tab_select === 'function') {
                console.log(`tab_select実行: ('${tab}', ${param2}, ${param3}, ${param4})`);
                window.tab_select(tab, param2, param3, param4);
                return true;
              }
              return false;
            }, pageMatch[1], parseInt(pageMatch[2]), parseInt(pageMatch[3]), parseInt(pageMatch[4]));
            
            if (clickResult) {
              console.log('   ✅ tab_select関数実行成功');
              
              // 内容変化を待機
              await new Promise(resolve => setTimeout(resolve, 8000));
              
              const page2Info = await page.evaluate(() => {
                const campaigns = document.querySelectorAll('.box_ad');
                return {
                  campaignCount: campaigns.length,
                  campaignTitles: Array.from(campaigns).slice(0, 3).map(el => {
                    const title = el.querySelector('.title_list');
                    return title ? title.textContent.trim() : '';
                  })
                };
              });
              
              console.log(`   クリック後: ${page2Info.campaignCount}件`);
              if (page2Info.campaignTitles.length > 0) {
                console.log(`   最初の3件: ${page2Info.campaignTitles.join(', ')}`);
              }
              
              if (page2Info.campaignCount > 0 && page2Info.campaignTitles[0] !== beforeTitle) {
                console.log('   ✅ ページネーション成功！内容が変更されました');
              } else {
                console.log('   ❌ ページネーション失敗：内容が変化しませんでした');
                
                // DOM要素の状態を詳細確認
                const domStatus = await page.evaluate(() => {
                  return {
                    hasBoxAd: !!document.querySelector('.box_ad'),
                    boxAdCount: document.querySelectorAll('.box_ad').length,
                    bodyHtml: document.body.innerHTML.length,
                    readyState: document.readyState
                  };
                });
                console.log('   DOM状態:', domStatus);
              }
            } else {
              console.log('   ❌ tab_select関数が見つからないか実行に失敗');
            }
            
          } else {
            console.log('   ❌ onclick属性のパラメータ解析に失敗');
          }
          
        } else {
          console.log('   ❌ 「次へ」ボタンが見つかりません');
        }
        
      } else {
        console.log('   ❌ ページネーションリンクが存在しません');
      }
      
      console.log('\n' + '─'.repeat(60));
    }
    
  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await browser.close();
  }
}

debugPaginationIssue();