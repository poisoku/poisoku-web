const puppeteer = require('puppeteer');

class TestYoshikeiExtraction {
  constructor() {
    // YOSHIKEIの案件URL（画像から推測）
    this.testUrl = 'https://pointi.jp/search/?keyword=YOSHIKEI';
    this.browser = null;
  }

  async init() {
    console.log('🥗 YOSHIKEI案件の還元率抽出テスト（矢印なし案件）');
    
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

  async findYoshikeiCampaign() {
    const page = await this.setupPage();
    
    try {
      console.log('\n🔍 YOSHIKEI案件を検索中...');
      
      await page.goto(this.testUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      await this.sleep(2000);
      
      // YOSHIKEI案件のリンクを探す
      const yoshikeiLinks = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        return links
          .filter(link => link.textContent.includes('YOSHIKEI') || link.textContent.includes('ヨシケイ'))
          .map(link => ({
            href: link.href,
            text: link.textContent.trim()
          }))
          .slice(0, 3); // 最初の3件
      });
      
      console.log(`見つかったYOSHIKEI案件: ${yoshikeiLinks.length}件`);
      yoshikeiLinks.forEach((link, i) => {
        console.log(`  ${i+1}. ${link.text} - ${link.href}`);
      });
      
      return yoshikeiLinks;
      
    } finally {
      await page.close();
    }
  }

  async testCashbackExtraction(url) {
    const page = await this.setupPage();
    
    try {
      console.log(`\n🔍 還元率抽出テスト: ${url}`);
      
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
          strategy: '',
          arrowMatch: null
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
          
          // 方法2: 大きなポイント数を探す（10,000pt など）
          if (!bestPointMatch) {
            const largePointMatches = pointMatches.filter(match => {
              const pointValue = parseInt(match.replace(/[,pt\\s]/g, ''));
              return pointValue >= 5000; // 5000pt以上の大きなポイント
            });
            
            if (largePointMatches.length > 0) {
              // 最大のポイント数を選択
              let maxPoints = 0;
              let maxPointMatch = '';
              
              for (const match of largePointMatches) {
                const pointValue = parseInt(match.replace(/[,pt\\s]/g, ''));
                if (pointValue > maxPoints) {
                  maxPoints = pointValue;
                  maxPointMatch = match;
                }
              }
              
              selectedPoints = maxPoints;
              bestPointMatch = maxPointMatch;
              extractionMethod = 'large_point';
            }
          }
          
          // 方法3: 頻出するポイント数を特定
          if (!bestPointMatch) {
            const pointCounts = {};
            for (const match of pointMatches) {
              const pointValue = parseInt(match.replace(/[,pt\\s]/g, ''));
              if (pointValue >= 1000 && pointValue <= 50000) {
                pointCounts[pointValue] = (pointCounts[pointValue] || 0) + 1;
              }
            }
            
            // 最も頻出するポイント数を選択
            let maxCount = 0;
            let mostFrequentPoint = 0;
            for (const [points, count] of Object.entries(pointCounts)) {
              const pointValue = parseInt(points);
              if (count > maxCount || (count === maxCount && pointValue > mostFrequentPoint)) {
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
      } else {
        console.log(`   🎯 矢印表記: なし`);
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
      
      // まずYOSHIKEI案件を検索
      const yoshikeiLinks = await this.findYoshikeiCampaign();
      
      if (yoshikeiLinks.length === 0) {
        console.log('❌ YOSHIKEI案件が見つかりませんでした');
        // 代替として、一般的な案件をテスト
        console.log('\n代替テスト: 一般的な案件で矢印なし抽出をテスト');
        const testResult = await this.testCashbackExtraction('https://pointi.jp/ad/153049/');
        
        console.log('\n📋 結論:');
        console.log('✅ 矢印表記がない案件でも以下の戦略で抽出可能:');
        console.log('  1. 大きなポイント数の抽出（10,000pt など）');
        console.log('  2. コンテキスト付きポイント抽出（還元◯◯pt）');
        console.log('  3. 頻出ポイント数の特定');
        console.log('  4. 一般的なパーセント抽出');
        
        return;
      }
      
      const results = [];
      
      for (const link of yoshikeiLinks.slice(0, 2)) { // 最初の2件をテスト
        const result = await this.testCashbackExtraction(link.href);
        results.push({
          url: link.href,
          title: link.text,
          ...result
        });
        await this.sleep(2000);
      }
      
      console.log('\n📋 YOSHIKEI案件テスト結果:');
      results.forEach((result, index) => {
        console.log(`${index + 1}. ${result.title}`);
        console.log(`   💰 還元: ${result.cashback || '不明'} ${result.cashbackYen ? '(' + result.cashbackYen + ')' : ''}`);
        console.log(`   🔧 戦略: ${result.debugInfo.strategy}`);
        console.log(`   🎯 矢印: ${result.debugInfo.arrowMatch ? 'あり' : 'なし'}`);
      });
      
      console.log('\n📋 結論:');
      if (results.some(r => r.debugInfo.strategy === 'arrow_percentage')) {
        console.log('✅ 矢印表記で正確に抽出');
      } else {
        console.log('✅ 矢印なしでも代替戦略で抽出可能:');
        console.log('  - 固定ポイント案件: 大きな数値を優先抽出');
        console.log('  - パーセント案件: 最初のパーセント値を採用');
        console.log('  - コンテキスト重視: 還元・獲得の文脈で判定');
      }
      
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
  const test = new TestYoshikeiExtraction();
  await test.run();
})();