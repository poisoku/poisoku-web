const puppeteer = require('puppeteer');
const fs = require('fs').promises;

/**
 * ちょびリッチ統一スクレイピングシステム（小規模テスト版）
 * フル版の動作確認用
 */
class ChobirichUnifiedScraperTest {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.results = [];
    this.browser = null;
    this.errors = [];
    
    // iOS ユーザーエージェント
    this.iosUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
    
    // テスト用設定（小規模）
    this.categories = {
      shopping: {
        name: 'ショッピング',
        categoryIds: [101, 102], // 2カテゴリのみ
        type: 'category_based',
        maxPagesPerCategory: 3 // 3ページまで
      },
      app: {
        name: 'アプリ',
        baseUrl: '/smartphone',
        params: '?sort=point',
        type: 'pagination',
        maxPages: 3 // 3ページまで
      },
      service: {
        name: 'サービス',
        testUrls: [
          '/service/',
          '/services/',
          '/offer/',
          '/campaign/'
        ],
        type: 'test_and_pagination',
        maxPages: 2 // 2ページまで
      },
      creditcard: {
        name: 'クレジットカード', 
        testUrls: [
          '/creditcard/',
          '/credit/',
          '/card/',
          '/finance/'
        ],
        type: 'test_and_pagination',
        maxPages: 2 // 2ページまで
      }
    };
    
    this.outputFile = 'chobirich_unified_test_results.json';
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

  // 強化されたデータクリーニング
  isValidCampaign(campaign) {
    if (!campaign || !campaign.name || campaign.name.trim() === '') {
      return false;
    }
    
    const name = campaign.name.trim().toLowerCase();
    
    const excludePatterns = [
      /^faq$/i,
      /^お問い合わせ$/i,
      /^アプリ大還元際$/i,
      /^注目ワード$/i,
      /^yahoo!$/i,
      /^楽天$/i,
      /^今月の注目/i,
      /特集$/i,
      /キャンペーン$/i,
      /ランキング$/i,
      /まとめ$/i,
      /^.{1,2}$/,
      /^名前取得失敗$/i,
      /^undefined$/i,
      /^null$/i,
      /^test/i
    ];
    
    for (const pattern of excludePatterns) {
      if (pattern.test(name)) {
        return false;
      }
    }
    
    return true;
  }

