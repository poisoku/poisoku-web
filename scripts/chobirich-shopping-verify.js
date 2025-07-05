const puppeteer = require('puppeteer');

// ショッピングカテゴリの詳細検証
class ShoppingCategoryVerifier {
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

  async verifyCategory(categoryId) {
    const page = await this.browser.newPage();
    
    try {
      await page.setUserAgent(this.iosUserAgent);
      
      const url = `${this.baseUrl}/shopping/shop/${categoryId}`;
      const response = await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });
      
      if (response.status() === 200) {
        const pageData = await page.evaluate(() => {
          const title = document.title;
          const bodyText = document.body.innerText;
          
          // ページが有効かチェック
          const isValidPage = !title.includes('404') && 
                             !title.includes('エラー') && 
                             !bodyText.includes('ページが見つかりません');
          
          // 案件リンクの数をカウント
          const shopLinks = document.querySelectorAll('a[href*="/ad_details/"]');
          const campaignCount = shopLinks.length;
          
          // カテゴリ名を取得
          let categoryName = '';
          const h1Element = document.querySelector('h1');
          if (h1Element) {
            categoryName = h1Element.textContent.trim();
          }
          
          // ページ内容の分析
          const hasShoppingContent = bodyText.includes('ショッピング') || 
                                    bodyText.includes('商品') || 
                                    bodyText.includes('買い物') ||
                                    campaignCount > 0;
          
          return {
            title: title,
            categoryName: categoryName,
            campaignCount: campaignCount,
            isValidPage: isValidPage,
            hasShoppingContent: hasShoppingContent,
            bodyLength: bodyText.length,
            bodyPreview: bodyText.substring(0, 200)
          };
        });
        
        return {
          categoryId: categoryId,
          url: url,
          status: response.status(),
          ...pageData,
          isActualCategory: pageData.isValidPage && pageData.hasShoppingContent && pageData.campaignCount > 0
        };
      } else {
        return {
          categoryId: categoryId,
          url: url,
          status: response.status(),
          isActualCategory: false
        };
      }
      
    } catch (error) {
      return {
        categoryId: categoryId,
        url: url,
        error: error.message.substring(0, 50),
        isActualCategory: false
      };
    } finally {
      await page.close();
    }
  }

  async run() {
    await this.init();
    
    const categoriesToCheck = [101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 115, 117, 118, 119, 123, 124, 128, 129, 130];
    
    console.log('🔍 ショッピングカテゴリ詳細検証開始');
    console.log('='.repeat(60));
    
    const results = [];
    
    for (const categoryId of categoriesToCheck) {
      console.log(`\n📋 カテゴリ${categoryId}検証中...`);
      
      const result = await this.verifyCategory(categoryId);
      results.push(result);
      
      if (result.isActualCategory) {
        console.log(`✅ カテゴリ${categoryId}: ${result.categoryName || '名前不明'}`);
        console.log(`   案件数: ${result.campaignCount}件`);
        console.log(`   URL: ${result.url}`);
      } else {
        console.log(`❌ カテゴリ${categoryId}: 案件なし`);
        if (result.status) {
          console.log(`   ステータス: ${result.status}`);
        }
        if (result.bodyPreview) {
          console.log(`   内容: ${result.bodyPreview.substring(0, 80)}...`);
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 結果まとめ
    const validCategories = results.filter(r => r.isActualCategory);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 検証結果まとめ');
    console.log('='.repeat(60));
    console.log(`✅ 有効なカテゴリ: ${validCategories.length}件`);
    console.log(`❌ 無効なカテゴリ: ${results.length - validCategories.length}件`);
    
    console.log('\n📋 実際に案件があるカテゴリ:');
    validCategories.forEach(category => {
      console.log(`  ${category.categoryId}: ${category.categoryName} (${category.campaignCount}件)`);
    });
    
    console.log('\n📋 有効なURL一覧:');
    validCategories.forEach(category => {
      console.log(`https://www.chobirich.com/shopping/shop/${category.categoryId}`);
    });
    
    if (this.browser) {
      await this.browser.close();
    }
    
    return validCategories;
  }
}

// 実行
(async () => {
  const verifier = new ShoppingCategoryVerifier();
  await verifier.run();
})();