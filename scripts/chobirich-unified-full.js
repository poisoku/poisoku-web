const puppeteer = require('puppeteer');
const fs = require('fs').promises;

/**
 * ちょびリッチ統一スクレイピングシステム（フル版）
 * 全カテゴリの案件データを完全取得
 */
class ChobirichUnifiedScraperFull {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.results = [];
    this.browser = null;
    this.processedUrls = new Set();
    this.errors = [];
    
    // パフォーマンス設定
    this.maxConnectionsPerBrowser = 30;
    this.connectionCount = 0;
    this.checkpointInterval = 100;
    
    // iOS ユーザーエージェント
    this.iosUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
    
    // 全カテゴリ定義
    this.categories = {
      shopping: {
        name: 'ショッピング',
        categoryIds: Array.from({length: 12}, (_, i) => 101 + i), // 101-112
        type: 'category_based',
        maxPagesPerCategory: 50
      },
      app: {
        name: 'アプリ',
        baseUrl: '/smartphone',
        params: '?sort=point',
        type: 'pagination',
        maxPages: 50
      },
      service: {
        name: 'サービス',
        // 正しいURLを後で調査・設定
        testUrls: [
          '/service/',
          '/services/',
          '/offer/',
          '/campaign/'
        ],
        type: 'test_and_pagination',
        maxPages: 30
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
        maxPages: 20
      }
    };
    