  // ショッピングカテゴリのテスト
  async scrapeShoppingTest() {
    console.log('\n📁 ショッピングカテゴリテスト開始');
    console.log('-'.repeat(50));
    
    const campaigns = [];
    
    for (const categoryId of this.categories.shopping.categoryIds) {
      console.log(`\n🛒 カテゴリ${categoryId}をテスト中...`);
      
      let pageNum = 1;
      let categoryCount = 0;
      
      while (pageNum <= this.categories.shopping.maxPagesPerCategory) {
        const page = await this.setupPage();
        
        try {
          const url = pageNum === 1 
            ? `${this.baseUrl}/shopping/shop/${categoryId}`
            : `${this.baseUrl}/shopping/shop/${categoryId}?page=${pageNum}`;
          
          console.log(`  📄 ページ${pageNum}`);
          
          const response = await page.goto(url, { 
            waitUntil: 'domcontentloaded',
            timeout: 25000 
          });
          
          if (response.status() !== 200) {
            console.log(`  ❌ HTTPステータス: ${response.status()}`);
            break;
          }
          
          await this.randomDelay(1, 2);
          
          const pageData = await page.evaluate((categoryId) => {
            const bodyText = document.body.innerText;
            
            const emptyPageMessages = [
              '現在、掲載している商品が存在しません。',
              '商品が存在しません',
              '該当する商品がありません'
            ];
            
            const hasEmptyMessage = emptyPageMessages.some(msg => bodyText.includes(msg));
            if (hasEmptyMessage) {
              return { hasEmptyMessage: true, campaigns: [] };
            }
            
            const campaignLinks = document.querySelectorAll('a[href*="/ad_details/"]');
            const campaigns = [];
            
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
                const container = link.closest('div, li, article, section');
                let campaignName = link.textContent?.trim() || '';
                let cashbackRate = '';
                let cashbackAmount = '';
                
                if (container) {
                  const textContent = container.textContent || '';
                  const lines = textContent.split('\n').filter(line => line.trim());
                  
                  if (lines.length > 0) {
                    let nameCandidate = lines[0].trim();
                    if (nameCandidate.includes('ランク別ポイント増量')) {
                      nameCandidate = nameCandidate.replace(/.*ランク別ポイント増量/, '').trim();
                    }
                    if (nameCandidate && nameCandidate.length > campaignName.length) {
                      campaignName = nameCandidate;
                    }
                  }
                  
                  const percentMatch = textContent.match(/(\d+(?:\.\d+)?)[%％]/);
                  if (percentMatch) {
                    cashbackRate = percentMatch[1] + '%';
                  }
                  
                  const pointMatch = textContent.match(/(\d+(?:,\d{3})*)[pP]|(\d+(?:,\d{3})*)ポイント/);
                  if (pointMatch) {
                    cashbackAmount = pointMatch[1] || pointMatch[2];
                  }
                }
                
                if (campaignName && campaignName.length > 2) {
                  campaigns.push({
                    id: campaignId,
                    name: campaignName,
                    url: href,
                    cashbackRate: cashbackRate,
                    cashbackAmount: cashbackAmount,
                    category: 'ショッピング',
                    subCategory: `カテゴリ${String(categoryId).padStart(3, '0')}`,
                    device: '全デバイス',
                    timestamp: new Date().toISOString()
                  });
                }
              }
            });
            
            return { hasEmptyMessage, campaigns };
          }, categoryId);
          
          if (pageData.hasEmptyMessage) {
            console.log(`  ❌ 空ページ検出`);
            break;
          } else if (pageData.campaigns.length === 0) {
            console.log(`  ❌ 案件なし`);
            break;
          } else {
            const validCampaigns = pageData.campaigns.filter(c => this.isValidCampaign(c));
            campaigns.push(...validCampaigns);
            categoryCount += validCampaigns.length;
            
            console.log(`  ✅ ${validCampaigns.length}件取得（${pageData.campaigns.length - validCampaigns.length}件除外）`);
            pageNum++;
          }
          
        } catch (error) {
          console.log(`  ❌ エラー: ${error.message}`);
          this.errors.push({
            category: 'shopping',
            categoryId,
            pageNum,
            error: error.message
          });
          break;
        } finally {
          await page.close();
        }
        
