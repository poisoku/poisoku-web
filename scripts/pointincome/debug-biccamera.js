const puppeteer = require('puppeteer');

class DebugBiccamera {
  constructor() {
    this.url = 'https://pointi.jp/ad/49384/'; // ビックカメラ.com
    this.browser = null;
  }

  async init() {
    console.log('🔍 ビックカメラ案件デバッグ開始');
    
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

  async debug() {
    const page = await this.setupPage();
    
    try {
      console.log(`\n📍 アクセス中: ${this.url}`);
      
      await page.goto(this.url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      await this.sleep(2000);
      
      const debugData = await page.evaluate(() => {
        const allText = document.body.textContent;
        
        console.log('=== ページ全体のテキスト ===');
        console.log(allText.substring(0, 2000)); // 最初の2000文字
        
        // 1. すべてのパーセント表記を検索
        const percentMatches = allText.match(/(\d+(?:\.\d+)?)\s*%/g);
        console.log('\n=== 発見されたパーセント ===');
        console.log(percentMatches);
        
        // 2. すべてのポイント表記を検索
        const pointMatches = allText.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*pt/g);
        console.log('\n=== 発見されたポイント ===');
        console.log(pointMatches);
        
        // 3. 購入金額に関する記述を検索
        const purchaseAmountMatches = allText.match(/購入金額[^0-9]*(\d+(?:\.\d+)?)\s*%/g);
        console.log('\n=== 購入金額パーセント ===');
        console.log(purchaseAmountMatches);
        
        // 4. 通常という文言と一緒のパーセント
        const normalMatches = allText.match(/通常[^0-9]*(\d+(?:\.\d+)?)\s*%/g);
        console.log('\n=== 通常パーセント ===');
        console.log(normalMatches);
        
        // 5. 矢印や特別表記
        const arrowMatches = allText.match(/(\d+(?:\.\d+)?)\s*%[^0-9]*(?:⇒|→)[^0-9]*(\d+(?:\.\d+)?)\s*%/g);
        console.log('\n=== 矢印表記 ===');
        console.log(arrowMatches);
        
        return {
          percentMatches,
          pointMatches,
          purchaseAmountMatches,
          normalMatches,
          arrowMatches,
          fullText: allText
        };
      });
      
      console.log('\n📊 デバッグ結果:');
      console.log('パーセント:', debugData.percentMatches);
      console.log('ポイント:', debugData.pointMatches);
      console.log('購入金額:', debugData.purchaseAmountMatches);
      console.log('通常:', debugData.normalMatches);
      console.log('矢印:', debugData.arrowMatches);
      
      // 現在のロジックをテスト
      console.log('\n🧪 現在のロジックテスト:');
      await this.testCurrentLogic(debugData.fullText);
      
    } finally {
      await page.close();
    }
  }

  testCurrentLogic(allText) {
    console.log('=== 戦略A: 購入金額のパーセント ===');
    const purchasePercentMatch = allText.match(/購入金額の\s*(\d+(?:\.\d+)?)\s*%/);
    console.log('購入金額のパーセント:', purchasePercentMatch);
    
    if (purchasePercentMatch) {
      console.log('✅ 戦略A採用:', purchasePercentMatch[1] + '%');
      return;
    }
    
    console.log('=== 戦略B: ポイント検索 ===');
    const pointMatches = allText.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*pt/g);
    if (pointMatches) {
      console.log('発見されたポイント:', pointMatches);
      
      // 頻度分析
      const pointCounts = {};
      for (const match of pointMatches) {
        const pointValue = parseInt(match.replace(/[,pt\s]/g, ''));
        if (pointValue >= 1000 && pointValue <= 50000) {
          pointCounts[pointValue] = (pointCounts[pointValue] || 0) + 1;
        }
      }
      
      console.log('ポイント頻度:', pointCounts);
      
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
        console.log('✅ 戦略B採用 (頻度):', mostFrequentPoint + 'pt');
        return;
      }
    }
    
    console.log('=== 戦略D: 一般パーセント ===');
    const percentMatches = allText.match(/(\d+(?:\.\d+)?)\s*%/g);
    if (percentMatches) {
      const firstPercent = percentMatches[0];
      console.log('✅ 戦略D採用:', firstPercent);
    }
  }

  async run() {
    try {
      await this.init();
      await this.debug();
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
  const debug = new DebugBiccamera();
  await debug.run();
})();