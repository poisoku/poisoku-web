#!/usr/bin/env node

/**
 * 軽量スクレイピング用ヘルパークラス
 * 差分取得システム専用の高速・軽量データ取得
 */

const puppeteer = require('puppeteer');

class LightweightScraper {
  constructor() {
    this.browser = null;
    this.config = {
      // 軽量設定
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 768 }, // 軽量ビューポート
      timeout: 15000,  // 短縮タイムアウト
      pageDelay: 1000, // 短縮待機時間
      maxConcurrent: 3, // 軽量並列処理
      disableImages: true,  // 画像読み込み無効
      disableCSS: true,     // CSS読み込み無効
      disableJavaScript: false // JSは必要
    };
  }

  /**
   * ブラウザ初期化
   */
  async initializeBrowser() {
    if (this.browser) return this.browser;

    console.log('🚀 軽量ブラウザ起動中...');
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-default-apps',
        '--no-first-run',
        '--no-default-browser-check',
        '--memory-pressure-off',
        '--max_old_space_size=2048'
      ]
    });

    console.log('✅ 軽量ブラウザ起動完了');
    return this.browser;
  }

  /**
   * 軽量ページ作成
   */
  async createLightweightPage() {
    const browser = await this.initializeBrowser();
    const page = await browser.newPage();

    // 軽量設定適用
    await page.setUserAgent(this.config.userAgent);
    await page.setViewport(this.config.viewport);
    
    // リソース制限（軽量化）
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      
      if (this.config.disableImages && resourceType === 'image') {
        request.abort();
      } else if (this.config.disableCSS && resourceType === 'stylesheet') {
        request.abort();
      } else if (resourceType === 'font' || resourceType === 'media') {
        request.abort();
      } else {
        request.continue();
      }
    });

    return page;
  }

  /**
   * Web案件軽量取得
   */
  async getLightweightWebCampaigns() {
    const campaigns = [];
    const categories = [
      'shopping_101', 'shopping_102', 'shopping_103', 'shopping_104', 'shopping_105',
      'shopping_106', 'shopping_107', 'shopping_108', 'shopping_109', 'shopping_110', 'shopping_111',
      'service_101', 'service_103', 'service_104', 'service_106', 
      'service_107', 'service_108', 'service_109', 'service_110', 'service_111'
    ];

    console.log('🌐 Web案件軽量取得開始...');

    for (const categoryKey of categories) {
      try {
        const categoryCampaigns = await this.scrapeCategoryLightweight(categoryKey);
        campaigns.push(...categoryCampaigns);
        
        console.log(`   ✅ ${categoryKey}: ${categoryCampaigns.length}件`);
        
        // 軽量待機
        await this.sleep(this.config.pageDelay);
        
      } catch (error) {
        console.log(`   ❌ ${categoryKey}: ${error.message}`);
      }
    }

    return campaigns;
  }

  /**
   * カテゴリ軽量スクレイピング
   */
  async scrapeCategoryLightweight(categoryKey) {
    const page = await this.createLightweightPage();
    const campaigns = [];

    try {
      const url = this.buildCategoryUrl(categoryKey);
      
      await page.goto(url, {
        waitUntil: 'domcontentloaded', // 軽量読み込み
        timeout: this.config.timeout
      });

      // 軽量データ抽出（ExtendedChobirichScraperと同じセレクタ使用）
      const lightweightData = await page.evaluate((categoryKey) => {
        
        // ポイント清理関数
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
        
        // 案件コンテナ取得（ExtendedChobirichScraperと同じセレクタ）
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
        
        const results = [];

        items.forEach((element, index) => {
          try {
            // タイトルリンク取得
            const titleLink = element.querySelector('a[href*="/ad_details/"]');
            if (!titleLink) return;
            
            const title = titleLink.textContent.trim();
            const href = titleLink.getAttribute('href');
            
            // ポイント情報取得
            const pointElements = element.querySelectorAll('*');
            let points = '0pt';
            
            for (const el of pointElements) {
              const text = el.textContent;
              const cleaned = cleanPoints(text);
              if (cleaned) {
                points = cleaned;
                break;
              }
            }
            
            // ID抽出
            const idMatch = href.match(/\/ad_details\/(\d+)\//);
            const id = idMatch ? idMatch[1] : `temp_${Date.now()}_${index}`;

            results.push({
              id: id,
              title: title,
              points: points,
              url: href.startsWith('http') ? href : `https://www.chobirich.com${href}`,
              platform: 'web',
              category: categoryKey,
              scrapedAt: new Date().toISOString(),
              lightweight: true
            });
          } catch (e) {
            // 個別要素エラーは無視
          }
        });

        return results;
      }, categoryKey);

      campaigns.push(...lightweightData);

    } catch (error) {
      console.log(`カテゴリ ${categoryKey} 軽量取得エラー:`, error.message);
    } finally {
      await page.close();
    }

    return campaigns;
  }

  /**
   * モバイル案件軽量取得
   */
  async getLightweightMobileCampaigns(platform = 'ios') {
    const page = await this.createLightweightPage();
    const campaigns = [];

    try {
      // プラットフォーム別UA設定
      const mobileUA = platform === 'ios' 
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
        : 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36';

      await page.setUserAgent(mobileUA);

      const url = 'https://www.chobirich.com/smartphone?sort=point';
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.config.timeout
      });

      // 軽量モバイルデータ抽出
      const mobileData = await page.evaluate((platform) => {
        const campaignElements = document.querySelectorAll('.campaign-item, .app-item');
        const results = [];

        campaignElements.forEach((element, index) => {
          try {
            const titleElement = element.querySelector('.title, .app-title');
            const pointElement = element.querySelector('.point, .reward');
            const linkElement = element.querySelector('a');

            if (titleElement && linkElement) {
              const title = titleElement.textContent.trim();
              const points = pointElement ? pointElement.textContent.trim() : '0pt';
              const href = linkElement.getAttribute('href');

              const idMatch = href.match(/(\\d+)/);
              const id = idMatch ? idMatch[1] : `mobile_${Date.now()}_${index}`;

              results.push({
                id: id,
                title: title,
                points: points,
                url: href.startsWith('http') ? href : `https://www.chobirich.com${href}`,
                platform: platform,
                category: 'mobile_app',
                scrapedAt: new Date().toISOString(),
                lightweight: true
              });
            }
          } catch (e) {
            // 個別要素エラーは無視
          }
        });

        return results;
      }, platform);

      campaigns.push(...mobileData);

    } catch (error) {
      console.log(`モバイル${platform}軽量取得エラー:`, error.message);
    } finally {
      await page.close();
    }

    return campaigns;
  }

  /**
   * カテゴリURL生成
   */
  buildCategoryUrl(categoryKey) {
    const baseUrls = {
      shopping_101: 'https://www.chobirich.com/shopping/shop/101',
      shopping_102: 'https://www.chobirich.com/shopping/shop/102',
      shopping_103: 'https://www.chobirich.com/shopping/shop/103',
      shopping_104: 'https://www.chobirich.com/shopping/shop/104',
      shopping_105: 'https://www.chobirich.com/shopping/shop/105',
      shopping_106: 'https://www.chobirich.com/shopping/shop/106',
      shopping_107: 'https://www.chobirich.com/shopping/shop/107',
      shopping_108: 'https://www.chobirich.com/shopping/shop/108',
      shopping_109: 'https://www.chobirich.com/shopping/shop/109',
      shopping_110: 'https://www.chobirich.com/shopping/shop/110',
      shopping_111: 'https://www.chobirich.com/shopping/shop/111',
      service_101: 'https://www.chobirich.com/earn/apply/101',
      service_103: 'https://www.chobirich.com/earn/apply/103',
      service_104: 'https://www.chobirich.com/earn/apply/104',
      service_106: 'https://www.chobirich.com/earn/apply/106',
      service_107: 'https://www.chobirich.com/earn/apply/107',
      service_108: 'https://www.chobirich.com/earn/apply/108',
      service_109: 'https://www.chobirich.com/earn/apply/109',
      service_110: 'https://www.chobirich.com/earn/apply/110',
      service_111: 'https://www.chobirich.com/earn/apply/111'
    };

    return baseUrls[categoryKey] || `https://www.chobirich.com/category/${categoryKey}`;
  }

  /**
   * クリーンアップ
   */
  async cleanup() {
    if (this.browser) {
      console.log('🧹 軽量ブラウザクリーンアップ中...');
      await this.browser.close();
      this.browser = null;
      console.log('✅ クリーンアップ完了');
    }
  }

  /**
   * スリープ
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = LightweightScraper;