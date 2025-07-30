const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const crypto = require('crypto');

/**
 * ちょびリッチ統一スクレイピングシステム
 * 全カテゴリの案件データを統一的に取得
 */
class ChobirichUnifiedScraper {
  constructor() {
    // 基本設定
    this.baseUrl = 'https://www.chobirich.com';
    this.results = [];
    this.errors = [];
    this.browser = null;
    this.processedUrls = new Set();
    
    // パフォーマンス設定
    this.maxConnectionsPerBrowser = 30;
    this.connectionCount = 0;
    this.checkpointInterval = 50;
    
    // iOS ユーザーエージェント（403エラー回避のため）
    this.iosUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
    
    // カテゴリ定義
    this.categories = {
      shopping: {
        name: 'ショッピング',
        baseUrl: '/shopping/shop/',
        categoryIds: Array.from({length: 12}, (_, i) => 101 + i),
        type: 'category_based'
      },
      service: {
        name: 'サービス',
        baseUrl: '/service/',
        type: 'pagination',
        maxPages: 50
      },
      app: {
        name: 'アプリ',
        baseUrl: '/smartphone',
        params: '?sort=point',
        type: 'pagination',
        maxPages: 30
      },
      creditcard: {
        name: 'クレジットカード',
        baseUrl: '/creditcard/',
        type: 'pagination',
        maxPages: 10
      }
    };
    
    // チェックポイントファイル
    this.checkpointFile = 'chobirich_unified_checkpoint.json';
    this.outputFile = 'chobirich_unified_campaigns.json';
  }

  // ユーティリティ: ランダム遅延
  async randomDelay(minSeconds, maxSeconds) {
    const delay = Math.random() * (maxSeconds - minSeconds) + minSeconds;
    console.log(`⏳ ${delay.toFixed(1)}秒待機中...`);
    await new Promise(resolve => setTimeout(resolve, delay * 1000));
  }

