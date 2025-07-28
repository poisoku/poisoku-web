const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class SingleCategoryTester {
  constructor() {
    this.baseUrl = 'https://pointi.jp';
    this.browser = null;
    this.rateLimitMs = 1500;
    this.pageTimeoutMs = 60000;
  }

  async init() {
    console.log('🧪 単一カテゴリテスト開始');
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ],
      timeout: 30000
    });
    
    console.log('✅ ブラウザ初期化完了');
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

  async testCategory(categoryName, categoryId, type = 'group') {
    console.log(`\n🧪 テスト開始: ${categoryName} (${type}:${categoryId})`);
    
    const page = await this.setupPage();
    
    try {
      const url = type === 'group' 
        ? `${this.baseUrl}/list.php?group=${categoryId}`
        : `${this.baseUrl}/list.php?category=${categoryId}`;
      
      console.log(`📍 URL: ${url}`);
      
      await page.goto(url, { waitUntil: 'networkidle2', timeout: this.pageTimeoutMs });
      await this.sleep(1000);
      
      // 1ページ目のリンクを取得
      const campaignLinks = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/ad/"]'));
        return links.map(link => ({
          url: link.href,
          title: link.textContent.trim()
        })).filter(link => link.url.includes('/ad/'));
      });
      
      console.log(`📊 発見した案件: ${campaignLinks.length}件`);
      
      if (campaignLinks.length > 0) {
        // 最初の3件の詳細を取得
        console.log(`🔍 最初の3件の詳細取得テスト:`);
        
        for (let i = 0; i < Math.min(3, campaignLinks.length); i++) {
          const campaign = campaignLinks[i];
          console.log(`\n  [${i + 1}] URL: ${campaign.url}`);
          
          try {
            const detailData = await this.testCampaignDetail(campaign.url);
            console.log(`  ✅ タイトル: ${detailData.title}`);
            console.log(`  ✅ 還元率: ${detailData.cashback || detailData.cashbackYen || '不明'}`);
            console.log(`  ✅ 説明: ${detailData.description.substring(0, 50)}...`);
            
            await this.sleep(this.rateLimitMs);
          } catch (error) {
            console.log(`  ❌ エラー: ${error.message}`);
          }
        }
      }
      
      return {
        success: true,
        totalLinks: campaignLinks.length,
        sampleData: campaignLinks.slice(0, 3)
      };
      
    } catch (error) {
      console.error(`❌ カテゴリテスト失敗: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    } finally {
      await page.close();
    }
  }

  async testCampaignDetail(url) {
    const page = await this.setupPage();
    
    try {
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: this.pageTimeoutMs 
      });
      
      await this.sleep(500);
      
      const detailData = await page.evaluate(() => {
        // タイトル取得（改良版）
        let title = '';
        
        // より具体的なセレクタから試す
        const titleSelectors = [
          'h1',
          '.ad-title',
          '.campaign-title',
          '.title',
          'h2',
          'h3'
        ];
        
        for (const selector of titleSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim() && 
              element.textContent.trim() !== 'TOP' && 
              element.textContent.trim().length > 3) {
            title = element.textContent.trim();
            break;
          }
        }
        
        // titleタグから取得（フォールバック）
        if (!title) {
          const titleElement = document.querySelector('title');
          if (titleElement) {
            const titleText = titleElement.textContent.trim();
            if (titleText && !titleText.includes('TOP') && !titleText.includes('ポイントサイト')) {
              // パイプ区切りの最初の部分を取得
              title = titleText.split('|')[0].trim();
            }
          }
        }
        
        // 還元率取得
        let cashback = '';
        let cashbackYen = '';
        
        const allText = document.body.textContent;
        
        // パーセンテージ還元率
        const percentMatch = allText.match(/(\d+(?:\.\d+)?)\s*%/);
        if (percentMatch) {
          cashback = percentMatch[1] + '%';
        }
        
        // ポイント還元率
        const pointMatch = allText.match(/(\d+(?:,\d+)*)\s*(?:pt|ポイント)/);
        if (pointMatch) {
          cashback = pointMatch[1] + 'pt';
        }
        
        // 円還元率
        const yenMatch = allText.match(/(\d+(?:,\d+)*)\s*円/);
        if (yenMatch) {
          cashbackYen = yenMatch[1] + '円';
        }
        
        // 説明取得
        let description = title;
        const descriptionSelectors = [
          '.description',
          '.ad-description',
          '.campaign-description',
          'p'
        ];
        
        for (const selector of descriptionSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim().length > 10) {
            description = element.textContent.trim();
            break;
          }
        }
        
        return {
          title: title || 'タイトル取得失敗',
          description: description || title || 'データ取得失敗',
          cashback: cashback,
          cashbackYen: cashbackYen,
          pageTitle: document.title,
          bodyTextLength: document.body.textContent.length
        };
      });
      
      return detailData;
      
    } finally {
      await page.close();
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('🔒 ブラウザクローズ完了');
    }
  }
}

// テスト実行
(async () => {
  const tester = new SingleCategoryTester();
  await tester.init();
  
  try {
    // 軽量なカテゴリから順番にテスト
    const testCategories = [
      { name: '衛生用品', id: 147, type: 'group' },
      { name: 'サービスカテゴリ82', id: 82, type: 'category' },
      { name: '美容', id: 148, type: 'group' }
    ];
    
    for (const category of testCategories) {
      const result = await tester.testCategory(category.name, category.id, category.type);
      
      if (result.success) {
        console.log(`✅ ${category.name}: ${result.totalLinks}件の案件を発見`);
      } else {
        console.log(`❌ ${category.name}: ${result.error}`);
      }
      
      await tester.sleep(2000);
    }
    
  } finally {
    await tester.close();
  }
})();