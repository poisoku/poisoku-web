const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class ChobirichOSSeparateScraper {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.iosResults = [];
    this.androidResults = [];
    
    // iOS/Android両方のユーザーエージェント
    this.userAgents = {
      ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      android: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36'
    };
  }

  async scrapeCampaign(campaignId, os) {
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
      console.log(`📱 ${os.toUpperCase()}環境で案件 ${campaignId} にアクセス中...`);

      // ページにアクセス
      const response = await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      const status = response.status();

      if (status === 403) {
        console.log('❌ 403 Forbidden');
        return null;
      }

      if (status !== 200) {
        console.log(`❌ ステータスコード: ${status}`);
        return null;
      }

      // ページ内容を確認
      await new Promise(resolve => setTimeout(resolve, 2000));

      // データ取得
      const data = await page.evaluate(() => {
        // 案件タイトル
        let title = '';
        const h1Element = document.querySelector('h1.AdDetails__title');
        if (h1Element) {
          title = h1Element.textContent.trim();
        } else {
          const h1Elements = document.querySelectorAll('h1');
          for (const h1 of h1Elements) {
            const text = h1.textContent.trim();
            if (text && !text.includes('ちょびリッチ')) {
              title = text;
              break;
            }
          }
        }

        // 還元率
        let cashback = '';
        const pointElement = document.querySelector('.AdDetails__pt.ItemPtLarge');
        if (pointElement) {
          const text = pointElement.textContent.trim();
          const match = text.match(/(\d{1,3}(?:,\d{3})*(?:ポイント|pt)?)/);
          if (match) {
            cashback = match[0];
          }
        }

        // 獲得方法（詳細ページから取得）
        let method = '';
        const bodyText = document.body.innerText;
        
        // よくあるパターンをチェック
        const patterns = [
          /インストール[^\n]{0,50}/,
          /初回[^\n]{0,50}/,
          /条件[：:]\s*([^\n]+)/,
          /獲得方法[：:]\s*([^\n]+)/
        ];
        
        for (const pattern of patterns) {
          const match = bodyText.match(pattern);
          if (match) {
            method = match[1] || match[0];
            method = method.trim().substring(0, 100); // 最大100文字
            break;
          }
        }

        return {
          title: title || '',
          cashback: cashback || '',
          method: method || '',
          pageValid: !!title // タイトルがあれば有効なページ
        };
      });

      if (!data.pageValid) {
        console.log('❌ 無効なページ（タイトルなし）');
        return null;
      }

      const result = {
        id: campaignId,
        name: data.title,
        url: url,
        cashback: data.cashback || '不明',
        os: os, // 取得したOS環境をそのまま使用
        method: data.method || '不明',
        timestamp: new Date().toISOString()
      };

      console.log(`✅ 取得成功: ${data.title} (${data.cashback})`);
      return result;

    } catch (error) {
      console.error(`❌ エラー: ${error.message}`);
      return null;
    } finally {
      await browser.close();
    }
  }

  async runTest() {
    console.log('🚀 iOS/Android別々にアプリ案件データを取得\n');
    
    // テスト用の案件ID
    const testIds = ['1794491', '1804736', '1837931', '1842976', '1850436'];
    
    // iOS環境でのテスト
    console.log('=== iOS環境でのスクレイピング ===\n');
    for (const id of testIds) {
      const result = await this.scrapeCampaign(id, 'ios');
      if (result) {
        this.iosResults.push(result);
      }
      
      // 5秒待機
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Android環境でのテスト（エラーが多いので試行のみ）
    console.log('\n=== Android環境でのスクレイピング ===\n');
    for (const id of testIds.slice(0, 2)) { // 最初の2件のみテスト
      const result = await this.scrapeCampaign(id, 'android');
      if (result) {
        this.androidResults.push(result);
      }
      
      // 5秒待機
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // 結果を保存
    const output = {
      test_date: new Date().toISOString(),
      summary: {
        ios_total: this.iosResults.length,
        android_total: this.androidResults.length,
        total: this.iosResults.length + this.androidResults.length
      },
      ios_campaigns: this.iosResults,
      android_campaigns: this.androidResults
    };

    await fs.writeFile(
      'test_chobirich_os_separate_results.json',
      JSON.stringify(output, null, 2)
    );

    console.log('\n📊 最終結果:');
    console.log(`iOS案件取得数: ${this.iosResults.length}`);
    console.log(`Android案件取得数: ${this.androidResults.length}`);
    console.log('結果をtest_chobirich_os_separate_results.jsonに保存しました');

    // サンプル表示
    if (this.iosResults.length > 0) {
      console.log('\niOS案件サンプル:');
      this.iosResults.slice(0, 3).forEach(item => {
        console.log(`- ${item.name} (${item.cashback}) - OS: ${item.os}`);
      });
    }
  }
}

// 実行
(async () => {
  const scraper = new ChobirichOSSeparateScraper();
  try {
    await scraper.runTest();
  } catch (error) {
    console.error('致命的エラー:', error);
  }
})();