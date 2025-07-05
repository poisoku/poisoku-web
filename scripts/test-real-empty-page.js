const puppeteer = require('puppeteer');

async function testRealEmptyPage() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
  
  // 元のページを確認
  const url = 'https://www.chobirich.com/shopping/shop/101?page=4';
  console.log(`テスト: ${url}`);
  
  try {
    const response = await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });
    
    console.log('ページが読み込まれました。3秒待機...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // まずページの全体的な状態を確認
    const initialCheck = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        bodyText: document.body.innerText.substring(0, 1000),
        hasRelevantContent: document.body.innerText.includes('総合通販・オークション')
      };
    });
    
    console.log('初期状態:');
    console.log('  URL:', initialCheck.url);
    console.log('  タイトル:', initialCheck.title);
    console.log('  関連コンテンツ存在:', initialCheck.hasRelevantContent);
    
    // 実際のブラウザでスクリーンショットを撮って比較
    await page.screenshot({ path: 'page4-current.png', fullPage: true });
    console.log('スクリーンショットを page4-current.png として保存しました');
    
    // 現在のページの詳細な内容を確認
    const detailedCheck = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      
      // 「現在、掲載している商品が存在しません。」を探す
      const noProductsMessage = '現在、掲載している商品が存在しません。';
      const hasNoProductsMessage = bodyText.includes(noProductsMessage);
      
      // 案件リンクをカウント
      const adDetailsLinks = document.querySelectorAll('a[href*="/ad_details/"]');
      const campaignCount = adDetailsLinks.length;
      
      // ページネーションの状態を確認
      const currentPageNumber = window.location.search.match(/page=(\d+)/);
      const paginationInfo = {
        currentPage: currentPageNumber ? parseInt(currentPageNumber[1]) : 1,
        hasNextPage: !!document.querySelector('a[href*="page=5"]'),
        hasPrevPage: !!document.querySelector('a[href*="page=3"]')
      };
      
      // 可能な空のページ指標を全て確認
      const emptyPageIndicators = [
        bodyText.includes('現在、掲載している商品が存在しません。'),
        bodyText.includes('商品が存在しません'),
        bodyText.includes('該当する商品がありません'),
        bodyText.includes('表示できる商品がありません'),
        bodyText.includes('商品はございません'),
        campaignCount === 0,
        bodyText.trim().length < 500
      ];
      
      return {
        hasNoProductsMessage: hasNoProductsMessage,
        campaignCount: campaignCount,
        paginationInfo: paginationInfo,
        emptyPageIndicators: emptyPageIndicators,
        bodyTextLength: bodyText.length,
        contentSample: bodyText.substring(0, 2000)
      };
    });
    
    console.log('\n詳細チェック結果:');
    console.log('  「現在、掲載している商品が存在しません。」:', detailedCheck.hasNoProductsMessage);
    console.log('  案件リンク数:', detailedCheck.campaignCount);
    console.log('  現在のページ:', detailedCheck.paginationInfo.currentPage);
    console.log('  次ページ存在:', detailedCheck.paginationInfo.hasNextPage);
    console.log('  前ページ存在:', detailedCheck.paginationInfo.hasPrevPage);
    console.log('  空ページ指標:', detailedCheck.emptyPageIndicators);
    console.log('  body文字数:', detailedCheck.bodyTextLength);
    
    console.log('\n--- ページ内容サンプル ---');
    console.log(detailedCheck.contentSample);
    
    // 手動で確認するため、しばらく待機
    console.log('\n手動確認のため10秒待機します...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
  }
  
  await browser.close();
}

testRealEmptyPage().catch(console.error);