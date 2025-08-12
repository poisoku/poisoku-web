#!/usr/bin/env node

const puppeteer = require('puppeteer');

/**
 * 「次の10件を表示」ボタンのクリックテスト
 */
async function testMoreButtonClick() {
  console.log('🔍 「次の10件を表示」ボタンクリックテスト');
  console.log('='.repeat(70));
  
  const browser = await puppeteer.launch({
    headless: false,  // デバッグのため表示モードで実行
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
    
    let totalCampaigns = campaignCount;
    let clickCount = 0;
    const maxClicks = 10;  // 最大10回クリック
    
    while (clickCount < maxClicks) {
      console.log(`🖱️ クリック試行 ${clickCount + 1}:`);
      
      // ページ最下部までスクロール
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 「次の10件を表示」ボタンを探してクリック
      const buttonClicked = await page.evaluate(() => {
        // テキストで検索
        const allElements = [...document.querySelectorAll('a, button, div, span, input')];
        
        for (const el of allElements) {
          const text = (el.textContent || el.value || '').trim();
          if (text === '次の10件を表示' || text.includes('次の10件')) {
            console.log('ボタン発見:', el.tagName, el.className);
            
            // クリック可能かチェック
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              // クリック実行
              try {
                el.click();
                return true;
              } catch (e) {
                console.error('クリックエラー:', e);
              }
            }
          }
        }
        
        return false;
      });
      
      if (!buttonClicked) {
        console.log('  ❌ ボタンが見つからない、またはクリックできませんでした');
        
        // 代替方法: href属性を持つリンクを探す
        const linkClicked = await page.evaluate(() => {
          const links = document.querySelectorAll('a');
          for (const link of links) {
            if (link.textContent && link.textContent.includes('次の10件')) {
              const href = link.getAttribute('href');
              if (href) {
                console.log('リンク発見:', href);
                window.location.href = href;
                return true;
              }
            }
          }
          return false;
        });
        
        if (linkClicked) {
          console.log('  ✅ リンクで遷移しました');
          await page.waitForNavigation({ waitUntil: 'networkidle2' });
        } else {
          // JavaScript関数を直接呼び出す
          const jsCallResult = await page.evaluate(() => {
            // グローバル関数を探す
            if (typeof window.loadMore === 'function') {
              window.loadMore();
              return 'loadMore';
            }
            if (typeof window.showMore === 'function') {
              window.showMore();
              return 'showMore';
            }
            if (typeof window.nextPage === 'function') {
              window.nextPage();
              return 'nextPage';
            }
            
            // onclick属性を探す
            const elements = document.querySelectorAll('[onclick]');
            for (const el of elements) {
              const onclick = el.getAttribute('onclick');
              if (onclick && (onclick.includes('more') || onclick.includes('next'))) {
                console.log('onclick発見:', onclick);
                eval(onclick);
                return 'onclick';
              }
            }
            
            return null;
          });
          
          if (jsCallResult) {
            console.log(`  ✅ JavaScript関数実行: ${jsCallResult}`);
          } else {
            console.log('  ❌ クリック方法が見つかりませんでした');
            break;
          }
        }
      } else {
        console.log('  ✅ ボタンをクリックしました');
      }
      
      // 読み込み待機
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // 新しい案件数を確認
      const newCount = await page.evaluate(() => document.querySelectorAll('.box01').length);
      console.log(`  案件数: ${campaignCount}件 → ${newCount}件`);
      
      if (newCount > campaignCount) {
        console.log(`  ✅ ${newCount - campaignCount}件の新規案件を読み込みました`);
        campaignCount = newCount;
      } else {
        console.log('  ⚠️ 案件数が変わりませんでした');
        
        // ページが遷移した可能性をチェック
        const currentUrl = page.url();
        if (currentUrl !== url) {
          console.log(`  📍 URL変更: ${currentUrl}`);
        }
        
        break;
      }
      
      clickCount++;
    }
    
    console.log(`\n📊 最終結果:`);
    console.log(`  クリック回数: ${clickCount}回`);
    console.log(`  総案件数: ${campaignCount}件`);
    console.log(`  増加案件数: ${campaignCount - totalCampaigns}件`);
    
    // 10秒待機（画面確認用）
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
testMoreButtonClick().catch(console.error);