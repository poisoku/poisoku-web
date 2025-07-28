const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class PointIncomeAppScraper {
  constructor() {
    this.baseUrl = 'https://sp.pointi.jp/list.php?cat_no=68';
    this.browser = null;
    this.allAppCampaigns = [];
    
    // 設定
    this.rateLimitMs = 2000; // 2秒間隔
    this.pageTimeoutMs = 30000;
    this.maxRetries = 3;
    
    // 出力ファイル
    this.outputFile = 'pointincome_app_campaigns.json';
  }

  async init() {
    console.log('📱 ポイントインカム アプリ案件スクレイピング開始');
    console.log(`🎯 対象URL: ${this.baseUrl}`);
    console.log('⚙️ 取得項目: 案件タイトル、URL、還元、デバイス（iOS/Android）');
    console.log('='.repeat(70));
    
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

  async setupPage() {
    const page = await this.browser.newPage();
    
    // モバイルビューポート設定
    await page.setViewport({ 
      width: 375, 
      height: 812,
      isMobile: true,
      hasTouch: true
    });
    
    // iOS UserAgent（安定性重視）
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
    
    return page;
  }

  detectDeviceFromTitle(title) {
    const lowerTitle = title.toLowerCase();
    
    if (lowerTitle.includes('ios') || lowerTitle.includes('iphone')) {
      return 'iOS';
    } else if (lowerTitle.includes('android')) {
      return 'Android';
    } else {
      return 'both'; // 両OS対応
    }
  }

  createCampaignData(rawCampaign) {
    const device = this.detectDeviceFromTitle(rawCampaign.title);
    const campaigns = [];
    
    if (device === 'both') {
      // 両OS対応の場合、iOS・Android別々に作成
      campaigns.push({
        id: rawCampaign.id + '_ios',
        title: rawCampaign.title,
        url: rawCampaign.url,
        cashback: rawCampaign.cashback,
        device: 'iOS',
        originalTitle: rawCampaign.title,
        scrapedAt: new Date().toISOString()
      });
      
      campaigns.push({
        id: rawCampaign.id + '_android',
        title: rawCampaign.title,
        url: rawCampaign.url,
        cashback: rawCampaign.cashback,
        device: 'Android',
        originalTitle: rawCampaign.title,
        scrapedAt: new Date().toISOString()
      });
    } else {
      // iOS・Android専用の場合
      campaigns.push({
        id: rawCampaign.id,
        title: rawCampaign.title,
        url: rawCampaign.url,
        cashback: rawCampaign.cashback,
        device: device,
        originalTitle: rawCampaign.title,
        scrapedAt: new Date().toISOString()
      });
    }
    
    return campaigns;
  }

  async scrapeAllPages() {
    const page = await this.setupPage();
    let pageNum = 1;
    let totalCampaigns = 0;
    
    try {
      while (pageNum <= 50) { // 最大50ページ
        console.log(`\n📄 ページ ${pageNum} を処理中...`);
        
        const pageUrl = pageNum === 1 ? this.baseUrl : `${this.baseUrl}&page=${pageNum}`;
        
        await page.goto(pageUrl, { 
          waitUntil: 'networkidle2',
          timeout: this.pageTimeoutMs 
        });
        
        await this.sleep(1000);
        
        // ページからアプリ案件を抽出
        const pageCampaigns = await page.evaluate(() => {
          const results = [];
          
          // アプリ案件のリンクを探す
          const links = document.querySelectorAll('a[href*="/ad/"]');
          
          links.forEach(link => {
            const container = link.closest('li, div, article, tr');
            
            if (container) {
              const campaign = {
                url: link.href,
                title: '',
                cashback: '',
                id: ''
              };
              
              // ID抽出
              const urlMatch = link.href.match(/\/ad\/(\d+)\//);
              if (urlMatch) {
                campaign.id = `pi_app_${urlMatch[1]}`;
              }
              
              // タイトル取得
              const titleEl = container.querySelector('h3, h4, .title, .campaign-name') || link;
              campaign.title = titleEl.textContent.trim();
              
              // 還元率取得（改良版）
              const text = container.textContent;
              
              // ポイント表記を優先
              const ptMatch = text.match(/(\d{1,3}(?:,\d{3})*)\s*pt/);
              if (ptMatch) {
                campaign.cashback = ptMatch[0];
              } else {
                // パーセント表記
                const percentMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
                if (percentMatch) {
                  campaign.cashback = percentMatch[0];
                }
              }
              
              // 有効な案件のみ追加
              if (campaign.title && campaign.url && campaign.id) {
                results.push(campaign);
              }
            }
          });
          
          return results;
        });
        
        if (pageCampaigns.length === 0) {
          console.log(`    ⚠️ アプリ案件が見つかりません - スクレイピング終了`);
          break;
        }
        
        // デバイス判定とデータ作成
        for (const rawCampaign of pageCampaigns) {
          const campaigns = this.createCampaignData(rawCampaign);
          this.allAppCampaigns.push(...campaigns);
          totalCampaigns += campaigns.length;
        }
        
        console.log(`    ✅ ${pageCampaigns.length}件発見、${pageCampaigns.reduce((sum, c) => sum + this.createCampaignData(c).length, 0)}件作成（累計: ${totalCampaigns}件）`);
        
        // デバイス判定結果の表示
        if (pageCampaigns.length > 0) {
          console.log(`    📊 デバイス判定例:`);
          pageCampaigns.slice(0, 3).forEach(campaign => {
            const device = this.detectDeviceFromTitle(campaign.title);
            const count = this.createCampaignData(campaign).length;
            console.log(`      "${campaign.title}" → ${device} (${count}件)`);
          });
        }
        
        // 次ページへ
        const hasNextPage = await page.evaluate(() => {
          const nextLinks = document.querySelectorAll('a');
          for (const link of nextLinks) {
            if (link.textContent.includes('次へ') || link.textContent === '>') {
              return true;
            }
          }
          return false;
        });
        
        if (!hasNextPage) {
          console.log(`    📄 最終ページに到達`);
          break;
        }
        
        await this.sleep(this.rateLimitMs);
        pageNum++;
      }
      
    } finally {
      await page.close();
    }
    
    return totalCampaigns;
  }

  async saveResults() {
    // 重複除去（URLベース）
    const uniqueCampaigns = [];
    const seenUrls = new Set();
    
    for (const campaign of this.allAppCampaigns) {
      const key = `${campaign.url}_${campaign.device}`;
      if (!seenUrls.has(key)) {
        seenUrls.add(key);
        uniqueCampaigns.push(campaign);
      }
    }
    
    console.log(`\n🔄 重複除去: ${this.allAppCampaigns.length}件 → ${uniqueCampaigns.length}件`);
    
    // デバイス別統計
    const deviceStats = {
      iOS: uniqueCampaigns.filter(c => c.device === 'iOS').length,
      Android: uniqueCampaigns.filter(c => c.device === 'Android').length
    };
    
    const outputData = {
      siteName: 'ポイントインカム',
      scrapingType: 'mobile-app-campaigns',
      scrapedAt: new Date().toISOString(),
      sourceUrl: this.baseUrl,
      summary: {
        totalCampaigns: uniqueCampaigns.length,
        deviceBreakdown: deviceStats,
        duplicatesRemoved: this.allAppCampaigns.length - uniqueCampaigns.length
      },
      campaigns: uniqueCampaigns
    };
    
    await fs.writeFile(this.outputFile, JSON.stringify(outputData, null, 2));
    
    console.log(`\n💾 結果保存: ${this.outputFile}`);
    console.log(`📊 最終統計:`);
    console.log(`  - 総アプリ案件: ${uniqueCampaigns.length}件`);
    console.log(`  - iOS案件: ${deviceStats.iOS}件`);
    console.log(`  - Android案件: ${deviceStats.Android}件`);
    console.log(`  - 重複除去: ${this.allAppCampaigns.length - uniqueCampaigns.length}件`);
    
    return uniqueCampaigns;
  }

  async run() {
    try {
      await this.init();
      
      console.log('\n🔍 アプリ案件の取得開始...');
      const totalCampaigns = await this.scrapeAllPages();
      
      console.log('\n📊 データ処理中...');
      const finalCampaigns = await this.saveResults();
      
      console.log('\n' + '='.repeat(70));
      console.log('🎉 ポイントインカム アプリ案件スクレイピング完了！');
      console.log(`📱 取得案件数: ${finalCampaigns.length}件`);
      console.log(`📁 出力ファイル: ${this.outputFile}`);
      
      // サンプルデータ表示
      if (finalCampaigns.length > 0) {
        console.log('\n📋 取得例（最初の5件）:');
        finalCampaigns.slice(0, 5).forEach((campaign, i) => {
          console.log(`\n${i + 1}. ${campaign.title}`);
          console.log(`   URL: ${campaign.url}`);
          console.log(`   還元: ${campaign.cashback || '不明'}`);
          console.log(`   デバイス: ${campaign.device}`);
        });
      }
      
    } catch (error) {
      console.error('❌ エラー:', error);
      throw error;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

// 実行
if (require.main === module) {
  (async () => {
    const scraper = new PointIncomeAppScraper();
    await scraper.run();
  })();
}

module.exports = PointIncomeAppScraper;