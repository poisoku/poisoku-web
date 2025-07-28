const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class PointIncomeMobileAppScraper {
  constructor() {
    this.baseUrl = 'https://sp.pointi.jp';
    this.results = [];
    this.browser = null;
    this.processedUrls = new Set();
    this.rateLimitMs = 2500;
    this.maxScrollAttempts = 15;
    
    // モバイルアプリ案件URL
    this.appUrl = 'https://sp.pointi.jp/list.php?rf=1&n=1';
  }

  async init() {
    console.log('📱 ポイントインカム モバイルアプリ案件スクレイピング開始');
    console.log(`📋 スクロール読み込みで全案件を取得予定\n`);
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      defaultViewport: { width: 375, height: 812 } // iPhone X サイズ
    });
  }

  async setupPage() {
    const page = await this.browser.newPage();
    
    // リソース制限
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['image', 'font', 'stylesheet', 'media'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // モバイルUser-Agent設定
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1');
    page.setDefaultTimeout(45000);
    
    return page;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  extractCashbackFromYen(yenText) {
    if (!yenText) return null;
    const match = yenText.match(/[(（](\d{1,3}(?:,\d{3})*(?:\.\d+)?)円分[)）]/);
    if (match) {
      return match[1].replace(/,/g, '') + '円';
    }
    return null;
  }

  async scrapeAppList() {
    const page = await this.setupPage();
    console.log(`📱 モバイルアプリ案件の処理開始`);
    
    try {
      console.log(`🌐 URL: ${this.appUrl}`);
      await page.goto(this.appUrl, { waitUntil: 'networkidle2', timeout: this.pageTimeoutMs });
      await this.sleep(3000);
      
      // スクロール読み込みで全案件を取得
      let previousCount = 0;
      let currentCount = 0;
      let scrollAttempts = 0;
      
      console.log('📊 スクロール読み込み開始...');
      
      while (scrollAttempts < this.maxScrollAttempts) {
        // 現在の案件数を取得
        currentCount = await page.evaluate(() => {
          const campaigns = document.querySelectorAll('a[href*="/ad/"]');
          return campaigns.length;
        });
        
        console.log(`  📄 スクロール ${scrollAttempts + 1}: ${currentCount}件の案件`);
        
        // 案件数が変わらない場合は終了
        if (scrollAttempts > 0 && currentCount === previousCount) {
          console.log('  ⚠️ 新しい案件が読み込まれなくなりました - 終了');
          break;
        }
        
        previousCount = currentCount;
        
        // ページの最下部までスクロール
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        
        // 読み込み待機
        await this.sleep(3000);
        
        // 「もっと見る」ボタンがあるかチェック
        const loadMoreButton = await page.$('button[onclick*="more"], .load-more, .btn-more, [data-action="load-more"]');
        if (loadMoreButton) {
          console.log('  🔄 「もっと見る」ボタンをクリック...');
          await loadMoreButton.click();
          await this.sleep(3000);
        }
        
        scrollAttempts++;
      }
      
      // 最終的な案件リストを取得
      const allCampaignLinks = await page.evaluate(() => {
        const campaigns = [];
        const campaignElements = document.querySelectorAll('a[href*="/ad/"]');
        
        campaignElements.forEach(element => {
          const campaign = {
            url: element.href,
            title: ''
          };
          
          // タイトル取得
          const titleElement = element.querySelector('img') || element;
          campaign.title = titleElement.alt || titleElement.textContent || '';
          
          if (campaign.title && campaign.url) {
            campaigns.push(campaign);
          }
        });
        
        return campaigns;
      });
      
      // 重複除去
      const uniqueLinks = Array.from(
        new Map(allCampaignLinks.map(link => [link.url, link])).values()
      );
      
      console.log(`📊 モバイルアプリ案件: ${uniqueLinks.length}件の案件を詳細取得開始`);
      
      // 詳細ページ処理
      for (let i = 0; i < uniqueLinks.length; i++) {
        const campaign = uniqueLinks[i];
        
        if (this.processedUrls.has(campaign.url)) {
          continue;
        }
        
        try {
          const detailData = await this.scrapeCampaignDetail(campaign.url);
          if (detailData) {
            // デバイス分類ルール適用
            let device = 'すべて'; // デフォルト
            const title = detailData.title.toLowerCase();
            
            if (title.includes('ios用') || title.includes('iphone') || title.includes('ipad') || title.includes('app store')) {
              device = 'iOS';
            } else if (title.includes('android用') || title.includes('google play') || title.includes('アンドロイド')) {
              device = 'Android';
            } else if (title.includes('pcのみ') || title.includes('pc限定') || title.includes('パソコン限定')) {
              device = 'PC';
            }
            
            this.results.push({
              ...detailData,
              category: 'モバイルアプリ',
              categoryType: 'app',
              device: device
            });
            this.processedUrls.add(campaign.url);
            
            console.log(`✅ [${i + 1}/${uniqueLinks.length}] [${device}] ${detailData.title} - ${detailData.cashback || detailData.cashbackYen || '不明'}`);
          }
        } catch (error) {
          console.error(`❌ [${i + 1}/${uniqueLinks.length}] 詳細エラー: ${campaign.url}`);
        }
        
        await this.sleep(this.rateLimitMs);
      }
      
      return uniqueLinks.length;
      
    } catch (error) {
      console.error(`❌ モバイルアプリ処理エラー:`, error);
      throw error;
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
      
      await this.sleep(1000);
      
      const detailData = await page.evaluate(() => {
        const data = {
          title: '',
          percentText: '',
          yenText: '',
          conditions: ''
        };
        
        const titleEl = document.querySelector('h2');
        if (titleEl) {
          data.title = titleEl.textContent.trim();
        }
        
        const percentEl = document.querySelector('.ad_pt.red.bold');
        if (percentEl) {
          data.percentText = percentEl.textContent.trim();
        }
        
        const yenEl = document.querySelector('.pt_yen.bold');
        if (yenEl) {
          data.yenText = yenEl.textContent.trim();
        }
        
        const conditionEl = document.querySelector('.box_point_joken');
        if (conditionEl) {
          data.conditions = conditionEl.textContent.trim().substring(0, 500);
        }
        
        return data;
      });
      
      const idMatch = url.match(/\/ad\/(\d+)/);
      const id = idMatch ? `pi_${idMatch[1]}` : `pi_${Date.now()}`;
      
      let cashback = null;
      let cashbackYen = null;
      
      if (detailData.percentText && detailData.percentText.match(/\d+(?:\.\d+)?%/)) {
        cashback = detailData.percentText;
      }
      
      if (detailData.yenText) {
        cashbackYen = this.extractCashbackFromYen(detailData.yenText);
      }
      
      if (!detailData.title || (!cashback && !cashbackYen)) {
        return null;
      }
      
      return {
        id: id,
        title: detailData.title,
        description: detailData.title,
        displayName: detailData.title,
        url: url,
        campaignUrl: url,
        pointSiteUrl: 'https://pointi.jp',
        cashback: cashback,
        cashbackYen: cashbackYen,
        conditions: detailData.conditions,
        lastUpdated: new Date().toLocaleString('ja-JP'),
        siteName: 'ポイントインカム',
        searchKeywords: detailData.title.toLowerCase(),
        searchWeight: 1
      };
      
    } catch (error) {
      throw new Error(`詳細ページ取得失敗: ${error.message}`);
    } finally {
      await page.close();
    }
  }

  async saveResults() {
    const data = {
      siteName: 'ポイントインカム',
      scrapingType: 'mobile-app',
      scrapedAt: new Date().toISOString(),
      summary: {
        total_campaigns: this.results.length,
        device_breakdown: this.getDeviceBreakdown()
      },
      campaigns: this.results
    };

    await fs.writeFile(
      'pointincome_mobile_app.json',
      JSON.stringify(data, null, 2),
      'utf8'
    );

    console.log(`\n💾 データ保存完了: pointincome_mobile_app.json`);
  }

  getDeviceBreakdown() {
    const breakdown = { iOS: 0, Android: 0, PC: 0, すべて: 0 };
    this.results.forEach(campaign => {
      breakdown[campaign.device]++;
    });
    return breakdown;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async run() {
    const startTime = Date.now();
    
    try {
      await this.init();
      
      const totalCampaigns = await this.scrapeAppList();
      
      // 最終保存
      await this.saveResults();
      
      const endTime = Date.now();
      const durationMinutes = Math.round((endTime - startTime) / 60000);
      
      const deviceBreakdown = this.getDeviceBreakdown();
      
      console.log('\n🎉 モバイルアプリ案件スクレイピング完了！');
      console.log(`📊 総案件数: ${this.results.length}件`);
      console.log(`📱 デバイス別内訳:`);
      console.log(`  iOS: ${deviceBreakdown.iOS}件`);
      console.log(`  Android: ${deviceBreakdown.Android}件`);
      console.log(`  PC: ${deviceBreakdown.PC}件`);
      console.log(`  すべて: ${deviceBreakdown.すべて}件`);
      console.log(`⏱️ 実行時間: ${durationMinutes}分`);
      
    } catch (error) {
      console.error('❌ 致命的エラー:', error);
    } finally {
      await this.close();
    }
  }
}

// 実行
(async () => {
  const scraper = new PointIncomeMobileAppScraper();
  await scraper.run();
})();