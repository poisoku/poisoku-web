const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class ChobirichAndroidLongerWaitScraper {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.results = [];
    
    // より多様なAndroid ユーザーエージェント（古いバージョン含む）
    this.androidUserAgents = [
      // 古いAndroidバージョン
      'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
      'Mozilla/5.0 (Linux; Android 9; SM-G960F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.127 Mobile Safari/537.36',
      'Mozilla/5.0 (Linux; Android 8.1.0; SM-G955F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Mobile Safari/537.36',
      
      // 異なるメーカー
      'Mozilla/5.0 (Linux; Android 11; Mi 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Mobile Safari/537.36',
      'Mozilla/5.0 (Linux; Android 12; ONEPLUS A6000) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Mobile Safari/537.36',
      'Mozilla/5.0 (Linux; Android 11; Redmi Note 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Mobile Safari/537.36'
    ];
    
    this.currentUserAgentIndex = 0;
  }

  getRandomUserAgent() {
    const ua = this.androidUserAgents[this.currentUserAgentIndex];
    this.currentUserAgentIndex = (this.currentUserAgentIndex + 1) % this.androidUserAgents.length;
    return ua;
  }

  async sleep(seconds) {
    console.log(`⏳ ${seconds}秒待機中...`);
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }

  async scrapeCampaign(campaignId, attemptNumber = 1) {
    console.log(`\n📱 Android環境で案件 ${campaignId} にアクセス中（試行 ${attemptNumber}）...`);
    
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-blink-features=AutomationControlled'
      ]
    });

    try {
      const page = await browser.newPage();
      
      // ランダムなAndroid UAを選択
      const userAgent = this.getRandomUserAgent();
      console.log(`使用UA: ${userAgent.substring(0, 50)}...`);
      
      await page.setUserAgent(userAgent);
      await page.setViewport({
        width: 412,
        height: 915
      });

      // より詳細なHTTPヘッダー設定
      await page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.chobirich.com/smartphone?sort=point',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      });

      // 自動化検出を回避
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
      });

      const url = `${this.baseUrl}/ad_details/${campaignId}/`;
      
      // まずトップページにアクセス（自然なアクセスパターン）
      console.log('1. トップページにアクセス...');
      await page.goto('https://www.chobirich.com/', { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      // 10秒待機
      await this.sleep(10);
      
      // スマートフォン案件一覧にアクセス
      console.log('2. スマートフォン案件一覧にアクセス...');
      await page.goto('https://www.chobirich.com/smartphone?sort=point', { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      // 15秒待機
      await this.sleep(15);
      
      // 目的の案件ページにアクセス
      console.log('3. 案件詳細ページにアクセス...');
      const response = await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      const status = response.status();
      console.log(`ステータス: ${status}`);

      if (status === 403) {
        console.log('❌ 403 Forbidden - アクセス拒否');
        
        // 403エラーの場合は指数バックオフで待機
        if (attemptNumber < 3) {
          const waitTime = 60 * Math.pow(2, attemptNumber - 1); // 60秒、120秒、240秒
          console.log(`⏳ ${waitTime}秒待機してリトライします...`);
          await this.sleep(waitTime);
          
          await browser.close();
          return this.scrapeCampaign(campaignId, attemptNumber + 1);
        } else {
          return null;
        }
      }

      if (status !== 200) {
        console.log(`❌ ステータスコード: ${status}`);
        return null;
      }

      // ページロード後に追加待機
      await this.sleep(5);

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

        return {
          title: title || '',
          cashback: cashback || '',
          method: method || '',
          pageValid: !!title && title !== 'エラー',
          htmlLength: document.documentElement.innerHTML.length
        };
      });

      if (!data.pageValid) {
        console.log('❌ 無効なページ（タイトルなしまたはエラーページ）');
        return null;
      }

      const result = {
        id: campaignId,
        name: data.title,
        url: url,
        cashback: data.cashback || '不明',
        os: 'android',
        method: data.method || '不明',
        userAgent: userAgent,
        attempts: attemptNumber,
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
    console.log('🚀 Android環境でのより長い待機時間テスト開始\n');
    
    // テスト用の案件ID
    const testIds = ['1794491', '1804736', '1837931'];
    
    for (let i = 0; i < testIds.length; i++) {
      const id = testIds[i];
      console.log(`\n${'='.repeat(60)}`);
      console.log(`[${i + 1}/${testIds.length}] 案件ID: ${id}`);
      console.log('='.repeat(60));
      
      const result = await this.scrapeCampaign(id);
      if (result) {
        this.results.push(result);
      }
      
      // 案件間で20秒待機
      if (i < testIds.length - 1) {
        await this.sleep(20);
      }
    }

    // 結果を保存
    const output = {
      test_date: new Date().toISOString(),
      strategy: 'android_longer_wait',
      summary: {
        total_attempts: testIds.length,
        successful: this.results.length,
        success_rate: `${((this.results.length / testIds.length) * 100).toFixed(1)}%`
      },
      results: this.results
    };

    await fs.writeFile(
      'test_chobirich_android_longer_wait_results.json',
      JSON.stringify(output, null, 2)
    );

    console.log('\n📊 テスト結果:');
    console.log(`総試行: ${testIds.length}`);
    console.log(`成功: ${this.results.length}`);
    console.log(`成功率: ${output.summary.success_rate}`);
    console.log('結果をtest_chobirich_android_longer_wait_results.jsonに保存しました');

    if (this.results.length > 0) {
      console.log('\n成功したAndroid案件:');
      this.results.forEach(item => {
        console.log(`- ${item.name} (${item.cashback}) - 試行回数: ${item.attempts}`);
      });
    }
  }
}

// 実行
(async () => {
  const scraper = new ChobirichAndroidLongerWaitScraper();
  try {
    await scraper.runTest();
  } catch (error) {
    console.error('致命的エラー:', error);
  }
})();