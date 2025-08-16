#!/usr/bin/env node

require('dotenv').config();
const puppeteer = require('puppeteer');

/**
 * 拡張版ちょびリッチスクレイパー【洗練版】
 * ショッピング・サービス全カテゴリ対応 / 高速カテゴリページ完結型
 */
class ExtendedChobirichScraper {
  constructor() {
    this.browser = null;
    this.results = [];
    this.stats = this.initializeStats();
    this.config = this.getConfig();
    this.categories = this.initializeCategories();
  }

  /**
   * 統計情報初期化（堅牢性統計追加）
   */
  initializeStats() {
    return {
      startTime: null,
      endTime: null,
      categoriesProcessed: 0,
      pagesProcessed: 0,
      campaignsFound: 0,
      totalRequests: 0,
      errors: [],
      // 堅牢性統計
      browserRestarts: 0,
      http403Errors: 0,
      retriesExecuted: 0,
      errorRecoveries: 0
    };
  }

  /**
   * 設定情報（403エラー対策機能付き）
   */
  getConfig() {
    return {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      timeout: 30000,
      pageDelay: 2000,
      contentLoadDelay: 3000,
      defaultMaxPages: 15,
      // 403エラー対策設定
      maxCategoriesPerBrowser: 2,  // 2カテゴリ毎にブラウザ再起動
      maxRetries: 3,               // 最大3回リトライ
      browserRestartDelay: 65000,  // ブラウザ再起動間隔65秒（アクセス数リセット）
      errorRecoveryDelay: 60000,   // エラー時60秒待機
      categoryDelay: 65000,        // カテゴリ間65秒待機（アクセス数制限対策）
      http403RetryDelay: 300000    // 403エラー時5分待機
    };
  }

  /**
   * カテゴリ設定初期化
   */
  initializeCategories() {
    const categories = {};
    
    // ショッピングカテゴリ (shop/101-111)
    const shoppingCategories = [
      { id: 101, name: '総合通販・デパート・ふるさと納税', maxPages: 20 },
      { id: 102, name: 'ファッション・アクセサリー', maxPages: 15 },
      { id: 103, name: 'コスメ・美容・健康', maxPages: 15 },
      { id: 104, name: 'グルメ・食品', maxPages: 15 },
      { id: 105, name: '家電・パソコン', maxPages: 15 },
      { id: 106, name: 'インテリア・生活用品', maxPages: 15 },
      { id: 107, name: 'ホビー・エンタメ', maxPages: 15 },
      { id: 108, name: 'スポーツ・アウトドア', maxPages: 15 },
      { id: 109, name: '車・バイク', maxPages: 15 },
      { id: 110, name: '本・雑誌・コミック', maxPages: 15 },
      { id: 111, name: 'その他ショッピング', maxPages: 15 }
    ];

    // サービスカテゴリ (earn/apply/101,103,104,106-111)
    const serviceCategories = [
      { id: 101, name: 'エンタメ・ゲーム', maxPages: 15 },
      { id: 103, name: '資料請求・査定・相談', maxPages: 15 },
      { id: 104, name: '会員登録・メルマガ', maxPages: 15 },
      { id: 106, name: '金融・投資・保険', maxPages: 15 },
      { id: 107, name: '不動産・引越し', maxPages: 15 },
      { id: 108, name: '美容・健康', maxPages: 15 },
      { id: 109, name: '旅行・宿泊', maxPages: 15 },
      { id: 110, name: '通信・プロバイダ', maxPages: 15 },
      { id: 111, name: 'その他サービス', maxPages: 15 }
    ];

    // ショッピングカテゴリ登録
    shoppingCategories.forEach(cat => {
      categories[`shopping_${cat.id}`] = {
        name: cat.name,
        baseUrl: `https://www.chobirich.com/shopping/shop/${cat.id}`,
        maxPages: cat.maxPages,
        type: 'shopping'
      };
    });

    // サービスカテゴリ登録
    serviceCategories.forEach(cat => {
      categories[`service_${cat.id}`] = {
        name: cat.name,
        baseUrl: `https://www.chobirich.com/earn/apply/${cat.id}`,
        maxPages: cat.maxPages,
        type: 'service'
      };
    });

    return categories;
  }

