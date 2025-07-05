const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class ChobirichIOSUAForAndroidScraper {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.results = [];
    
    // iOS ユーザーエージェント（Android案件の取得にも使用）
    this.iosUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
  }

  async sleep(seconds) {
    console.log(`⏳ ${seconds}秒待機中...`);
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }

  async scrapeCampaign(campaignId) {
    console.log(`\n📱 iOS UAでAndroid案件 ${campaignId} にアクセス中...`);
    
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      
      // iOS ユーザーエージェントを使用
      await page.setUserAgent(this.iosUserAgent);
      await page.setViewport({
        width: 390,  // iPhone 14 Pro
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
      console.log(`ステータス: ${status}`);

      if (status === 403) {
        console.log('❌ 403 Forbidden');
        return null;
      }

      if (status !== 200) {
        console.log(`❌ ステータスコード: ${status}`);
        return null;
      }

      // ページロード後に待機
      await this.sleep(3);

      // データ取得とOS判定
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
          /インストール[^\n]{0,50}/,
          /初回[^\n]{0,50}/,
          /条件[：:]\s*([^\n]+)/,
          /獲得方法[：:]\s*([^\n]+)/
        ];
        
        for (const pattern of patterns) {
          const match = bodyText.match(pattern);
          if (match) {
            method = match[1] || match[0];
            method = method.trim().substring(0, 100);
            break;
          }
        }

        // OS判定（案件名とページ内容から）
        let detectedOs = 'unknown';
        const titleLower = title.toLowerCase();
        const bodyTextLower = bodyText.toLowerCase();
        
        // まずタイトルで判定
        if (titleLower.includes('android') || titleLower.includes('アンドロイド')) {
          detectedOs = 'android';
        } else if (titleLower.includes('ios') || titleLower.includes('iphone')) {
          detectedOs = 'ios';
        } else {
          // ページ内容で判定
          const androidKeywords = ['android', 'アンドロイド', 'google play', 'androidアプリ'];
          const iosKeywords = ['ios', 'iphone', 'ipad', 'app store', 'iosアプリ'];
          
          let androidCount = 0;
          let iosCount = 0;
          
          androidKeywords.forEach(keyword => {
            if (bodyTextLower.includes(keyword)) androidCount++;
          });
          
          iosKeywords.forEach(keyword => {
            if (bodyTextLower.includes(keyword)) iosCount++;
          });
          
          if (androidCount > iosCount) {
            detectedOs = 'android';
          } else if (iosCount > androidCount) {
            detectedOs = 'ios';
          } else if (androidCount > 0 && iosCount > 0) {
            detectedOs = 'both';
          }
        }

        return {
          title: title || '',
          cashback: cashback || '',
          method: method || '',
          detectedOs: detectedOs,
          pageValid: !!title && title !== 'エラー',
          bodyTextSample: bodyText.substring(0, 200) // デバッグ用
        };
      });

      if (!data.pageValid) {
        console.log('❌ 無効なページ');
        return null;
      }

      const result = {
        id: campaignId,
        name: data.title,
        url: url,
        cashback: data.cashback || '不明',
        os: data.detectedOs, // 検出されたOS
        method: data.method || '不明',
        accessMethod: 'ios_ua_for_android',
        bodyTextSample: data.bodyTextSample,
        timestamp: new Date().toISOString()
      };

      console.log(`✅ 取得成功: ${data.title} (${data.cashback}) - 検出OS: ${data.detectedOs}`);
      return result;

    } catch (error) {
      console.error(`❌ エラー: ${error.message}`);
      return null;
    } finally {
      await browser.close();
    }
  }

  async runTest() {
    console.log('🚀 iOS UAでAndroid案件データ取得テスト開始\n');
    
    // テスト用の案件ID（Android寄りの案件を含む）
    const testIds = ['1794491', '1804736', '1837931', '1842976', '1850436'];
    
    for (let i = 0; i < testIds.length; i++) {
      const id = testIds[i];
      console.log(`\n${'='.repeat(60)}`);
      console.log(`[${i + 1}/${testIds.length}] 案件ID: ${id}`);
      console.log('='.repeat(60));
      
      const result = await this.scrapeCampaign(id);
      if (result) {
        this.results.push(result);
      }
      
      // 案件間で8秒待機
      if (i < testIds.length - 1) {
        await this.sleep(8);
      }
    }

    // 結果を保存
    const output = {
      test_date: new Date().toISOString(),
      strategy: 'ios_ua_for_android_detection',
      summary: {
        total_attempts: testIds.length,
        successful: this.results.length,
        success_rate: `${((this.results.length / testIds.length) * 100).toFixed(1)}%`,
        os_breakdown: {
          ios: this.results.filter(r => r.os === 'ios').length,
          android: this.results.filter(r => r.os === 'android').length,
          both: this.results.filter(r => r.os === 'both').length,
          unknown: this.results.filter(r => r.os === 'unknown').length
        }
      },
      results: this.results
    };

    await fs.writeFile(
      'test_chobirich_ios_ua_for_android_results.json',
      JSON.stringify(output, null, 2)
    );

    console.log('\n📊 テスト結果:');
    console.log(`総試行: ${testIds.length}`);
    console.log(`成功: ${this.results.length}`);
    console.log(`成功率: ${output.summary.success_rate}`);
    console.log('\nOS別分類:');
    console.log(`iOS: ${output.summary.os_breakdown.ios}件`);
    console.log(`Android: ${output.summary.os_breakdown.android}件`);
    console.log(`両対応: ${output.summary.os_breakdown.both}件`);
    console.log(`不明: ${output.summary.os_breakdown.unknown}件`);
    console.log('\n結果をtest_chobirich_ios_ua_for_android_results.jsonに保存しました');

    if (this.results.length > 0) {
      console.log('\n取得できた案件:');
      this.results.forEach(item => {
        console.log(`- ${item.name} (${item.cashback}) - OS: ${item.os}`);
      });
    }
  }
}

// 実行
(async () => {
  const scraper = new ChobirichIOSUAForAndroidScraper();
  try {
    await scraper.runTest();
  } catch (error) {
    console.error('致命的エラー:', error);
  }
})();