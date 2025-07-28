const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class SingleCategoryScraper {
  constructor() {
    this.baseUrl = 'https://pointi.jp';
    this.browser = null;
    this.rateLimitMs = 1500;
    this.pageTimeoutMs = 60000;
  }

  async init() {
    console.log('🧪 単一カテゴリ完全スクレイピング開始');
    
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

  async scrapeCategory(categoryName, categoryId, type = 'group') {
    console.log(`\n🛍️ カテゴリ処理開始: ${categoryName} (${type}:${categoryId})`);
    
    const page = await this.setupPage();
    const results = [];
    
    try {
      let allCampaignLinks = [];
      let pageNum = 1;
      
      const firstUrl = type === 'group' 
        ? `${this.baseUrl}/list.php?group=${categoryId}`
        : `${this.baseUrl}/list.php?category=${categoryId}`;
      
      console.log(`📍 URL: ${firstUrl}`);
      
      await page.goto(firstUrl, { waitUntil: 'networkidle2', timeout: this.pageTimeoutMs });
      await this.sleep(1000);
      
      // 全ページから案件リンクを取得
      while (pageNum <= 20) {
        console.log(`  📄 ページ ${pageNum} を処理中...`);
        
        const campaignLinks = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a[href*="/ad/"]'));
          return links.map(link => ({
            url: link.href,
            title: link.textContent.trim()
          })).filter(link => link.url.includes('/ad/'));
        });
        
        if (campaignLinks.length === 0) {
          console.log(`    ⚠️ 案件が見つかりません - ページ終了`);
          break;
        }
        
        allCampaignLinks.push(...campaignLinks);
        console.log(`    ✅ ${campaignLinks.length}件発見（累計: ${allCampaignLinks.length}件）`);
        
        // 次ページボタンをクリック
        const nextPageResult = await page.evaluate(() => {
          const nextButtons = Array.from(document.querySelectorAll('a, input[type="button"], input[type="submit"]'));
          let nextButton = null;
          
          for (let btn of nextButtons) {
            const text = btn.textContent || btn.value || '';
            if (text.includes('次へ') || text === '>' || text.includes('next')) {
              nextButton = btn;
              break;
            }
          }
          
          if (nextButton && nextButton.onclick) {
            try {
              nextButton.click();
              return { success: true };
            } catch (error) {
              return { success: false, error: error.message };
            }
          }
          
          return { success: false, reason: 'no_button' };
        });
        
        if (!nextPageResult.success) {
          console.log(`    📝 最終ページ ${pageNum} で終了`);
          break;
        }
        
        await this.sleep(1000);
        pageNum++;
      }
      
      const uniqueLinks = Array.from(
        new Map(allCampaignLinks.map(link => [link.url, link])).values()
      );
      
      console.log(`📊 ${categoryName}: ${uniqueLinks.length}件の案件を詳細取得開始`);
      
      // 詳細データ取得
      for (let i = 0; i < uniqueLinks.length; i++) {
        const campaign = uniqueLinks[i];
        
        try {
          const detailData = await this.scrapeCampaignDetail(campaign.url);
          if (detailData && detailData.title !== 'タイトル取得失敗') {
            let device = 'すべて';
            const title = detailData.title.toLowerCase();
            
            if (title.includes('ios用') || title.includes('iphone') || title.includes('ipad') || title.includes('app store')) {
              device = 'iOS';
            } else if (title.includes('android用') || title.includes('google play') || title.includes('アンドロイド')) {
              device = 'Android';
            } else if (title.includes('pcのみ') || title.includes('pc限定') || title.includes('パソコン限定')) {
              device = 'PC';
            }
            
            results.push({
              ...detailData,
              category: categoryName,
              categoryType: type,
              device: device
            });
            
            console.log(`✅ [${i + 1}/${uniqueLinks.length}] ${detailData.title} - ${detailData.cashback || detailData.cashbackYen || '不明'}`);
          } else {
            console.log(`⚠️ [${i + 1}/${uniqueLinks.length}] データ取得失敗: ${campaign.url}`);
          }
        } catch (error) {
          console.error(`❌ [${i + 1}/${uniqueLinks.length}] 詳細エラー: ${campaign.url} - ${error.message}`);
        }
        
        await this.sleep(this.rateLimitMs);
      }
      
      console.log(`✅ ${categoryName}: ${results.length}件の案件取得完了`);
      return results;
      
    } finally {
      await page.close();
    }
  }

  async scrapeCampaignDetail(url) {
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
          scrapedAt: new Date().toISOString()
        };
      });
      
      // URL情報を追加
      const urlParts = url.split('/');
      const adId = urlParts[urlParts.length - 2] || urlParts[urlParts.length - 1];
      
      return {
        id: `pi_${adId}`,
        url: url,
        campaignUrl: url,
        displayName: detailData.title,
        ...detailData
      };
      
    } finally {
      await page.close();
    }
  }

  async saveResults(results, filename) {
    const data = {
      siteName: 'ポイントインカム',
      scrapingType: 'single-category-test',
      scrapedAt: new Date().toISOString(),
      summary: {
        total_campaigns: results.length,
        rate_limit_ms: this.rateLimitMs
      },
      campaigns: results
    };

    await fs.writeFile(filename, JSON.stringify(data, null, 2), 'utf8');
    console.log(`💾 データ保存完了: ${filename} (${results.length}件)`);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('🔒 ブラウザクローズ完了');
    }
  }
}

// 実行
(async () => {
  const scraper = new SingleCategoryScraper();
  await scraper.init();
  
  try {
    // 軽量カテゴリでテスト
    const results = await scraper.scrapeCategory('衛生用品', 147, 'group');
    await scraper.saveResults(results, 'single_category_test.json');
    
  } finally {
    await scraper.close();
  }
})();