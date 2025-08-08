#!/usr/bin/env node

require('dotenv').config();
const puppeteer = require('puppeteer');

/**
 * 拡張版ちょびリッチスクレイパー
 * 仕様書対応：全ショッピングカテゴリ + サービス・クレジットカード・マネーカテゴリ
 * カテゴリページ完結型で100倍高速化を実現
 */
class ExtendedChobirichScraper {
  constructor() {
    this.browser = null;
    this.results = [];
    this.stats = {
      startTime: null,
      endTime: null,
      categoriesProcessed: 0,
      pagesProcessed: 0,
      campaignsFound: 0,
      totalRequests: 0,
      errors: []
    };
    
    // 仕様書対応：全カテゴリ設定
    this.categories = {
      // ショッピングカテゴリ（11カテゴリ）
      shopping_101: {
        name: '総合通販・デパート・ふるさと納税',
        baseUrl: 'https://www.chobirich.com/shopping/shop/101',
        maxPages: 20,
        type: 'shopping'
      },
      shopping_102: {
        name: 'ショッピング102',
        baseUrl: 'https://www.chobirich.com/shopping/shop/102',
        maxPages: 15,
        type: 'shopping'
      },
      shopping_103: {
        name: 'ショッピング103',
        baseUrl: 'https://www.chobirich.com/shopping/shop/103',
        maxPages: 15,
        type: 'shopping'
      },
      shopping_104: {
        name: 'ショッピング104',
        baseUrl: 'https://www.chobirich.com/shopping/shop/104',
        maxPages: 15,
        type: 'shopping'
      },
      shopping_105: {
        name: 'ショッピング105',
        baseUrl: 'https://www.chobirich.com/shopping/shop/105',
        maxPages: 15,
        type: 'shopping'
      },
      shopping_106: {
        name: 'ショッピング106',
        baseUrl: 'https://www.chobirich.com/shopping/shop/106',
        maxPages: 15,
        type: 'shopping'
      },
      shopping_107: {
        name: 'ショッピング107',
        baseUrl: 'https://www.chobirich.com/shopping/shop/107',
        maxPages: 15,
        type: 'shopping'
      },
      shopping_108: {
        name: 'ショッピング108',
        baseUrl: 'https://www.chobirich.com/shopping/shop/108',
        maxPages: 15,
        type: 'shopping'
      },
      shopping_109: {
        name: 'ショッピング109',
        baseUrl: 'https://www.chobirich.com/shopping/shop/109',
        maxPages: 15,
        type: 'shopping'
      },
      shopping_110: {
        name: 'ショッピング110',
        baseUrl: 'https://www.chobirich.com/shopping/shop/110',
        maxPages: 15,
        type: 'shopping'
      },
      shopping_111: {
        name: 'ショッピング111',
        baseUrl: 'https://www.chobirich.com/shopping/shop/111',
        maxPages: 15,
        type: 'shopping'
      },
      
      // サービス・クレジットカード・マネーカテゴリ（9カテゴリ）
      service_101: {
        name: 'サービス・クレジットカード・マネー101',
        baseUrl: 'https://www.chobirich.com/earn/apply/101',
        maxPages: 15,
        type: 'service'
      },
      service_103: {
        name: 'サービス・クレジットカード・マネー103',
        baseUrl: 'https://www.chobirich.com/earn/apply/103',
        maxPages: 15,
        type: 'service'
      },
      service_104: {
        name: 'サービス・クレジットカード・マネー104',
        baseUrl: 'https://www.chobirich.com/earn/apply/104',
        maxPages: 15,
        type: 'service'
      },
      service_106: {
        name: 'サービス・クレジットカード・マネー106',
        baseUrl: 'https://www.chobirich.com/earn/apply/106',
        maxPages: 15,
        type: 'service'
      },
      service_107: {
        name: 'サービス・クレジットカード・マネー107',
        baseUrl: 'https://www.chobirich.com/earn/apply/107',
        maxPages: 15,
        type: 'service'
      },
      service_108: {
        name: 'サービス・クレジットカード・マネー108',
        baseUrl: 'https://www.chobirich.com/earn/apply/108',
        maxPages: 15,
        type: 'service'
      },
      service_109: {
        name: 'サービス・クレジットカード・マネー109',
        baseUrl: 'https://www.chobirich.com/earn/apply/109',
        maxPages: 15,
        type: 'service'
      },
      service_110: {
        name: 'サービス・クレジットカード・マネー110',
        baseUrl: 'https://www.chobirich.com/earn/apply/110',
        maxPages: 15,
        type: 'service'
      },
      service_111: {
        name: 'サービス・クレジットカード・マネー111',
        baseUrl: 'https://www.chobirich.com/earn/apply/111',
        maxPages: 15,
        type: 'service'
      }
    };
  }

