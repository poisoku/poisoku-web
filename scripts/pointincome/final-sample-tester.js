const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class FinalSampleTester {
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
    console.log('🎯 ポイントインカム 最終版サンプルテスト開始');
    console.log(`📊 特定案件テスト: ${this.testUrls.length}件`);
    console.log('🎯 正確な還元率判定ロジック適用\n');
    
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
        
        // ページの主要テキストを取得
        const allText = document.body.textContent;
        
        // より精密な還元率取得ロジック
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
          debugInfo.foundPercentages = percentMatches;
        }
        
        // 2. すべてのポイント表記を検索（大きな数字を優先）
        const pointMatches = allText.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*pt/g);
        if (pointMatches) {
          debugInfo.foundPoints = pointMatches;
        }
        
        // 3. すべての円表記を検索
        const yenMatches = allText.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*円/g);
        if (yenMatches) {
          debugInfo.foundYen = yenMatches;
        }
        
        // 戦略A: 「購入金額の◯%」形式をチェック
        const purchasePercentMatch = allText.match(/購入金額の\s*(\d+(?:\.\d+)?)\s*%/);
        if (purchasePercentMatch) {
          cashback = purchasePercentMatch[1] + '%';
          debugInfo.strategy = 'purchase_percentage';
        }
        
        // 戦略B: 固定ポイント案件かチェック（特定のコンテキストで抽出）
        if (!cashback && pointMatches) {
          let selectedPoints = 0;
          let bestPointMatch = '';
          let extractionMethod = '';
          
          // 方法1: 還元や獲得という文脈の近くにあるポイントを優先
          const contextualPatterns = [
            /還元[^\\d]*?(\\d{1,3}(?:,\\d{3})*)\\s*pt/,
            /獲得[^\\d]*?(\\d{1,3}(?:,\\d{3})*)\\s*pt/,
            /\\b(\\d{1,3}(?:,\\d{3})*)\\s*pt\\s*(?:還元|獲得)/,
            /\\b(\\d{1,3}(?:,\\d{3})*)\\s*pt\\s*(?:プレゼント|もらえる)/
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
              const pointValue = parseInt(match.replace(/[,pt\\s]/g, ''));
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
          
          // 方法3: どちらでも見つからない場合、中程度のポイント数を選択（過度に大きくない値）
          if (!bestPointMatch) {
            const reasonablePoints = pointMatches
              .map(match => parseInt(match.replace(/[,pt\\s]/g, '')))
              .filter(points => points >= 1000 && points <= 30000)
              .sort((a, b) => a - b);
            
            if (reasonablePoints.length > 0) {
              // 中央値付近を選択
              const midIndex = Math.floor(reasonablePoints.length / 2);
              selectedPoints = reasonablePoints[midIndex];
              bestPointMatch = selectedPoints.toLocaleString() + 'pt';
              extractionMethod = 'median';
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
        
        // 戦略C: 小さなポイント案件（1000pt未満）
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
            debugInfo.strategy = 'fixed_points_small';
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
      console.log(`   📊 発見した％: ${detailData.debugInfo.foundPercentages.slice(0,5).join(', ') || 'なし'}`);
      console.log(`   📊 発見したpt: ${detailData.debugInfo.foundPoints.slice(0,5).join(', ') || 'なし'}`);
      console.log(`   📊 戦略: ${detailData.debugInfo.strategy}`);
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
        testType: 'final_cashback_extraction_test',
        testDate: new Date().toISOString(),
        summary: {
          total_tested: this.results.length,
        },
        results: this.results
      };
      
      await fs.writeFile('final_sample_results.json', JSON.stringify(output, null, 2));
      
      console.log('\n🎉 最終版テスト完了！');
      console.log(`📊 総取得数: ${this.results.length}件`);
      console.log('📄 結果保存: final_sample_results.json');
      
      // 結果サマリー
      console.log('\n📋 最終版結果サマリー:');
      this.results.forEach((result, index) => {
        console.log(`${index + 1}. ${result.title}`);
        console.log(`   💰 還元: ${result.cashback || '不明'} ${result.cashbackYen ? '(' + result.cashbackYen + ')' : ''}`);
        console.log(`   📝 条件: ${result.method || '取得失敗'}`);
        console.log(`   🔧 戦略: ${result.debugInfo.strategy}`);
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
  const tester = new FinalSampleTester();
  await tester.run();
})();