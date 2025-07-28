const puppeteer = require('puppeteer');

class TestBiccameraFix {
  constructor() {
    this.testUrls = [
      'https://pointi.jp/ad/49384/', // ビックカメラ.com（0.1%が正解）
      'https://pointi.jp/ad/153049/', // もち麦（11,500ptが正解）
      'https://pointi.jp/ad/146956/', // AliExpress（10%が正解）
    ];
    this.browser = null;
  }

  async init() {
    console.log('🧪 修正されたcashback抽出ロジックのテスト');
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
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

  async testCashbackExtraction(url) {
    const page = await this.setupPage();
    
    try {
      console.log(`\n🔍 テスト対象: ${url}`);
      
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      await this.sleep(1000);
      
      const result = await page.evaluate(() => {
        const allText = document.body.textContent;
        
        let cashback = '';
        let cashbackYen = '';
        let debugInfo = {
          foundPercentages: [],
          foundPoints: [],
          foundYen: [],
          strategy: ''
        };
        
        // 1. すべてのパーセント表記を検索
        const percentMatches = allText.match(/(\d+(?:\.\d+)?)\s*%/g);
        if (percentMatches) {
          debugInfo.foundPercentages = percentMatches.slice(0, 10);
        }
        
        // 2. すべてのポイント表記を検索（大きな数字を優先）
        const pointMatches = allText.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*pt/g);
        if (pointMatches) {
          debugInfo.foundPoints = pointMatches.slice(0, 10);
        }
        
        // 3. すべての円表記を検索
        const yenMatches = allText.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*円/g);
        if (yenMatches) {
          debugInfo.foundYen = yenMatches.slice(0, 10);
        }
        
        // 戦略A0: 矢印表記での特別還元率（最優先）
        const arrowPercentMatch = allText.match(/(\d+(?:\.\d+)?)\s*%[^0-9]*(?:⇒|→)[^0-9]*(\d+(?:\.\d+)?)\s*%/);
        if (arrowPercentMatch) {
          // 矢印の後の値を採用（特別還元率）
          cashback = arrowPercentMatch[2] + '%';
          debugInfo.strategy = 'arrow_percentage';
          debugInfo.arrowMatch = arrowPercentMatch[0];
        }
        
        // 戦略A: 「購入金額の◯%」形式をチェック
        if (!cashback) {
          const purchasePercentMatch = allText.match(/購入金額の\s*(\d+(?:\.\d+)?)\s*%/);
          if (purchasePercentMatch) {
            cashback = purchasePercentMatch[1] + '%';
            debugInfo.strategy = 'purchase_percentage';
          }
        }
        
        // 戦略B: 固定ポイント案件かチェック（特定のコンテキストで抽出）
        if (!cashback && pointMatches) {
          let selectedPoints = 0;
          let bestPointMatch = '';
          let extractionMethod = '';
          
          // 方法1: 還元や獲得という文脈の近くにあるポイントを優先
          const contextualPatterns = [
            /還元[^\d]*?(\d{1,3}(?:,\d{3})*)\s*pt/,
            /獲得[^\d]*?(\d{1,3}(?:,\d{3})*)\s*pt/,
            /\b(\d{1,3}(?:,\d{3})*)\s*pt\s*(?:還元|獲得)/,
            /\b(\d{1,3}(?:,\d{3})*)\s*pt\s*(?:プレゼント|もらえる)/
          ];
          
          for (const pattern of contextualPatterns) {
            const match = allText.match(pattern);
            if (match && match[1]) {
              const pointValue = parseInt(match[1].replace(/,/g, ''));
              if (pointValue >= 1000 && pointValue > selectedPoints) {
                selectedPoints = pointValue;
                bestPointMatch = match[1] + 'pt';
                extractionMethod = 'contextual';
                break;
              }
            }
          }
          
          // 方法2: コンテキストで見つからない場合、頻出するポイント数を特定
          if (!bestPointMatch) {
            const pointCounts = {};
            for (const match of pointMatches) {
              const pointValue = parseInt(match.replace(/[,pt\s]/g, ''));
              if (pointValue >= 1000 && pointValue <= 50000) {
                pointCounts[pointValue] = (pointCounts[pointValue] || 0) + 1;
              }
            }
            
            // 最も頻出するポイント数を選択（複数回言及されるものは重要な可能性が高い）
            let maxCount = 0;
            let mostFrequentPoint = 0;
            for (const [points, count] of Object.entries(pointCounts)) {
              const pointValue = parseInt(points);
              if (count > maxCount || (count === maxCount && pointValue < mostFrequentPoint)) {
                maxCount = count;
                mostFrequentPoint = pointValue;
              }
            }
            
            if (mostFrequentPoint > 0) {
              selectedPoints = mostFrequentPoint;
              bestPointMatch = mostFrequentPoint.toLocaleString() + 'pt';
              extractionMethod = 'frequency';
            }
          }
          
          if (bestPointMatch) {
            cashback = bestPointMatch;
            const yenValue = Math.floor(selectedPoints / 10);
            cashbackYen = yenValue + '円';
            debugInfo.strategy = 'fixed_points_large';
            debugInfo.extractionMethod = extractionMethod;
          }
        }
        
        // 戦略D: パーセント形式（購入金額のパーセントでない場合）
        if (!cashback && percentMatches) {
          // 最初に見つかったパーセントを使用（広告メインエリアの可能性が高い）
          const firstPercent = percentMatches[0];
          const percentValue = parseFloat(firstPercent.replace('%', ''));
          if (percentValue > 0 && percentValue <= 100) {
            cashback = firstPercent;
            debugInfo.strategy = 'general_percentage';
          }
        }
        
        return {
          cashback,
          cashbackYen,
          debugInfo
        };
      });
      
      console.log(`   📊 発見した％: ${result.debugInfo.foundPercentages.slice(0,5).join(', ') || 'なし'}`);
      console.log(`   📊 発見したpt: ${result.debugInfo.foundPoints.slice(0,5).join(', ') || 'なし'}`);
      console.log(`   📊 戦略: ${result.debugInfo.strategy}`);
      if (result.debugInfo.arrowMatch) {
        console.log(`   🎯 矢印表記: ${result.debugInfo.arrowMatch}`);
      }
      console.log(`   ✅ 抽出結果: ${result.cashback || '不明'} ${result.cashbackYen ? '(' + result.cashbackYen + ')' : ''}`);
      
      return result;
      
    } finally {
      await page.close();
    }
  }

  async run() {
    try {
      await this.init();
      
      const results = [];
      
      for (const url of this.testUrls) {
        const result = await this.testCashbackExtraction(url);
        results.push({
          url,
          ...result
        });
        await this.sleep(2000);
      }
      
      console.log('\n📋 テスト結果サマリー:');
      results.forEach((result, index) => {
        console.log(`${index + 1}. URL: ${result.url}`);
        console.log(`   💰 還元: ${result.cashback || '不明'} ${result.cashbackYen ? '(' + result.cashbackYen + ')' : ''}`);
        console.log(`   🔧 戦略: ${result.debugInfo.strategy}`);
      });
      
    } catch (error) {
      console.error('❌ エラー:', error);
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

(async () => {
  const test = new TestBiccameraFix();
  await test.run();
})();