  // ブラウザ初期化
  async initBrowser() {
    console.log('🚀 ブラウザ初期化中...');
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--disable-features=VizDisplayCompositor',
        '--disable-web-security'
      ],
      timeout: 60000
    });
    
    this.connectionCount = 0;
    console.log('✅ ブラウザ初期化完了');
  }

  // ブラウザ再起動
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

  // ページセットアップ（403エラー対策含む）
  async setupPage() {
    const page = await this.browser.newPage();
    
    // タイムアウト設定
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);
    
    // ユーザーエージェント設定
    await page.setUserAgent(this.iosUserAgent);
    
    // 追加ヘッダー（人間らしく見せる）
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Upgrade-Insecure-Requests': '1'
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

  // URLをリダイレクトから直接URLに変換
  convertRedirectToDirectUrl(url) {
    const redirectPattern = /\/ad_details\/redirect\/(\d+)\/?$/;
    const match = url.match(redirectPattern);
    
    if (match) {
      return `${this.baseUrl}/ad_details/${match[1]}/`;
    }
    
    return url;
  }

  // カテゴリベースのURL抽出（ショッピング用）
  async extractCategoryUrls(categoryId) {
    const urls = [];
    let pageNum = 1;
    let hasMorePages = true;
    
    while (hasMorePages) {
      const page = await this.setupPage();
      
      try {
        const url = pageNum === 1 
          ? `${this.baseUrl}/shopping/shop/${categoryId}`
          : `${this.baseUrl}/shopping/shop/${categoryId}?page=${pageNum}`;
        
        console.log(`📄 カテゴリ${categoryId} ページ${pageNum} 取得中...`);
        
        const response = await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        });
        
        if (response.status() !== 200) {
          console.log(`⚠️ HTTPステータス: ${response.status()}`);
          hasMorePages = false;
          break;
        }
        
        await this.randomDelay(1, 3);
        
        // 案件URL抽出
        const pageUrls = await page.evaluate(() => {
          const links = document.querySelectorAll('a[href*="/ad_details/"]');
          return Array.from(links).map(link => link.href);
        });
        
        if (pageUrls.length === 0) {
          hasMorePages = false;
        } else {
          urls.push(...pageUrls);
          pageNum++;
        }
        
      } catch (error) {
        console.log(`❌ エラー: ${error.message}`);
        hasMorePages = false;
      } finally {
        await page.close();
      }
      
      // 連続アクセス回避
      await this.randomDelay(2, 5);
    }
    
    return urls;
  }

  // ページネーションベースのURL抽出
  async extractPaginationUrls(category) {
    const urls = [];
    let pageNum = 1;
    const maxPages = category.maxPages || 50;
    
    while (pageNum <= maxPages) {
      const page = await this.setupPage();
      
      try {
        const url = pageNum === 1
          ? `${this.baseUrl}${category.baseUrl}${category.params || ''}`
          : `${this.baseUrl}${category.baseUrl}${category.params || ''}${category.params ? '&' : '?'}page=${pageNum}`;
        
        console.log(`📄 ${category.name} ページ${pageNum} 取得中...`);
        
        const response = await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        });
        
        if (response.status() !== 200) {
          console.log(`⚠️ HTTPステータス: ${response.status()}`);
          break;
        }
        
        await this.randomDelay(1, 3);
        
        // 案件URL抽出
        const pageUrls = await page.evaluate(() => {
          const links = document.querySelectorAll('a[href*="/ad_details/"]');
          return Array.from(links).map(link => link.href);
        });
        
        if (pageUrls.length === 0) {
          break;
        }
        
        urls.push(...pageUrls);
        pageNum++;
        
      } catch (error) {
        console.log(`❌ エラー: ${error.message}`);
        break;
      } finally {
        await page.close();
      }
      
      // 連続アクセス回避
      await this.randomDelay(2, 5);
    }
    
    return urls;
  }

  // 案件詳細情報の取得
  async getCampaignDetails(url, categoryName) {
    const page = await this.setupPage();
    
    try {
      // リダイレクトURLを直接URLに変換
      const directUrl = this.convertRedirectToDirectUrl(url);
      
      console.log(`🔍 詳細取得: ${directUrl}`);
      
      const response = await page.goto(directUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      
      if (response.status() !== 200) {
        console.log(`⚠️ HTTPステータス: ${response.status()}`);
        return null;
      }
      
      await this.randomDelay(1, 2);
      
      // データ抽出
      const data = await page.evaluate(() => {
        const getTextContent = (selector) => {
          const element = document.querySelector(selector);
          return element ? element.textContent.trim() : '';
        };
        
        // 案件名
        const name = getTextContent('h1') || getTextContent('.campaign-title') || '';
        
        // 還元率
        let cashback = '';
        const pointElements = document.querySelectorAll('span, div, p');
        for (const elem of pointElements) {
          const text = elem.textContent;
          if (text.match(/\d+pt/i) || text.match(/\d+ポイント/i) || text.match(/\d+%/)) {
            cashback = text.trim();
            break;
          }
        }
        
        // 獲得条件
        const method = getTextContent('.condition') || getTextContent('[class*="condition"]') || '';
        
        // 説明
        const description = getTextContent('.description') || getTextContent('[class*="description"]') || '';
        
        return { name, cashback, method, description };
      });
      
      // URLからIDを抽出
      const idMatch = directUrl.match(/\/ad_details\/(\d+)/);
      const id = idMatch ? idMatch[1] : 'unknown';
      
      // OS判定（アプリカテゴリの場合）
      let device = 'all';
      if (categoryName === 'アプリ') {
        if (data.name.includes('iOS') || data.name.includes('iPhone')) {
          device = 'ios';
        } else if (data.name.includes('Android')) {
          device = 'android';
        }
      }
      
      return {
        id,
        name: data.name,
        url: directUrl,
        cashback: data.cashback || '要確認',
        category: this.mapCategory(categoryName),
        subcategory: categoryName,
        device,
        method: data.method,
        description: data.description,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.log(`❌ 詳細取得エラー: ${error.message}`);
      return null;
    } finally {
      await page.close();
    }
  }

  // カテゴリマッピング
  mapCategory(categoryName) {
    const mapping = {
      'ショッピング': 'shopping',
      'サービス': 'other',
      'アプリ': 'entertainment',
      'クレジットカード': 'finance'
    };
    return mapping[categoryName] || 'other';
  }

  // データ検証
  isValidCampaign(campaign) {
    // 無効な案件をフィルタリング
    if (!campaign || !campaign.name || campaign.name.trim() === '') {
      return false;
    }
    
    if (campaign.cashback === '不明' || campaign.cashback === '') {
      return false;
    }
    
    // 特殊企画等を除外
    const excludePatterns = [
      /大還元際/,
      /キャンペーン/,
      /特集/,
      /ランキング/,
      /^test/i
    ];
    
    for (const pattern of excludePatterns) {
      if (pattern.test(campaign.name)) {
        return false;
      }
    }
    
    return true;
  }

  // チェックポイント保存
  async saveCheckpoint(currentCategory) {
    const checkpoint = {
      timestamp: new Date().toISOString(),
      currentCategory,
      processedCount: this.results.length,
      validCount: this.results.filter(r => this.isValidCampaign(r)).length,
      processedUrls: Array.from(this.processedUrls)
    };
    
    await fs.writeFile(
      this.checkpointFile,
      JSON.stringify(checkpoint, null, 2)
    );
    
    console.log(`💾 チェックポイント保存: ${this.results.length}件処理済み`);
  }

  // チェックポイント読み込み
  async loadCheckpoint() {
    try {
      const data = await fs.readFile(this.checkpointFile, 'utf8');
      const checkpoint = JSON.parse(data);
      this.processedUrls = new Set(checkpoint.processedUrls || []);
      console.log(`📂 チェックポイント読み込み: ${this.processedUrls.size}件の処理済みURL`);
      return checkpoint;
    } catch (error) {
      console.log('📝 新規実行開始');
      return null;
    }
  }

  // 結果保存
  async saveResults() {
    // 有効な案件のみフィルタリング
    const validCampaigns = this.results.filter(r => this.isValidCampaign(r));
    
    const output = {
      scrape_date: new Date().toISOString(),
      total_campaigns: this.results.length,
      valid_campaigns: validCampaigns.length,
      category_breakdown: this.getCategoryBreakdown(validCampaigns),
      campaigns: validCampaigns
    };
    
    await fs.writeFile(
      this.outputFile,
      JSON.stringify(output, null, 2)
    );
    
    console.log(`💾 結果保存: ${validCampaigns.length}件の有効な案件`);
  }

  // カテゴリ別集計
  getCategoryBreakdown(campaigns) {
    const breakdown = {};
    campaigns.forEach(campaign => {
      breakdown[campaign.category] = (breakdown[campaign.category] || 0) + 1;
    });
    return breakdown;
  }

  // メイン実行
  async run() {
    console.log('🚀 ちょびリッチ統一スクレイピング開始\n');
    console.log('=' .repeat(60));
    
    try {
      // ブラウザ初期化
      await this.initBrowser();
      
      // チェックポイント確認
      const checkpoint = await this.loadCheckpoint();
      
      // 各カテゴリを処理
      for (const [key, category] of Object.entries(this.categories)) {
        console.log(`\n📁 ${category.name}カテゴリ処理開始`);
        console.log('-'.repeat(40));
        
        let urls = [];
        
        // URL収集
        if (category.type === 'category_based') {
          // ショッピングカテゴリ
          for (const categoryId of category.categoryIds) {
            const categoryUrls = await this.extractCategoryUrls(categoryId);
            urls.push(...categoryUrls);
            console.log(`✅ カテゴリ${categoryId}: ${categoryUrls.length}件`);
          }
        } else {
          // ページネーション型
          urls = await this.extractPaginationUrls(category);
          console.log(`✅ ${category.name}: ${urls.length}件`);
        }
        
        // 重複除去
        const uniqueUrls = [...new Set(urls)];
        console.log(`📊 重複除去後: ${uniqueUrls.length}件`);
        
        // 各URLの詳細を取得
        for (let i = 0; i < uniqueUrls.length; i++) {
          const url = uniqueUrls[i];
          
          // 処理済みチェック
          if (this.processedUrls.has(url)) {
            continue;
          }
          
          // ブラウザ再起動チェック
          if (this.connectionCount >= this.maxConnectionsPerBrowser) {
            await this.restartBrowser();
          }
          
          // 詳細取得
          const details = await this.getCampaignDetails(url, category.name);
          if (details) {
            this.results.push(details);
            this.processedUrls.add(url);
          }
          
          // 進捗表示
          if ((i + 1) % 10 === 0) {
            console.log(`進捗: ${i + 1}/${uniqueUrls.length}`);
          }
          
          // チェックポイント
          if ((i + 1) % this.checkpointInterval === 0) {
            await this.saveCheckpoint(key);
            await this.saveResults();
          }
          
          // アクセス間隔
          await this.randomDelay(2, 5);
        }
        
        console.log(`✅ ${category.name}カテゴリ完了`);
      }
      
      // 最終保存
      await this.saveResults();
      
      console.log('\n' + '='.repeat(60));
      console.log('🎉 スクレイピング完了！');
      console.log(`📊 総案件数: ${this.results.length}`);
      console.log(`✅ 有効案件: ${this.results.filter(r => this.isValidCampaign(r)).length}`);
      console.log('='.repeat(60));
      
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
if (require.main === module) {
  const scraper = new ChobirichUnifiedScraper();
  scraper.run().catch(console.error);
}

module.exports = ChobirichUnifiedScraper;