const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class ChobirichIOSUABulkScraper {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.results = [];
    this.errors = [];
    
    // iOS ユーザーエージェント
    this.iosUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
  }

  async sleep(seconds) {
    console.log(`⏳ ${seconds}秒待機中...`);
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }

  async scrapeCampaign(campaignId) {
    console.log(`\n📱 案件 ${campaignId} を取得中...`);
    
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      
      // iOS ユーザーエージェントを使用
      await page.setUserAgent(this.iosUserAgent);
      await page.setViewport({
        width: 390,
        height: 844
      });

      // リクエストヘッダーを設定
      await page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja-JP,ja;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.chobirich.com/smartphone?sort=point'
      });

      const url = `${this.baseUrl}/ad_details/${campaignId}/`;
      
      // ページにアクセス
      const response = await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      const status = response.status();

      if (status === 403) {
        console.log('❌ 403 Forbidden');
        this.errors.push({ id: campaignId, error: '403 Forbidden' });
        return null;
      }

      if (status !== 200) {
        console.log(`❌ ステータスコード: ${status}`);
        this.errors.push({ id: campaignId, error: `Status ${status}` });
        return null;
      }

      // ページロード後に待機
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
            if (text && !text.includes('ちょびリッチ') && text !== 'エラー') {
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

        // 獲得方法
        let method = '';
        const bodyText = document.body.innerText;
        const patterns = [
          /インストール[^\n。]{0,50}/,
          /初回[^\n。]{0,50}/,
          /条件[：:]\s*([^\n]+)/,
          /獲得方法[：:]\s*([^\n]+)/,
          /利用[^\n。]{0,30}/
        ];
        
        for (const pattern of patterns) {
          const match = bodyText.match(pattern);
          if (match) {
            method = match[1] || match[0];
            method = method.trim().substring(0, 80);
            break;
          }
        }

        // OS判定
        let detectedOs = 'unknown';
        const titleLower = title.toLowerCase();
        const bodyTextLower = bodyText.toLowerCase();
        
        // Android判定
        const androidKeywords = ['android', 'アンドロイド', 'google play', 'playストア'];
        const iosKeywords = ['ios', 'iphone', 'ipad', 'app store', 'appstore'];
        
        let isAndroid = false;
        let isIOS = false;
        
        // タイトルでの判定
        if (titleLower.includes('android') || titleLower.includes('アンドロイド')) {
          isAndroid = true;
        }
        if (titleLower.includes('ios') || titleLower.includes('iphone')) {
          isIOS = true;
        }
        
        // 本文での判定
        if (!isAndroid && !isIOS) {
          androidKeywords.forEach(keyword => {
            if (bodyTextLower.includes(keyword)) isAndroid = true;
          });
          iosKeywords.forEach(keyword => {
            if (bodyTextLower.includes(keyword)) isIOS = true;
          });
        }
        
        if (isAndroid && isIOS) {
          detectedOs = 'both';
        } else if (isAndroid) {
          detectedOs = 'android';
        } else if (isIOS) {
          detectedOs = 'ios';
        }

        return {
          title: title || '',
          cashback: cashback || '',
          method: method || '',
          detectedOs: detectedOs,
          pageValid: !!title && title !== 'エラー'
        };
      });

      if (!data.pageValid) {
        console.log('❌ 無効なページ');
        this.errors.push({ id: campaignId, error: 'Invalid page' });
        return null;
      }

      const result = {
        id: campaignId,
        name: data.title,
        url: url,
        cashback: data.cashback || '不明',
        os: data.detectedOs,
        method: data.method || '不明',
        timestamp: new Date().toISOString()
      };

      console.log(`✅ ${data.title} (${data.cashback}) - OS: ${data.detectedOs}`);
      return result;

    } catch (error) {
      console.error(`❌ エラー: ${error.message}`);
      this.errors.push({ id: campaignId, error: error.message });
      return null;
    } finally {
      await browser.close();
    }
  }

  async runBulkTest() {
    console.log('🚀 iOS UAでのバルクデータ取得テスト開始\n');
    
    // より多くのテスト用案件ID
    const testIds = [
      '1794491', '1804736', '1837931', '1842976', '1850436',
      '1851234', '1848765', '1845123', '1840987', '1839456',
      '1835678', '1832145', '1829876', '1825443', '1821098'
    ];
    
    console.log(`📊 ${testIds.length}件の案件をテストします\n`);
    
    for (let i = 0; i < testIds.length; i++) {
      const id = testIds[i];
      console.log(`[${i + 1}/${testIds.length}] 案件ID: ${id}`);
      
      const result = await this.scrapeCampaign(id);
      if (result) {
        this.results.push(result);
      }
      
      // 案件間で5秒待機
      if (i < testIds.length - 1) {
        await this.sleep(5);
      }
    }

    // 結果を保存
    const output = {
      test_date: new Date().toISOString(),
      strategy: 'ios_ua_bulk_test',
      summary: {
        total_attempts: testIds.length,
        successful: this.results.length,
        failed: this.errors.length,
        success_rate: `${((this.results.length / testIds.length) * 100).toFixed(1)}%`,
        os_breakdown: {
          ios: this.results.filter(r => r.os === 'ios').length,
          android: this.results.filter(r => r.os === 'android').length,
          both: this.results.filter(r => r.os === 'both').length,
          unknown: this.results.filter(r => r.os === 'unknown').length
        }
      },
      successful_results: this.results,
      errors: this.errors
    };

    await fs.writeFile(
      'test_chobirich_ios_ua_bulk_results.json',
      JSON.stringify(output, null, 2)
    );

    console.log('\n' + '='.repeat(60));
    console.log('📊 バルクテスト結果');
    console.log('='.repeat(60));
    console.log(`総試行: ${testIds.length}件`);
    console.log(`成功: ${this.results.length}件`);
    console.log(`失敗: ${this.errors.length}件`);
    console.log(`成功率: ${output.summary.success_rate}`);
    
    console.log('\n📱 OS別分類:');
    console.log(`iOS: ${output.summary.os_breakdown.ios}件`);
    console.log(`Android: ${output.summary.os_breakdown.android}件`);
    console.log(`両対応: ${output.summary.os_breakdown.both}件`);
    console.log(`不明: ${output.summary.os_breakdown.unknown}件`);

    console.log('\n結果をtest_chobirich_ios_ua_bulk_results.jsonに保存しました');

    if (this.results.length > 0) {
      console.log('\n✅ 取得成功した案件:');
      this.results.forEach((item, index) => {
        console.log(`${index + 1}. ${item.name} (${item.cashback}) - OS: ${item.os}`);
      });
    }

    if (this.errors.length > 0) {
      console.log('\n❌ エラーが発生した案件:');
      this.errors.forEach((error, index) => {
        console.log(`${index + 1}. ID: ${error.id} - ${error.error}`);
      });
    }
  }
}

// 実行
(async () => {
  const scraper = new ChobirichIOSUABulkScraper();
  try {
    await scraper.runBulkTest();
  } catch (error) {
    console.error('致命的エラー:', error);
  }
})();