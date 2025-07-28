const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class PointIncomeAppPCScraper {
  constructor() {
    this.baseUrl = 'https://pointi.jp/list.php?category=68';
    this.browser = null;
    this.allAppCampaigns = [];
    
    // 設定
    this.rateLimitMs = 2000; // 2秒間隔
    this.pageTimeoutMs = 30000;
    this.maxRetries = 3;
    
    // 出力ファイル
    this.outputFile = 'pointincome_app_campaigns_pc.json';
  }

  async init() {
    console.log('📱 ポイントインカム アプリ案件PC版スクレイピング開始');
    console.log(`🎯 対象URL: ${this.baseUrl}`);
    console.log('⚙️ 取得項目: 案件タイトル、URL、還元、デバイス（iOS/Android）');
    console.log('🖥️ PC版ページから全案件を取得');
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
    
    // PC用ビューポート設定
    await page.setViewport({ 
      width: 1280, 
      height: 800
    });
    
    // PC UserAgent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
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
      while (pageNum <= 100) { // 最大100ページ
        console.log(`\n📄 ページ ${pageNum} を処理中...`);
        
        const pageUrl = pageNum === 1 ? this.baseUrl : `${this.baseUrl}&page=${pageNum}`;
        
        await page.goto(pageUrl, { 
          waitUntil: 'networkidle2',
          timeout: this.pageTimeoutMs 
        });
        
        await this.sleep(2000);
        
        // ページからアプリ案件を抽出
        const pageCampaigns = await page.evaluate(() => {
          const results = [];
          
          // PC版のアプリ案件セレクタパターンを試行
          const selectorPatterns = [
            'a[href*="/ad/"]',
            'a[href*="ad_details"]',
            '.campaign-item a',
            '.offer-list a',
            'tr a[href*="/ad/"]',
            'li a[href*="/ad/"]'
          ];
          
          let links = [];
          for (const pattern of selectorPatterns) {
            const found = document.querySelectorAll(pattern);
            if (found.length > 0) {
              links = Array.from(found);
              console.log(`Using pattern: ${pattern}, found: ${found.length} links`);
              break;
            }
          }
          
          if (links.length === 0) {
            // フォールバック: 全てのリンクから ad を含むものを探す
            const allLinks = document.querySelectorAll('a[href]');
            links = Array.from(allLinks).filter(link => 
              link.href.includes('/ad/') || link.href.includes('ad_details')
            );
          }
          
          links.forEach(link => {
            const container = link.closest('tr, li, div, article');
            
            if (container) {
              const campaign = {
                url: link.href,
                title: '',
                cashback: '',
                id: ''
              };
              
              // ID抽出（複数パターン対応）
              let urlMatch = link.href.match(/\/ad\/(\d+)\//);
              if (!urlMatch) {
                urlMatch = link.href.match(/ad_details\/(\d+)/);
              }
              if (!urlMatch) {
                urlMatch = link.href.match(/ad_id=(\d+)/);
              }
              
              if (urlMatch) {
                campaign.id = `pi_app_${urlMatch[1]}`;
              }
              
              // タイトル取得（複数の方法で試行）
              let titleEl = container.querySelector('h3, h4, .title, .campaign-name, .offer-title');
              if (!titleEl) {
                titleEl = link.querySelector('img[alt]');
                if (titleEl) {
                  campaign.title = titleEl.alt.trim();
                }
              }
              if (!titleEl) {
                titleEl = link;
              }
              
              if (!campaign.title) {
                campaign.title = titleEl.textContent.trim();
              }
              
              // 還元率取得（PC版用パターン）
              const text = container.textContent;
              
              // ポイント表記を優先（カンマ区切り対応）
              const ptMatch = text.match(/(\d{1,3}(?:,\d{3})*)\s*(?:pt|ポイント|point)/i);
              if (ptMatch) {
                campaign.cashback = ptMatch[1] + 'pt';
              } else {
                // パーセント表記
                const percentMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
                if (percentMatch) {
                  campaign.cashback = percentMatch[0];
                } else {
                  // 円表記
                  const yenMatch = text.match(/(\d{1,3}(?:,\d{3})*)\s*円/);
                  if (yenMatch) {
                    campaign.cashback = yenMatch[0];
                  }
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
        
        // 次ページ存在確認
        const hasNextPage = await page.evaluate(() => {
          // PC版の次ページリンクパターン
          const nextPatterns = [
            'a[href*="page=' + (window.location.href.match(/page=(\d+)/) ? 
              (parseInt(window.location.href.match(/page=(\d+)/)[1]) + 1) : 2) + '"]',
            'a:contains("次へ")',
            'a:contains(">")',
            '.pagination a:contains(">")',
            '.page-next',
            'a[href*="&page="]'
          ];
          
          // 現在のページ番号を取得
          const currentPageMatch = window.location.href.match(/page=(\d+)/);
          const currentPage = currentPageMatch ? parseInt(currentPageMatch[1]) : 1;
          const nextPage = currentPage + 1;
          
          // 次ページのリンクを探す
          const allLinks = document.querySelectorAll('a[href]');
          for (const link of allLinks) {
            if (link.href.includes(`page=${nextPage}`) || 
                link.textContent.includes('次へ') ||
                (link.textContent.trim() === '>' && link.href.includes('page='))) {
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
      scrapingType: 'pc-app-campaigns',
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
      
      console.log('\n🔍 PC版アプリ案件の取得開始...');
      const totalCampaigns = await this.scrapeAllPages();
      
      console.log('\n📊 データ処理中...');
      const finalCampaigns = await this.saveResults();
      
      console.log('\n' + '='.repeat(70));
      console.log('🎉 ポイントインカム PC版アプリ案件スクレイピング完了！');
      console.log(`📱 取得案件数: ${finalCampaigns.length}件`);
      console.log(`📁 出力ファイル: ${this.outputFile}`);
      
      // サンプルデータ表示
      if (finalCampaigns.length > 0) {
        console.log('\n📋 取得例（最初の10件）:');
        finalCampaigns.slice(0, 10).forEach((campaign, i) => {
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
    const scraper = new PointIncomeAppPCScraper();
    await scraper.run();
  })();
}

module.exports = PointIncomeAppPCScraper;