const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class FixedSampleTester {
  constructor() {
    this.baseUrl = 'https://pointi.jp';
    this.results = [];
    this.browser = null;
    
    // 特定の案件をテスト
    this.testUrls = [
      'https://pointi.jp/ad/153049/', // もち麦バースターターセット
      'https://pointi.jp/ad/146956/', // AliExpress
      'https://pointi.jp/ad/6475/',   // マクロミル
    ];
  }

  async init() {
    console.log('🔧 ポイントインカム 修正版サンプルテスト開始');
    console.log(`📊 特定案件テスト: ${this.testUrls.length}件`);
    console.log('🎯 ポイント数値の正確な抽出\n');
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
    
    console.log('✅ ブラウザ初期化完了');
  }

  async setupPage() {
    const page = await this.browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    return page;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async scrapeCampaignDetail(url) {
    const page = await this.setupPage();
    
    try {
      console.log(`\n🔍 詳細スクレイピング: ${url}`);
      
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      await this.sleep(1000);
      
      const detailData = await page.evaluate(() => {
        // タイトル取得
        let title = '';
        const titleSelectors = ['h1', '.ad-title', '.campaign-title', '.title', 'h2', 'h3'];
        
        for (const selector of titleSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim() && 
              element.textContent.trim() !== 'TOP' && 
              element.textContent.trim().length > 3) {
            title = element.textContent.trim();
            break;
          }
        }
        
        if (!title) {
          const titleElement = document.querySelector('title');
          if (titleElement) {
            const titleText = titleElement.textContent.trim();
            if (titleText && !titleText.includes('TOP') && !titleText.includes('ポイントサイト')) {
              title = titleText.split('|')[0].trim();
            }
          }
        }
        
        // デバッグ用：ページの主要テキストを取得
        const allText = document.body.textContent;
        
        // より精密なポイント・還元率取得
        let cashback = '';
        let cashbackYen = '';
        let debugInfo = {
          foundPercentages: [],
          foundPoints: [],
          foundYen: []
        };
        
        // 1. すべてのパーセント表記を検索
        const percentMatches = allText.match(/(\d+(?:\.\d+)?)\s*%/g);
        if (percentMatches) {
          debugInfo.foundPercentages = percentMatches;
        }
        
        // 2. すべてのポイント表記を検索
        const pointMatches = allText.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*pt/g);
        if (pointMatches) {
          debugInfo.foundPoints = pointMatches;
        }
        
        // 3. すべての円表記を検索
        const yenMatches = allText.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*円/g);
        if (yenMatches) {
          debugInfo.foundYen = yenMatches;
        }
        
        // パーセント形式を優先（購入金額の◯%の場合）
        const purchasePercentMatch = allText.match(/購入金額の\s*(\d+(?:\.\d+)?)\s*%/);
        if (purchasePercentMatch) {
          cashback = purchasePercentMatch[1] + '%';
        } else {
          // 単独のパーセント表記
          const singlePercentMatch = allText.match(/(\d+(?:\.\d+)?)\s*%/);
          if (singlePercentMatch) {
            cashback = singlePercentMatch[1] + '%';
          }
        }
        
        // パーセントが見つからない場合、最大のポイント数を取得
        if (!cashback && pointMatches) {
          let maxPoints = 0;
          let bestPointMatch = '';
          
          for (const match of pointMatches) {
            const pointValue = parseInt(match.replace(/[,pt\s]/g, ''));
            if (pointValue > maxPoints) {
              maxPoints = pointValue;
              bestPointMatch = match.trim();
            }
          }
          
          if (bestPointMatch) {
            cashback = bestPointMatch;
            // 10pt = 1円でレート変換
            const yenValue = Math.floor(maxPoints / 10);
            if (yenValue > 0) {
              cashbackYen = yenValue + '円';
            }
          }
        }
        
        // 獲得条件を正確に取得
        let method = '';
        
        // 成果条件セクションを探す
        const methodPatterns = [
          /成果条件\s*([^\n\r]+)/,
          /ポイント獲得条件\s*([^\n\r]+)/,
          /獲得条件\s*([^\n\r]+)/
        ];
        
        for (const pattern of methodPatterns) {
          const match = allText.match(pattern);
          if (match && match[1]) {
            method = match[1].trim();
            // 不要な文字列を除去
            method = method.replace(/^\s*[:：]\s*/, '');
            method = method.replace(/\s+/g, ' ');
            if (method.length > 5 && method.length < 200) {
              break;
            }
          }
        }
        
        return {
          title: title || 'タイトル取得失敗',
          cashback: cashback,
          cashbackYen: cashbackYen,
          method: method,
          device: 'すべて',
          scrapedAt: new Date().toISOString(),
          debugInfo: debugInfo
        };
      });
      
      const urlParts = url.split('/');
      const adId = urlParts[urlParts.length - 2] || urlParts[urlParts.length - 1];
      
      // デバッグ情報を表示
      console.log(`   📊 発見した％: ${detailData.debugInfo.foundPercentages.join(', ') || 'なし'}`);
      console.log(`   📊 発見したpt: ${detailData.debugInfo.foundPoints.join(', ') || 'なし'}`);
      console.log(`   📊 発見した円: ${detailData.debugInfo.foundYen.slice(0,3).join(', ') || 'なし'}`);
      console.log(`   ✅ 採用した還元: ${detailData.cashback || '不明'} ${detailData.cashbackYen ? '(' + detailData.cashbackYen + ')' : ''}`);
      
      return {
        id: `pi_${adId}`,
        url: url,
        campaignUrl: url,
        displayName: detailData.title,
        description: detailData.title,
        ...detailData
      };
      
    } finally {
      await page.close();
    }
  }

  async run() {
    try {
      await this.init();
      
      for (const url of this.testUrls) {
        try {
          const result = await this.scrapeCampaignDetail(url);
          this.results.push(result);
          await this.sleep(3000);
        } catch (error) {
          console.error(`❌ エラー: ${url} - ${error.message}`);
        }
      }
      
      // 結果保存
      const output = {
        testType: 'fixed_point_extraction_test',
        testDate: new Date().toISOString(),
        summary: {
          total_tested: this.results.length,
        },
        results: this.results
      };
      
      await fs.writeFile('fixed_sample_results.json', JSON.stringify(output, null, 2));
      
      console.log('\n🎉 修正版テスト完了！');
      console.log(`📊 総取得数: ${this.results.length}件`);
      console.log('📄 結果保存: fixed_sample_results.json');
      
      // 結果サマリー
      console.log('\n📋 修正版結果サマリー:');
      this.results.forEach((result, index) => {
        console.log(`${index + 1}. ${result.title}`);
        console.log(`   💰 還元: ${result.cashback || '不明'} ${result.cashbackYen ? '(' + result.cashbackYen + ')' : ''}`);
        console.log(`   📝 条件: ${result.method || '取得失敗'}`);
        console.log('');
      });
      
      return output;
      
    } catch (error) {
      console.error('❌ テスト実行エラー:', error);
      throw error;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

// 実行
(async () => {
  const tester = new FixedSampleTester();
  await tester.run();
})();