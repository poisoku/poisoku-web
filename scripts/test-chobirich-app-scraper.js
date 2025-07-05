const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class ChobirichAppScraper {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.results = [];
    
    // iOS/Android両方のユーザーエージェント
    this.userAgents = {
      ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      android: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36'
    };
  }

  async testSingleCampaign(campaignId, os) {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      
      // OSに応じたユーザーエージェントを設定
      await page.setUserAgent(this.userAgents[os]);
      await page.setViewport({
        width: os === 'ios' ? 390 : 412,
        height: os === 'ios' ? 844 : 915
      });

      // リクエストヘッダーを設定
      await page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja-JP,ja;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.chobirich.com/smartphone?sort=point'
      });

      const url = `${this.baseUrl}/ad_details/${campaignId}/`;
      console.log(`\n📱 ${os.toUpperCase()}環境で案件 ${campaignId} にアクセス中...`);
      console.log(`URL: ${url}`);

      // ページにアクセス（タイムアウトを30秒に設定）
      const response = await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      const status = response.status();
      console.log(`ステータス: ${status}`);

      if (status === 403) {
        console.log('❌ 403 Forbidden - アクセス拒否されました');
        return null;
      }

      if (status !== 200) {
        console.log(`❌ 予期しないステータスコード: ${status}`);
        return null;
      }

      // ページ内容を確認
      await new Promise(resolve => setTimeout(resolve, 2000));

      // データ取得
      const data = await page.evaluate(() => {
        // 案件タイトル
        let title = '';
        const titleSelectors = [
          'h1.AdDetails__title',
          'h1',
          '.campaign-title',
          '[class*="title"]'
        ];
        
        for (const selector of titleSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim()) {
            title = element.textContent.trim();
            if (!title.includes('ちょびリッチ')) break;
          }
        }

        // 還元率
        let cashback = '';
        const cashbackSelectors = [
          '.AdDetails__pt.ItemPtLarge',
          '.campaign-point',
          '[class*="point"]',
          '[class*="cashback"]'
        ];

        for (const selector of cashbackSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            const text = element.textContent.trim();
            const match = text.match(/(\d+(?:,\d+)?(?:ちょび)?pt|\d+(?:\.\d+)?[%％])/);
            if (match) {
              cashback = match[1];
              break;
            }
          }
        }

        // 獲得方法
        let method = '';
        const methodElement = document.querySelector('.AdDetails__conditionItem');
        if (methodElement) {
          const methodText = methodElement.textContent;
          const methodMatch = methodText.match(/獲得方法[：:]\s*(.+?)(?:\s|$)/);
          if (methodMatch) {
            method = methodMatch[1].trim();
          }
        }

        return {
          title,
          cashback,
          method,
          htmlLength: document.documentElement.innerHTML.length
        };
      });

      console.log('取得データ:', data);

      // OS判定
      let detectedOs = 'unknown';
      if (data.title) {
        if (data.title.includes('iOS') || data.title.includes('iPhone')) {
          detectedOs = 'ios';
        } else if (data.title.includes('Android') || data.title.includes('アンドロイド')) {
          detectedOs = 'android';
        }
      }

      const result = {
        id: campaignId,
        name: data.title || 'タイトル取得失敗',
        url: url,
        cashback: data.cashback || '不明',
        os: detectedOs,
        testedOs: os,
        method: data.method || '不明',
        success: !!data.title,
        timestamp: new Date().toISOString()
      };

      console.log('✅ 取得成功:', result);
      return result;

    } catch (error) {
      console.error(`❌ エラー: ${error.message}`);
      return null;
    } finally {
      await browser.close();
    }
  }

  async runTest() {
    console.log('🧪 ちょびリッチアプリ案件データ取得テスト開始\n');
    
    // テスト用の案件ID（既存データから選択）
    const testIds = ['1794491', '1804736', '1837931'];
    
    for (const id of testIds) {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`テスト案件ID: ${id}`);
      console.log('='.repeat(50));
      
      // iOS環境でテスト
      const iosResult = await this.testSingleCampaign(id, 'ios');
      if (iosResult) this.results.push(iosResult);
      
      // 5秒待機
      console.log('\n⏱️ 5秒待機中...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Android環境でテスト
      const androidResult = await this.testSingleCampaign(id, 'android');
      if (androidResult) this.results.push(androidResult);
      
      // 10秒待機
      console.log('\n⏱️ 10秒待機中...');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    // 結果を保存
    const output = {
      test_date: new Date().toISOString(),
      total_tests: this.results.length,
      successful_tests: this.results.filter(r => r.success).length,
      results: this.results
    };

    await fs.writeFile(
      'test_chobirich_app_results.json',
      JSON.stringify(output, null, 2)
    );

    console.log('\n📊 テスト結果サマリー:');
    console.log(`総テスト数: ${output.total_tests}`);
    console.log(`成功: ${output.successful_tests}`);
    console.log('結果をtest_chobirich_app_results.jsonに保存しました');
  }
}

// 実行
(async () => {
  const scraper = new ChobirichAppScraper();
  try {
    await scraper.runTest();
  } catch (error) {
    console.error('致命的エラー:', error);
  }
})();