#!/usr/bin/env node

/**
 * モッピー改良版スクレイピングシステム
 * アクセス制限・動的コンテンツ対策版
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

class MoppyAdvancedScraper {
  constructor() {
    this.baseUrl = 'https://pc.moppy.jp';
    this.campaigns = [];
    this.errors = [];
    this.apiEndpoints = []; // 発見されたAPIエンドポイント
    this.stats = {
      totalCategories: 0,
      processedCategories: 0,
      totalCampaigns: 0,
      totalPages: 0,
      errors: 0,
      startTime: new Date()
    };
    
    // テスト用カテゴリ（1つから開始）
    this.categoryUrls = [
      { url: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=80&af_sorter=1&page=1', name: '総合通販', type: 'shopping' }
    ];
    
    this.stats.totalCategories = this.categoryUrls.length;
  }

  /**
   * メイン実行関数
   */
  async execute() {
    console.log('🚀 モッピー改良版スクレイピングシステム起動');
    console.log('='.repeat(60));
    console.log('📋 アクセス制限対策・動的コンテンツ対応版');
    console.log('='.repeat(60));

    let browser;
    try {
      browser = await this.launchStealthBrowser();
      
      for (const category of this.categoryUrls) {
        await this.processCategoryAdvanced(browser, category);
        await this.sleep(3000); // レート制限
      }
      
      await this.saveResults();
      this.generateReport();
      
    } catch (error) {
      console.error('💥 致命的エラー:', error);
      this.errors.push({
        type: 'FATAL',
        message: error.message,
        stack: error.stack
      });
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * ステルスブラウザ起動（検出回避）
   */
  async launchStealthBrowser() {
    console.log('🌐 ステルスブラウザ起動中...');
    
    const browser = await puppeteer.launch({
      headless: false, // ヘッドレスモード無効化（検出回避）
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--window-size=1920,1080',
        '--start-maximized',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ],
      defaultViewport: null
    });
    
    // 新しいページで検出回避設定
    const page = await browser.newPage();
    
    // Webdriver プロパティを削除
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });
      
      // Chrome プロパティを追加
      window.chrome = {
        runtime: {}
      };
      
      // Permissions API のオーバーライド
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
    });
    
    await page.close();
    console.log('✅ ステルスモード設定完了');
    
    return browser;
  }

  /**
   * 改良版カテゴリ処理
   */
  async processCategoryAdvanced(browser, category) {
    console.log(`\n📂 カテゴリ処理開始: ${category.name}`);
    
    const page = await browser.newPage();
    
    try {
      // 検出回避設定
      await this.setupStealthPage(page);
      
      // ネットワーク監視設定
      const capturedRequests = [];
      await page.setRequestInterception(true);
      
      page.on('request', (request) => {
        const url = request.url();
        // APIリクエストをキャプチャ
        if (url.includes('api') || url.includes('ajax') || url.includes('json')) {
          capturedRequests.push({
            url,
            method: request.method(),
            headers: request.headers()
          });
        }
        request.continue();
      });
      
      // レスポンス監視
      page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('api') || url.includes('ajax') || url.includes('json')) {
          try {
            const contentType = response.headers()['content-type'] || '';
            if (contentType.includes('json')) {
              const data = await response.json();
              console.log(`  📡 APIレスポンス検出: ${url.slice(0, 50)}...`);
              this.apiEndpoints.push({ url, data });
            }
          } catch (e) {
            // JSON解析エラーは無視
          }
        }
      });
      
      console.log(`  📄 ページアクセス中...`);
      
      // 複数の待機戦略を試す
      const navigationPromise = page.goto(category.url, {
        waitUntil: 'domcontentloaded', // networkidle2の代わりに使用
        timeout: 30000
      });
      
      await navigationPromise;
      console.log('  ✅ ページ読み込み完了');
      
      // 追加の待機
      await this.sleep(3000);
      
      // スクロールして遅延読み込みをトリガー
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight / 2);
      });
      await this.sleep(2000);
      
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await this.sleep(2000);
      
      // 案件データ抽出（複数の方法を試す）
      const campaigns = await this.extractCampaignsAdvanced(page, category);
      
      if (campaigns.length > 0) {
        this.campaigns.push(...campaigns);
        this.stats.totalCampaigns += campaigns.length;
        console.log(`  📦 取得成功: ${campaigns.length}件`);
      } else {
        console.log('  ⚠️ 案件が見つかりませんでした');
        
        // HTMLを保存してデバッグ
        const html = await page.content();
        const debugFile = path.join(__dirname, `moppy_debug_${Date.now()}.html`);
        await fs.writeFile(debugFile, html);
        console.log(`  💾 デバッグHTML保存: ${debugFile}`);
      }
      
      // キャプチャされたリクエストを記録
      if (capturedRequests.length > 0) {
        console.log(`  🔍 検出されたAPIリクエスト: ${capturedRequests.length}件`);
      }
      
      this.stats.processedCategories++;
      
    } catch (error) {
      console.error(`  ❌ エラー: ${error.message}`);
      this.errors.push({
        category: category.name,
        error: error.message
      });
    } finally {
      await page.close();
    }
  }

  /**
   * ステルスページ設定
   */
  async setupStealthPage(page) {
    // User-Agent設定
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // その他のヘッダー設定
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ja-JP,ja;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    });
    
    // Webdriver検出回避
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });
    });
  }

  /**
   * 改良版案件データ抽出
   */
  async extractCampaignsAdvanced(page, category) {
    return await page.evaluate((categoryInfo) => {
      const campaigns = [];
      
      // 方法1: 全てのリンクから案件を探す
      const allLinks = document.querySelectorAll('a[href]');
      const campaignLinks = new Map(); // 重複除去用
      
      allLinks.forEach((link) => {
        const href = link.href;
        
        // 案件URLパターンにマッチ
        if (href.includes('/shopping/detail.php') || 
            href.includes('/ad/detail.php') ||
            href.includes('site_id=')) {
          
          // site_idを抽出してユニークキーとする
          const siteIdMatch = href.match(/site_id=(\d+)/);
          const siteId = siteIdMatch ? siteIdMatch[1] : href;
          
          if (!campaignLinks.has(siteId)) {
            // 情報収集
            let container = link.closest('li, div, article, section, tr, td');
            if (!container) container = link.parentElement;
            
            const campaign = {
              id: `moppy_${siteId}`,
              url: href,
              title: '',
              points: '',
              image: ''
            };
            
            // タイトル取得（複数方法）
            campaign.title = link.title || 
                            link.getAttribute('alt') ||
                            link.getAttribute('data-title');
            
            // 画像からタイトル取得
            const img = link.querySelector('img');
            if (img) {
              campaign.image = img.src;
              if (!campaign.title) {
                campaign.title = img.alt || img.title;
              }
            }
            
            // テキストからタイトル取得
            if (!campaign.title) {
              const textContent = link.textContent.trim();
              if (textContent && textContent.length > 0 && textContent.length < 200) {
                campaign.title = textContent;
              }
            }
            
            // ポイント情報を周辺から探す
            if (container) {
              const containerHtml = container.innerHTML;
              const containerText = container.textContent;
              
              // ポイントパターン（複数）
              const patterns = [
                /(\d{1,5}(?:,\d{3})*)\s*[Pp]/,
                /(\d+(?:\.\d+)?)\s*[%％]/,
                /(\d{1,5}(?:,\d{3})*)\s*ポイント/,
                /(\d{1,5}(?:,\d{3})*)\s*pt/i,
                /最大\s*(\d{1,5}(?:,\d{3})*)/
              ];
              
              patterns.forEach(pattern => {
                if (!campaign.points) {
                  const match = containerText.match(pattern);
                  if (match) {
                    campaign.points = match[0];
                  }
                }
              });
              
              // ポイント要素を直接探す
              if (!campaign.points) {
                const pointElements = container.querySelectorAll('[class*="point"], [class*="Point"], [class*="reward"]');
                pointElements.forEach(el => {
                  if (!campaign.points && el.textContent) {
                    const text = el.textContent.trim();
                    if (/\d/.test(text)) {
                      campaign.points = text;
                    }
                  }
                });
              }
            }
            
            // タイトルがある場合のみ追加
            if (campaign.title && campaign.title.length > 0) {
              campaignLinks.set(siteId, campaign);
            }
          }
        }
      });
      
      // 方法2: 特定のクラス・構造を探す
      const possibleContainers = [
        '.campaign-item',
        '.offer-item',
        '.point-item',
        '[class*="campaign"]',
        '[class*="offer"]',
        '[class*="item"]'
      ];
      
      possibleContainers.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          const link = el.querySelector('a[href*="detail.php"]');
          if (link) {
            const href = link.href;
            const siteIdMatch = href.match(/site_id=(\d+)/);
            const siteId = siteIdMatch ? siteIdMatch[1] : null;
            
            if (siteId && !campaignLinks.has(siteId)) {
              const campaign = {
                id: `moppy_${siteId}`,
                url: href,
                title: el.querySelector('img')?.alt || el.textContent.trim().slice(0, 100),
                points: '',
                image: el.querySelector('img')?.src || ''
              };
              
              // ポイント探索
              const pointText = el.textContent;
              const pointMatch = pointText.match(/(\d{1,5}(?:,\d{3})*)\s*[Pp]/) ||
                                pointText.match(/(\d+(?:\.\d+)?)\s*%/);
              if (pointMatch) {
                campaign.points = pointMatch[0];
              }
              
              if (campaign.title) {
                campaignLinks.set(siteId, campaign);
              }
            }
          }
        });
      });
      
      // MapからArrayに変換
      campaignLinks.forEach((campaign, siteId) => {
        campaigns.push({
          ...campaign,
          category: categoryInfo.name,
          categoryType: categoryInfo.type,
          device: 'All',
          scrapedAt: new Date().toISOString()
        });
      });
      
      return campaigns;
    }, category);
  }

  /**
   * 結果保存
   */
  async saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `moppy_advanced_${timestamp}.json`;
    const filepath = path.join(__dirname, '..', '..', '..', 'data', 'moppy', filename);
    
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    
    const output = {
      scrapeDate: new Date().toISOString(),
      version: '2.0.0',
      systemType: 'moppy_advanced_scraper',
      stats: {
        totalCampaigns: this.campaigns.length,
        totalCategories: this.stats.processedCategories,
        executionTime: Math.round((new Date() - this.stats.startTime) / 1000),
        errors: this.errors.length,
        apiEndpointsFound: this.apiEndpoints.length
      },
      campaigns: this.campaigns,
      apiEndpoints: this.apiEndpoints,
      errors: this.errors
    };
    
    await fs.writeFile(filepath, JSON.stringify(output, null, 2));
    console.log(`\n💾 保存完了: ${filename}`);
  }

  /**
   * レポート生成
   */
  generateReport() {
    const executionTime = Math.round((new Date() - this.stats.startTime) / 1000);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 スクレイピング完了レポート');
    console.log('='.repeat(60));
    console.log(`✅ 取得案件数: ${this.campaigns.length}件`);
    console.log(`📂 処理カテゴリ: ${this.stats.processedCategories}/${this.stats.totalCategories}`);
    console.log(`🔍 発見APIエンドポイント: ${this.apiEndpoints.length}件`);
    console.log(`⏱️ 実行時間: ${executionTime}秒`);
    console.log(`❌ エラー数: ${this.errors.length}件`);
    
    if (this.campaigns.length > 0) {
      console.log('\n📦 取得案件サンプル（最初の3件）:');
      this.campaigns.slice(0, 3).forEach((c, i) => {
        console.log(`${i + 1}. ${c.title}`);
        console.log(`   URL: ${c.url}`);
        console.log(`   ポイント: ${c.points || '未検出'}`);
      });
    }
    
    if (this.apiEndpoints.length > 0) {
      console.log('\n📡 検出されたAPIエンドポイント:');
      this.apiEndpoints.slice(0, 3).forEach(ep => {
        console.log(`  - ${ep.url.slice(0, 80)}...`);
      });
    }
  }

  /**
   * スリープ関数
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 実行
if (require.main === module) {
  const scraper = new MoppyAdvancedScraper();
  scraper.execute().catch(console.error);
}

module.exports = MoppyAdvancedScraper;