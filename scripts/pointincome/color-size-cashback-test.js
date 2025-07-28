const puppeteer = require('puppeteer');

class ColorSizeCashbackTest {
  constructor() {
    this.testUrls = [
      'https://pointi.jp/ad/49384/', // ビックカメラ.com（赤色0.1%を抽出したい）
      'https://pointi.jp/ad/153049/', // もち麦（pt値を確認）
      'https://pointi.jp/ad/146956/', // AliExpress（赤色パーセントを確認）
    ];
    this.browser = null;
  }

  async init() {
    console.log('🎨 テキスト色・サイズベースの還元率抽出テスト');
    
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

  async testColorSizeExtraction(url) {
    const page = await this.setupPage();
    
    try {
      console.log(`\n🔍 テスト対象: ${url}`);
      
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      await this.sleep(1000);
      
      const result = await page.evaluate(() => {
        let cashback = '';
        let cashbackYen = '';
        let debugInfo = {
          redElements: [],
          largeElements: [],
          redAndLarge: [],
          strategy: ''
        };

        // すべてのテキスト要素を取得
        const allElements = document.querySelectorAll('*');
        
        // 色とサイズの条件をチェック
        for (const element of allElements) {
          const text = element.textContent?.trim();
          if (!text || text.length > 50) continue; // 長すぎるテキストは除外
          
          const computedStyle = window.getComputedStyle(element);
          const color = computedStyle.color;
          const fontSize = parseFloat(computedStyle.fontSize);
          
          // RGB値から赤色判定（rgb(255, 0, 0)やrgb(200+, 0-100, 0-100)など）
          const isRed = (() => {
            if (color.includes('rgb')) {
              const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
              if (match) {
                const [, r, g, b] = match.map(Number);
                return r > 150 && g < 100 && b < 100; // 赤っぽい色
              }
            }
            // 色名での判定
            return color.includes('red') || color === '#ff0000' || color === '#e60000';
          })();
          
          // 大きいフォントサイズ判定（16px以上）
          const isLarge = fontSize >= 16;
          
          // パーセント表記かポイント表記をチェック
          const hasPercent = /\d+(?:\.\d+)?%/.test(text);
          const hasPoints = /\d+(?:,\d{3})*pt/.test(text);
          const hasYen = /\d+(?:,\d{3})*円/.test(text);
          
          if (isRed && (hasPercent || hasPoints || hasYen)) {
            debugInfo.redElements.push({
              text: text,
              fontSize: fontSize,
              color: color,
              hasPercent,
              hasPoints,
              hasYen
            });
          }
          
          if (isLarge && (hasPercent || hasPoints || hasYen)) {
            debugInfo.largeElements.push({
              text: text,
              fontSize: fontSize,
              color: color,
              hasPercent,
              hasPoints,
              hasYen
            });
          }
          
          if (isRed && isLarge && (hasPercent || hasPoints || hasYen)) {
            debugInfo.redAndLarge.push({
              text: text,
              fontSize: fontSize,
              color: color,
              hasPercent,
              hasPoints,
              hasYen
            });
          }
        }

        // 戦略1: 赤色 + 大きいサイズの要素から抽出
        if (debugInfo.redAndLarge.length > 0) {
          const target = debugInfo.redAndLarge[0];
          
          if (target.hasPercent) {
            const percentMatch = target.text.match(/(\d+(?:\.\d+)?)%/);
            if (percentMatch) {
              cashback = percentMatch[1] + '%';
              debugInfo.strategy = 'red_large_percentage';
            }
          } else if (target.hasPoints) {
            const pointMatch = target.text.match(/(\d{1,3}(?:,\d{3})*)pt/);
            if (pointMatch) {
              cashback = pointMatch[1] + 'pt';
              const pointValue = parseInt(pointMatch[1].replace(/,/g, ''));
              cashbackYen = Math.floor(pointValue / 10) + '円';
              debugInfo.strategy = 'red_large_points';
            }
          }
        }
        
        // 戦略2: 赤色のみ（サイズ不問）
        if (!cashback && debugInfo.redElements.length > 0) {
          const target = debugInfo.redElements[0];
          
          if (target.hasPercent) {
            const percentMatch = target.text.match(/(\d+(?:\.\d+)?)%/);
            if (percentMatch) {
              cashback = percentMatch[1] + '%';
              debugInfo.strategy = 'red_percentage';
            }
          } else if (target.hasPoints) {
            const pointMatch = target.text.match(/(\d{1,3}(?:,\d{3})*)pt/);
            if (pointMatch) {
              cashback = pointMatch[1] + 'pt';
              const pointValue = parseInt(pointMatch[1].replace(/,/g, ''));
              cashbackYen = Math.floor(pointValue / 10) + '円';
              debugInfo.strategy = 'red_points';
            }
          }
        }
        
        // 戦略3: 大きいサイズのみ（色不問）
        if (!cashback && debugInfo.largeElements.length > 0) {
          const target = debugInfo.largeElements[0];
          
          if (target.hasPercent) {
            const percentMatch = target.text.match(/(\d+(?:\.\d+)?)%/);
            if (percentMatch) {
              cashback = percentMatch[1] + '%';
              debugInfo.strategy = 'large_percentage';
            }
          } else if (target.hasPoints) {
            const pointMatch = target.text.match(/(\d{1,3}(?:,\d{3})*)pt/);
            if (pointMatch) {
              cashback = pointMatch[1] + 'pt';
              const pointValue = parseInt(pointMatch[1].replace(/,/g, ''));
              cashbackYen = Math.floor(pointValue / 10) + '円';
              debugInfo.strategy = 'large_points';
            }
          }
        }
        
        return {
          cashback,
          cashbackYen,
          debugInfo
        };
      });
      
      console.log(`   🔴 赤色要素: ${result.debugInfo.redElements.length}個`);
      if (result.debugInfo.redElements.length > 0) {
        result.debugInfo.redElements.slice(0, 3).forEach((elem, i) => {
          console.log(`      ${i+1}. "${elem.text}" (${elem.fontSize}px, ${elem.color})`);
        });
      }
      
      console.log(`   📏 大きい要素: ${result.debugInfo.largeElements.length}個`);
      if (result.debugInfo.largeElements.length > 0) {
        result.debugInfo.largeElements.slice(0, 3).forEach((elem, i) => {
          console.log(`      ${i+1}. "${elem.text}" (${elem.fontSize}px)`);
        });
      }
      
      console.log(`   🎯 赤色+大きい: ${result.debugInfo.redAndLarge.length}個`);
      if (result.debugInfo.redAndLarge.length > 0) {
        result.debugInfo.redAndLarge.forEach((elem, i) => {
          console.log(`      ${i+1}. "${elem.text}" (${elem.fontSize}px, ${elem.color})`);
        });
      }
      
      console.log(`   📊 戦略: ${result.debugInfo.strategy}`);
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
        const result = await this.testColorSizeExtraction(url);
        results.push({
          url,
          ...result
        });
        await this.sleep(2000);
      }
      
      console.log('\n📋 色・サイズベーステスト結果:');
      results.forEach((result, index) => {
        console.log(`${index + 1}. URL: ${result.url}`);
        console.log(`   💰 還元: ${result.cashback || '不明'} ${result.cashbackYen ? '(' + result.cashbackYen + ')' : ''}`);
        console.log(`   🔧 戦略: ${result.debugInfo.strategy}`);
        console.log(`   📊 候補数: 赤${result.debugInfo.redElements.length}個, 大${result.debugInfo.largeElements.length}個, 赤+大${result.debugInfo.redAndLarge.length}個`);
      });
      
      console.log('\n🤔 分析結果:');
      console.log('色・サイズベースの抽出は以下の利点があります：');
      console.log('✅ 視覚的に強調された重要な還元率を直接抽出');
      console.log('✅ サイドバーの無関係な情報を自動除外');
      console.log('✅ 矢印表記に依存せず、デザイン変更に強い');
      
      console.log('\n注意点:');
      console.log('⚠️  色の判定はブラウザ環境に依存する可能性');
      console.log('⚠️  フォントサイズの基準値（16px）は調整が必要かも');
      console.log('⚠️  複数の赤色要素がある場合の優先順位が必要');
      
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
  const test = new ColorSizeCashbackTest();
  await test.run();
})();