const puppeteer = require('puppeteer');

async function comparePages() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
  
  const testPages = [
    'https://www.chobirich.com/shopping/shop/101',
    'https://www.chobirich.com/shopping/shop/101?page=2',
    'https://www.chobirich.com/shopping/shop/101?page=3',
    'https://www.chobirich.com/shopping/shop/101?page=4',
    'https://www.chobirich.com/shopping/shop/101?page=5'
  ];
  
  console.log('='.repeat(60));
  console.log('ページ比較テスト');
  console.log('='.repeat(60));
  
  for (const url of testPages) {
    console.log(`\n🔍 テスト: ${url}`);
    
    try {
      const response = await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 10000 
      });
      
      const result = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        
        // 「現在、掲載している商品が存在しません。」のチェック
        const noProductsMessage = '現在、掲載している商品が存在しません。';
        const hasNoProductsMessage = bodyText.includes(noProductsMessage);
        
        // 案件リンクの数をカウント
        const adDetailsLinks = document.querySelectorAll('a[href*="/ad_details/"]');
        const campaignCount = adDetailsLinks.length;
        
        // ページタイトルを確認
        const title = document.title;
        
        // 特定のエラーメッセージを確認
        const errorIndicators = [
          'ページが見つかりません',
          '404',
          'エラー',
          '現在、掲載している商品が存在しません。',
          '商品が存在しません',
          '該当する商品がありません'
        ];
        
        const foundErrors = errorIndicators.filter(indicator => 
          bodyText.includes(indicator)
        );
        
        // 主要コンテンツの最初の部分を取得
        const contentPreview = bodyText.substring(0, 500);
        
        return {
          status: 'success',
          title: title,
          hasNoProductsMessage: hasNoProductsMessage,
          campaignCount: campaignCount,
          foundErrors: foundErrors,
          contentPreview: contentPreview,
          bodyLength: bodyText.length
        };
      });
      
      console.log(`  ステータス: ${response.status()}`);
      console.log(`  タイトル: ${result.title}`);
      console.log(`  「現在、掲載している商品が存在しません。」: ${result.hasNoProductsMessage}`);
      console.log(`  案件リンク数: ${result.campaignCount}`);
      console.log(`  エラー検出: ${result.foundErrors.length > 0 ? result.foundErrors.join(', ') : 'なし'}`);
      console.log(`  コンテンツ長: ${result.bodyLength}文字`);
      console.log(`  内容プレビュー: ${result.contentPreview.substring(0, 100)}...`);
      
      // 判定
      const hasValidContent = !result.hasNoProductsMessage && result.campaignCount > 0 && result.foundErrors.length === 0;
      console.log(`  📊 判定: ${hasValidContent ? '✅ 有効' : '❌ 無効'}`);
      
    } catch (error) {
      console.log(`  ❌ エラー: ${error.message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  await browser.close();
}

comparePages().catch(console.error);