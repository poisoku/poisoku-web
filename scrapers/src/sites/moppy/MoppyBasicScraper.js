#!/usr/bin/env node

/**
 * モッピー基本スクレイピングシステム
 * ちょびリッチv3システムをベースに、モッピー専用にカスタマイズ
 * 
 * 機能:
 * - Web案件（サービス・ショッピング）の取得
 * - ページネーション自動対応
 * - 1pt = 1円の還元率計算
 * - エラー回避・リトライ機能
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

class MoppyBasicScraper {
  constructor() {
    this.baseUrl = 'https://pc.moppy.jp';
    this.campaigns = [];
    this.errors = [];
    this.stats = {
      totalCategories: 0,
      processedCategories: 0,
      totalCampaigns: 0,
      totalPages: 0,
      errors: 0,
      startTime: new Date()
    };
    
    // カテゴリURL（初期は10カテゴリでテスト）
    this.categoryUrls = [
      // サービスカテゴリ（最初の5つ）
      { url: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=51&af_sorter=1&page=1', name: 'サービス_51', type: 'service' },
      { url: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=128&af_sorter=1&page=1', name: 'サービス_128', type: 'service' },
      { url: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=53&af_sorter=1&page=1', name: 'サービス_53', type: 'service' },
      { url: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=72&af_sorter=1&page=1', name: 'サービス_72', type: 'service' },
      { url: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=73&af_sorter=1&page=1', name: 'サービス_73', type: 'service' },
      
      // ショッピングカテゴリ（最初の5つ）
      { url: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=80&af_sorter=1&page=1', name: 'ショッピング_80', type: 'shopping' },
      { url: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=143&af_sorter=1&page=1', name: 'ショッピング_143', type: 'shopping' },
      { url: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=195&af_sorter=1&page=1', name: 'ショッピング_195', type: 'shopping' },
      { url: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=86&af_sorter=1&page=1', name: 'ショッピング_86', type: 'shopping' },
      { url: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=107&af_sorter=1&page=1', name: 'ショッピング_107', type: 'shopping' }
    ];
    
    this.stats.totalCategories = this.categoryUrls.length;
  }

  /**
   * メイン実行関数
   */
  async execute() {
    console.log('🚀 モッピー基本スクレイピングシステム起動');
    console.log('='.repeat(60));
    console.log(`📋 対象カテゴリ数: ${this.categoryUrls.length}`);
    console.log(`🕐 開始時刻: ${this.stats.startTime.toLocaleString('ja-JP')}`);
    console.log('='.repeat(60));

    let browser;
    try {
      browser = await this.launchBrowser();
      
      // カテゴリごとに処理（15カテゴリごとにブラウザ再起動）
      for (let i = 0; i < this.categoryUrls.length; i++) {
        // ブラウザ再起動（Protocol error対策）
        if (i > 0 && i % 15 === 0) {
          console.log('\n🔄 ブラウザ再起動（メモリ解放）');
          await browser.close();
          await this.sleep(3000);
          browser = await this.launchBrowser();
        }
        
        const category = this.categoryUrls[i];
        await this.processCategoryWithAllPages(browser, category);
        
        // レート制限
        if (i < this.categoryUrls.length - 1) {
          await this.sleep(2000);
        }
      }
      
      // 結果保存
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
   * ブラウザ起動
   */
  async launchBrowser() {
    return await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ],
      defaultViewport: {
        width: 1920,
        height: 1080
      }
    });
  }

  /**
   * カテゴリの全ページを処理
   */
  async processCategoryWithAllPages(browser, category) {
    console.log(`\n📂 カテゴリ処理開始: ${category.name}`);
    
    let page = 1;
    let hasMorePages = true;
    let categoryStats = {
      campaigns: 0,
      pages: 0
    };
    
    while (hasMorePages) {
      const url = category.url.replace('page=1', `page=${page}`);
      const pageTab = await browser.newPage();
      
      try {
        // User-Agent設定
        await pageTab.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // ページアクセス
        console.log(`  📄 ページ${page}取得中...`);
        await pageTab.goto(url, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        
        // コンテンツ読み込み待機
        await pageTab.waitForSelector('.point-get-list', { timeout: 10000 }).catch(() => {});
        
        // 案件データ抽出
        const campaignsOnPage = await this.extractCampaigns(pageTab, category);
        
        if (campaignsOnPage.length === 0) {
          hasMorePages = false;
          console.log(`  ✅ 最終ページ到達（ページ${page}）`);
        } else {
          this.campaigns.push(...campaignsOnPage);
          categoryStats.campaigns += campaignsOnPage.length;
          categoryStats.pages++;
          this.stats.totalCampaigns += campaignsOnPage.length;
          console.log(`    取得: ${campaignsOnPage.length}件`);
          
          // 30件未満なら最終ページ
          if (campaignsOnPage.length < 30) {
            hasMorePages = false;
          } else {
            page++;
            await this.sleep(1500);
          }
        }
        
      } catch (error) {
        console.error(`  ❌ ページ${page}エラー:`, error.message);
        this.errors.push({
          category: category.name,
          page,
          error: error.message
        });
        hasMorePages = false;
      } finally {
        await pageTab.close();
      }
    }
    
    this.stats.processedCategories++;
    this.stats.totalPages += categoryStats.pages;
    console.log(`  📊 カテゴリ完了: ${categoryStats.campaigns}件（${categoryStats.pages}ページ）`);
  }

  /**
   * 案件データ抽出
   */
  async extractCampaigns(page, category) {
    return await page.evaluate((categoryInfo) => {
      const campaigns = [];
      
      // 案件リスト要素を取得
      const campaignElements = document.querySelectorAll('.point-get-list li');
      
      campaignElements.forEach((element) => {
        try {
          // タイトル取得
          const titleEl = element.querySelector('.item-title a');
          const title = titleEl ? titleEl.textContent.trim() : '';
          
          // URL取得
          const url = titleEl ? titleEl.href : '';
          
          // ポイント取得（複数パターン対応）
          let points = '';
          let pointsYen = null;
          
          // パターン1: .point-num内のテキスト
          const pointNumEl = element.querySelector('.point-num');
          if (pointNumEl) {
            points = pointNumEl.textContent.trim();
          }
          
          // パターン2: .item-point内のテキスト
          if (!points) {
            const itemPointEl = element.querySelector('.item-point');
            if (itemPointEl) {
              points = itemPointEl.textContent.trim();
            }
          }
          
          // ポイント正規化と円換算
          if (points) {
            // "P"を統一、スペース除去
            points = points.replace(/[Pp]/, 'P').replace(/\s+/g, '');
            
            // 円換算（1P = 1円）
            const pointMatch = points.match(/(\d+(?:,\d+)*)P/);
            if (pointMatch) {
              const pointValue = parseInt(pointMatch[1].replace(/,/g, ''));
              pointsYen = `${pointValue.toLocaleString()}円`;
            }
            // パーセント案件はそのまま
            else if (points.includes('%')) {
              // 不要なテキストを除去
              const percentMatch = points.match(/(\d+(?:\.\d+)?%)/);
              if (percentMatch) {
                points = percentMatch[1];
              }
            }
          }
          
          // 案件IDの抽出（URLから）
          let campaignId = '';
          const idMatch = url.match(/[?&]id=(\d+)/);
          if (idMatch) {
            campaignId = idMatch[1];
          }
          
          if (title && url) {
            campaigns.push({
              id: `moppy_${campaignId || Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              title,
              url,
              points,
              pointsYen,
              category: categoryInfo.name,
              categoryType: categoryInfo.type,
              device: 'All', // 基本的に全デバイス対応
              scrapedAt: new Date().toISOString()
            });
          }
        } catch (err) {
          console.error('案件抽出エラー:', err);
        }
      });
      
      return campaigns;
    }, category);
  }

  /**
   * 結果保存
   */
  async saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `moppy_basic_${timestamp}.json`;
    const filepath = path.join(__dirname, '..', '..', '..', 'data', 'moppy', filename);
    
    // ディレクトリ作成
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    
    const output = {
      scrapeDate: new Date().toISOString(),
      version: '1.0.0',
      systemType: 'moppy_basic_scraper',
      stats: {
        totalCampaigns: this.campaigns.length,
        totalCategories: this.stats.processedCategories,
        totalPages: this.stats.totalPages,
        executionTime: Math.round((new Date() - this.stats.startTime) / 1000),
        errors: this.errors.length
      },
      campaigns: this.campaigns,
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
    console.log(`📄 処理ページ数: ${this.stats.totalPages}ページ`);
    console.log(`⏱️ 実行時間: ${executionTime}秒`);
    console.log(`❌ エラー数: ${this.errors.length}件`);
    
    // カテゴリ別集計
    const categoryStats = {};
    this.campaigns.forEach(campaign => {
      if (!categoryStats[campaign.category]) {
        categoryStats[campaign.category] = 0;
      }
      categoryStats[campaign.category]++;
    });
    
    console.log('\n📈 カテゴリ別取得数:');
    Object.entries(categoryStats).forEach(([category, count]) => {
      console.log(`  ${category}: ${count}件`);
    });
    
    if (this.errors.length > 0) {
      console.log('\n⚠️ エラー詳細:');
      this.errors.slice(0, 5).forEach(error => {
        console.log(`  - ${error.category || 'SYSTEM'}: ${error.error || error.message}`);
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
  const scraper = new MoppyBasicScraper();
  scraper.execute().catch(console.error);
}

module.exports = MoppyBasicScraper;