  /**
   * 初期化
   */
  async initialize() {
    console.log('🚀 拡張版ちょびリッチスクレイパー初期化中...');
    console.log('📋 対応カテゴリ:');
    console.log('   - ショッピングカテゴリ: 11カテゴリ (shop/101-111)');
    console.log('   - サービスカテゴリ: 9カテゴリ (earn/apply/101,103,104,106-111)');
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage',
        '--disable-web-security'
      ]
    });
    
    console.log('✅ 初期化完了');
  }

  /**
   * ポイント値のクリーンアップ
   * 矢印表記（→）の右側の値のみを抽出
   * 「数字+pt」「数字+％」の部分のみを正規表現で抽出（想定外テキスト完全対応）
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
      // カンマ区切り形式（例: 1,234pt, 12,345pt）
      /(\d{1,3}(?:,\d{3})+pt)/gi,
      // 連続数字形式（例: 1234pt, 12345pt）
      /(\d{4,}pt)/gi,
      // 小さい数字形式（例: 123pt, 12pt）
      /(\d{1,3}pt)/gi,
      // パーセント形式（例: 1.5%, 10％）
      /(\d+(?:\.\d+)?[%％])/gi
    ];
    
    // 最初にマッチしたパターンを返す
    for (const pattern of pointPatterns) {
      const match = targetText.match(pattern);
      if (match && match[0]) {
        return match[0];
      }
    }
    
    // どのパターンにもマッチしない場合は空文字
    return '';
  }

  /**
   * カテゴリページから案件データを取得
   * ★ ショッピング・サービス両カテゴリ対応
   */
  async scrapeCategoryPage(categoryUrl, categoryName, categoryType = 'shopping') {
    const page = await this.browser.newPage();
    
    try {
      // PC用設定
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1920, height: 1080 });
      
      // キャッシュ無効化
      await page.setExtraHTTPHeaders({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      console.log(`   📄 取得中: ${categoryUrl}`);
      
      const response = await page.goto(categoryUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      this.stats.totalRequests++;

      if (response.status() !== 200) {
        console.log(`   ❌ HTTPエラー: ${response.status()}`);
        return [];
      }

      // コンテンツ読み込み待機
      await new Promise(resolve => setTimeout(resolve, 3000));

      // ★拡張対応：ショッピング・サービス両カテゴリから完全データ抽出
      const campaigns = await page.evaluate((categoryName, categoryType) => {
        const results = [];
        
        // ポイント値をクリーンアップする関数（ページ内実行用）
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
            // カンマ区切り形式（例: 1,234pt, 12,345pt）
            /(\d{1,3}(?:,\d{3})+pt)/gi,
            // 連続数字形式（例: 1234pt, 12345pt）
            /(\d{4,}pt)/gi,
            // 小さい数字形式（例: 123pt, 12pt）
            /(\d{1,3}pt)/gi,
            // パーセント形式（例: 1.5%, 10％）
            /(\d+(?:\.\d+)?[%％])/gi
          ];
          
          // 最初にマッチしたパターンを返す
          for (const pattern of pointPatterns) {
            const match = targetText.match(pattern);
            if (match && match[0]) {
              return match[0];
            }
          }
          
          // どのパターンにもマッチしない場合は空文字
          return '';
        }
        
        // 共通の案件コンテナセレクタ（両カテゴリ対応）
        const campaignItemSelectors = [
          'li.ad-category__ad',           // ショッピングカテゴリ用
          'li.AdList__item',              // サービスカテゴリ用の可能性
          'div.campaign-item',            // 汎用
          'div.ad-item'                   // 汎用
        ];
        
        let campaignItems = [];
        
        // 最適なセレクタを見つける
        for (const selector of campaignItemSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            campaignItems = elements;
            break;
          }
        }
        
        // フォールバック：ad_detailsリンクから推測
        if (campaignItems.length === 0) {
          const allLinks = document.querySelectorAll('a[href*="/ad_details/"]');
          const containers = new Set();
          
          allLinks.forEach(link => {
            // 親要素を2-3階層遡って案件コンテナを特定
            let container = link;
            for (let i = 0; i < 3; i++) {
              container = container.parentElement;
              if (!container) break;
              
              // 案件コンテナの可能性が高い要素
              if (container.tagName === 'LI' || 
                  container.tagName === 'DIV' && container.className.includes('item')) {
                containers.add(container);
                break;
              }
            }
          });
          
          campaignItems = Array.from(containers);
        }
        
        Array.from(campaignItems).forEach((item, index) => {
          const campaign = {
            id: '',
            title: '',
            url: '',
            points: '',
            category: categoryName,
            categoryType: categoryType,
            scrapedAt: new Date().toISOString(),
            source: 'extended_category_system'
          };

          // タイトルとURL（優先度順で取得）
          const linkSelectors = [
            'a[href*="/ad_details/"]',     // 詳細ページリンク
            'a.campaign-link',             // キャンペーンリンク
            'a.item-link'                  // アイテムリンク
          ];
          
          let linkEl = null;
          for (const selector of linkSelectors) {
            linkEl = item.querySelector(selector);
            if (linkEl) break;
          }
          
          if (linkEl) {
            campaign.title = linkEl.textContent.trim();
            campaign.url = linkEl.href;
            const idMatch = linkEl.href.match(/\/ad_details\/(\d+)/);
            if (idMatch) {
              campaign.id = idMatch[1];
            }
          }

          // ポイント（複数セレクタ対応）
          const pointSelectors = [
            '.ad-category__ad__pt',        // ショッピング用
            '.item-point',                 // 汎用
            '.campaign-point',             // 汎用
            '.cashback',                   // キャッシュバック
            '[class*="pt"]',               // pt含むクラス
            '[class*="point"]'             // point含むクラス
          ];
          
          let pointText = '';
          for (const selector of pointSelectors) {
            const pointEl = item.querySelector(selector);
            if (pointEl) {
              pointText = pointEl.textContent.trim();
              if (pointText) break;
            }
          }
          
          if (pointText) {
            campaign.points = cleanPoints(pointText);
          }

          // ポイントが取得できない場合、テキストから直接探す
          if (!campaign.points) {
            const itemText = item.textContent;
            const pointMatch = itemText.match(/(\d{1,3}(?:,\d{3})*pt|\d+(?:\.\d+)?%|\d+(?:\.\d+)?％)/i);
            if (pointMatch) {
              campaign.points = cleanPoints(pointMatch[1]);
            }
          }

          // 基本データが揃っている場合のみ追加
          if (campaign.id && campaign.title && campaign.url) {
            results.push(campaign);
          }
        });

        return results;
      }, categoryName, categoryType);

      console.log(`   ✅ ${campaigns.length}件の案件を取得`);
      this.stats.campaignsFound += campaigns.length;
      
      return campaigns;

    } catch (error) {
      console.log(`   ❌ エラー: ${error.message}`);
      this.stats.errors.push({
        url: categoryUrl,
        error: error.message,
        time: new Date().toISOString()
      });
      return [];
      
    } finally {
      await page.close();
    }
  }

  /**
   * カテゴリの全ページを処理
   */
  async processCategory(categoryKey, categoryConfig) {
    console.log(`\n📂 ${categoryConfig.type.toUpperCase()}カテゴリ: ${categoryConfig.name}`);
    console.log('-'.repeat(50));
    
    const allCampaigns = [];
    
    for (let page = 1; page <= categoryConfig.maxPages; page++) {
      const pageUrl = page === 1 ? 
        categoryConfig.baseUrl : 
        `${categoryConfig.baseUrl}?page=${page}`;
      
      const campaigns = await this.scrapeCategoryPage(
        pageUrl, 
        categoryConfig.name, 
        categoryConfig.type
      );
      
      if (campaigns.length === 0) {
        console.log(`   ➡️ ページ${page}: 案件なし。次のカテゴリへ`);
        break;
      }
      
      allCampaigns.push(...campaigns);
      this.stats.pagesProcessed++;
      
      // ページ間の待機（レート制限対策）
      if (page < categoryConfig.maxPages) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    this.results.push(...allCampaigns);
    this.stats.categoriesProcessed++;
    
    return allCampaigns;
  }

  /**
   * メインスクレイピング処理
   */
  async scrape(targetCategories = null, categoryTypes = null) {
    this.stats.startTime = new Date();
    console.log('🎯 拡張版スクレイピング開始');
    console.log('=' .repeat(60));
    
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
      
      for (const categoryKey of categoriesToProcess) {
        if (!this.categories[categoryKey]) {
          console.log(`⚠️ 不明なカテゴリ: ${categoryKey}`);
          continue;
        }
        
        await this.processCategory(categoryKey, this.categories[categoryKey]);
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
    
    if (this.stats.totalRequests > 0) {
      const avgTime = duration / this.stats.totalRequests;
      console.log(`\n⚡ パフォーマンス:`);
      console.log(`  平均処理時間: ${avgTime.toFixed(2)}秒/リクエスト`);
      console.log(`  案件取得効率: ${(this.stats.campaignsFound / this.stats.totalRequests).toFixed(1)}件/リクエスト`);
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
   * ヘルパーメソッド：カテゴリ情報を取得
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