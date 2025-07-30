const puppeteer = require('puppeteer');
const fs = require('fs').promises;

/**
 * Android案件クイック取得スクレイパー
 * Android UAでアクセスし、Android専用案件を高速で取得
 */
class QuickAndroidScraper {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.listingUrl = 'https://www.chobirich.com/smartphone?sort=point';
    this.androidUserAgent = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36';
    this.results = [];
    this.browser = null;
  }

  async initBrowser() {
    console.log('🤖 Android環境ブラウザ初期化中...');
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }

  async setupPage() {
    const page = await this.browser.newPage();
    await page.setUserAgent(this.androidUserAgent);
    await page.setViewport({ width: 412, height: 915, isMobile: true });
    
    // リソース最適化
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    return page;
  }

  async extractAndroidCampaigns() {
    console.log('📱 Android専用案件の抽出開始（最初の5ページ）');
    
    for (let pageNum = 1; pageNum <= 5; pageNum++) {
      console.log(`\\n📄 ページ ${pageNum} 処理中...`);
      
      const page = await this.setupPage();
      
      try {
        const url = pageNum === 1 
          ? this.listingUrl 
          : `${this.listingUrl}&page=${pageNum}`;
        
        const response = await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        });
        
        if (response.status() !== 200) {
          console.log(`❌ ページ ${pageNum}: ステータス ${response.status()}`);
          continue;
        }

        // ページ内のAndroid案件を抽出
        const campaigns = await page.evaluate(() => {
          const campaignLinks = document.querySelectorAll('a[href*="/ad_details/"]');
          const results = [];
          
          campaignLinks.forEach(link => {
            const href = link.href;
            const container = link.closest('div, li, article, section, tr');
            
            if (container) {
              const textContent = container.textContent || '';
              const titleElement = link.querySelector('h3, .title, strong') || link;
              const title = titleElement.textContent?.trim() || '';
              
              // Android案件の判定
              const isAndroid = title.toLowerCase().includes('android') || 
                               textContent.toLowerCase().includes('android') ||
                               textContent.includes('Google Play');
              
              if (isAndroid) {
                const idMatch = href.match(/\/ad_details\/(?:redirect\/)?(\d+)/);
                if (idMatch) {
                  // ポイント抽出
                  let cashback = '';
                  const pointMatch = textContent.match(/(\d+(?:,\d{3})*)\s*(?:pt|ポイント)/i);
                  if (pointMatch) {
                    cashback = pointMatch[1] + 'pt';
                  }
                  
                  results.push({
                    id: idMatch[1],
                    name: title,
                    url: href.replace('/redirect/', '/'),
                    cashback: cashback,
                    device: 'android'
                  });
                }
              }
            }
          });
          
          return results;
        });

        console.log(`✅ ${campaigns.length}件のAndroid案件を発見`);
        this.results.push(...campaigns);
        
      } catch (error) {
        console.error(`❌ ページ ${pageNum} エラー: ${error.message}`);
      } finally {
        await page.close();
      }
      
      // ページ間で少し待機
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  async saveResults() {
    const output = {
      scrape_date: new Date().toISOString(),
      strategy: 'quick_android_scraper',
      environment: 'android',
      total_android_campaigns: this.results.length,
      campaigns: this.results
    };

    await fs.writeFile(
      'chobirich_quick_android_campaigns.json',
      JSON.stringify(output, null, 2)
    );

    console.log(`\\n💾 結果を chobirich_quick_android_campaigns.json に保存`);
  }

  async run() {
    console.log('🚀 Android案件クイック取得開始\\n');
    
    try {
      await this.initBrowser();
      await this.extractAndroidCampaigns();
      await this.saveResults();
      
      console.log('\\n📊 最終結果:');
      console.log(`Android専用案件: ${this.results.length}件`);
      
      if (this.results.length > 0) {
        console.log('\\n🤖 Android案件サンプル:');
        this.results.slice(0, 5).forEach((campaign, i) => {
          console.log(`${i + 1}. [${campaign.id}] ${campaign.name} (${campaign.cashback})`);
        });
      }
      
    } catch (error) {
      console.error('💥 エラー:', error);
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

// 実行
(async () => {
  const scraper = new QuickAndroidScraper();
  await scraper.run();
})();