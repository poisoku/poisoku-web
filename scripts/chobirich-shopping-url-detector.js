const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class ChobirichShoppingUrlDetector {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.browser = null;
    this.validCategories = [];
    this.iosUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
  }

  async init() {
    console.log('🔍 ショッピングカテゴリURL検出開始');
    
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

  async checkCategoryExists(categoryId) {
    const page = await this.setupPage();
    
    try {
      const url = `${this.baseUrl}/shopping/shop/${categoryId}`;
      console.log(`🔍 チェック中: ${url}`);
      
      const response = await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });
      
      const isValid = response.status() === 200;
      
      if (isValid) {
        // ページ内容も確認
        const pageContent = await page.evaluate(() => {
          const title = document.title;
          const bodyText = document.body.innerText.substring(0, 200);
          const hasShoppingContent = !title.includes('404') && 
                                   !title.includes('エラー') && 
                                   !bodyText.includes('ページが見つかりません');
          
          // カテゴリ名も取得
          let categoryName = '';
          const h1Element = document.querySelector('h1');
          if (h1Element) {
            categoryName = h1Element.textContent.trim();
          }
          
          return { 
            title, 
            hasShoppingContent,
            categoryName,
            bodyPreview: bodyText.substring(0, 100)
          };
        });
        
        if (pageContent.hasShoppingContent) {
          console.log(`✅ カテゴリ${categoryId}: ${pageContent.categoryName || '名前不明'}`);
          return {
            id: categoryId,
            url: url,
            categoryName: pageContent.categoryName,
            isValid: true
          };
        } else {
          console.log(`❌ カテゴリ${categoryId}: 無効なページ`);
          return { id: categoryId, isValid: false };
        }
      } else {
        console.log(`❌ カテゴリ${categoryId}: ステータス ${response.status()}`);
        return { id: categoryId, isValid: false };
      }
      
    } catch (error) {
      console.log(`❌ カテゴリ${categoryId}: エラー ${error.message.substring(0, 50)}`);
      return { id: categoryId, isValid: false };
    } finally {
      await page.close();
    }
  }

  async checkCategoryPages(categoryId) {
    console.log(`📄 カテゴリ${categoryId}のページ数チェック...`);
    
    const pages = [];
    let pageNum = 1;
    let hasMorePages = true;
    const maxPages = 20; // 安全のため最大20ページまで
    
    while (hasMorePages && pageNum <= maxPages) {
      const page = await this.setupPage();
      
      try {
        const url = pageNum === 1 
          ? `${this.baseUrl}/shopping/shop/${categoryId}`
          : `${this.baseUrl}/shopping/shop/${categoryId}?page=${pageNum}`;
        
        const response = await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 15000 
        });
        
        if (response.status() === 200) {
          const pageData = await page.evaluate(() => {
            const title = document.title;
            const bodyText = document.body.innerText;
            const hasValidContent = !title.includes('404') && 
                                   !title.includes('エラー') && 
                                   !bodyText.includes('ページが見つかりません') &&
                                   bodyText.length > 500; // 十分なコンテンツがある
            
            // 次ページの存在確認
            const hasNext = !!document.querySelector('a[href*="page=' + (parseInt(window.location.search.match(/page=(\d+)/)?.[1] || '1') + 1) + '"]') ||
                           !!document.querySelector('.pagination a[href*="page="]');
            
            // 案件数を確認
            const shopItems = document.querySelectorAll('[class*="shop"], [class*="item"], [class*="campaign"]');
            
            return { 
              hasValidContent, 
              hasNext, 
              itemCount: shopItems.length,
              bodyLength: bodyText.length
            };
          });
          
          if (pageData.hasValidContent) {
            pages.push({
              pageNum: pageNum,
              url: url,
              itemCount: pageData.itemCount
            });
            console.log(`  ✅ ページ${pageNum}: ${pageData.itemCount}件の案件`);
            
            hasMorePages = pageData.hasNext;
          } else {
            console.log(`  ❌ ページ${pageNum}: 無効なページ`);
            hasMorePages = false;
          }
        } else {
          console.log(`  ❌ ページ${pageNum}: ステータス ${response.status()}`);
          hasMorePages = false;
        }
        
        pageNum++;
        
        // 間隔を空ける
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.log(`  ❌ ページ${pageNum}: エラー ${error.message.substring(0, 30)}`);
        hasMorePages = false;
      } finally {
        await page.close();
      }
    }
    
    console.log(`📊 カテゴリ${categoryId}: ${pages.length}ページ検出`);
    return pages;
  }

  async detectValidCategories() {
    console.log('🔍 ショッピングカテゴリの検出開始（101から開始）');
    
    const validCategories = [];
    const maxCategory = 200; // 最大200まで検索
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 10; // 連続10回失敗で終了
    
    for (let categoryId = 101; categoryId <= maxCategory; categoryId++) {
      const result = await this.checkCategoryExists(categoryId);
      
      if (result.isValid) {
        // ページ数もチェック
        const pages = await this.checkCategoryPages(categoryId);
        
        validCategories.push({
          categoryId: categoryId,
          categoryName: result.categoryName,
          url: result.url,
          pageCount: pages.length,
          pages: pages
        });
        
        consecutiveFailures = 0; // 成功したのでリセット
      } else {
        consecutiveFailures++;
      }
      
      // 連続失敗が多い場合は終了
      if (consecutiveFailures >= maxConsecutiveFailures) {
        console.log(`🛑 連続${maxConsecutiveFailures}回失敗のため検出終了`);
        break;
      }
      
      // 間隔を空ける
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    return validCategories;
  }

  async run() {
    await this.init();
    
    try {
      const validCategories = await this.detectValidCategories();
      
      // 結果保存
      const output = {
        detection_date: new Date().toISOString(),
        total_categories: validCategories.length,
        categories: validCategories
      };
      
      await fs.writeFile(
        'chobirich_shopping_categories.json',
        JSON.stringify(output, null, 2)
      );
      
      // 結果表示
      console.log('\n' + '='.repeat(60));
      console.log('🎯 ショッピングカテゴリ検出結果');
      console.log('='.repeat(60));
      console.log(`📂 検出カテゴリ数: ${validCategories.length}件`);
      
      console.log('\n📋 検出されたカテゴリ一覧:');
      validCategories.forEach(category => {
        console.log(`  ${category.categoryId}: ${category.categoryName} (${category.pageCount}ページ)`);
        console.log(`    → ${category.url}`);
        if (category.pages.length > 1) {
          console.log(`    → ページ2-${category.pageCount}: ${category.url}?page=2 〜 ?page=${category.pageCount}`);
        }
      });
      
      console.log('\n💾 詳細結果をchobirich_shopping_categories.jsonに保存');
      
      return validCategories;
      
    } catch (error) {
      console.error('ショッピングカテゴリ検出エラー:', error);
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

// 実行
(async () => {
  const detector = new ChobirichShoppingUrlDetector();
  await detector.run();
})();