const puppeteer = require('puppeteer');

async function debugPage4WithWait() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
  
  const url = 'https://www.chobirich.com/shopping/shop/101?page=4';
  console.log(`完全ロード待機テスト: ${url}`);
  
  const response = await page.goto(url, { 
    waitUntil: 'networkidle2',
    timeout: 15000 
  });
  
  // 少し待機してDOMの完全な読み込みを確認
  await page.waitForTimeout(3000);
  
  const result = await page.evaluate(() => {
    const bodyText = document.body.innerText;
    const htmlContent = document.body.innerHTML;
    
    // より詳細な検索
    const noProductsMessage = '現在、掲載している商品が存在しません。';
    const hasNoProductsMessage = bodyText.includes(noProductsMessage);
    
    // HTMLの中も確認
    const htmlHasMessage = htmlContent.includes(noProductsMessage);
    
    // 空のページを示す他のパターンも確認
    const emptyPatterns = [
      '現在、掲載している商品が存在しません。',
      '商品が存在しません',
      '掲載している商品が存在しません',
      '該当する商品がありません',
      '商品はございません',
      '表示できる商品がありません'
    ];
    
    const emptyPageIndicators = emptyPatterns.map(pattern => ({
      pattern: pattern,
      found: bodyText.includes(pattern)
    }));
    
    // 実際の商品リンクをチェック
    const adDetailsLinks = document.querySelectorAll('a[href*="/ad_details/"]');
    const actualCampaignLinks = [];
    
    adDetailsLinks.forEach(link => {
      const href = link.href;
      const text = link.textContent.trim();
      actualCampaignLinks.push({ href, text });
    });
    
    // 主要な商品エリアを探す
    const possibleProductContainers = [
      document.querySelector('.product-list'),
      document.querySelector('.item-list'),
      document.querySelector('.campaign-list'),
      document.querySelector('.shop-list'),
      document.querySelector('main'),
      document.querySelector('#main'),
      document.querySelector('.main-content')
    ].filter(el => el !== null);
    
    const containerTexts = possibleProductContainers.map(container => 
      container.innerText.substring(0, 300)
    );
    
    return {
      hasNoProductsMessage: hasNoProductsMessage,
      htmlHasMessage: htmlHasMessage,
      emptyPageIndicators: emptyPageIndicators,
      adDetailsCount: adDetailsLinks.length,
      actualCampaignLinks: actualCampaignLinks.slice(0, 5), // 最初の5件のみ
      containerTexts: containerTexts,
      bodyTextLength: bodyText.length,
      // 文字エンコーディングの問題を確認
      encodingTest: bodyText.includes('。') ? 'Japanese chars OK' : 'Encoding issue?',
      // 実際のページ内容のサンプル（より大きく）
      fullBodySample: bodyText.substring(0, 3000)
    };
  });
  
  console.log('='.repeat(60));
  console.log('完全ロード待機テスト結果:');
  console.log('='.repeat(60));
  console.log('ステータス:', response.status());
  console.log('「現在、掲載している商品が存在しません。」(bodyText):', result.hasNoProductsMessage);
  console.log('「現在、掲載している商品が存在しません。」(HTML):', result.htmlHasMessage);
  console.log('ad_detailsリンク数:', result.adDetailsCount);
  console.log('文字エンコーディング:', result.encodingTest);
  console.log('body文字数:', result.bodyTextLength);
  
  console.log('\n--- 空ページ検出パターン ---');
  result.emptyPageIndicators.forEach(indicator => {
    console.log(`"${indicator.pattern}": ${indicator.found ? 'FOUND' : 'NOT FOUND'}`);
  });
  
  console.log('\n--- 実際の案件リンク（最初の5件） ---');
  result.actualCampaignLinks.forEach((link, i) => {
    console.log(`${i+1}. ${link.text} -> ${link.href}`);
  });
  
  console.log('\n--- コンテナ別テキスト ---');
  result.containerTexts.forEach((text, i) => {
    console.log(`コンテナ ${i+1}: ${text}`);
  });
  
  console.log('\n--- 完全ページ内容サンプル ---');
  console.log(result.fullBodySample);
  
  // 3秒待機してページの状態を確認
  console.log('\n--- 3秒待機後のページ状態 ---');
  await page.waitForTimeout(3000);
  
  const finalCheck = await page.evaluate(() => {
    return {
      finalBodyText: document.body.innerText.substring(0, 1000),
      finalLinkCount: document.querySelectorAll('a[href*="/ad_details/"]').length
    };
  });
  
  console.log('最終リンク数:', finalCheck.finalLinkCount);
  console.log('最終ページ内容:', finalCheck.finalBodyText);
  
  await browser.close();
}

debugPage4WithWait().catch(console.error);