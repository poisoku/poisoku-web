const puppeteer = require('puppeteer');

// 高速でショッピングカテゴリを検出
class QuickShoppingCheck {
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

  async quickCheck(categoryId) {
    const page = await this.browser.newPage();
    
    try {
      await page.setUserAgent(this.iosUserAgent);
      
      const url = `${this.baseUrl}/shopping/shop/${categoryId}`;
      const response = await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 10000 
      });
      
      const isValid = response.status() === 200;
      
      if (isValid) {
        const hasContent = await page.evaluate(() => {
          const title = document.title;
          const bodyText = document.body.innerText;
          return !title.includes('404') && 
                 !title.includes('エラー') && 
                 !bodyText.includes('ページが見つかりません') &&
                 bodyText.length > 300;
        });
        
        return hasContent;
      }
      
      return false;
      
    } catch (error) {
      return false;
    } finally {
      await page.close();
    }
  }

  async run() {
    await this.init();
    
    const validCategories = [];
    
    console.log('🔍 ショッピングカテゴリクイックチェック（101-130）');
    
    for (let categoryId = 101; categoryId <= 130; categoryId++) {
      const isValid = await this.quickCheck(categoryId);
      
      if (isValid) {
        validCategories.push(categoryId);
        console.log(`✅ カテゴリ${categoryId}: 有効`);
      } else {
        console.log(`❌ カテゴリ${categoryId}: 無効`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n📊 検出結果:');
    console.log(`有効カテゴリ: ${validCategories.join(', ')}`);
    
    // URL一覧生成
    console.log('\n📋 検出されたURL:');
    validCategories.forEach(categoryId => {
      console.log(`https://www.chobirich.com/shopping/shop/${categoryId}`);
    });
    
    if (this.browser) {
      await this.browser.close();
    }
    
    return validCategories;
  }
}

// 実行
(async () => {
  const checker = new QuickShoppingCheck();
  await checker.run();
})();