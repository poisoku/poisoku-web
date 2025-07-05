const puppeteer = require('puppeteer');

// 正確なショッピングページ検出（「現在、掲載している商品が存在しません。」を除外）
class CorrectShoppingDetector {
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

  async checkPageHasProducts(categoryId, pageNum) {
    const page = await this.browser.newPage();
    
    try {
      await page.setUserAgent(this.iosUserAgent);
      
      const url = pageNum === 1 
        ? `${this.baseUrl}/shopping/shop/${categoryId}`
        : `${this.baseUrl}/shopping/shop/${categoryId}?page=${pageNum}`;
      
      console.log(`🔍 チェック中: ${url}`);
      
      const response = await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });
      
      if (response.status() === 200) {
        const pageData = await page.evaluate(() => {
          const bodyText = document.body.innerText;
          
          // 重要: 「現在、掲載している商品が存在しません。」の完全チェック
          const hasNoProductsMessage = bodyText.includes('現在、掲載している商品が存在しません。');
          
          // 案件リンクの数をカウント
          const campaignLinks = document.querySelectorAll('a[href*="/ad_details/"]');
          const campaignCount = campaignLinks.length;
          
          return {
            hasNoProductsMessage: hasNoProductsMessage,
            campaignCount: campaignCount,
            bodyTextSample: bodyText.substring(0, 500) // デバッグ用
          };
        });
        
        // 「現在、掲載している商品が存在しません。」があれば無効
        if (pageData.hasNoProductsMessage) {
          console.log(`  ❌ ページ${pageNum}: 商品が存在しません`);
          return { valid: false, reason: 'no_products_message' };
        }
        
        // 案件リンクが0個でも無効
        if (pageData.campaignCount === 0) {
          console.log(`  ❌ ページ${pageNum}: 案件リンクが0件`);
          return { valid: false, reason: 'no_campaign_links' };
        }
        
        console.log(`  ✅ ページ${pageNum}: ${pageData.campaignCount}件の案件`);
        return { 
          valid: true, 
          url: url, 
          campaignCount: pageData.campaignCount,
          categoryId: categoryId,
          pageNum: pageNum
        };
        
      } else {
        console.log(`  ❌ ページ${pageNum}: ステータス ${response.status()}`);
        return { valid: false, reason: `status_${response.status()}` };
      }
      
    } catch (error) {
      console.log(`  ❌ ページ${pageNum}: エラー ${error.message.substring(0, 30)}`);
      return { valid: false, reason: 'error' };
    } finally {
      await page.close();
    }
  }

  async detectValidPagesForCategory(categoryId) {
    console.log(`\n📋 カテゴリ${categoryId}の有効ページ検出中...`);
    
    const validPages = [];
    let pageNum = 1;
    let consecutiveInvalid = 0;
    const maxConsecutiveInvalid = 2; // 連続2回無効で終了
    const maxPages = 15; // 安全のため最大15ページまで
    
    while (pageNum <= maxPages && consecutiveInvalid < maxConsecutiveInvalid) {
      const result = await this.checkPageHasProducts(categoryId, pageNum);
      
      if (result.valid) {
        validPages.push(result);
        consecutiveInvalid = 0; // リセット
      } else {
        consecutiveInvalid++;
        console.log(`  📊 連続無効: ${consecutiveInvalid}回`);
        
        // 早期終了の判定
        if (consecutiveInvalid >= maxConsecutiveInvalid) {
          console.log(`  🛑 連続${maxConsecutiveInvalid}回無効のため終了`);
          break;
        }
      }
      
      pageNum++;
      
      // 間隔を空ける
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    console.log(`📊 カテゴリ${categoryId}: ${validPages.length}ページが有効`);
    return validPages;
  }

  async run() {
    await this.init();
    
    // 101-112のカテゴリのみチェック
    const categories = [101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112];
    
    console.log('🔍 ショッピングカテゴリ101-112の正確な検出開始');
    console.log('（「現在、掲載している商品が存在しません。」のページは除外）');
    console.log('='.repeat(60));
    
    const allValidPages = [];
    
    for (const categoryId of categories) {
      const pages = await this.detectValidPagesForCategory(categoryId);
      allValidPages.push(...pages);
      
      // カテゴリ間の間隔
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // 結果まとめ
    console.log('\n' + '='.repeat(60));
    console.log('📊 正確な検出結果まとめ');
    console.log('='.repeat(60));
    
    const categoryGroups = {};
    allValidPages.forEach(page => {
      if (!categoryGroups[page.categoryId]) {
        categoryGroups[page.categoryId] = [];
      }
      categoryGroups[page.categoryId].push(page);
    });
    
    console.log(`✅ 実際に案件があるページ総数: ${allValidPages.length}ページ`);
    console.log(`📂 有効なカテゴリ数: ${Object.keys(categoryGroups).length}カテゴリ`);
    
    console.log('\n📋 カテゴリ別有効ページ数:');
    Object.keys(categoryGroups).sort((a, b) => parseInt(a) - parseInt(b)).forEach(categoryId => {
      const pages = categoryGroups[categoryId];
      console.log(`  カテゴリ${categoryId}: ${pages.length}ページ`);
    });
    
    console.log('\n📋 実際に案件があるURL一覧:');
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
  const detector = new CorrectShoppingDetector();
  await detector.run();
})();