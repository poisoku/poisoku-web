#!/usr/bin/env node

/**
 * モッピー全案件包括テストシステム
 * スマホアプリ案件以外のすべてのカテゴリを対象
 * 各ページごとの詳細な取得数を報告
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

class MoppyComprehensiveTest {
  constructor() {
    this.baseUrl = 'https://pc.moppy.jp';
    this.campaigns = [];
    this.errors = [];
    this.pageReports = []; // ページ別詳細レポート
    this.stats = {
      totalCategories: 0,
      processedCategories: 0,
      totalCampaigns: 0,
      campaignsWithPoints: 0,
      totalPages: 0,
      pointDetectionRate: 0,
      startTime: new Date()
    };
    
    // 発見された主要カテゴリ（スマホアプリ案件除外）
    this.allCategories = [
      // ショッピングカテゴリ
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=80&af_sorter=1&page=', name: '総合通販', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=81&af_sorter=1&page=', name: 'レディースファッション', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=82&af_sorter=1&page=', name: 'メンズファッション', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=83&af_sorter=1&page=', name: 'バッグ・小物・ブランド雑貨', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=84&af_sorter=1&page=', name: '靴', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=85&af_sorter=1&page=', name: 'インナー・下着・ナイトウェア', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=86&af_sorter=1&page=', name: 'ベビー・キッズ・マタニティ', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=87&af_sorter=1&page=', name: '食品', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=88&af_sorter=1&page=', name: 'ドリンク・お酒', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=89&af_sorter=1&page=', name: '健康食品', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=90&af_sorter=1&page=', name: '化粧品・スキンケア', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=91&af_sorter=1&page=', name: '美容', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=92&af_sorter=1&page=', name: 'ヘアケア', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=93&af_sorter=1&page=', name: 'スポーツ', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=94&af_sorter=1&page=', name: 'アウトドア', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=95&af_sorter=1&page=', name: '家電', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=96&af_sorter=1&page=', name: 'カメラ', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=97&af_sorter=1&page=', name: 'PC・タブレット', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=98&af_sorter=1&page=', name: 'スマートフォン・携帯電話', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=100&af_sorter=1&page=', name: '電子書籍・本・漫画', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=101&af_sorter=1&page=', name: '家具・インテリア', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=102&af_sorter=1&page=', name: '花・ガーデニング', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=103&af_sorter=1&page=', name: 'キッチン・日用品・文具', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=104&af_sorter=1&page=', name: 'ペット用品・生き物', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=105&af_sorter=1&page=', name: '車・カー用品', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=143&af_sorter=1&page=', name: 'デパート・百貨店', type: 'shopping' },
      
      // サービスカテゴリ  
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=51&af_sorter=1&page=', name: '金融・投資', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=52&af_sorter=1&page=', name: 'クレジットカード', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=53&af_sorter=1&page=', name: 'VISA', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=54&af_sorter=1&page=', name: 'Mastercard', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=55&af_sorter=1&page=', name: 'JCB', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=56&af_sorter=1&page=', name: 'アメリカン・エキスプレス', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=57&af_sorter=1&page=', name: 'ダイナースクラブカード', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=58&af_sorter=1&page=', name: '楽天Edy', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=59&af_sorter=1&page=', name: 'iD', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=60&af_sorter=1&page=', name: 'WAON', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=61&af_sorter=1&page=', name: 'PASMO', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=62&af_sorter=1&page=', name: 'Suica', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=63&af_sorter=1&page=', name: 'QUICPay', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=64&af_sorter=1&page=', name: 'Smartplus', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=65&af_sorter=1&page=', name: '無料', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=66&af_sorter=1&page=', name: '初月無料', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=67&af_sorter=1&page=', name: '口座開設', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=68&af_sorter=1&page=', name: '無料＆即P', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=69&af_sorter=1&page=', name: '車検・中古車', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=70&af_sorter=1&page=', name: '配車サービス', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=71&af_sorter=1&page=', name: 'その他乗り物', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=72&af_sorter=1&page=', name: 'その他投資', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=111&af_sorter=1&page=', name: '飲食店予約', type: 'service' }
    ];
    
    this.stats.totalCategories = this.allCategories.length;
  }

  /**
   * メイン実行関数
   */
  async execute() {
    console.log('🎯 モッピー全案件包括テストシステム起動');
    console.log('='.repeat(80));
    console.log('📋 スマホアプリ案件以外の全カテゴリ対応');
    console.log(`📊 対象カテゴリ数: ${this.allCategories.length}カテゴリ`);
    console.log('='.repeat(80));

    let browser;
    try {
      browser = await this.launchOptimizedBrowser();
      
      for (const [index, category] of this.allCategories.entries()) {
        console.log(`\n[${index + 1}/${this.allCategories.length}] 処理中...`);
        await this.processCategoryComprehensive(browser, category, index + 1);
        await this.sleep(1000); // カテゴリ間の待機時間を短縮
      }
      
      // 統計計算
      this.stats.pointDetectionRate = this.stats.campaignsWithPoints / this.stats.totalCampaigns;
      
      await this.saveResults();
      this.generateDetailedReport();
      
    } catch (error) {
      console.error('💥 致命的エラー:', error);
      this.errors.push({
        type: 'FATAL',
        message: error.message
      });
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * 最適化ブラウザ起動
   */
  async launchOptimizedBrowser() {
    console.log('🚀 最適化ブラウザ起動中...');
    
    return await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--window-size=1920,1080',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ],
      defaultViewport: { width: 1920, height: 1080 }
    });
  }

  /**
   * 包括的カテゴリ処理
   */
  async processCategoryComprehensive(browser, category, categoryNumber) {
    console.log(`📂 カテゴリ${categoryNumber}: ${category.name}`);
    
    let currentPage = 1;
    let hasMorePages = true;
    let categoryTotalCampaigns = 0;
    let categoryPages = [];
    
    while (hasMorePages && currentPage <= 10) { // 最大10ページに制限（安全のため）
      const pageUrl = `${category.baseUrl}${currentPage}`;
      
      const page = await browser.newPage();
      
      try {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.goto(pageUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        
        await this.sleep(2000);
        
        // 案件抽出
        const campaigns = await this.extractMainContentCampaigns(page, category, currentPage);
        
        if (campaigns.length > 0) {
          this.campaigns.push(...campaigns);
          categoryTotalCampaigns += campaigns.length;
          
          // ポイント検出数をカウント
          const withPoints = campaigns.filter(c => c.points && c.points !== '').length;
          this.stats.campaignsWithPoints += withPoints;
          
          // ページ別レポートに記録
          const pageReport = {
            categoryNumber,
            categoryName: category.name,
            categoryType: category.type,
            pageNumber: currentPage,
            campaignCount: campaigns.length,
            campaignsWithPoints: withPoints,
            url: pageUrl
          };
          
          categoryPages.push(pageReport);
          this.pageReports.push(pageReport);
          
          console.log(`  📄 ページ${currentPage}: ${campaigns.length}件取得 (ポイント情報: ${withPoints}件)`);
          
          // 次のページの存在確認（簡易版）
          const nextPageItems = await page.evaluate((nextPage) => {
            // 次のページのリンクが存在するかチェック
            const nextLink = document.querySelector(`a[href*="page=${nextPage}"]`);
            return !!nextLink;
          }, currentPage + 1);
          
          if (!nextPageItems) {
            hasMorePages = false;
            console.log(`  🏁 ページ${currentPage}が最終ページ`);
          }
          
          currentPage++;
          
        } else {
          hasMorePages = false;
          if (currentPage === 1) {
            console.log(`  ⚠️ 案件なし（空のカテゴリ）`);
          } else {
            console.log(`  🏁 ページ${currentPage}に案件なし。処理終了`);
          }
        }
        
      } catch (error) {
        console.error(`  ❌ ページ${currentPage}エラー: ${error.message}`);
        this.errors.push({
          category: category.name,
          page: currentPage,
          error: error.message
        });
        hasMorePages = false;
      } finally {
        await page.close();
      }
      
      await this.sleep(500); // ページ間の待機時間を短縮
    }
    
    this.stats.totalCampaigns += categoryTotalCampaigns;
    this.stats.totalPages += categoryPages.length;
    this.stats.processedCategories++;
    
    console.log(`  📊 ${category.name}完了: ${categoryTotalCampaigns}件 (${categoryPages.length}ページ)`);
  }

  /**
   * メインコンテンツエリアからの案件抽出（簡略版）
   */
  async extractMainContentCampaigns(page, category, pageNumber) {
    return await page.evaluate((categoryInfo, pageNum) => {
      const campaigns = new Map();
      
      // メインコンテンツエリアの特定
      const mainContentItems = document.querySelectorAll('.m-list__item');
      
      mainContentItems.forEach(container => {
        // 除外エリアチェック
        if (container.closest('.m-trending-words__list-item') ||
            container.closest('.m-trending-words')) {
          return;
        }
        
        // 案件リンクの抽出
        const links = container.querySelectorAll('a[href]');
        
        links.forEach(link => {
          const href = link.href;
          
          if (href.includes('/shopping/detail.php') || 
              href.includes('/ad/detail.php')) {
            
            if (href.includes('track_ref=tw')) {
              return;
            }
            
            const siteIdMatch = href.match(/site_id=(\d+)/);
            const siteId = siteIdMatch ? siteIdMatch[1] : null;
            
            if (siteId && !campaigns.has(siteId)) {
              const campaign = {
                id: `moppy_${siteId}`,
                url: href,
                title: '',
                points: '',
                pageNumber: pageNum
              };
              
              // タイトル取得
              campaign.title = link.title || 
                              link.getAttribute('data-title') ||
                              link.getAttribute('alt');
              
              const img = link.querySelector('img');
              if (img && !campaign.title) {
                campaign.title = img.alt || img.title;
              }
              
              if (!campaign.title) {
                const linkText = link.textContent.trim();
                if (linkText && linkText.length > 0 && linkText.length < 200) {
                  campaign.title = linkText.replace(/\s+/g, ' ').trim();
                }
              }
              
              // ポイント情報の抽出（簡略版）
              const containerText = container.textContent || '';
              const pointPatterns = [
                /(\d{1,6}(?:,\d{3})*)(?:\s*)([PpＰ])/,
                /(\d+(?:\.\d+)?)(?:\s*)([%％])/,
                /(\d{1,6}(?:,\d{3})*)(?:\s*)円相当/,
                /最大(?:\s*)(\d{1,6}(?:,\d{3})*)/
              ];
              
              for (const pattern of pointPatterns) {
                const match = containerText.match(pattern);
                if (match) {
                  campaign.points = match[0];
                  break;
                }
              }
              
              if (campaign.title && campaign.title.length > 0) {
                campaigns.set(siteId, campaign);
              }
            }
          }
        });
      });
      
      // 結果の整形
      const results = [];
      campaigns.forEach(campaign => {
        results.push({
          ...campaign,
          category: categoryInfo.name,
          categoryType: categoryInfo.type,
          device: 'All',
          scrapedAt: new Date().toISOString()
        });
      });
      
      return results;
    }, category, pageNumber);
  }

  /**
   * 結果保存
   */
  async saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `moppy_comprehensive_test_${timestamp}.json`;
    const filepath = path.join(__dirname, 'data', 'moppy', filename);
    
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    
    const output = {
      testDate: new Date().toISOString(),
      version: '6.0.0',
      systemType: 'moppy_comprehensive_test',
      description: '全カテゴリ対応・包括テスト版',
      stats: {
        totalCampaigns: this.campaigns.length,
        campaignsWithPoints: this.stats.campaignsWithPoints,
        pointDetectionRate: Math.round(this.stats.pointDetectionRate * 100),
        totalCategories: this.stats.processedCategories,
        totalPages: this.stats.totalPages,
        executionTime: Math.round((new Date() - this.stats.startTime) / 1000),
        errors: this.errors.length
      },
      pageReports: this.pageReports,
      campaigns: this.campaigns,
      errors: this.errors
    };
    
    await fs.writeFile(filepath, JSON.stringify(output, null, 2));
    console.log(`\n💾 保存完了: ${filename}`);
  }

  /**
   * 詳細レポート生成
   */
  generateDetailedReport() {
    const executionTime = Math.round((new Date() - this.stats.startTime) / 1000);
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 モッピー全案件包括テスト完了レポート');
    console.log('='.repeat(80));
    console.log(`✅ 総取得案件数: ${this.campaigns.length}件`);
    console.log(`💰 ポイント情報取得: ${this.stats.campaignsWithPoints}件`);
    console.log(`📈 ポイント検出率: ${Math.round(this.stats.pointDetectionRate * 100)}%`);
    console.log(`📂 処理カテゴリ: ${this.stats.processedCategories}/${this.stats.totalCategories}`);
    console.log(`📄 総ページ数: ${this.stats.totalPages}ページ`);
    console.log(`⏱️ 実行時間: ${executionTime}秒`);
    console.log(`❌ エラー数: ${this.errors.length}件`);
    
    // ページ別詳細レポート
    console.log('\n📋 カテゴリ別・ページ別詳細取得数:');
    console.log('='.repeat(80));
    
    let currentCategory = '';
    this.pageReports.forEach(report => {
      if (currentCategory !== report.categoryName) {
        currentCategory = report.categoryName;
        console.log(`\n📂 ${report.categoryNumber}. ${report.categoryName} (${report.categoryType})`);
      }
      console.log(`  📄 ページ${report.pageNumber}: ${report.campaignCount}件取得 (ポイント情報: ${report.campaignsWithPoints}件)`);
    });
    
    // 統計サマリー
    const categoryStats = {};
    this.pageReports.forEach(report => {
      if (!categoryStats[report.categoryName]) {
        categoryStats[report.categoryName] = {
          totalCampaigns: 0,
          totalPages: 0,
          campaignsWithPoints: 0
        };
      }
      categoryStats[report.categoryName].totalCampaigns += report.campaignCount;
      categoryStats[report.categoryName].totalPages++;
      categoryStats[report.categoryName].campaignsWithPoints += report.campaignsWithPoints;
    });
    
    console.log('\n📊 カテゴリ別統計サマリー:');
    console.log('='.repeat(80));
    Object.entries(categoryStats).forEach(([category, stats]) => {
      console.log(`${category}: ${stats.totalCampaigns}件 (${stats.totalPages}ページ, ポイント付き: ${stats.campaignsWithPoints}件)`);
    });
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
  const tester = new MoppyComprehensiveTest();
  tester.execute().catch(console.error);
}

module.exports = MoppyComprehensiveTest;