#!/usr/bin/env node

/**
 * モッピー案件詳細ページ構造調査
 * ポイント情報の正確な場所を特定
 */

const puppeteer = require('puppeteer');

async function investigateDetailPages() {
  console.log('🔍 モッピー案件詳細ページ構造調査');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  });
  
  try {
    // テスト用の案件URL（取得したデータから）
    const testUrls = [
      'https://pc.moppy.jp/ad/detail.php?site_id=138222', // 17万ポイント案件
      'https://pc.moppy.jp/ad/detail.php?site_id=124167', // 東急カード（最大18,000検出済み）
      'https://pc.moppy.jp/ad/detail.php?site_id=159095'  // IG証券（18,000P検出済み）
    ];
    
    for (let i = 0; i < testUrls.length; i++) {
      const url = testUrls[i];
      console.log(`\n📄 ${i + 1}. 詳細ページ調査: ${url}`);
      
      const page = await browser.newPage();
      
      try {
        // ステルス設定
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.evaluateOnNewDocument(() => {
          Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
          });
        });
        
        // ページアクセス
        await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        
        // 少し待機
        await new Promise(r => setTimeout(r, 3000));
        
        // ポイント情報を詳細に調査
        const pointAnalysis = await page.evaluate(() => {
          const result = {
            title: document.title,
            pointElements: [],
            allNumbers: [],
            specificSelectors: {}
          };
          
          // ポイント関連の要素を探す
          const possibleSelectors = [
            '[class*="point"]',
            '[class*="Point"]',
            '[class*="reward"]',
            '[class*="amount"]',
            '[class*="price"]',
            '[id*="point"]',
            '[id*="Point"]',
            'strong',
            '.value',
            '.number',
            'span[class*="num"]',
            'div[class*="num"]'
          ];
          
          possibleSelectors.forEach(selector => {
            try {
              const elements = document.querySelectorAll(selector);
              if (elements.length > 0) {
                result.specificSelectors[selector] = [];
                elements.forEach(el => {
                  const text = el.textContent.trim();
                  if (text && /\d/.test(text)) {
                    result.specificSelectors[selector].push({
                      text,
                      className: el.className,
                      id: el.id,
                      tagName: el.tagName
                    });
                  }
                });
              }
            } catch (e) {
              // セレクタエラーは無視
            }
          });
          
          // すべてのテキストから数字パターンを探す
          const bodyText = document.body.innerText;
          const numberPatterns = [
            /(\d{1,6}(?:,\d{3})*)\s*[PpＰ]/g,
            /(\d{1,6}(?:,\d{3})*)\s*ポイント/g,
            /(\d+(?:\.\d+)?)\s*[%％]/g,
            /最大\s*(\d{1,6}(?:,\d{3})*)/g,
            /(\d{1,6}(?:,\d{3})*)\s*円相当/g,
            /獲得\s*(\d{1,6}(?:,\d{3})*)/g
          ];
          
          numberPatterns.forEach((pattern, i) => {
            let match;
            while ((match = pattern.exec(bodyText)) !== null) {
              result.allNumbers.push({
                pattern: i,
                value: match[0],
                number: match[1]
              });
            }
          });
          
          // 特定のキーワード周辺のテキストを抽出
          const keywords = ['獲得', 'ポイント', '相当', '最大', 'P'];
          keywords.forEach(keyword => {
            const regex = new RegExp(`[^。]*${keyword}[^。]*`, 'g');
            const matches = bodyText.match(regex);
            if (matches) {
              result.pointElements.push(...matches.slice(0, 3));
            }
          });
          
          return result;
        });
        
        console.log(`   📋 ページタイトル: ${pointAnalysis.title}`);
        
        if (pointAnalysis.allNumbers.length > 0) {
          console.log('   🔢 検出された数値パターン:');
          pointAnalysis.allNumbers.slice(0, 5).forEach(num => {
            console.log(`     - ${num.value} (パターン${num.pattern})`);
          });
        }
        
        if (pointAnalysis.pointElements.length > 0) {
          console.log('   💰 ポイント関連テキスト:');
          pointAnalysis.pointElements.slice(0, 3).forEach(text => {
            console.log(`     - ${text.slice(0, 100)}`);
          });
        }
        
        // 最も有望なセレクタを特定
        const promising = Object.entries(pointAnalysis.specificSelectors)
          .filter(([, elements]) => elements.length > 0)
          .slice(0, 5);
        
        if (promising.length > 0) {
          console.log('   🎯 有望なセレクタ:');
          promising.forEach(([selector, elements]) => {
            console.log(`     ${selector}: ${elements.length}要素`);
            elements.slice(0, 2).forEach(el => {
              console.log(`       - "${el.text}" (${el.tagName}.${el.className})`);
            });
          });
        }
        
      } catch (error) {
        console.error(`   ❌ エラー: ${error.message}`);
      } finally {
        await page.close();
      }
      
      // 次のページまで少し待機
      if (i < testUrls.length - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    
    console.log('\n⏱️ 5秒後にブラウザを閉じます...');
    await new Promise(r => setTimeout(r, 5000));
    
  } catch (error) {
    console.error('❌ 全体エラー:', error);
  } finally {
    await browser.close();
  }
}

investigateDetailPages().catch(console.error);