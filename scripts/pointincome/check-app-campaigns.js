const puppeteer = require('puppeteer');

class CheckAppCampaigns {
  constructor() {
    this.baseUrl = 'https://sp.pointi.jp/list.php?cat_no=68';
    this.browser = null;
  }

  async init() {
    console.log('🔍 ポイントインカム アプリ案件確認');
    console.log(`📱 URL: ${this.baseUrl}`);
    console.log('='.repeat(60));
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async checkWithUserAgent(userAgent, deviceType) {
    console.log(`\n🔍 ${deviceType} UserAgentでチェック`);
    
    const page = await this.browser.newPage();
    
    // モバイルビューポート設定
    await page.setViewport({ 
      width: 375, 
      height: 812,
      isMobile: true,
      hasTouch: true
    });
    
    await page.setUserAgent(userAgent);
    
    try {
      console.log('📄 ページアクセス中...');
      await page.goto(this.baseUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      await this.sleep(2000);
      
      // ページタイトル確認
      const title = await page.title();
      console.log(`📌 ページタイトル: ${title}`);
      
      // アプリ案件を抽出
      const campaigns = await page.evaluate(() => {
        const results = [];
        
        // 案件リンクを探す（複数のセレクタパターンを試す）
        const patterns = [
          'a[href*="/ad/"]',
          'a[href*="ad_id="]',
          '.campaign-item a',
          '.offer-item a',
          'li a[href*="pointi.jp"]'
        ];
        
        let links = [];
        for (const pattern of patterns) {
          const found = document.querySelectorAll(pattern);
          if (found.length > 0) {
            links = found;
            break;
          }
        }
        
        links.forEach((link, index) => {
          if (index < 10) { // 最初の10件
            const container = link.closest('li, div, article');
            const campaign = {
              url: link.href,
              title: '',
              cashback: '',
              osInfo: ''
            };
            
            // タイトル取得
            if (container) {
              // タイトル要素を探す
              const titleEl = container.querySelector('h3, h4, .title, .campaign-name') || link;
              campaign.title = titleEl.textContent.trim();
              
              // 還元率取得
              const text = container.textContent;
              const ptMatch = text.match(/(\d{1,3}(?:,\d{3})*)\s*pt/);
              const percentMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
              
              if (ptMatch) campaign.cashback = ptMatch[0];
              else if (percentMatch) campaign.cashback = percentMatch[0];
              
              // OS情報判定
              const lowerText = text.toLowerCase();
              if (lowerText.includes('ios') || lowerText.includes('iphone')) {
                campaign.osInfo = 'iOS';
              } else if (lowerText.includes('android')) {
                campaign.osInfo = 'Android';
              } else if (text.includes('両OS') || text.includes('iOS/Android')) {
                campaign.osInfo = '両OS対応';
              }
            } else {
              campaign.title = link.textContent.trim();
            }
            
            results.push(campaign);
          }
        });
        
        // ページ内のテキストから案件数を推定
        const pageText = document.body.textContent;
        const hasIOS = pageText.includes('iOS') || pageText.includes('iPhone');
        const hasAndroid = pageText.includes('Android');
        
        return {
          campaigns: results,
          totalLinks: links.length,
          pageInfo: {
            hasIOS,
            hasAndroid,
            url: window.location.href
          }
        };
      });
      
      console.log(`\n📊 検出結果:`);
      console.log(`  - 案件リンク総数: ${campaigns.totalLinks}件`);
      console.log(`  - iOS案件検出: ${campaigns.pageInfo.hasIOS ? '✅' : '❌'}`);
      console.log(`  - Android案件検出: ${campaigns.pageInfo.hasAndroid ? '✅' : '❌'}`);
      console.log(`  - 実際のURL: ${campaigns.pageInfo.url}`);
      
      if (campaigns.campaigns.length > 0) {
        console.log(`\n📱 取得できた案件データ (最初の5件):`);
        campaigns.campaigns.slice(0, 5).forEach((campaign, i) => {
          console.log(`\n${i + 1}. ${campaign.title || '(タイトル未取得)'}`);
          console.log(`   URL: ${campaign.url}`);
          console.log(`   還元: ${campaign.cashback || '不明'}`);
          console.log(`   OS: ${campaign.osInfo || '不明'}`);
        });
      } else {
        console.log('\n⚠️ 案件データを取得できませんでした');
        
        // ページ構造を確認
        const pageStructure = await page.evaluate(() => {
          return {
            bodyText: document.body.textContent.substring(0, 500),
            linkCount: document.querySelectorAll('a').length,
            imgCount: document.querySelectorAll('img').length
          };
        });
        
        console.log('\n🔍 ページ構造の確認:');
        console.log(`  - リンク数: ${pageStructure.linkCount}`);
        console.log(`  - 画像数: ${pageStructure.imgCount}`);
        console.log(`  - ページ内容の一部:\n${pageStructure.bodyText}`);
      }
      
    } catch (error) {
      console.error(`❌ エラー: ${error.message}`);
    } finally {
      await page.close();
    }
  }

  async run() {
    try {
      await this.init();
      
      // iOS UserAgentでチェック
      const iosUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
      await this.checkWithUserAgent(iosUA, 'iOS');
      
      // Android UserAgentでチェック
      const androidUA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36';
      await this.checkWithUserAgent(androidUA, 'Android');
      
    } catch (error) {
      console.error('❌ 致命的エラー:', error);
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

// 実行
(async () => {
  const checker = new CheckAppCampaigns();
  await checker.run();
})();