  /**
   * 初期化（403エラー対策機能付き）
   */
  async initialize() {
    console.log('🚀 拡張版ちょびリッチスクレイパー【堅牢版】初期化中...');
    console.log('🛡️ 403エラー対策機能（バランス型）:');
    console.log('   ✅ 2カテゴリ毎の強制ブラウザ再起動');
    console.log('   ✅ 403エラー時5分待機・自動リトライ');
    console.log('   ✅ カテゴリ間65秒待機');
    console.log('   ✅ ブラウザ再起動間65秒待機');
    console.log('📋 対応カテゴリ:');
    console.log('   - ショッピングカテゴリ: 11カテゴリ (shop/101-111)');
    console.log('   - サービスカテゴリ: 9カテゴリ (earn/apply/101,103,104,106-111)');
    
    await this.createNewBrowser();
    
    console.log('✅ 初期化完了');
  }

  /**
   * 新しいブラウザインスタンス作成
   */
  async createNewBrowser() {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        console.log('⚠️ 既存ブラウザクローズエラー（無視）');
      }
    }

    console.log('🔄 新しいブラウザインスタンス作成中...');
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    
    this.stats.browserRestarts++;
    
    // ブラウザ起動後の安定化待機
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  /**
   * ポイント値クリーンアップ【統一版】
   * 「数字+pt/％」のみを正規表現で抽出
   */
  cleanPoints(pointText) {
    if (!pointText) return '';
    
    let targetText = pointText.trim();
    
    // 矢印表記の処理（→の右側の値を取得）
    if (targetText.includes('→')) {
      const parts = targetText.split('→');
      targetText = parts[parts.length - 1].trim();
    }
    
    // 「数字+ポイント」「数字+％」のパターンを正規表現で抽出
    const pointPatterns = [
      /(\d{1,3}(?:,\d{3})+pt)/gi,    // カンマ区切り形式
      /(\d{4,}pt)/gi,                // 連続数字形式（4桁以上）
      /(\d{1,3}pt)/gi,               // 小さい数字形式（1-3桁）
      /(\d+(?:\.\d+)?[%％])/gi       // パーセント形式
    ];
    
    // 最初にマッチしたパターンを返す
    for (const pattern of pointPatterns) {
      const match = targetText.match(pattern);
      if (match && match[0]) {
        return match[0];
      }
    }
    
    return '';
  }

  /**
   * カテゴリページからの案件データ取得【統合版】
   */
  async scrapeCategoryPage(categoryUrl, pageNum = 1, categoryType = 'shopping') {
    const page = await this.browser.newPage();
    
    try {
      // ページ設定
      await page.setUserAgent(this.config.userAgent);
      await page.setViewport(this.config.viewport);
      await page.setExtraHTTPHeaders({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      // URL構築
      const targetUrl = pageNum === 1 ? categoryUrl : `${categoryUrl}?page=${pageNum}`;
      console.log(`   📄 取得中: ${targetUrl}`);
      
      const response = await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: this.config.timeout
      });

      this.stats.totalRequests++;

      if (response.status() !== 200) {
        const errorMessage = `HTTPエラー: ${response.status()}`;
        console.log(`   ❌ ${errorMessage}`);
        
        if (response.status() === 403) {
          throw new Error(`403 Forbidden - アクセス制限: ${targetUrl}`);
        }
        
        return [];
      }

      // コンテンツ読み込み待機
      await new Promise(resolve => setTimeout(resolve, this.config.contentLoadDelay));

      // データ抽出
      const campaigns = await page.evaluate((categoryType) => {
        const results = [];
        
        // cleanPoints関数（ページ内実行用）
        function cleanPoints(pointText) {
          if (!pointText) return '';
          
          let targetText = pointText.trim();
          
          // 矢印表記の処理（→の右側の値を取得）
          if (targetText.includes('→')) {
            const parts = targetText.split('→');
            targetText = parts[parts.length - 1].trim();
          }
          
          // 「数字+ポイント」「数字+％」のパターンを正規表現で抽出
          const pointPatterns = [
            /(\d{1,3}(?:,\d{3})+pt)/gi,    // カンマ区切り形式
            /(\d{4,}pt)/gi,                // 連続数字形式（4桁以上）
            /(\d{1,3}pt)/gi,               // 小さい数字形式（1-3桁）
            /(\d+(?:\.\d+)?[%％])/gi       // パーセント形式
          ];
          
          // 最初にマッチしたパターンを返す
          for (const pattern of pointPatterns) {
            const match = targetText.match(pattern);
            if (match && match[0]) {
              return match[0];
            }
          }
          
          return '';
        }
        
        // 案件コンテナ取得
        const campaignItems = document.querySelectorAll('li.ad-category__ad, li.AdList__item, div.campaign-item, div.ad-item');
        
        // フォールバック: ad_detailsリンクから推測
        let items = Array.from(campaignItems);
        if (items.length === 0) {
          const allLinks = document.querySelectorAll('a[href*="/ad_details/"]');
          const containers = new Set();
          
          allLinks.forEach(link => {
            let container = link;
            for (let i = 0; i < 3; i++) {
              container = container.parentElement;
              if (!container) break;
              
              if (container.tagName === 'LI' || 
                  (container.tagName === 'DIV' && container.className.includes('item'))) {
                containers.add(container);
                break;
              }
            }
          });
          
          items = Array.from(containers);
        }
        
        items.forEach((item, index) => {
          const campaign = {
            id: '',
            title: '',
            url: '',
            points: '',
            categoryType: categoryType,
            scrapedAt: new Date().toISOString(),
            source: 'extended_category_system'
          };

          // リンク要素取得
          const linkEl = item.querySelector('a[href*="/ad_details/"]');
          if (linkEl) {
            campaign.title = linkEl.textContent.trim();
            campaign.url = linkEl.href;
            const idMatch = linkEl.href.match(/\/ad_details\/(\d+)/);
            if (idMatch) {
              campaign.id = idMatch[1];
            }
          }

          // ポイント取得
          const pointSelectors = [
            '.ad-category__ad__pt',
            '.item-point',
            '.campaign-point',
            '.cashback',
            '[class*="pt"]',
            '[class*="point"]'
          ];
          
          let pointText = '';
          for (const selector of pointSelectors) {
            const pointEl = item.querySelector(selector);
            if (pointEl) {
              pointText = pointEl.textContent.trim();
              if (pointText) break;
            }
          }
          
          // ポイントが取得できない場合、テキストから検索
          if (!pointText) {
            const itemText = item.textContent;
            const pointMatch = itemText.match(/(\d{1,3}(?:,\d{3})*pt|\d+(?:\.\d+)?[%％])/i);
            if (pointMatch) {
              pointText = pointMatch[1];
            }
          }

          if (pointText) {
            campaign.points = cleanPoints(pointText);
          }

          // 基本データが揃っている場合のみ追加
          if (campaign.id && campaign.title && campaign.url) {
            results.push(campaign);
          }
        });

        return results;
      }, categoryType);

      console.log(`   ✅ ${campaigns.length}件の案件を取得`);
      this.stats.campaignsFound += campaigns.length;
      
      return campaigns;

    } catch (error) {
      const errorUrl = pageNum === 1 ? categoryUrl : `${categoryUrl}?page=${pageNum}`;
      console.log(`   ❌ エラー: ${error.message}`);
      this.stats.errors.push({
        url: errorUrl,
        error: error.message,
        time: new Date().toISOString()
      });
      return [];
      
    } finally {
      await page.close();
    }
  }

  /**
   * バッチ処理（エラー回復機能付き）
   */
  async processBatchWithErrorHandling(categoryKeys, batchNumber) {
    let attempt = 0;
    let success = false;
    
    while (attempt < this.config.maxRetries && !success) {
      try {
        console.log(`\n🔧 Batch ${batchNumber} 実行開始 (試行 ${attempt + 1}/${this.config.maxRetries})`);
        
        // 新しいブラウザインスタンス作成
        await this.createNewBrowser();
        
        // バッチ内のカテゴリを順次処理
        for (const categoryKey of categoryKeys) {
          const categoryConfig = this.categories[categoryKey];
          if (!categoryConfig) {
            console.log(`⚠️ 不明なカテゴリ: ${categoryKey}`);
            continue;
          }
          
          await this.processCategoryWithRetry(categoryKey, categoryConfig);
          
          // カテゴリ間待機（アクセス数制限対策）
          if (categoryKeys.indexOf(categoryKey) < categoryKeys.length - 1) {
            console.log(`   ⏳ 次カテゴリまで${this.config.categoryDelay/1000}秒待機（アクセス数制限対策）...`);
            await new Promise(resolve => setTimeout(resolve, this.config.categoryDelay));
          }
        }
        
        console.log(`✅ Batch ${batchNumber} 完了`);
        success = true;
        
      } catch (error) {
        attempt++;
        console.log(`❌ Batch ${batchNumber} 失敗 (試行 ${attempt}): ${error.message}`);
        
        this.stats.errors.push({
          batch: batchNumber,
          attempt,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        
        if (attempt < this.config.maxRetries) {
          console.log(`🛡️ エラー回復中 - ${this.config.errorRecoveryDelay/1000}秒待機...`);
          await new Promise(resolve => setTimeout(resolve, this.config.errorRecoveryDelay));
          this.stats.errorRecoveries++;
        }
      }
    }
    
    if (!success) {
      console.log(`💥 Batch ${batchNumber} 最大リトライ数に達しました`);
    }
  }

  /**
   * カテゴリ処理（リトライ機能付き）
   */
  async processCategoryWithRetry(categoryKey, categoryConfig) {
    console.log(`\n📂 ${categoryConfig.type.toUpperCase()}カテゴリ: ${categoryConfig.name}`);
    console.log('-'.repeat(50));
    
    const allCampaigns = [];
    let emptyPageCount = 0; // 連続して案件が0件のページ数をカウント
    const maxEmptyPages = 3; // 3ページ連続で0件なら終了
    
    for (let page = 1; page <= categoryConfig.maxPages; page++) {
      let pageSuccess = false;
      let pageAttempt = 0;
      
      while (pageAttempt < this.config.maxRetries && !pageSuccess) {
        try {
          const campaigns = await this.scrapeCategoryPage(
            categoryConfig.baseUrl,
            page,
            categoryConfig.type
          );
          
          if (campaigns.length === 0) {
            emptyPageCount++;
            console.log(`   ➡️ ページ${page}: 案件なし（${emptyPageCount}/${maxEmptyPages}）`);
            
            // 3ページ連続で案件が0件の場合、残りのページをスキップ
            if (emptyPageCount >= maxEmptyPages) {
              console.log(`   ⏭️ ${maxEmptyPages}ページ連続で案件なし。次のカテゴリへ`);
              return allCampaigns; // カテゴリ処理を終了
            }
            
            pageSuccess = true;
            // ページ間待機は必要ないのでbreakする
            break;
          }
          
          // 案件が見つかったらカウントをリセット
          emptyPageCount = 0;
          allCampaigns.push(...campaigns);
          this.stats.pagesProcessed++;
          pageSuccess = true;
          
        } catch (error) {
          pageAttempt++;
          
          if (error.message.includes('403')) {
            this.stats.http403Errors++;
            console.log(`   ❌ 403エラー (試行 ${pageAttempt}): ${this.config.http403RetryDelay/60000}分待機（アクセス数リセット）...`);
            
            if (pageAttempt < this.config.maxRetries) {
              await new Promise(resolve => setTimeout(resolve, this.config.http403RetryDelay));
              this.stats.retriesExecuted++;
            }
          } else {
            console.log(`   ❌ ページ${page}エラー (試行 ${pageAttempt}): ${error.message}`);
            
            if (pageAttempt < this.config.maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 5000));
              this.stats.retriesExecuted++;
            }
          }
        }
      }
      
      if (!pageSuccess) {
        console.log(`   💥 ページ${page}: 最大リトライ数に達しました`);
        break;
      }
      
      // ページ間待機
      if (page < categoryConfig.maxPages && allCampaigns.length > 0) {
        await new Promise(resolve => setTimeout(resolve, this.config.pageDelay));
      }
    }
    
    this.results.push(...allCampaigns);
    this.stats.categoriesProcessed++;
    
    return allCampaigns;
  }

  /**
   * メインスクレイピング処理（403エラー対策付き）
   */
  async scrape(targetCategories = null, categoryTypes = null) {
    this.stats.startTime = new Date();
    console.log('🎯 拡張版スクレイピング開始（堅牢版）');
    console.log('='.repeat(60));
    
    await this.initialize();
    
    try {
      let categoriesToProcess = targetCategories || Object.keys(this.categories);
      
      // カテゴリタイプでフィルタリング
      if (categoryTypes) {
        categoriesToProcess = categoriesToProcess.filter(key => {
          const categoryType = this.categories[key]?.type;
          return categoryTypes.includes(categoryType);
        });
      }
      
      console.log(`📋 処理対象: ${categoriesToProcess.length}カテゴリ`);
      
      // 3カテゴリずつのバッチに分割
      const batches = [];
      for (let i = 0; i < categoriesToProcess.length; i += this.config.maxCategoriesPerBrowser) {
        batches.push(categoriesToProcess.slice(i, i + this.config.maxCategoriesPerBrowser));
      }
      
      console.log(`🔄 ${batches.length}バッチに分割実行（403エラー対策）`);
      
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`\n📦 Batch ${batchIndex + 1}/${batches.length}: ${batch.join(', ')}`);
        
        await this.processBatchWithErrorHandling(batch, batchIndex + 1);
        
        // バッチ間の待機（アクセス数リセット待機）
        if (batchIndex < batches.length - 1) {
          console.log(`⏳ 次バッチまで${this.config.browserRestartDelay/1000}秒待機（アクセス数リセット待機）...`);
          await new Promise(resolve => setTimeout(resolve, this.config.browserRestartDelay));
        }
      }
      
    } catch (error) {
      console.error('💥 致命的エラー:', error);
      this.stats.errors.push({
        type: 'fatal',
        message: error.message,
        time: new Date().toISOString()
      });
    } finally {
      await this.cleanup();
    }
    
    this.stats.endTime = new Date();
    this.displayStats();
    
    return this.results;
  }

  /**
   * 統計表示
   */
  displayStats() {
    const duration = (this.stats.endTime - this.stats.startTime) / 1000;
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 拡張版スクレイピング完了');
    console.log('='.repeat(60));
    console.log(`実行時間: ${duration.toFixed(1)}秒`);
    console.log(`処理カテゴリ数: ${this.stats.categoriesProcessed}`);
    console.log(`処理ページ数: ${this.stats.pagesProcessed}`);
    console.log(`取得案件数: ${this.stats.campaignsFound}`);
    console.log(`総リクエスト数: ${this.stats.totalRequests}`);
    console.log(`エラー数: ${this.stats.errors.length}`);
    
    // カテゴリ別統計
    const shoppingCampaigns = this.results.filter(c => c.categoryType === 'shopping').length;
    const serviceCampaigns = this.results.filter(c => c.categoryType === 'service').length;
    
    console.log(`\n📈 カテゴリ別取得数:`);
    console.log(`  ショッピング: ${shoppingCampaigns}件`);
    console.log(`  サービス: ${serviceCampaigns}件`);
    
    // 堅牢性統計
    console.log(`\n🛡️ 堅牢性統計:`);
    console.log(`  ブラウザ再起動: ${this.stats.browserRestarts}回`);
    console.log(`  403エラー: ${this.stats.http403Errors}回`);
    console.log(`  リトライ実行: ${this.stats.retriesExecuted}回`);
    console.log(`  エラー回復: ${this.stats.errorRecoveries}回`);
    
    if (this.stats.totalRequests > 0) {
      const avgTime = duration / this.stats.totalRequests;
      console.log(`\n⚡ パフォーマンス:`);
      console.log(`  平均処理時間: ${avgTime.toFixed(2)}秒/リクエスト`);
      console.log(`  案件取得効率: ${(this.stats.campaignsFound / this.stats.totalRequests).toFixed(1)}件/リクエスト`);
    }
    
    // 成功率計算
    const successRate = this.stats.totalRequests > 0 ? 
      ((this.stats.totalRequests - this.stats.errors.length) / this.stats.totalRequests * 100).toFixed(1) : 0;
    console.log(`  成功率: ${successRate}%`);
    
    if (this.stats.http403Errors === 0) {
      console.log(`\n🎉 403エラー対策成功！全カテゴリを堅牢に取得`);
    }
  }

  /**
   * クリーンアップ
   */
  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  /**
   * カテゴリ情報取得
   */
  getCategoryInfo() {
    const shoppingCategories = Object.keys(this.categories).filter(k => k.startsWith('shopping_'));
    const serviceCategories = Object.keys(this.categories).filter(k => k.startsWith('service_'));
    
    return {
      total: Object.keys(this.categories).length,
      shopping: shoppingCategories.length,
      service: serviceCategories.length,
      shoppingCategories,
      serviceCategories
    };
  }
}

module.exports = ExtendedChobirichScraper;