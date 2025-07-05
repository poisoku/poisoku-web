const puppeteer = require('puppeteer');

// ショッピングカテゴリの全ページ検出（101-112のみ）
class ShoppingPagesDetector {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.browser = null;
    this.iosUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
  }

  async init() {
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  }

  async checkPageExists(categoryId, pageNum) {
    const page = await this.browser.newPage();
    
    try {
      await page.setUserAgent(this.iosUserAgent);
      
      const url = pageNum === 1 
        ? `${this.baseUrl}/shopping/shop/${categoryId}`
        : `${this.baseUrl}/shopping/shop/${categoryId}?page=${pageNum}`;
      
      const response = await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });
      
      if (response.status() === 200) {
        const pageData = await page.evaluate(() => {
          const bodyText = document.body.innerText;
          
          // 「現在、掲載している商品が存在しません。」のチェック
          const hasNoProductsMessage = bodyText.includes('現在、掲載している商品が存在しません。');
          
          // 案件リンクの数をカウント
          const campaignLinks = document.querySelectorAll('a[href*="/ad_details/"]');
          const campaignCount = campaignLinks.length;
          
          // 次のページへのリンクがあるかチェック
          const nextPageExists = !!document.querySelector(`a[href*="page=${parseInt(window.location.search.match(/page=(\d+)/)?.[1] || '1') + 1}"]`);
          
          return {
            hasNoProductsMessage: hasNoProductsMessage,
            campaignCount: campaignCount,
            nextPageExists: nextPageExists,
            hasValidContent: !hasNoProductsMessage && campaignCount > 0
          };
        });
        
        return {
          categoryId: categoryId,
          pageNum: pageNum,
          url: url,
          status: response.status(),
          campaignCount: pageData.campaignCount,
          hasValidContent: pageData.hasValidContent,
          hasNoProductsMessage: pageData.hasNoProductsMessage,
          nextPageExists: pageData.nextPageExists
        };
      } else {
        return {
          categoryId: categoryId,
          pageNum: pageNum,
          url: url,
          status: response.status(),
          hasValidContent: false
        };
      }
      
    } catch (error) {
      return {
        categoryId: categoryId,
        pageNum: pageNum,
        url: url,
        error: error.message.substring(0, 50),
        hasValidContent: false
      };
    } finally {
      await page.close();
    }
  }

  async detectAllPagesForCategory(categoryId) {
    console.log(`\n📋 カテゴリ${categoryId}のページ検出中...`);
    
    const validPages = [];
    let pageNum = 1;
    let hasMorePages = true;
    const maxPages = 20; // 安全のため最大20ページまで
    
    while (hasMorePages && pageNum <= maxPages) {
      const result = await this.checkPageExists(categoryId, pageNum);
      
      if (result.hasValidContent) {
        validPages.push(result);
        console.log(`  ✅ ページ${pageNum}: ${result.campaignCount}件の案件`);
        console.log(`     URL: ${result.url}`);
        
        // 次のページがあるかチェック
        hasMorePages = result.nextPageExists;
      } else {
        if (result.hasNoProductsMessage) {
          console.log(`  ❌ ページ${pageNum}: 商品が存在しません`);
        } else {
          console.log(`  ❌ ページ${pageNum}: 無効なページ (ステータス: ${result.status})`);
        }
        hasMorePages = false;
      }
      
      pageNum++;
      
      // 間隔を空ける
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`📊 カテゴリ${categoryId}: ${validPages.length}ページ検出`);
    return validPages;
  }

  async run() {
    await this.init();
    
    // 101-112のカテゴリのみチェック
    const categories = [101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112];
    
    console.log('🔍 ショッピングカテゴリ101-112の全ページ検出開始');
    console.log('='.repeat(60));
    
    const allValidPages = [];
    
    for (const categoryId of categories) {
      const pages = await this.detectAllPagesForCategory(categoryId);
      allValidPages.push(...pages);
      
      // カテゴリ間の間隔
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // 結果まとめ
    console.log('\n' + '='.repeat(60));
    console.log('📊 全ページ検出結果まとめ');
    console.log('='.repeat(60));
    
    const categoryGroups = {};
    allValidPages.forEach(page => {
      if (!categoryGroups[page.categoryId]) {
        categoryGroups[page.categoryId] = [];
      }
      categoryGroups[page.categoryId].push(page);
    });
    
    console.log(`✅ 有効なページ総数: ${allValidPages.length}ページ`);
    console.log(`📂 有効なカテゴリ数: ${Object.keys(categoryGroups).length}カテゴリ`);
    
    console.log('\n📋 カテゴリ別ページ数:');
    Object.keys(categoryGroups).sort((a, b) => parseInt(a) - parseInt(b)).forEach(categoryId => {
      const pages = categoryGroups[categoryId];
      console.log(`  カテゴリ${categoryId}: ${pages.length}ページ`);
    });
    
    console.log('\n📋 検出された全URL一覧:');
    allValidPages.forEach(page => {
      console.log(page.url);
    });
    
    if (this.browser) {
      await this.browser.close();
    }
    
    return allValidPages;
  }
}

// 実行
(async () => {
  const detector = new ShoppingPagesDetector();
  await detector.run();
})();