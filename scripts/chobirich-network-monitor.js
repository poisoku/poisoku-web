const puppeteer = require('puppeteer');

class NetworkMonitor {
  async findDataAPIs() {
    const browser = await puppeteer.launch({
      headless: false, // ブラウザを表示して確認
      devtools: true   // 開発者ツールを開く
    });

    const page = await browser.newPage();
    const requests = [];

    // ネットワークリクエストを監視
    page.on('request', request => {
      const url = request.url();
      const type = request.resourceType();
      
      // APIっぽいリクエストを記録
      if (type === 'xhr' || type === 'fetch' || 
          url.includes('api') || url.includes('json') || 
          url.includes('data')) {
        requests.push({
          url: url,
          method: request.method(),
          headers: request.headers(),
          postData: request.postData()
        });
      }
    });

    // レスポンスも監視
    page.on('response', async response => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';
      
      // JSONレスポンスを探す
      if (contentType.includes('json')) {
        try {
          const json = await response.json();
          console.log('\n=== JSON Response Found ===');
          console.log('URL:', url);
          console.log('Data sample:', JSON.stringify(json).substring(0, 500));
        } catch (e) {}
      }
    });

    console.log('ちょびリッチのネットワークリクエストを監視中...');
    console.log('ブラウザで操作してください（案件をクリックなど）\n');

    // 楽天市場の詳細ページを開く
    await page.goto('https://www.chobirich.com/ad_details/36796/', {
      waitUntil: 'networkidle2'
    });

    // 10秒待機
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log('\n=== 検出されたAPIリクエスト ===');
    requests.forEach((req, i) => {
      console.log(`\n${i + 1}. ${req.method} ${req.url}`);
      if (req.postData) {
        console.log('POST Data:', req.postData);
      }
    });

    // ブラウザは開いたままにする（手動で閉じる）
    console.log('\n調査完了。ブラウザを手動で閉じてください。');
  }
}

// 実行
const monitor = new NetworkMonitor();
monitor.findDataAPIs().catch(console.error);