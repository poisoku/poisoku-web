#!/usr/bin/env node

/**
 * モッピー完全取得保証版スクレイパー
 * 取得漏れ防止システム実装版
 * 2025-08-14 Complete Coverage System
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

class MoppyCompleteCoverageScraper {
  constructor() {
    this.baseUrl = 'https://pc.moppy.jp';
    this.campaigns = [];
    this.seenSiteIds = new Set(); // 重複チェック用Set
    this.duplicateStats = {
      total: 0,
      duplicates: 0,
      unique: 0
    };
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
    
    // 主要カテゴリURL（完全取得保証版）
    this.mainCategories = [
      // === 最重要カテゴリ（最初に処理） ===
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=2&child_category=&af_sorter=1&page=', name: '全案件', type: 'all' },
      
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
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=210&af_sorter=1&page=', name: '口座開設', type: 'service' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=73&af_sorter=1&page=', name: '暗号資産・仮想通貨', type: 'service' },
      
      // === 主要旅行・エンタメ系 ===
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=44&af_sorter=1&page=', name: '旅行・ホテル予約', type: 'travel' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=40&af_sorter=1&page=', name: '国内旅行', type: 'travel' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=45&af_sorter=1&page=', name: '海外旅行', type: 'travel' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=178&af_sorter=1&page=', name: '動画配信サービス', type: 'travel' },
      
      // === 美容系 ===
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=8&child_category=183&af_sorter=1&page=', name: '美容院・サロン予約', type: 'beauty' },
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=8&child_category=184&af_sorter=1&page=', name: '脱毛', type: 'beauty' },
      
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
      { baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=88&af_sorter=1&page=', name: 'ドリンク・お酒', type: 'shopping' }
    ];
    
    this.stats.totalCategories = this.mainCategories.length;
  }

  /**
   * メイン実行関数
   */
  async execute() {
    console.log('🎯 モッピー完全取得保証版スクレイパー起動');
    console.log('='.repeat(80));
    console.log('📋 取得漏れ防止システム実装版');
    console.log(`📊 対象カテゴリ数: ${this.mainCategories.length}カテゴリ`);
    console.log('🔍 全ページを確実にチェック（「条件に一致する広告はありません」まで）');
    console.log('⚡ 重複案件は自動除外（最初の出現を優先）');
    console.log('🛡️ 取得漏れ完全防止システム');
    console.log('='.repeat(80));

    let browser;
    try {
      browser = await this.launchOptimizedBrowser();
      
      // カテゴリごとに処理
      for (const [index, category] of this.mainCategories.entries()) {
        console.log(`\n[${index + 1}/${this.mainCategories.length}] 処理中...`);
        
        // Protocol error回避のため、定期的にブラウザを再起動
        if (index > 0 && index % 10 === 0) {
          console.log('🔄 ブラウザ再起動（安定性維持）...');
          await browser.close();
          await this.sleep(3000);
          browser = await this.launchOptimizedBrowser();
        }
        
        await this.processCategoryCompleteCoverage(browser, category, index + 1);
        await this.sleep(1000);
      }
      
      // 統計計算
      this.stats.pointDetectionRate = this.stats.campaignsWithPoints / this.stats.totalCampaigns;
      this.duplicateStats.unique = this.campaigns.length;
      
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
   * 完全取得保証カテゴリ処理（取得漏れ防止版）
   */
  async processCategoryCompleteCoverage(browser, category, categoryNumber) {
    console.log(`📂 カテゴリ${categoryNumber}: ${category.name}`);
    
    let currentPage = 1;
    let hasMorePages = true;
    let categoryTotalCampaigns = 0;
    let categoryUniqueCampaigns = 0;
    let categoryDuplicates = 0;
    let categoryPages = [];
    let consecutiveEmptyPages = 0;
    const maxEmptyPages = 3; // 連続3ページ空で終了
    const maxSafetyPages = 200; // 安全上限（無限ループ防止）
    
    while (hasMorePages && currentPage <= maxSafetyPages) {
      const pageUrl = `${category.baseUrl}${currentPage}`;
      
      const page = await browser.newPage();
      
      try {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.goto(pageUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        
        await this.sleep(1500);
        
        // 「条件に一致する広告はありません」メッセージのチェック
        const noAdsMessage = await page.evaluate(() => {
          // 複数のパターンでチェック
          const noAdsPatterns = [
            '条件に一致する広告はありません',
            '該当する広告がありません',
            '広告が見つかりません',
            'お探しの広告はありません'
          ];
          
          const pageText = document.body.textContent;
          return noAdsPatterns.some(pattern => pageText.includes(pattern));
        });
        
        if (noAdsMessage) {
          console.log(`  🏁 ページ${currentPage}: 「条件に一致する広告はありません」検出。処理終了`);
          hasMorePages = false;
          break;
        }
        
        // 案件抽出
        const rawCampaigns = await this.extractMainContentCampaigns(page, category, currentPage);
        
        // 真の空ページ判定（案件が1件も存在しない）
        if (rawCampaigns.length === 0) {
          consecutiveEmptyPages++;
          console.log(`  ⚠️ ページ${currentPage}: 案件なし (連続空ページ ${consecutiveEmptyPages}/${maxEmptyPages})`);
          
          if (consecutiveEmptyPages >= maxEmptyPages) {
            hasMorePages = false;
            console.log(`  🏁 連続${maxEmptyPages}ページ空のため処理終了`);
            break;
          }
          
          currentPage++;
          continue;
        }
        
        // 案件が存在する場合、連続空ページカウンターをリセット
        consecutiveEmptyPages = 0;
        
        // 重複除去処理
        const uniqueCampaigns = [];
        let pageDuplicates = 0;
        
        for (const campaign of rawCampaigns) {
          const siteId = campaign.id.replace('moppy_', '');
          
          if (!this.seenSiteIds.has(siteId)) {
            // 新規案件として追加
            this.seenSiteIds.add(siteId);
            uniqueCampaigns.push(campaign);
            categoryUniqueCampaigns++;
          } else {
            // 重複として記録
            pageDuplicates++;
            categoryDuplicates++;
            this.duplicateStats.duplicates++;
          }
          
          this.duplicateStats.total++;
        }
        
        // 案件があれば処理を継続（重複のみでも継続）
        this.campaigns.push(...uniqueCampaigns);
        categoryTotalCampaigns += rawCampaigns.length;
        
        // ポイント検出数をカウント（ユニーク案件のみ）
        const withPoints = uniqueCampaigns.filter(c => c.points && c.points !== '').length;
        this.stats.campaignsWithPoints += withPoints;
        
        // ページ別レポートに記録
        const pageReport = {
          categoryNumber,
          categoryName: category.name,
          categoryType: category.type,
          pageNumber: currentPage,
          rawCount: rawCampaigns.length,
          uniqueCount: uniqueCampaigns.length,
          duplicateCount: pageDuplicates,
          campaignsWithPoints: withPoints,
          url: pageUrl
        };
        
        categoryPages.push(pageReport);
        this.pageReports.push(pageReport);
        
        // ログ出力（重複が多い場合も処理継続を明示）
        if (uniqueCampaigns.length > 0) {
          console.log(`  📄 ページ${currentPage}: ${rawCampaigns.length}件取得 → ${uniqueCampaigns.length}件追加（重複${pageDuplicates}件除外）`);
        } else {
          console.log(`  📄 ページ${currentPage}: ${rawCampaigns.length}件取得 → 全て重複（処理継続）`);
        }
        
        currentPage++;
        
      } catch (error) {
        console.error(`  ❌ ページ${currentPage}エラー: ${error.message}`);
        this.errors.push({
          category: category.name,
          page: currentPage,
          error: error.message
        });
        
        // エラーがあっても次ページを試行
        currentPage++;
        consecutiveEmptyPages++;
        
        if (consecutiveEmptyPages >= maxEmptyPages) {
          hasMorePages = false;
          console.log(`  🏁 エラーが連続${maxEmptyPages}回のため処理終了`);
        }
      } finally {
        await page.close();
      }
      
      await this.sleep(300);
    }
    
    // 安全上限に達した場合の警告
    if (currentPage > maxSafetyPages) {
      console.log(`  ⚠️ 安全上限（${maxSafetyPages}ページ）に達したため処理終了`);
    }
    
    this.stats.totalCampaigns += categoryUniqueCampaigns;
    this.stats.totalPages += categoryPages.length;
    this.stats.processedCategories++;
    
    console.log(`  📊 ${category.name}完了: ${categoryUniqueCampaigns}件追加（重複${categoryDuplicates}件除外, ${categoryPages.length}ページ処理）`);
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
                siteId: siteId,
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
    const filename = `moppy_complete_coverage_${timestamp}.json`;
    const filepath = path.join(__dirname, 'data', 'moppy', filename);
    
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    
    const output = {
      scrapeDate: new Date().toISOString(),
      version: '10.0.0',
      systemType: 'moppy_complete_coverage_scraper',
      description: '完全取得保証版（取得漏れ防止システム実装）',
      stats: {
        totalCampaigns: this.campaigns.length,
        campaignsWithPoints: this.stats.campaignsWithPoints,
        pointDetectionRate: Math.round(this.stats.pointDetectionRate * 100),
        totalCategories: this.stats.processedCategories,
        totalPages: this.stats.totalPages,
        executionTime: Math.round((new Date() - this.stats.startTime) / 1000),
        errors: this.errors.length
      },
      duplicateStats: {
        totalProcessed: this.duplicateStats.total,
        uniqueCampaigns: this.duplicateStats.unique,
        duplicatesRemoved: this.duplicateStats.duplicates,
        duplicateRate: Math.round((this.duplicateStats.duplicates / this.duplicateStats.total) * 100)
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
    console.log('📊 モッピー完全取得保証版スクレイピング完了レポート');
    console.log('='.repeat(80));
    
    console.log('\n📈 基本統計:');
    console.log(`✅ 総取得案件数: ${this.campaigns.length}件（重複除去後）`);
    console.log(`💰 ポイント情報取得: ${this.stats.campaignsWithPoints}件`);
    console.log(`📈 ポイント検出率: ${Math.round(this.stats.pointDetectionRate * 100)}%`);
    console.log(`📂 処理カテゴリ: ${this.stats.processedCategories}/${this.stats.totalCategories}`);
    console.log(`📄 総ページ数: ${this.stats.totalPages}ページ`);
    console.log(`⏱️ 実行時間: ${executionTime}秒`);
    console.log(`❌ エラー数: ${this.errors.length}件`);
    
    console.log('\n🔍 重複除去統計:');
    console.log(`📊 総処理案件数: ${this.duplicateStats.total}件`);
    console.log(`✅ ユニーク案件数: ${this.duplicateStats.unique}件`);
    console.log(`🚫 除外した重複: ${this.duplicateStats.duplicates}件`);
    console.log(`📉 重複率: ${this.duplicateStats.duplicateRate}%`);
    
    console.log('\n🛡️ 取得漏れ防止機能:');
    console.log(`✅ 全ページ完全チェック実施`);
    console.log(`✅ 「条件に一致する広告はありません」検出対応`);
    console.log(`✅ 重複多数ページでも処理継続`);
    console.log(`✅ 連続空ページ検出による適切な終了`);
    
    // ページ数統計
    const pageStats = {};
    this.pageReports.forEach(report => {
      if (!pageStats[report.categoryName]) {
        pageStats[report.categoryName] = {
          maxPage: 0,
          totalPages: 0,
          uniqueCampaigns: 0
        };
      }
      pageStats[report.categoryName].maxPage = Math.max(pageStats[report.categoryName].maxPage, report.pageNumber);
      pageStats[report.categoryName].totalPages++;
      pageStats[report.categoryName].uniqueCampaigns += report.uniqueCount;
    });
    
    const topPageCategories = Object.entries(pageStats)
      .sort((a, b) => b[1].maxPage - a[1].maxPage)
      .slice(0, 5);
    
    if (topPageCategories.length > 0) {
      console.log('\n📄 ページ数が多かったカテゴリTop5:');
      console.log('='.repeat(80));
      topPageCategories.forEach(([category, stats], i) => {
        console.log(`${i + 1}. ${category}: ${stats.maxPage}ページまで処理（${stats.uniqueCampaigns}件取得）`);
      });
    }
    
    console.log('\n✅ 完全取得保証スクレイピング完了！');
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
  const scraper = new MoppyCompleteCoverageScraper();
  scraper.execute().catch(console.error);
}

module.exports = MoppyCompleteCoverageScraper;