        await this.randomDelay(1, 3);
      }
      
      console.log(`  📊 カテゴリ${categoryId}: ${categoryCount}件`);
    }
    
    console.log(`✅ ショッピングテスト完了: ${campaigns.length}件`);
    return campaigns;
  }

  // アプリカテゴリのテスト
  async scrapeAppTest() {
    console.log('\n📱 アプリカテゴリテスト開始');
    console.log('-'.repeat(50));
    
    const campaigns = [];
    let pageNum = 1;
    
    while (pageNum <= this.categories.app.maxPages) {
      const page = await this.setupPage();
      
      try {
        const url = pageNum === 1
          ? `${this.baseUrl}/smartphone?sort=point`
          : `${this.baseUrl}/smartphone?sort=point&page=${pageNum}`;
        
        console.log(`📄 ページ${pageNum}`);
        
        const response = await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 25000 
        });
        
        if (response.status() !== 200) {
          console.log(`❌ HTTPステータス: ${response.status()}`);
          break;
        }
        
        await this.randomDelay(1, 2);
        
        const pageData = await page.evaluate(() => {
          const campaignLinks = document.querySelectorAll('a[href*="/ad_details/"]');
          const campaigns = [];
          
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
                  timestamp: new Date().toISOString()
                });
              }
            }
          });
          
          return { campaigns };
        });
        
        if (pageData.campaigns.length === 0) {
          console.log(`❌ 案件なし - 終了`);
          break;
        }
        
        const validCampaigns = pageData.campaigns.filter(c => this.isValidCampaign(c));
        campaigns.push(...validCampaigns);
        
        console.log(`✅ ${validCampaigns.length}件取得（${pageData.campaigns.length - validCampaigns.length}件除外）`);
        pageNum++;
        
      } catch (error) {
        console.log(`❌ エラー: ${error.message}`);
        this.errors.push({
          category: 'app',
          pageNum,
          error: error.message
        });
        break;
      } finally {
        await page.close();
      }
      
      await this.randomDelay(1, 3);
    }
    
    console.log(`✅ アプリテスト完了: ${campaigns.length}件`);
    return campaigns;
  }

  // 新カテゴリのテスト
  async scrapeNewCategoryTest(categoryConfig) {
    console.log(`\n🔍 ${categoryConfig.name}カテゴリテスト開始`);
    console.log('-'.repeat(50));
    
    const campaigns = [];
    let validBaseUrl = null;
    
    // URL探索
    for (const testUrl of categoryConfig.testUrls) {
      const page = await this.setupPage();
      
      try {
        const fullUrl = `${this.baseUrl}${testUrl}`;
        console.log(`テスト中: ${testUrl}`);
        
        const response = await page.goto(fullUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 25000
        });
        
        if (response.status() === 200) {
          const hasAds = await page.evaluate(() => {
            const adLinks = document.querySelectorAll('a[href*="/ad_details/"]');
            return adLinks.length > 0;
          });
          
          if (hasAds) {
            validBaseUrl = testUrl;
            console.log(`✅ 有効URL発見: ${testUrl}`);
            break;
          } else {
            console.log(`⚠️ 案件なし: ${testUrl}`);
          }
        } else {
          console.log(`❌ ${response.status()}: ${testUrl}`);
        }
        
      } catch (error) {
        console.log(`❌ エラー: ${testUrl} - ${error.message}`);
      } finally {
        await page.close();
      }
      
      await this.randomDelay(1, 2);
    }
    
    if (!validBaseUrl) {
      console.log(`❌ ${categoryConfig.name}の有効URLなし`);
      return campaigns;
    }
    
    // 有効URLでページスクレイピング
    let pageNum = 1;
    while (pageNum <= categoryConfig.maxPages) {
      const page = await this.setupPage();
      
      try {
        const url = pageNum === 1
          ? `${this.baseUrl}${validBaseUrl}`
          : `${this.baseUrl}${validBaseUrl}${validBaseUrl.includes('?') ? '&' : '?'}page=${pageNum}`;
        
        console.log(`📄 ページ${pageNum}`);
        
        const response = await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 25000
        });
        
        if (response.status() !== 200) {
          break;
        }
        
        await this.randomDelay(1, 2);
        
        const pageData = await page.evaluate((categoryName) => {
          const campaignLinks = document.querySelectorAll('a[href*="/ad_details/"]');
          const campaigns = [];
          
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
              const container = link.closest('div, li, article, section');
              let campaignName = link.textContent?.trim() || '';
              let cashback = '';
              
              if (container) {
                const textContent = container.textContent || '';
                
                if (!campaignName) {
                  const lines = textContent.split('\n').filter(line => line.trim());
                  if (lines.length > 0) {
                    campaignName = lines[0].trim();
                  }
                }
                
                const pointMatch = textContent.match(/(\d+(?:,\d{3})*)\s*(?:pt|ポイント)/i);
                if (pointMatch) {
                  cashback = pointMatch[1] + 'pt';
                } else {
                  const percentMatch = textContent.match(/(\d+(?:\.\d+)?)\s*%/);
                  if (percentMatch) {
                    cashback = percentMatch[1] + '%';
                  }
                }
              }
              
              if (campaignName && campaignName.length > 2) {
                campaigns.push({
                  id: campaignId,
                  name: campaignName,
                  url: href,
                  cashback: cashback || '要確認',
                  category: categoryName,
                  device: 'all',
                  timestamp: new Date().toISOString()
                });
              }
            }
          });
          
          return { campaigns };
        }, categoryConfig.name);
        
        if (pageData.campaigns.length === 0) {
          break;
        }
        
        const validCampaigns = pageData.campaigns.filter(c => this.isValidCampaign(c));
        campaigns.push(...validCampaigns);
        
        console.log(`✅ ${validCampaigns.length}件取得`);
        pageNum++;
        
      } catch (error) {
        console.log(`❌ エラー: ${error.message}`);
        break;
      } finally {
        await page.close();
      }
      
      await this.randomDelay(1, 3);
    }
    
    console.log(`✅ ${categoryConfig.name}テスト完了: ${campaigns.length}件`);
    return campaigns;
  }

  async run() {
    console.log('🧪 ちょびリッチ統一スクレイピング（小規模テスト）開始\n');
    console.log('='.repeat(60));
    console.log('テスト範囲:');
    console.log('  - ショッピング: 2カテゴリ × 3ページ');
    console.log('  - アプリ: 3ページ');
    console.log('  - サービス・クレジットカード: 各2ページ');
    console.log('='.repeat(60));
    
    const startTime = Date.now();
    
    try {
      await this.initBrowser();
      
      // 1. ショッピングテスト
      const shoppingCampaigns = await this.scrapeShoppingTest();
      this.results.push(...shoppingCampaigns);
      
      // 2. アプリテスト
      const appCampaigns = await this.scrapeAppTest();
      this.results.push(...appCampaigns);
      
      // 3. サービステスト
      const serviceCampaigns = await this.scrapeNewCategoryTest(this.categories.service);
      this.results.push(...serviceCampaigns);
      
      // 4. クレジットカードテスト
      const creditCampaigns = await this.scrapeNewCategoryTest(this.categories.creditcard);
      this.results.push(...creditCampaigns);
      
      // 重複除去
      const uniqueCampaigns = [];
      const seenIds = new Set();
      
      this.results.forEach(campaign => {
        if (!seenIds.has(campaign.id)) {
          uniqueCampaigns.push(campaign);
          seenIds.add(campaign.id);
        }
      });
      
      // 結果保存
      const output = {
        test_date: new Date().toISOString(),
        test_type: 'small_scale',
        total_campaigns: this.results.length,
        unique_campaigns: uniqueCampaigns.length,
        duplicates_removed: this.results.length - uniqueCampaigns.length,
        category_breakdown: this.getCategoryBreakdown(uniqueCampaigns),
        errors: this.errors,
        campaigns: uniqueCampaigns
      };
      
      await fs.writeFile(this.outputFile, JSON.stringify(output, null, 2));
      
      const endTime = Date.now();
      const duration = Math.round((endTime - startTime) / 1000 / 60 * 10) / 10;
      
      // 結果表示
      console.log('\n' + '='.repeat(60));
      console.log('🎉 小規模テスト完了！');
      console.log('='.repeat(60));
      console.log(`⏱️  実行時間: ${duration}分`);
      console.log(`📊 取得案件数: ${uniqueCampaigns.length}件（重複除去後）`);
      console.log(`🔄 重複除去: ${this.results.length - uniqueCampaigns.length}件`);
      console.log(`❌ エラー数: ${this.errors.length}件`);
      
      const breakdown = this.getCategoryBreakdown(uniqueCampaigns);
      console.log('\n📈 カテゴリ別内訳:');
      Object.entries(breakdown).forEach(([category, count]) => {
        console.log(`  ${category}: ${count}件`);
      });
      
      if (this.errors.length > 0) {
        console.log('\n⚠️  エラー一覧:');
        this.errors.forEach((error, i) => {
          console.log(`  ${i+1}. ${error.category}: ${error.error.substring(0, 60)}...`);
        });
      }
      
      // フル版実行の推定
      const estimatedFull = uniqueCampaigns.length * 10; // 約10倍の規模
      console.log('\n📊 フル版実行時の推定:');
      console.log(`  推定案件数: ${estimatedFull}件`);
      console.log(`  推定実行時間: ${Math.round(duration * 10)}分`);
      
      console.log(`\n💾 詳細結果: ${this.outputFile}`);
      console.log('='.repeat(60));
      
      return {
        success: true,
        uniqueCampaigns: uniqueCampaigns.length,
        errors: this.errors.length,
        duration: duration
      };
      
    } catch (error) {
      console.error('💥 テストエラー:', error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  getCategoryBreakdown(campaigns) {
    const breakdown = {};
    campaigns.forEach(campaign => {
      breakdown[campaign.category] = (breakdown[campaign.category] || 0) + 1;
    });
    return breakdown;
  }
}

// 実行
if (require.main === module) {
  const scraper = new ChobirichUnifiedScraperTest();
  scraper.run().catch(console.error);
}

module.exports = ChobirichUnifiedScraperTest;