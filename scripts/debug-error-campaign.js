const puppeteer = require('puppeteer');

async function debugErrorCampaign() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    console.log('エラー案件（ID: 1021914）を調査...\n');
    const url = 'https://www.chobirich.com/ad_details/1021914/';
    
    console.log(`アクセス先: ${url}`);
    
    // タイムアウト時間を60秒に延長してテスト
    const startTime = Date.now();
    
    try {
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 60000 // 60秒
      });
      
      const endTime = Date.now();
      const loadTime = (endTime - startTime) / 1000;
      console.log(`✅ ページ読み込み成功 (${loadTime.toFixed(1)}秒)`);
      
      // ページ情報を取得
      const pageInfo = await page.evaluate(() => {
        return {
          title: document.title,
          url: window.location.href,
          isError: document.body.textContent.includes('404') || 
                   document.body.textContent.includes('エラー') ||
                   document.body.textContent.includes('見つかりません'),
          hasAdDetails: !!document.querySelector('.AdDetails'),
          campaignName: document.querySelector('h1.AdDetails__title')?.textContent?.trim() || '取得できず'
        };
      });
      
      console.log('\n=== ページ情報 ===');
      console.log('タイトル:', pageInfo.title);
      console.log('URL:', pageInfo.url);
      console.log('エラーページ:', pageInfo.isError);
      console.log('AdDetailsエリア存在:', pageInfo.hasAdDetails);
      console.log('案件名:', pageInfo.campaignName);
      
      // 還元率を取得してみる
      const cashback = await page.evaluate(() => {
        const mainPtElement = document.querySelector('.AdDetails__pt.ItemPtLarge');
        if (mainPtElement) {
          return mainPtElement.textContent.trim();
        }
        return '見つからず';
      });
      
      console.log('還元率:', cashback);
      
    } catch (error) {
      const endTime = Date.now();
      const loadTime = (endTime - startTime) / 1000;
      
      console.log(`❌ エラー発生 (${loadTime.toFixed(1)}秒後)`);
      console.log('エラー内容:', error.message);
      
      // ネットワークエラーかタイムアウトかを判定
      if (error.message.includes('timeout')) {
        console.log('原因: ページの読み込みが非常に遅い（60秒でもタイムアウト）');
      } else if (error.message.includes('net::')) {
        console.log('原因: ネットワークエラー（サーバー側の問題）');
      } else {
        console.log('原因: その他の問題');
      }
    }
    
    // 別の方法でページの存在確認
    console.log('\n=== 代替確認方法 ===');
    try {
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded', // より軽い待機条件
        timeout: 30000
      });
      
      console.log('HTTPステータス:', response.status());
      console.log('ページ存在:', response.status() < 400);
      
    } catch (altError) {
      console.log('代替方法でもエラー:', altError.message);
    }

  } finally {
    await browser.close();
  }
}

debugErrorCampaign().catch(console.error);