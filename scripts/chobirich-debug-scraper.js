const puppeteer = require('puppeteer');

/**
 * デバッグ用スクレイパー - HTML構造を確認
 */
async function debugScraper() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // iOS UA設定
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
    
    // ショッピング案件の詳細ページ
    console.log('🔍 ショッピング案件のHTML構造を確認...\n');
    const testUrl = 'https://www.chobirich.com/ad_details/1838641/';
    
    await page.goto(testUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    // タイトル要素を探す
    const titleInfo = await page.evaluate(() => {
      const results = {
        h1: null,
        h2: [],
        h3: [],
        metaTitle: null,
        pageTitle: document.title,
        possibleTitles: []
      };
      
      // h1要素
      const h1 = document.querySelector('h1');
      if (h1) {
        results.h1 = h1.textContent.trim();
      }
      
      // h2要素
      document.querySelectorAll('h2').forEach(h2 => {
        results.h2.push(h2.textContent.trim());
      });
      
      // h3要素
      document.querySelectorAll('h3').forEach(h3 => {
        results.h3.push(h3.textContent.trim());
      });
      
      // メタタイトル
      const metaTitle = document.querySelector('meta[property="og:title"]');
      if (metaTitle) {
        results.metaTitle = metaTitle.content;
      }
      
      // classやidに"title"を含む要素
      const titleElements = document.querySelectorAll('[class*="title"], [id*="title"], .campaign-name, .shop-name');
      titleElements.forEach(elem => {
        const text = elem.textContent.trim();
        if (text && text.length > 0 && text.length < 200) {
          results.possibleTitles.push({
            tag: elem.tagName,
            class: elem.className,
            text: text
          });
        }
      });
      
      return results;
    });
    
    console.log('📋 タイトル要素の調査結果:');
    console.log(JSON.stringify(titleInfo, null, 2));
    
    // 還元率情報を探す
    console.log('\n💰 還元率情報の調査:');
    const cashbackInfo = await page.evaluate(() => {
      const results = {
        pointTexts: [],
        percentTexts: []
      };
      
      // ポイント表記を探す
      const allText = document.body.innerText;
      const pointMatches = allText.match(/\d+(?:,\d{3})*\s*(?:pt|ポイント|円相当)/gi);
      if (pointMatches) {
        results.pointTexts = pointMatches;
      }
      
      // パーセント表記を探す
      const percentMatches = allText.match(/\d+(?:\.\d+)?\s*%/gi);
      if (percentMatches) {
        results.percentTexts = percentMatches;
      }
      
      return results;
    });
    
    console.log(JSON.stringify(cashbackInfo, null, 2));
    
    // 獲得条件を探す
    console.log('\n📝 獲得条件の調査:');
    const methodInfo = await page.evaluate(() => {
      const results = {
        conditionTexts: []
      };
      
      // "条件"を含む要素を探す
      const conditionElements = document.querySelectorAll('*');
      conditionElements.forEach(elem => {
        if (elem.textContent.includes('獲得条件') || elem.textContent.includes('ポイント獲得条件')) {
          // 次の要素のテキストを取得
          const nextSibling = elem.nextElementSibling;
          if (nextSibling) {
            results.conditionTexts.push(nextSibling.textContent.trim());
          }
          // 親要素内のテキストも取得
          const parent = elem.parentElement;
          if (parent) {
            results.conditionTexts.push(parent.textContent.trim());
          }
        }
      });
      
      return results;
    });
    
    console.log(JSON.stringify(methodInfo, null, 2));
    
    // スクリーンショット保存
    await page.screenshot({ path: 'chobirich_debug_screenshot.png', fullPage: true });
    console.log('\n📸 スクリーンショットを保存: chobirich_debug_screenshot.png');
    
    // カテゴリURLの確認
    console.log('\n🔗 カテゴリURLの確認:');
    await page.goto('https://www.chobirich.com/', { waitUntil: 'networkidle0' });
    
    const categoryUrls = await page.evaluate(() => {
      const urls = {
        service: [],
        creditcard: [],
        shopping: []
      };
      
      // リンクを探す
      const links = document.querySelectorAll('a');
      links.forEach(link => {
        const href = link.href;
        if (href.includes('/service')) {
          urls.service.push(href);
        }
        if (href.includes('credit') || href.includes('card')) {
          urls.creditcard.push(href);
        }
        if (href.includes('/shopping')) {
          urls.shopping.push(href);
        }
      });
      
      return urls;
    });
    
    console.log('発見したカテゴリURL:');
    console.log(JSON.stringify(categoryUrls, null, 2));
    
  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await browser.close();
  }
}

// 実行
debugScraper();