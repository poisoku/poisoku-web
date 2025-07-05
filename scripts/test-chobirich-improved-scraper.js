const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class ImprovedChobirichScraper {
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

      // ページにアクセス
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
      await new Promise(resolve => setTimeout(resolve, 3000));

      // デバッグ用：ページの構造を確認
      const debugInfo = await page.evaluate(() => {
        const selectors = {
          titles: [
            { selector: 'h1.AdDetails__title', count: document.querySelectorAll('h1.AdDetails__title').length },
            { selector: 'h1', count: document.querySelectorAll('h1').length },
            { selector: '.campaign-title', count: document.querySelectorAll('.campaign-title').length },
            { selector: '[class*="title"]', count: document.querySelectorAll('[class*="title"]').length }
          ],
          points: [
            { selector: '.AdDetails__pt', count: document.querySelectorAll('.AdDetails__pt').length },
            { selector: '.ItemPtLarge', count: document.querySelectorAll('.ItemPtLarge').length },
            { selector: '[class*="point"]', count: document.querySelectorAll('[class*="point"]').length },
            { selector: '[class*="pt"]', count: document.querySelectorAll('[class*="pt"]').length }
          ],
          conditions: [
            { selector: '.AdDetails__condition', count: document.querySelectorAll('.AdDetails__condition').length },
            { selector: '.AdDetails__conditionItem', count: document.querySelectorAll('.AdDetails__conditionItem').length },
            { selector: '[class*="condition"]', count: document.querySelectorAll('[class*="condition"]').length }
          ]
        };
        
        return {
          selectors,
          pageTitle: document.title,
          bodyClasses: document.body.className,
          htmlSnippet: document.documentElement.innerHTML.substring(0, 500)
        };
      });

      console.log('デバッグ情報:', JSON.stringify(debugInfo, null, 2));

      // データ取得（改良版）
      const data = await page.evaluate(() => {
        // 案件タイトル
        let title = '';
        const h1Elements = document.querySelectorAll('h1');
        for (const h1 of h1Elements) {
          const text = h1.textContent.trim();
          if (text && !text.includes('ちょびリッチ')) {
            title = text;
            break;
          }
        }
        
        // タイトルが見つからない場合はページタイトルから取得
        if (!title && document.title) {
          const titleMatch = document.title.match(/(.+?)[\s\-\|｜]/);
          if (titleMatch) {
            title = titleMatch[1].trim();
          }
        }

        // 還元率（より広範囲に検索）
        let cashback = '';
        
        // まず、ポイント表示を探す
        const pointElements = document.querySelectorAll('[class*="pt"], [class*="point"], [class*="Point"], [class*="PT"]');
        for (const elem of pointElements) {
          const text = elem.textContent.trim();
          // 数字を含むパターンを探す
          const patterns = [
            /(\d{1,3}(?:,\d{3})*(?:ちょび)?pt)/i,
            /(\d{1,3}(?:,\d{3})*ポイント)/,
            /(\d+(?:\.\d+)?[%％])/,
            /最大(\d{1,3}(?:,\d{3})*)/
          ];
          
          for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
              cashback = match[1] || match[0];
              break;
            }
          }
          if (cashback) break;
        }

        // 獲得方法（条件セクションから取得）
        let method = '';
        const conditionElements = document.querySelectorAll('[class*="condition"], dl, dt, dd');
        
        for (const elem of conditionElements) {
          const text = elem.textContent;
          if (text.includes('獲得方法') || text.includes('条件')) {
            // 次の要素または同じ要素内のテキストを確認
            const methodMatch = text.match(/(?:獲得方法|条件)[：:：\s]*(.+?)(?:\n|$)/);
            if (methodMatch) {
              method = methodMatch[1].trim();
            } else {
              // 次の兄弟要素を確認
              const nextElem = elem.nextElementSibling;
              if (nextElem) {
                method = nextElem.textContent.trim();
              }
            }
            if (method) break;
          }
        }

        // より詳細な情報を取得
        const allText = document.body.innerText;
        if (!method && allText.includes('インストール')) {
          const installMatch = allText.match(/(インストール[^。\n]{0,30})/);
          if (installMatch) {
            method = installMatch[1].trim();
          }
        }

        return {
          title,
          cashback,
          method,
          htmlLength: document.documentElement.innerHTML.length,
          bodyText: document.body.innerText.substring(0, 1000) // デバッグ用
        };
      });

      console.log('取得データ概要:', {
        title: data.title,
        cashback: data.cashback,
        method: data.method,
        htmlLength: data.htmlLength
      });

      // OS判定（改良版）
      let detectedOs = 'unknown';
      const titleLower = (data.title || '').toLowerCase();
      const bodyTextLower = (data.bodyText || '').toLowerCase();
      
      if (titleLower.includes('ios') || titleLower.includes('iphone') || 
          bodyTextLower.includes('ios限定') || bodyTextLower.includes('iphone限定')) {
        detectedOs = 'ios';
      } else if (titleLower.includes('android') || titleLower.includes('アンドロイド') ||
                 bodyTextLower.includes('android限定') || bodyTextLower.includes('アンドロイド限定')) {
        detectedOs = 'android';
      } else if (bodyTextLower.includes('ios') && bodyTextLower.includes('android')) {
        detectedOs = 'both';
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

      console.log('✅ 取得結果:', result);
      return result;

    } catch (error) {
      console.error(`❌ エラー: ${error.message}`);
      return null;
    } finally {
      await browser.close();
    }
  }

  async runTest() {
    console.log('🧪 ちょびリッチアプリ案件データ取得テスト（改良版）開始\n');
    
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
      ios_success: this.results.filter(r => r.testedOs === 'ios' && r.success).length,
      android_success: this.results.filter(r => r.testedOs === 'android' && r.success).length,
      results: this.results
    };

    await fs.writeFile(
      'test_chobirich_improved_results.json',
      JSON.stringify(output, null, 2)
    );

    console.log('\n📊 テスト結果サマリー:');
    console.log(`総テスト数: ${output.total_tests}`);
    console.log(`成功: ${output.successful_tests}`);
    console.log(`iOS成功: ${output.ios_success}`);
    console.log(`Android成功: ${output.android_success}`);
    console.log('結果をtest_chobirich_improved_results.jsonに保存しました');
  }
}

// 実行
(async () => {
  const scraper = new ImprovedChobirichScraper();
  try {
    await scraper.runTest();
  } catch (error) {
    console.error('致命的エラー:', error);
  }
})();