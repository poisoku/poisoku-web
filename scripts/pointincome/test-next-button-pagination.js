const puppeteer = require('puppeteer');

async function testNextButtonPagination() {
  console.log('🧪 「次へ>」ボタンのページネーションテスト\n');
  
  const browser = await puppeteer.launch({
    headless: false, // デバッグ用にブラウザ表示
    args: ['--no-sandbox'],
    defaultViewport: { width: 1920, height: 1080 }
  });
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // ファッションカテゴリでテスト（8+ページある）
    const testUrl = 'https://pointi.jp/list.php?group=152';
    await page.goto(testUrl, { waitUntil: 'networkidle2' });
    
    let pageNum = 1;
    let hasNextPage = true;
    const maxPages = 5; // テスト用に5ページまで
    
    while (hasNextPage && pageNum <= maxPages) {
      console.log(`📄 ページ ${pageNum} を処理中...`);
      
      // 案件数確認
      const campaignCount = await page.$$eval('.box_ad_inner a[href*="/ad/"]', links => links.length);
      console.log(`  ✅ ${campaignCount}件の案件を発見`);
      
      // ページネーション情報を取得
      const paginationInfo = await page.evaluate(() => {
        const pagerLinks = document.querySelectorAll('.pager a');
        const pageNumbers = [];
        let nextButton = null;
        
        for (let link of pagerLinks) {
          const text = link.textContent.trim();
          console.log(`Link text: "${text}", href: ${link.href}`);
          
          if (text.match(/^\d+$/)) {
            pageNumbers.push(text);
          } else if (text.includes('次へ') || text === '>' || text.toLowerCase().includes('next')) {
            nextButton = {
              text: text,
              href: link.href,
              onclick: link.onclick ? 'has onclick' : 'no onclick'
            };
          }
        }
        
        // 最後のリンクをチェック
        if (!nextButton && pagerLinks.length > 0) {
          const lastLink = pagerLinks[pagerLinks.length - 1];
          const lastText = lastLink.textContent.trim();
          if (!lastText.match(/^\d+$/) && !lastText.includes('前へ') && !lastText.includes('<')) {
            nextButton = {
              text: lastText,
              href: lastLink.href,
              onclick: lastLink.onclick ? 'has onclick' : 'no onclick'
            };
          }
        }
        
        return {
          pageNumbers,
          nextButton,
          totalPagerLinks: pagerLinks.length
        };
      });
      
      console.log(`  📖 利用可能ページ: [${paginationInfo.pageNumbers.join(', ')}]`);
      console.log(`  📖 次ボタン: ${paginationInfo.nextButton ? JSON.stringify(paginationInfo.nextButton) : 'なし'}`);
      
      if (paginationInfo.nextButton && pageNum < maxPages) {
        console.log(`  🔄 「${paginationInfo.nextButton.text}」ボタンをクリック中...`);
        
        try {
          // 次ページボタンをクリック
          await page.evaluate(() => {
            const pagerLinks = document.querySelectorAll('.pager a');
            let nextButton = null;
            
            for (let link of pagerLinks) {
              const text = link.textContent.trim();
              if (text.includes('次へ') || text === '>' || text.toLowerCase().includes('next')) {
                nextButton = link;
                break;
              }
            }
            
            if (!nextButton && pagerLinks.length > 0) {
              const lastLink = pagerLinks[pagerLinks.length - 1];
              const lastText = lastLink.textContent.trim();
              if (!lastText.match(/^\d+$/) && !lastText.includes('前へ') && !lastText.includes('<')) {
                nextButton = lastLink;
              }
            }
            
            if (nextButton) {
              nextButton.click();
            }
          });
          
          // ページ遷移を待機
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
          pageNum++;
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          console.log(`  ❌ 次ページクリック失敗: ${error.message}`);
          hasNextPage = false;
        }
      } else {
        console.log(`  📝 次ページなし、またはテスト上限に到達`);
        hasNextPage = false;
      }
    }
    
    console.log(`\n✅ テスト完了: ${pageNum - 1}ページを処理`);
    
  } catch (error) {
    console.error('❌ テストエラー:', error);
  } finally {
    await browser.close();
  }
}

testNextButtonPagination();