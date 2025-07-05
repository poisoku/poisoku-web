const puppeteer = require('puppeteer');

async function debugPage4Detailed() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
  
  const url = 'https://www.chobirich.com/shopping/shop/101?page=4';
  console.log(`詳細テスト対象: ${url}`);
  
  const response = await page.goto(url, { 
    waitUntil: 'domcontentloaded',
    timeout: 15000 
  });
  
  const result = await page.evaluate(() => {
    const bodyText = document.body.innerText;
    
    // より詳細な検索
    const noProductsMessage = '現在、掲載している商品が存在しません。';
    const hasNoProductsMessage = bodyText.includes(noProductsMessage);
    
    // 実際の商品リンクをチェック（ad_details以外のものも確認）
    const adDetailsLinks = document.querySelectorAll('a[href*="/ad_details/"]');
    const shopLinks = document.querySelectorAll('a[href*="/shopping/"]');
    
    // メインコンテンツエリアを探す
    const mainContent = document.querySelector('main') || document.querySelector('.main') || document.querySelector('#main');
    let mainContentText = '';
    if (mainContent) {
      mainContentText = mainContent.innerText;
    }
    
    // 商品一覧エリアを探す
    const productArea = document.querySelector('.product-list') || document.querySelector('.item-list') || document.querySelector('.campaign-list');
    let productAreaText = '';
    if (productArea) {
      productAreaText = productArea.innerText;
    }
    
    // ページネーションを確認
    const paginationLinks = document.querySelectorAll('a[href*="page="]');
    const nextPageLink = document.querySelector('a[href*="page=5"]');
    
    return {
      hasNoProductsMessage: hasNoProductsMessage,
      adDetailsCount: adDetailsLinks.length,
      shopLinksCount: shopLinks.length,
      mainContentText: mainContentText.substring(0, 500),
      productAreaText: productAreaText.substring(0, 500),
      paginationLinksCount: paginationLinks.length,
      hasNextPage: !!nextPageLink,
      bodyTextSearch: bodyText.includes(noProductsMessage) ? 'FOUND' : 'NOT FOUND',
      // 部分検索も試す
      partialSearch1: bodyText.includes('現在、掲載している') ? 'FOUND' : 'NOT FOUND',
      partialSearch2: bodyText.includes('商品が存在しません') ? 'FOUND' : 'NOT FOUND',
      partialSearch3: bodyText.includes('掲載している商品が存在') ? 'FOUND' : 'NOT FOUND',
      bodyTextLength: bodyText.length,
      // 実際の商品案件かどうかを判断するために、具体的なポイント情報があるかチェック
      hasPercentage: bodyText.includes('%'),
      hasPointInfo: bodyText.includes('ポイント') || bodyText.includes('還元'),
      fullBodyPreview: bodyText.substring(0, 2000)
    };
  });
  
  console.log('='.repeat(60));
  console.log('詳細デバッグ結果:');
  console.log('='.repeat(60));
  console.log('ステータス:', response.status());
  console.log('「現在、掲載している商品が存在しません。」:', result.hasNoProductsMessage);
  console.log('ad_detailsリンク数:', result.adDetailsCount);
  console.log('shoppingリンク数:', result.shopLinksCount);
  console.log('次ページリンク存在:', result.hasNextPage);
  console.log('ページネーションリンク数:', result.paginationLinksCount);
  console.log('完全一致検索:', result.bodyTextSearch);
  console.log('部分検索1 (現在、掲載している):', result.partialSearch1);
  console.log('部分検索2 (商品が存在しません):', result.partialSearch2);
  console.log('部分検索3 (掲載している商品が存在):', result.partialSearch3);
  console.log('パーセンテージ情報:', result.hasPercentage);
  console.log('ポイント情報:', result.hasPointInfo);
  console.log('body文字数:', result.bodyTextLength);
  
  console.log('\n--- メインコンテンツ ---');
  console.log(result.mainContentText);
  
  console.log('\n--- 商品エリア ---');
  console.log(result.productAreaText);
  
  console.log('\n--- 全体プレビュー ---');
  console.log(result.fullBodyPreview);
  
  await browser.close();
}

debugPage4Detailed().catch(console.error);