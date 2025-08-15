#!/usr/bin/env node

/**
 * モッピーサンプル版スクレイパー
 * 各カテゴリ最大5ページまでの効率的取得
 * 2025-08-14 効率版
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

class MoppySampleScraper {
  constructor() {
    this.baseUrl = 'https://pc.moppy.jp';
    this.campaigns = [];
    this.errors = [];
    this.pageReports = [];
    this.stats = {
      totalCategories: 0,
      processedCategories: 0,
      totalCampaigns: 0,
      campaignsWithPoints: 0,
      totalPages: 0,
      pointDetectionRate: 0,
      startTime: new Date()
    };
    
    // 仕様書記載の主要カテゴリURL（効率的サンプリング版）
    this.mainCategories = [
      // === 主要サービス系 ===
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=51&af_sorter=1&page=', name: '金融・投資', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=128&af_sorter=1&page=', name: 'FX', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=53&af_sorter=1&page=', name: 'VISA', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=55&af_sorter=1&page=', name: 'JCB', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=65&af_sorter=1&page=', name: '無料', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=68&af_sorter=1&page=', name: '無料＆即P', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=111&af_sorter=1&page=', name: '飲食店予約', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=165&af_sorter=1&page=', name: '転職・求人', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=175&af_sorter=1&page=', name: '不動産', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=192&af_sorter=1&page=', name: '資料請求', type: 'service' },
      
      // 全案件（最も重要）
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=2&child_category=&af_sorter=1&page=', name: '全案件', type: 'all' },
      
      // === 主要旅行・エンタメ系 ===
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=44&af_sorter=1&page=', name: '旅行・ホテル予約', type: 'travel' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=40&af_sorter=1&page=', name: '国内旅行', type: 'travel' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=45&af_sorter=1&page=', name: '海外旅行', type: 'travel' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=41&af_sorter=1&page=', name: 'エンタメ・チケット', type: 'travel' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=178&af_sorter=1&page=', name: '動画配信サービス', type: 'travel' },
      
      // === 新カテゴリ（美容系） ===
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=8&child_category=183&af_sorter=1&page=', name: '美容院・サロン予約', type: 'beauty' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=8&child_category=184&af_sorter=1&page=', name: '脱毛', type: 'beauty' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=8&child_category=187&af_sorter=1&page=', name: 'ジム・フィットネス', type: 'beauty' },
      
      // === ゲーム系 ===
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=5&child_category=74&af_sorter=1&page=', name: 'ブラウザゲーム', type: 'game' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=5&child_category=75&af_sorter=1&page=', name: 'RPG', type: 'game' },
      
      // === 主要ショッピング系 ===
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=80&af_sorter=1&page=', name: '総合通販', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=143&af_sorter=1&page=', name: 'デパート・百貨店', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=195&af_sorter=1&page=', name: 'ふるさと納税', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=81&af_sorter=1&page=', name: 'レディースファッション', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=82&af_sorter=1&page=', name: 'メンズファッション', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=90&af_sorter=1&page=', name: '化粧品・スキンケア', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=89&af_sorter=1&page=', name: '健康食品', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=95&af_sorter=1&page=', name: '家電', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=87&af_sorter=1&page=', name: '食品', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=88&af_sorter=1&page=', name: 'ドリンク・お酒', type: 'shopping' },
      
      // === 追加重要カテゴリ ===
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=72&af_sorter=1&page=', name: 'その他投資', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=73&af_sorter=1&page=', name: '暗号資産・仮想通貨', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=171&af_sorter=1&page=', name: '結婚・恋愛', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=180&af_sorter=1&page=', name: '引越し', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=86&af_sorter=1&page=', name: 'ベビー・キッズ・マタニティ', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=96&af_sorter=1&page=', name: 'カメラ', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=97&af_sorter=1&page=', name: 'PC・タブレット', type: 'shopping' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=98&af_sorter=1&page=', name: 'スマートフォン・携帯電話', type: 'shopping' }
    ];
    
    this.stats.totalCategories = this.mainCategories.length;
  }

  /**
   * メイン実行関数
   */
  async execute() {
    console.log('🎯 モッピーサンプル版スクレイパー起動');
    console.log('='.repeat(80));
    console.log('📋 主要カテゴリ・効率的サンプリング版');
    console.log(`📊 対象カテゴリ数: ${this.mainCategories.length}カテゴリ`);
    console.log('⚡ 各カテゴリ最大5ページまで取得');
    console.log('='.repeat(80));

    let browser;
    try {
      browser = await this.launchOptimizedBrowser();
      
      // カテゴリごとに処理
      for (const [index, category] of this.mainCategories.entries()) {
        console.log(`\n[${index + 1}/${this.mainCategories.length}] 処理中...`);
        
        // Protocol error回避のため、定期的にブラウザを再起動
        if (index > 0 && index % 15 === 0) {
          console.log('🔄 ブラウザ再起動（安定性維持）...');
          await browser.close();
          await this.sleep(3000);
          browser = await this.launchOptimizedBrowser();
        }
        
        await this.processCategoryWithPagination(browser, category, index + 1);
        await this.sleep(1000);
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
      defaultViewport: { width: 1920, height: 1080 },
      protocolTimeout: 120000
    });
  }

  /**
   * ページネーション対応カテゴリ処理（サンプル版 - 最大5ページ）
   */
  async processCategoryWithPagination(browser, category, categoryNumber) {
    console.log(`📂 カテゴリ${categoryNumber}: ${category.name}`);
    
    let currentPage = 1;
    let hasMorePages = true;
    let categoryTotalCampaigns = 0;
    let categoryPages = [];
    let consecutiveEmptyPages = 0;
    const maxEmptyPages = 2; // 連続2ページ空なら終了（効率化）
    const maxPages = 5; // サンプル版：最大5ページまで
    
    while (hasMorePages && currentPage <= maxPages) {
      const pageUrl = `${category.baseUrl}${currentPage}`;
      
      const page = await browser.newPage();
      
      try {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.goto(pageUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        
        await this.sleep(1500); // 待機時間短縮
        
        // 案件抽出
        const campaigns = await this.extractMainContentCampaigns(page, category, currentPage);
        
        if (campaigns.length > 0) {
          consecutiveEmptyPages = 0; // リセット
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
          
          currentPage++;
          
        } else {
          consecutiveEmptyPages++;
          
          if (consecutiveEmptyPages >= maxEmptyPages) {
            hasMorePages = false;
            console.log(`  🏁 ${maxEmptyPages}ページ連続で案件なし。処理終了`);
          } else {
            console.log(`  ⚠️ ページ${currentPage}: 案件なし (${consecutiveEmptyPages}/${maxEmptyPages})`);
            currentPage++;
          }
        }
        
      } catch (error) {
        console.error(`  ❌ ページ${currentPage}エラー: ${error.message}`);
        this.errors.push({
          category: category.name,
          page: currentPage,
          error: error.message
        });
        consecutiveEmptyPages++;
        
        if (consecutiveEmptyPages >= maxEmptyPages) {
          hasMorePages = false;
        } else {
          currentPage++;
        }
      } finally {
        await page.close();
      }
      
      await this.sleep(300); // ページ間待機時間短縮
    }
    
    this.stats.totalCampaigns += categoryTotalCampaigns;
    this.stats.totalPages += categoryPages.length;
    this.stats.processedCategories++;
    
    console.log(`  📊 ${category.name}完了: ${categoryTotalCampaigns}件 (${categoryPages.length}ページ)`);
  }

  /**
   * メインコンテンツエリアからの案件抽出
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
              
              // ポイント情報の抽出（高精度版）
              const containerText = container.textContent || '';
              const pointPatterns = [
                { regex: /(\d{1,6}(?:,\d{3})*)(?:\s*)([PpＰ])/g, confidence: 5 },
                { regex: /(\d+(?:\.\d+)?)(?:\s*)([%％])/g, confidence: 5 },
                { regex: /(\d{1,6}(?:,\d{3})*)(?:\s*)ポイント/g, confidence: 5 },
                { regex: /最大(?:\s*)(\d{1,6}(?:,\d{3})*)(?:\s*)([PpＰ])/g, confidence: 4 },
                { regex: /(\d{1,6}(?:,\d{3})*)(?:\s*)円相当/g, confidence: 4 },
                { regex: /(\d{1,6}(?:,\d{3})*)(?:\s*)円分/g, confidence: 4 }
              ];
              
              let bestPoints = '';
              let confidence = 0;
              
              pointPatterns.forEach(pattern => {
                const matches = [...containerText.matchAll(pattern.regex)];
                matches.forEach(match => {
                  if (pattern.confidence > confidence) {
                    bestPoints = match[0];
                    confidence = pattern.confidence;
                  }
                });
              });
              
              campaign.points = bestPoints;
              
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
    const filename = `moppy_sample_${timestamp}.json`;
    const filepath = path.join(__dirname, 'data', 'moppy', filename);
    
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    
    const output = {
      scrapeDate: new Date().toISOString(),
      version: '8.0.0',
      systemType: 'moppy_sample_scraper',
      description: '主要カテゴリ・効率サンプリング版（各カテゴリ最大5ページ）',
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
    console.log('📊 モッピーサンプル版スクレイピング完了レポート');
    console.log('='.repeat(80));
    console.log(`✅ 総取得案件数: ${this.campaigns.length}件`);
    console.log(`💰 ポイント情報取得: ${this.stats.campaignsWithPoints}件`);
    console.log(`📈 ポイント検出率: ${Math.round(this.stats.pointDetectionRate * 100)}%`);
    console.log(`📂 処理カテゴリ: ${this.stats.processedCategories}/${this.stats.totalCategories}`);
    console.log(`📄 総ページ数: ${this.stats.totalPages}ページ`);
    console.log(`⏱️ 実行時間: ${executionTime}秒`);
    console.log(`❌ エラー数: ${this.errors.length}件`);
    
    // カテゴリタイプ別統計
    const typeStats = {};
    this.pageReports.forEach(report => {
      if (!typeStats[report.categoryType]) {
        typeStats[report.categoryType] = {
          categories: new Set(),
          campaigns: 0,
          pages: 0
        };
      }
      typeStats[report.categoryType].categories.add(report.categoryName);
      typeStats[report.categoryType].campaigns += report.campaignCount;
      typeStats[report.categoryType].pages++;
    });
    
    console.log('\n📊 カテゴリタイプ別統計:');
    console.log('='.repeat(80));
    Object.entries(typeStats).forEach(([type, stats]) => {
      console.log(`${type}: ${stats.categories.size}カテゴリ, ${stats.campaigns}件, ${stats.pages}ページ`);
    });
    
    // 成功例を表示
    const withPoints = this.campaigns.filter(c => c.points && c.points !== '');
    if (withPoints.length > 0) {
      console.log('\n💎 取得案件例（最初の10件）:');
      console.log('='.repeat(80));
      withPoints.slice(0, 10).forEach((c, i) => {
        console.log(`${i + 1}. [${c.category}] ${c.title.slice(0, 40)}...`);
        console.log(`   💰 ポイント: ${c.points}`);
      });
    }
    
    // 最も多い案件数のカテゴリ
    const categoryStats = {};
    this.pageReports.forEach(report => {
      if (!categoryStats[report.categoryName]) {
        categoryStats[report.categoryName] = {
          totalCampaigns: 0,
          totalPages: 0
        };
      }
      categoryStats[report.categoryName].totalCampaigns += report.campaignCount;
      categoryStats[report.categoryName].totalPages++;
    });
    
    const topCategories = Object.entries(categoryStats)
      .sort((a, b) => b[1].totalCampaigns - a[1].totalCampaigns)
      .slice(0, 5);
    
    console.log('\n🏆 案件数トップ5カテゴリ:');
    console.log('='.repeat(80));
    topCategories.forEach(([category, stats], i) => {
      console.log(`${i + 1}. ${category}: ${stats.totalCampaigns}件 (${stats.totalPages}ページ)`);
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
  const scraper = new MoppySampleScraper();
  scraper.execute().catch(console.error);
}

module.exports = MoppySampleScraper;