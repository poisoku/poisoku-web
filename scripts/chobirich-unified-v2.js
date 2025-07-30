const puppeteer = require('puppeteer');
const fs = require('fs').promises;

/**
 * ちょびリッチ統一スクレイピングシステム v2
 * 動作実績のあるセレクタを活用
 */
class ChobirichUnifiedScraperV2 {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.results = [];
    this.browser = null;
    
    // iOS ユーザーエージェント
    this.iosUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
    
    // 動作確認済みカテゴリのみ
    this.categories = {
      shopping: {
        name: 'ショッピング',
        categoryIds: [101, 102, 103], // テスト用に3つのみ
        type: 'category_based'
      },
      app: {
        name: 'アプリ',
        baseUrl: '/smartphone',
        params: '?sort=point',
        type: 'pagination',
        maxPages: 2 // テスト用に2ページのみ
      }
    };
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
    
    page.setDefaultTimeout(20000);
    await page.setUserAgent(this.iosUserAgent);
    
    // リソース最適化
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    return page;
  }

  convertRedirectToDirectUrl(url) {
    const redirectPattern = /\/ad_details\/redirect\/(\d+)\/?$/;
    const match = url.match(redirectPattern);
    
    if (match) {
      return `${this.baseUrl}/ad_details/${match[1]}/`;
    }
    
    return url;
  }

  // ショッピングカテゴリのスクレイピング（動作実績あり）
  async scrapeShoppingCategory(categoryId) {
    const campaigns = [];
    let pageNum = 1;
    let hasMorePages = true;
    
    while (hasMorePages && pageNum <= 3) { // テスト用に3ページまで
      const page = await this.setupPage();
      
      try {
        const url = pageNum === 1 
          ? `${this.baseUrl}/shopping/shop/${categoryId}`
          : `${this.baseUrl}/shopping/shop/${categoryId}?page=${pageNum}`;
        
        console.log(`📄 取得中: ${url}`);
        
        const response = await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 20000 
        });
        
        if (response.status() !== 200) {
          console.log(`❌ ステータス ${response.status()}`);
          hasMorePages = false;
          continue;
        }
        
        await this.randomDelay(1, 2);
        
        // 動作実績のあるセレクタを使用
        const pageData = await page.evaluate((categoryId) => {
          const bodyText = document.body.innerText;
          
          // 空ページチェック
          const emptyPageMessages = [
            '現在、掲載している商品が存在しません。',
            '商品が存在しません',
            '該当する商品がありません'
          ];
          
          const hasEmptyMessage = emptyPageMessages.some(msg => bodyText.includes(msg));
          if (hasEmptyMessage) {
            return { hasEmptyMessage: true, campaigns: [] };
          }
          
          // 案件データ抽出（動作実績のあるロジック）
          const campaignLinks = document.querySelectorAll('a[href*="/ad_details/"]');
          const campaigns = [];
          
          campaignLinks.forEach(link => {
            const href = link.href;
            
            // IDの抽出
            let campaignId = null;
            const directMatch = href.match(/\/ad_details\/(\d+)/);
            const redirectMatch = href.match(/\/ad_details\/redirect\/(\d+)/);
            
            if (directMatch) {
              campaignId = directMatch[1];
            } else if (redirectMatch) {
              campaignId = redirectMatch[1];
            }
            
            if (campaignId) {
              // 案件情報を取得
              const container = link.closest('div, li, article, section');
              let campaignName = link.textContent?.trim() || '';
              let cashbackRate = '';
              let cashbackAmount = '';
              let description = '';
              
              if (container) {
                const textContent = container.textContent || '';
                const lines = textContent.split('\n').filter(line => line.trim());
                
                // 案件名の改善
                if (lines.length > 0) {
                  let nameCandidate = lines[0].trim();
                  if (nameCandidate.includes('ランク別ポイント増量')) {
                    nameCandidate = nameCandidate.replace(/.*ランク別ポイント増量/, '').trim();
                  }
                  if (nameCandidate && nameCandidate.length > campaignName.length) {
                    campaignName = nameCandidate;
                  }
                }
                
                // キャッシュバック情報を探す
                const percentMatch = textContent.match(/(\d+(?:\.\d+)?)[%％]/);
                if (percentMatch) {
                  cashbackRate = percentMatch[1] + '%';
                }
                
                // ポイント数を探す
                const pointMatch = textContent.match(/(\d+(?:,\d{3})*)[pP]|(\d+(?:,\d{3})*)ポイント/);
                if (pointMatch) {
                  cashbackAmount = pointMatch[1] || pointMatch[2];
                }
                
                // 説明文を探す
                if (lines.length > 1) {
                  description = lines.slice(1, 3).join(' ').trim();
                }
              }
              
              if (campaignName && campaignName.length > 2) {
                campaigns.push({
                  id: campaignId,
                  name: campaignName,
                  url: href,
                  cashbackRate: cashbackRate,
                  cashbackAmount: cashbackAmount,
                  description: description,
                  category: 'ショッピング',
                  subCategory: `カテゴリ${String(categoryId).padStart(3, '0')}`,
                  device: '全デバイス',
                  timestamp: new Date().toISOString()
                });
              }
            }
          });
          
          return {
            hasEmptyMessage: hasEmptyMessage,
            campaigns: campaigns
          };
        }, categoryId);
        
        if (pageData.hasEmptyMessage) {
          console.log(`❌ 空ページメッセージ検出`);
          hasMorePages = false;
        } else if (pageData.campaigns.length === 0) {
          hasMorePages = false;
        } else {
          campaigns.push(...pageData.campaigns);
          console.log(`✅ ${pageData.campaigns.length}件取得`);
          pageNum++;
        }
        
      } catch (error) {
        console.log(`❌ エラー: ${error.message}`);
        hasMorePages = false;
      } finally {
        await page.close();
      }
      
      await this.randomDelay(2, 4);
    }
    
    return campaigns;
  }

  // アプリカテゴリのスクレイピング
  async scrapeAppCategory() {
    const campaigns = [];
    let pageNum = 1;
    const maxPages = 2; // テスト用
    
    while (pageNum <= maxPages) {
      const page = await this.setupPage();
      
      try {
        const url = pageNum === 1
          ? `${this.baseUrl}/smartphone?sort=point`
          : `${this.baseUrl}/smartphone?sort=point&page=${pageNum}`;
        
        console.log(`📄 取得中: ${url}`);
        
        const response = await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 20000 
        });
        
        if (response.status() !== 200) {
          console.log(`❌ ステータス ${response.status()}`);
          break;
        }
        
        await this.randomDelay(1, 2);
        
        const pageData = await page.evaluate(() => {
          // アプリ用のセレクタを使用
          const campaignLinks = document.querySelectorAll('a[href*="/ad_details/"]');
          const campaigns = [];
          
          campaignLinks.forEach(link => {
            const href = link.href;
            
            // IDの抽出
            let campaignId = null;
            const directMatch = href.match(/\/ad_details\/(\d+)/);
            const redirectMatch = href.match(/\/ad_details\/redirect\/(\d+)/);
            
            if (directMatch) {
              campaignId = directMatch[1];
            } else if (redirectMatch) {
              campaignId = redirectMatch[1];
            }
            
            if (campaignId) {
              // アプリ案件特有の情報取得
              const container = link.closest('div, li, article, section, tr');
              let campaignName = '';
              let cashback = '';
              
              if (container) {
                const textContent = container.textContent || '';
                
                // 案件名を取得（複数の方法を試す）
                campaignName = link.textContent?.trim() || '';
                if (!campaignName) {
                  // 近くのテキストから取得
                  const nearbyText = container.textContent.split('\n')[0]?.trim();
                  if (nearbyText && nearbyText.length < 100) {
                    campaignName = nearbyText;
                  }
                }
                
                // アプリ特有のポイント取得
                const pointMatch = textContent.match(/(\d+(?:,\d{3})*)\s*(?:pt|ポイント)/i);
                if (pointMatch) {
                  cashback = pointMatch[1] + 'pt';
                }
                
                // パーセント表記も確認
                if (!cashback) {
                  const percentMatch = textContent.match(/(\d+(?:\.\d+)?)\s*%/);
                  if (percentMatch) {
                    cashback = percentMatch[1] + '%';
                  }
                }
              }
              
              // OS判定
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
                  timestamp: new Date().toISOString()
                });
              }
            }
          });
          
          return { campaigns };
        });
        
        if (pageData.campaigns.length === 0) {
          break;
        }
        
        campaigns.push(...pageData.campaigns);
        console.log(`✅ ${pageData.campaigns.length}件取得`);
        pageNum++;
        
      } catch (error) {
        console.log(`❌ エラー: ${error.message}`);
        break;
      } finally {
        await page.close();
      }
      
      await this.randomDelay(2, 4);
    }
    
    return campaigns;
  }

  async run() {
    console.log('🚀 ちょびリッチ統一スクレイピングv2開始\n');
    console.log('='.repeat(60));
    
    try {
      await this.initBrowser();
      
      // ショッピングカテゴリを処理
      console.log('\n📁 ショッピングカテゴリ処理開始');
      console.log('-'.repeat(40));
      
      for (const categoryId of this.categories.shopping.categoryIds) {
        console.log(`\nカテゴリ${categoryId}を処理中...`);
        const campaigns = await this.scrapeShoppingCategory(categoryId);
        this.results.push(...campaigns);
        console.log(`カテゴリ${categoryId}: ${campaigns.length}件`);
      }
      
      // アプリカテゴリを処理
      console.log('\n📁 アプリカテゴリ処理開始');
      console.log('-'.repeat(40));
      
      const appCampaigns = await this.scrapeAppCategory();
      this.results.push(...appCampaigns);
      console.log(`アプリカテゴリ: ${appCampaigns.length}件`);
      
      // 結果を保存
      const output = {
        scrape_date: new Date().toISOString(),
        total_campaigns: this.results.length,
        category_breakdown: this.getCategoryBreakdown(),
        campaigns: this.results
      };
      
      await fs.writeFile(
        'chobirich_unified_v2_results.json',
        JSON.stringify(output, null, 2)
      );
      
      // 結果表示
      console.log('\n' + '='.repeat(60));
      console.log('📊 テスト結果サマリー');
      console.log('='.repeat(60));
      console.log(`総案件数: ${this.results.length}`);
      
      // カテゴリ別表示
      const breakdown = this.getCategoryBreakdown();
      Object.entries(breakdown).forEach(([category, count]) => {
        console.log(`${category}: ${count}件`);
      });
      
      // サンプル表示
      console.log('\n📋 取得サンプル（各カテゴリ2件ずつ）:');
      const samplesByCategory = {};
      this.results.forEach(campaign => {
        if (!samplesByCategory[campaign.category]) {
          samplesByCategory[campaign.category] = [];
        }
        if (samplesByCategory[campaign.category].length < 2) {
          samplesByCategory[campaign.category].push(campaign);
        }
      });
      
      Object.entries(samplesByCategory).forEach(([category, campaigns]) => {
        console.log(`\n【${category}】`);
        campaigns.forEach((campaign, i) => {
          console.log(`${i + 1}. ${campaign.name}`);
          console.log(`   💰 ${campaign.cashback || campaign.cashbackRate || campaign.cashbackAmount || '要確認'}`);
          console.log(`   🔗 ${campaign.url}`);
        });
      });
      
      console.log('\n💾 詳細はchobirich_unified_v2_results.jsonに保存されました');
      
    } catch (error) {
      console.error('💥 エラー:', error);
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  getCategoryBreakdown() {
    const breakdown = {};
    this.results.forEach(campaign => {
      breakdown[campaign.category] = (breakdown[campaign.category] || 0) + 1;
    });
    return breakdown;
  }
}

// 実行
if (require.main === module) {
  const scraper = new ChobirichUnifiedScraperV2();
  scraper.run().catch(console.error);
}

module.exports = ChobirichUnifiedScraperV2;