    // ファイル設定
    this.checkpointFile = 'chobirich_unified_full_checkpoint.json';
    this.outputFile = 'chobirich_unified_full_results.json';
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
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run'
      ],
      timeout: 60000
    });
    
    this.connectionCount = 0;
    console.log('✅ ブラウザ初期化完了');
  }

  async restartBrowser() {
    console.log('🔄 ブラウザを再起動中...');
    
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        // エラー無視
      }
    }
    
    await this.randomDelay(2, 4);
    await this.initBrowser();
  }

  async setupPage() {
    const page = await this.browser.newPage();
    
    page.setDefaultTimeout(30000);
    await page.setUserAgent(this.iosUserAgent);
    
    // 追加ヘッダー
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
    
    this.connectionCount++;
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

  // データクリーニング強化
  isValidCampaign(campaign) {
    if (!campaign || !campaign.name || campaign.name.trim() === '') {
      return false;
    }
    
    const name = campaign.name.trim().toLowerCase();
    
    // 強化された除外パターン
    const excludePatterns = [
      // 特別企画・非案件
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
      
      // 短すぎる名前
      /^.{1,2}$/,
      
      // システムテキスト
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

  // ショッピングカテゴリの完全スクレイピング
  async scrapeShoppingFull() {
    console.log('\n📁 ショッピングカテゴリ（全12カテゴリ）処理開始');
    console.log('='.repeat(60));
    
    const campaigns = [];
    let totalProcessed = 0;
    
    for (const categoryId of this.categories.shopping.categoryIds) {
      console.log(`\n🛒 カテゴリ${categoryId}を処理中...`);
      
      let pageNum = 1;
      let hasMorePages = true;
      let categoryCount = 0;
      
      while (hasMorePages && pageNum <= this.categories.shopping.maxPagesPerCategory) {
        // ブラウザ再起動チェック
        if (this.connectionCount >= this.maxConnectionsPerBrowser) {
          await this.restartBrowser();
        }
        
        const page = await this.setupPage();
        
        try {
          const url = pageNum === 1 
            ? `${this.baseUrl}/shopping/shop/${categoryId}`
            : `${this.baseUrl}/shopping/shop/${categoryId}?page=${pageNum}`;
          
          console.log(`  📄 ページ${pageNum}: ${url}`);
          
          const response = await page.goto(url, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
          });
          
          if (response.status() !== 200) {
            console.log(`  ❌ HTTPステータス: ${response.status()}`);
            hasMorePages = false;
            continue;
          }
          
          await this.randomDelay(1, 3);
          
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
            
            // 案件データ抽出
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
                  
                  const pointMatch = textContent.match(/(\d+(?:,\d{3})*)[pP]|(\d+(?:,\d{3})*)ポイント/);
                  if (pointMatch) {
                    cashbackAmount = pointMatch[1] || pointMatch[2];
                  }
                  
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
            console.log(`  ❌ 空ページメッセージ検出`);
            hasMorePages = false;
          } else if (pageData.campaigns.length === 0) {
            console.log(`  ❌ 案件が見つかりません - 次のカテゴリへ`);
            hasMorePages = false;
          } else {
            const validCampaigns = pageData.campaigns.filter(c => this.isValidCampaign(c));
            campaigns.push(...validCampaigns);
            categoryCount += validCampaigns.length;
            totalProcessed += validCampaigns.length;
            
            console.log(`  ✅ ${validCampaigns.length}件取得（${pageData.campaigns.length - validCampaigns.length}件除外）`);
            pageNum++;
          }
          
        } catch (error) {
          console.log(`  ❌ エラー: ${error.message}`);
          this.errors.push({
            category: 'shopping',
            categoryId,
            pageNum,
            error: error.message,
            timestamp: new Date().toISOString()
          });
          hasMorePages = false;
        } finally {
          await page.close();
        }
        
        // チェックポイント保存
        if (totalProcessed > 0 && totalProcessed % this.checkpointInterval === 0) {
          await this.saveCheckpoint();
        }
        
        await this.randomDelay(2, 5);
      }
      
      console.log(`  📊 カテゴリ${categoryId}完了: ${categoryCount}件`);
    }
    
    console.log(`\n✅ ショッピングカテゴリ完了: ${campaigns.length}件`);
    return campaigns;
  }

  // アプリカテゴリの完全スクレイピング
  async scrapeAppFull() {
    console.log('\n📱 アプリカテゴリ（全ページ）処理開始');
    console.log('='.repeat(60));
    
    const campaigns = [];
    let pageNum = 1;
    let totalProcessed = 0;
    
    while (pageNum <= this.categories.app.maxPages) {
      if (this.connectionCount >= this.maxConnectionsPerBrowser) {
        await this.restartBrowser();
      }
      
      const page = await this.setupPage();
      
      try {
        const url = pageNum === 1
          ? `${this.baseUrl}/smartphone?sort=point`
          : `${this.baseUrl}/smartphone?sort=point&page=${pageNum}`;
        
        console.log(`📄 ページ${pageNum}: ${url}`);
        
        const response = await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        });
        
        if (response.status() !== 200) {
          console.log(`❌ HTTPステータス: ${response.status()}`);
          break;
        }
        
        await this.randomDelay(1, 3);
        
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
          console.log(`❌ 案件が見つかりません - 終了`);
          break;
        }
        
        const validCampaigns = pageData.campaigns.filter(c => this.isValidCampaign(c));
        campaigns.push(...validCampaigns);
        totalProcessed += validCampaigns.length;
        
        console.log(`✅ ${validCampaigns.length}件取得（${pageData.campaigns.length - validCampaigns.length}件除外）`);
        pageNum++;
        
        // チェックポイント保存
        if (totalProcessed > 0 && totalProcessed % this.checkpointInterval === 0) {
          await this.saveCheckpoint();
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
      
      await this.randomDelay(2, 5);
    }
    
    console.log(`\n✅ アプリカテゴリ完了: ${campaigns.length}件`);
    return campaigns;
  }

  // 新カテゴリのURL探索とスクレイピング
  async scrapeNewCategory(categoryConfig) {
    console.log(`\n🔍 ${categoryConfig.name}カテゴリのURL探索開始`);
    
    const campaigns = [];
    let validBaseUrl = null;
    
    // 有効なベースURLを探索
    for (const testUrl of categoryConfig.testUrls) {
      const page = await this.setupPage();
      
      try {
        const fullUrl = `${this.baseUrl}${testUrl}`;
        console.log(`  テスト中: ${fullUrl}`);
        
        const response = await page.goto(fullUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        
        if (response.status() === 200) {
          // 案件リンクがあるかチェック
          const hasAds = await page.evaluate(() => {
            const adLinks = document.querySelectorAll('a[href*="/ad_details/"]');
            return adLinks.length > 0;
          });
          
          if (hasAds) {
            validBaseUrl = testUrl;
            console.log(`  ✅ 有効なURL発見: ${fullUrl}`);
            break;
          }
        }
        
      } catch (error) {
        console.log(`  ❌ ${testUrl}: ${error.message}`);
      } finally {
        await page.close();
      }
      
      await this.randomDelay(1, 2);
    }
    
    if (!validBaseUrl) {
      console.log(`  ❌ ${categoryConfig.name}の有効なURLが見つかりませんでした`);
      return campaigns;
    }
    
    // 有効URLでページネーション実行
    let pageNum = 1;
    while (pageNum <= categoryConfig.maxPages) {
      if (this.connectionCount >= this.maxConnectionsPerBrowser) {
        await this.restartBrowser();
      }
      
      const page = await this.setupPage();
      
      try {
        const url = pageNum === 1
          ? `${this.baseUrl}${validBaseUrl}`
          : `${this.baseUrl}${validBaseUrl}${validBaseUrl.includes('?') ? '&' : '?'}page=${pageNum}`;
        
        console.log(`  📄 ページ${pageNum}: ${url}`);
        
        const response = await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        
        if (response.status() !== 200) {
          break;
        }
        
        await this.randomDelay(1, 3);
        
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
                
                // 案件名改善
                if (!campaignName) {
                  const lines = textContent.split('\n').filter(line => line.trim());
                  if (lines.length > 0) {
                    campaignName = lines[0].trim();
                  }
                }
                
                // 還元率取得
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
        
        console.log(`  ✅ ${validCampaigns.length}件取得`);
        pageNum++;
        
      } catch (error) {
        console.log(`  ❌ エラー: ${error.message}`);
        break;
      } finally {
        await page.close();
      }
      
      await this.randomDelay(2, 5);
    }
    
    console.log(`\n✅ ${categoryConfig.name}カテゴリ完了: ${campaigns.length}件`);
    return campaigns;
  }

  // チェックポイント機能
  async saveCheckpoint() {
    const checkpoint = {
      timestamp: new Date().toISOString(),
      processedCount: this.results.length,
      errors: this.errors,
      categories: Object.keys(this.categories)
    };
    
    await fs.writeFile(
      this.checkpointFile,
      JSON.stringify(checkpoint, null, 2)
    );
    
    console.log(`💾 チェックポイント保存: ${this.results.length}件処理済み`);
  }

  async loadCheckpoint() {
    try {
      const data = await fs.readFile(this.checkpointFile, 'utf8');
      const checkpoint = JSON.parse(data);
      console.log(`📂 チェックポイント読み込み: ${checkpoint.processedCount}件の進捗`);
      return checkpoint;
    } catch (error) {
      console.log('📝 新規実行開始');
      return null;
    }
  }

  // 結果保存
  async saveResults() {
    // 重複除去
    const uniqueCampaigns = [];
    const seenIds = new Set();
    
    this.results.forEach(campaign => {
      if (!seenIds.has(campaign.id)) {
        uniqueCampaigns.push(campaign);
        seenIds.add(campaign.id);
      }
    });
    
    const output = {
      scrape_date: new Date().toISOString(),
      total_campaigns: this.results.length,
      unique_campaigns: uniqueCampaigns.length,
      duplicates_removed: this.results.length - uniqueCampaigns.length,
      category_breakdown: this.getCategoryBreakdown(uniqueCampaigns),
      errors: this.errors,
      campaigns: uniqueCampaigns
    };
    
    await fs.writeFile(
      this.outputFile,
      JSON.stringify(output, null, 2)
    );
    
    console.log(`💾 結果保存: ${uniqueCampaigns.length}件のユニーク案件`);
    return uniqueCampaigns.length;
  }

  getCategoryBreakdown(campaigns) {
    const breakdown = {};
    campaigns.forEach(campaign => {
      breakdown[campaign.category] = (breakdown[campaign.category] || 0) + 1;
    });
    return breakdown;
  }

  // メイン実行
  async run() {
    console.log('🚀 ちょびリッチ統一スクレイピングシステム（フル版）開始\n');
    console.log('='.repeat(80));
    
    const startTime = Date.now();
    
    try {
      await this.initBrowser();
      
      // チェックポイント確認
      const checkpoint = await this.loadCheckpoint();
      
      // 1. ショッピングカテゴリ
      const shoppingCampaigns = await this.scrapeShoppingFull();
      this.results.push(...shoppingCampaigns);
      
      // 2. アプリカテゴリ
      const appCampaigns = await this.scrapeAppFull();
      this.results.push(...appCampaigns);
      
      // 3. サービスカテゴリ
      const serviceCampaigns = await this.scrapeNewCategory(this.categories.service);
      this.results.push(...serviceCampaigns);
      
      // 4. クレジットカードカテゴリ
      const creditCampaigns = await this.scrapeNewCategory(this.categories.creditcard);
      this.results.push(...creditCampaigns);
      
      // 最終結果保存
      const finalCount = await this.saveResults();
      
      const endTime = Date.now();
      const duration = Math.round((endTime - startTime) / 1000 / 60);
      
      // 結果サマリー
      console.log('\n' + '='.repeat(80));
      console.log('🎉 フル版スクレイピング完了！');
      console.log('='.repeat(80));
      console.log(`⏱️  実行時間: ${duration}分`);
      console.log(`📊 取得案件数: ${finalCount}件（重複除去後）`);
      console.log(`❌ エラー数: ${this.errors.length}件`);
      
      const breakdown = this.getCategoryBreakdown(this.results);
      console.log('\n📈 カテゴリ別内訳:');
      Object.entries(breakdown).forEach(([category, count]) => {
        console.log(`  ${category}: ${count}件`);
      });
      
      if (this.errors.length > 0) {
        console.log('\n⚠️  エラーサマリー:');
        this.errors.slice(0, 5).forEach((error, i) => {
          console.log(`  ${i+1}. ${error.category}: ${error.error}`);
        });
      }
      
      console.log(`\n💾 詳細結果: ${this.outputFile}`);
      console.log('='.repeat(80));
      
    } catch (error) {
      console.error('💥 致命的エラー:', error);
      await this.saveResults(); // エラー時も保存
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

// 実行
if (require.main === module) {
  const scraper = new ChobirichUnifiedScraperFull();
  scraper.run().catch(console.error);
}

module.exports = ChobirichUnifiedScraperFull;