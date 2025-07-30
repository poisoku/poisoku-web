const puppeteer = require('puppeteer');
const fs = require('fs').promises;

/**
 * Android案件専用の拡張スクレイパー
 * 指定案件（1840652）を含む、より広範囲のAndroid案件を取得
 */
class ExtendedAndroidScraper {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.results = [];
    this.browser = null;
    this.errors = [];
    
    // iOS ユーザーエージェント（403回避）
    this.iosUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
    
    this.targetId = '1840652';
    this.outputFile = 'extended_android_campaigns.json';
  }

  async randomDelay(minSeconds, maxSeconds) {
    const delay = Math.random() * (maxSeconds - minSeconds) + minSeconds;
    console.log(`⏳ ${delay.toFixed(1)}秒待機中...`);
    await new Promise(resolve => setTimeout(resolve, delay * 1000));
  }

  async initBrowser() {
    console.log('🚀 ブラウザ初期化中...');
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
    
    console.log('✅ ブラウザ初期化完了');
  }

  async setupPage() {
    const page = await this.browser.newPage();
    
    page.setDefaultTimeout(25000);
    await page.setUserAgent(this.iosUserAgent);
    
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ja-JP,ja;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache'
    });
    
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

  // アプリページの拡張スクレイピング（50ページまで）
  async scrapeExtendedAppPages() {
    console.log('\n📱 アプリページ拡張スクレイピング開始（50ページ）');
    console.log('='.repeat(60));
    
    const campaigns = [];
    let targetFound = false;
    
    for (let pageNum = 1; pageNum <= 50; pageNum++) {
      const page = await this.setupPage();
      
      try {
        const url = pageNum === 1
          ? `${this.baseUrl}/smartphone?sort=point`
          : `${this.baseUrl}/smartphone?sort=point&page=${pageNum}`;
        
        console.log(`📄 ページ${pageNum}を処理中...`);
        
        const response = await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 25000 
        });
        
        if (response.status() !== 200) {
          console.log(`❌ HTTPステータス: ${response.status()}`);
          break;
        }
        
        await this.randomDelay(1, 2);
        
        const pageData = await page.evaluate((targetId) => {
          const campaignLinks = document.querySelectorAll('a[href*="/ad_details/"]');
          const campaigns = [];
          let targetFound = false;
          
          campaignLinks.forEach(link => {
            const href = link.href;
            
            let campaignId = null;
            const directMatch = href.match(/\/ad_details\/(\d+)/);
            const redirectMatch = href.match(/\/ad_details\/redirect\/(\d+)/);
            
            if (directMatch) {
              campaignId = directMatch[1];
            } else if (redirectMatch) {
              campaignId = redirectMatch[1];
            }
            
            if (campaignId) {
              // 指定案件の検出
              if (campaignId === targetId) {
                targetFound = true;
              }
              
              const container = link.closest('div, li, article, section, tr');
              let campaignName = '';
              let cashback = '';
              
              if (container) {
                const textContent = container.textContent || '';
                
                campaignName = link.textContent?.trim() || '';
                if (!campaignName) {
                  const nearbyText = container.textContent.split('\n')[0]?.trim();
                  if (nearbyText && nearbyText.length < 100) {
                    campaignName = nearbyText;
                  }
                }
                
                const pointMatch = textContent.match(/(\d+(?:,\d{3})*)\s*(?:pt|ポイント)/i);
                if (pointMatch) {
                  cashback = pointMatch[1] + 'pt';
                }
                
                if (!cashback) {
                  const percentMatch = textContent.match(/(\d+(?:\.\d+)?)\s*%/);
                  if (percentMatch) {
                    cashback = percentMatch[1] + '%';
                  }
                }
              }
              
              let device = 'all';
              if (campaignName.includes('iOS') || campaignName.includes('iPhone')) {
                device = 'ios';
              } else if (campaignName.includes('Android')) {
                device = 'android';
              }
              
              if (campaignName && campaignName.length > 2) {
                campaigns.push({
                  id: campaignId,
                  name: campaignName,
                  url: href,
                  cashback: cashback || '要確認',
                  category: 'アプリ',
                  device: device,
                  pageNumber: pageNum,
                  timestamp: new Date().toISOString(),
                  isTarget: campaignId === targetId
                });
              }
            }
          });
          
          return { campaigns, targetFound };
        }, this.targetId);
        
        if (pageData.targetFound) {
          console.log(`🎯 指定案件（${this.targetId}）を発見！ページ${pageNum}`);
          targetFound = true;
        }
        
        if (pageData.campaigns.length === 0) {
          console.log(`❌ 案件なし - 終了`);
          break;
        }
        
        const androidCampaigns = pageData.campaigns.filter(c => c.device === 'android');
        const allCampaigns = pageData.campaigns.filter(c => c.device === 'all');
        
        campaigns.push(...pageData.campaigns);
        
        console.log(`✅ ${pageData.campaigns.length}件取得（Android: ${androidCampaigns.length}, All: ${allCampaigns.length}）`);
        
        if (targetFound) {
          console.log(`🎉 指定案件を発見したため、詳細情報を記録`);
        }
        
      } catch (error) {
        console.log(`❌ エラー: ${error.message}`);
        this.errors.push({
          category: 'app',
          pageNum,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        break;
      } finally {
        await page.close();
      }
      
      await this.randomDelay(1, 2);
    }
    
    console.log(`\n✅ アプリページ拡張スクレイピング完了: ${campaigns.length}件`);
    return { campaigns, targetFound };
  }

  async run() {
    console.log('🔍 Android案件拡張スクレイピング開始\n');
    console.log(`🎯 特別検索対象: 案件ID ${this.targetId}`);
    console.log('='.repeat(80));
    
    const startTime = Date.now();
    
    try {
      await this.initBrowser();
      
      // アプリページの拡張スクレイピング実行
      const { campaigns, targetFound } = await this.scrapeExtendedAppPages();
      this.results.push(...campaigns);
      
      // Android案件の集計
      const androidCampaigns = campaigns.filter(c => c.device === 'android');
      const allDeviceCampaigns = campaigns.filter(c => c.device === 'all');
      const targetCampaigns = campaigns.filter(c => c.isTarget);
      
      // 結果保存
      const output = {
        scrape_date: new Date().toISOString(),
        scraper_type: 'extended_android',
        target_id: this.targetId,
        target_found: targetFound,
        total_campaigns: campaigns.length,
        android_campaigns: androidCampaigns.length,
        all_device_campaigns: allDeviceCampaigns.length,
        target_campaigns: targetCampaigns,
        device_breakdown: {
          android: androidCampaigns.length,
          ios: campaigns.filter(c => c.device === 'ios').length,
          all: allDeviceCampaigns.length
        },
        errors: this.errors,
        campaigns: campaigns
      };
      
      await fs.writeFile(this.outputFile, JSON.stringify(output, null, 2));
      
      const endTime = Date.now();
      const duration = Math.round((endTime - startTime) / 1000 / 60 * 10) / 10;
      
      // 結果表示
      console.log('\n' + '='.repeat(80));
      console.log('🎉 拡張Android案件スクレイピング完了！');
      console.log('='.repeat(80));
      console.log(`⏱️  実行時間: ${duration}分`);
      console.log(`📊 総取得案件数: ${campaigns.length}件`);
      console.log(`🤖 Android専用案件: ${androidCampaigns.length}件`);
      console.log(`📱 全デバイス案件: ${allDeviceCampaigns.length}件`);
      console.log(`🎯 指定案件発見: ${targetFound ? 'はい' : 'いいえ'}`);
      console.log(`❌ エラー数: ${this.errors.length}件`);
      
      if (targetFound) {
        console.log('\n🎯 指定案件詳細:');
        targetCampaigns.forEach(campaign => {
          console.log(`   名前: ${campaign.name}`);
          console.log(`   デバイス: ${campaign.device}`);
          console.log(`   還元: ${campaign.cashback}`);
          console.log(`   ページ: ${campaign.pageNumber}`);
          console.log(`   URL: ${campaign.url}`);
        });
      }
      
      console.log(`\n💾 詳細結果: ${this.outputFile}`);
      console.log('='.repeat(80));
      
      return targetFound;
      
    } catch (error) {
      console.error('💥 致命的エラー:', error);
      return false;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

// 実行
if (require.main === module) {
  const scraper = new ExtendedAndroidScraper();
  scraper.run().then(found => {
    if (found) {
      console.log('\n✅ 指定案件が見つかりました！');
    } else {
      console.log('\n❌ 指定案件は見つかりませんでした。');
      console.log('可能性:');
      console.log('1. 案件が削除または非公開');
      console.log('2. アプリページ以外のカテゴリに存在');
      console.log('3. URLが間違っている');
    }
  }).catch(console.error);
}

module.exports = ExtendedAndroidScraper;