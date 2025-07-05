const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class ChobirichMethodTest {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.iosUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
    this.browser = null;
  }

  async init() {
    console.log('🧪 Method取得テスト開始');
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });
  }

  async setupPage() {
    const page = await this.browser.newPage();
    
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    await page.setUserAgent(this.iosUserAgent);
    await page.setViewport({ width: 390, height: 844 });
    
    return page;
  }

  async testMethodExtraction(campaignId) {
    const page = await this.setupPage();
    
    try {
      const url = `${this.baseUrl}/ad_details/${campaignId}/`;
      console.log(`\n🔍 テスト中: ${url}`);
      
      const response = await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 25000 
      });
      
      if (response.status() !== 200) {
        console.log(`❌ ステータス: ${response.status()}`);
        return null;
      }

      const result = await page.evaluate(() => {
        const title = document.querySelector('h1')?.textContent?.trim() || '';
        const bodyText = document.body.innerText;
        
        // 改良されたmethod取得ロジック
        let method = '';
        
        // より具体的な条件を優先的に検索
        const specificPatterns = [
          /新規アプリインストール後.*?レベル\s*\d+[^\n。]{0,60}/,
          /レベル\s*\d+[^\n。]{0,60}/,
          /\d+日間[^\n。]{0,60}/,
          /チュートリアル完了[^\n。]{0,60}/,
          /初回ログイン[^\n。]{0,60}/,
          /アプリ初回起動[^\n。]{0,60}/,
          /新規インストール[^\n。]{0,60}/,
          /インストール後[^\n。]{0,60}/
        ];
        
        // 除外すべきパターン
        const excludePatterns = [
          /インストール日・時刻/,
          /広告主発行の申込完了メール/,
          /プレイヤー情報画面キャプチャ/,
          /アプリの場合はプレイヤー情報/,
          /などが必要です/
        ];
        
        for (const pattern of specificPatterns) {
          const match = bodyText.match(pattern);
          if (match) {
            const foundMethod = match[0].trim();
            // 除外パターンチェック
            const shouldExclude = excludePatterns.some(excludePattern => 
              excludePattern.test(foundMethod)
            );
            
            if (!shouldExclude) {
              method = foundMethod.substring(0, 120);
              break;
            }
          }
        }
        
        // 具体的な条件が見つからない場合の一般的な条件
        if (!method) {
          const generalPatterns = [
            /獲得条件[：:]\s*([^\n]+)/,
            /達成条件[：:]\s*([^\n]+)/,
            /条件[：:]\s*([^\n]+)/
          ];
          
          for (const pattern of generalPatterns) {
            const match = bodyText.match(pattern);
            if (match && match[1]) {
              const foundMethod = match[1].trim();
              const shouldExclude = excludePatterns.some(excludePattern => 
                excludePattern.test(foundMethod)
              );
              
              if (!shouldExclude) {
                method = foundMethod.substring(0, 120);
                break;
              }
            }
          }
        }
        
        return {
          title,
          method: method || '条件不明',
          bodyText: bodyText.substring(0, 500) // デバッグ用
        };
      });

      console.log(`📝 タイトル: ${result.title}`);
      console.log(`🎯 Method: ${result.method}`);
      console.log(`📄 Body抜粋: ${result.bodyText.substring(0, 200)}...`);
      
      return result;
      
    } catch (error) {
      console.error(`❌ エラー: ${error.message}`);
      return null;
    } finally {
      await page.close();
    }
  }

  async run() {
    await this.init();
    
    // テスト対象のキャンペーンID（既存データから選択）
    const testCampaignIds = [
      '1837310', // アプリ大還元際
      '1826358', // 楽天
      '1835496', // ピコットタウン（レベル案件）
      '1809384', // Toon Blast（レベル案件）
      '1804736'  // ザ・グランドマフィア
    ];
    
    const results = [];
    
    for (const campaignId of testCampaignIds) {
      const result = await this.testMethodExtraction(campaignId);
      if (result) {
        results.push({
          id: campaignId,
          ...result
        });
      }
      
      // 間隔を空ける
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // 結果保存
    await fs.writeFile(
      'chobirich_method_test_results.json',
      JSON.stringify(results, null, 2)
    );
    
    console.log('\n=== Method取得テスト結果 ===');
    results.forEach(result => {
      console.log(`\n${result.id}: ${result.title}`);
      console.log(`→ ${result.method}`);
    });
    
    console.log('\n💾 結果をchobirich_method_test_results.jsonに保存しました');
    
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// 実行
(async () => {
  const tester = new ChobirichMethodTest();
  await tester.run();
})();