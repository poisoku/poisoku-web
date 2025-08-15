#!/usr/bin/env node

/**
 * モッピー簡素化版スクレイパー
 * 10のparent_categoryのみでの取得テスト
 * 2025-08-15 Simplified Test Version
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

class MoppySimplifiedScraper {
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
      totalUrls: 0,
      processedUrls: 0,
      totalCampaigns: 0,
      campaignsWithPoints: 0,
      totalPages: 0,
      pointDetectionRate: 0,
      startTime: new Date()
    };
    
    // 簡素化版：10のparent_categoryのみ
    this.targetUrls = [
      'https://pc.moppy.jp/category/list.php?parent_category=1&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=2&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=3&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=5&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=7&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=8&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=9&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=10&af_sorter=1&page='
    ];
    
    this.stats.totalUrls = this.targetUrls.length;
  }

  /**
   * URLから識別子を生成
   */
  getUrlIdentifier(url) {
    const urlObj = new URL(url);
    const parentCategory = urlObj.searchParams.get('parent_category');
    return `parent_category=${parentCategory}`;
  }

  /**
   * メイン実行関数
   */
  async execute() {
    console.log('🎯 モッピー簡素化版スクレイパー起動');
    console.log('='.repeat(80));
    console.log('📋 10のparent_categoryのみテスト版');
    console.log(`📊 対象URL数: ${this.targetUrls.length} URL`);
    console.log('🔍 全ページを確実にチェック（「条件に一致する広告はありません」まで）');
    console.log('⚡ 重複案件は自動除外（最初の出現を優先）');
    console.log('🛡️ 取得漏れ完全防止システム');
    console.log('='.repeat(80));

    let browser;
    try {
      browser = await this.launchOptimizedBrowser();
      
      // URLごとに処理
      for (const [index, targetUrl] of this.targetUrls.entries()) {
        const urlId = this.getUrlIdentifier(targetUrl);
        console.log(`\n[${index + 1}/${this.targetUrls.length}] 処理中...`);
        console.log(`🔗 URL: ${urlId}`);
        
        await this.processUrlCompleteCoverage(browser, targetUrl, index + 1);
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
   * 完全取得保証URL処理
   */
  async processUrlCompleteCoverage(browser, baseUrl, urlNumber) {
    const urlId = this.getUrlIdentifier(baseUrl);
    
    let currentPage = 1;
    let hasMorePages = true;
    let urlTotalCampaigns = 0;
    let urlUniqueCampaigns = 0;
    let urlDuplicates = 0;
    let urlPages = [];
    let consecutiveEmptyPages = 0;
    const maxEmptyPages = 3;
    const maxSafetyPages = 200; // 安全上限
    
    while (hasMorePages && currentPage <= maxSafetyPages) {
      const pageUrl = `${baseUrl}${currentPage}`;
      
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
        const rawCampaigns = await this.extractMainContentCampaigns(page, urlId, currentPage);
        
        // 真の空ページ判定
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
        
        consecutiveEmptyPages = 0;
        
        // 重複除去処理
        const uniqueCampaigns = [];
        let pageDuplicates = 0;
        
        for (const campaign of rawCampaigns) {
          const siteId = campaign.id.replace('moppy_', '');
          
          if (!this.seenSiteIds.has(siteId)) {
            this.seenSiteIds.add(siteId);
            uniqueCampaigns.push(campaign);
            urlUniqueCampaigns++;
          } else {
            pageDuplicates++;
            urlDuplicates++;
            this.duplicateStats.duplicates++;
          }
          
          this.duplicateStats.total++;
        }
        
        this.campaigns.push(...uniqueCampaigns);
        urlTotalCampaigns += rawCampaigns.length;
        
        const withPoints = uniqueCampaigns.filter(c => c.points && c.points !== '').length;
        this.stats.campaignsWithPoints += withPoints;
        
        const pageReport = {
          urlNumber,
          urlId: urlId,
          pageNumber: currentPage,
          rawCount: rawCampaigns.length,
          uniqueCount: uniqueCampaigns.length,
          duplicateCount: pageDuplicates,
          campaignsWithPoints: withPoints,
          url: pageUrl
        };
        
        urlPages.push(pageReport);
        this.pageReports.push(pageReport);
        
        if (uniqueCampaigns.length > 0) {
          console.log(`  📄 ページ${currentPage}: ${rawCampaigns.length}件取得 → ${uniqueCampaigns.length}件追加（重複${pageDuplicates}件除外）`);
        } else {
          console.log(`  📄 ページ${currentPage}: ${rawCampaigns.length}件取得 → 全て重複（処理継続）`);
        }
        
        currentPage++;
        
      } catch (error) {
        console.error(`  ❌ ページ${currentPage}エラー: ${error.message}`);
        this.errors.push({
          urlId: urlId,
          page: currentPage,
          error: error.message
        });
        
        currentPage++;
        consecutiveEmptyPages++;
        
        if (consecutiveEmptyPages >= maxEmptyPages) {
          hasMorePages = false;
        }
      } finally {
        await page.close();
      }
      
      await this.sleep(300);
    }
    
    if (currentPage > maxSafetyPages) {
      console.log(`  ⚠️ 安全上限（${maxSafetyPages}ページ）に達したため処理終了`);
    }
    
    this.stats.totalCampaigns += urlUniqueCampaigns;
    this.stats.totalPages += urlPages.length;
    this.stats.processedUrls++;
    
    console.log(`  📊 ${urlId}完了: ${urlUniqueCampaigns}件追加（重複${urlDuplicates}件除外, ${urlPages.length}ページ処理）`);
  }

  /**
   * メインコンテンツエリアからの案件抽出
   */
  async extractMainContentCampaigns(page, urlId, pageNumber) {
    return await page.evaluate((urlIdentifier, pageNum) => {
      const campaigns = new Map();
      
      const mainContentItems = document.querySelectorAll('.m-list__item');
      
      mainContentItems.forEach(container => {
        if (container.closest('.m-trending-words__list-item') ||
            container.closest('.m-trending-words')) {
          return;
        }
        
        const links = container.querySelectorAll('a[href]');
        
        links.forEach(link => {
          const href = link.href;
          
          if (href.includes('/shopping/detail.php') || 
              href.includes('/ad/detail.php')) {
            
            if (href.includes('track_ref=tw') || href.includes('track_ref=reg')) {
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
                pageNumber: pageNum,
                urlId: urlIdentifier
              };
              
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
      
      const results = [];
      campaigns.forEach(campaign => {
        results.push({
          ...campaign,
          device: 'All',
          scrapedAt: new Date().toISOString()
        });
      });
      
      return results;
    }, urlId, pageNumber);
  }

  /**
   * 結果保存
   */
  async saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `moppy_simplified_${timestamp}.json`;
    const filepath = path.join(__dirname, 'data', 'moppy', filename);
    
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    
    const output = {
      scrapeDate: new Date().toISOString(),
      version: '13.0.0',
      systemType: 'moppy_simplified_scraper',
      description: '10のparent_categoryのみテスト版',
      simplifiedTest: true,
      targetUrls: this.targetUrls.length,
      stats: {
        totalCampaigns: this.campaigns.length,
        campaignsWithPoints: this.stats.campaignsWithPoints,
        pointDetectionRate: Math.round(this.stats.pointDetectionRate * 100),
        totalUrls: this.stats.processedUrls,
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
    console.log('📊 モッピー簡素化版スクレイピング完了レポート');
    console.log('='.repeat(80));
    
    console.log('\n📈 基本統計:');
    console.log(`✅ 総取得案件数: ${this.campaigns.length}件（重複除去後）`);
    console.log(`💰 ポイント情報取得: ${this.stats.campaignsWithPoints}件`);
    console.log(`📈 ポイント検出率: ${Math.round(this.stats.pointDetectionRate * 100)}%`);
    console.log(`🔗 処理URL: ${this.stats.processedUrls}/${this.stats.totalUrls}`);
    console.log(`📄 総ページ数: ${this.stats.totalPages}ページ`);
    console.log(`⏱️ 実行時間: ${executionTime}秒`);
    console.log(`❌ エラー数: ${this.errors.length}件`);
    
    console.log('\n🔍 重複除去統計:');
    console.log(`📊 総処理案件数: ${this.duplicateStats.total}件`);
    console.log(`✅ ユニーク案件数: ${this.duplicateStats.unique}件`);
    console.log(`🚫 除外した重複: ${this.duplicateStats.duplicates}件`);
    console.log(`📉 重複率: ${Math.round((this.duplicateStats.duplicates / this.duplicateStats.total) * 100)}%`);
    
    console.log('\n🎯 簡素化テスト結果:');
    console.log(`✅ 対象URL: ${this.targetUrls.length}件（簡素化版）`);
    console.log(`✅ 処理済みURL: ${this.stats.processedUrls}件`);
    console.log(`✅ 対応率: ${Math.round((this.stats.processedUrls / this.stats.totalUrls) * 100)}%`);
    
    // URL別取得数統計
    const urlStats = {};
    this.pageReports.forEach(report => {
      if (!urlStats[report.urlId]) {
        urlStats[report.urlId] = {
          maxPage: 0,
          totalPages: 0,
          uniqueCampaigns: 0,
          duplicates: 0
        };
      }
      urlStats[report.urlId].maxPage = Math.max(urlStats[report.urlId].maxPage, report.pageNumber);
      urlStats[report.urlId].totalPages++;
      urlStats[report.urlId].uniqueCampaigns += report.uniqueCount;
      urlStats[report.urlId].duplicates += report.duplicateCount;
    });
    
    console.log('\n📊 URL別取得結果:');
    console.log('='.repeat(80));
    Object.entries(urlStats).forEach(([urlId, stats]) => {
      console.log(`${urlId}: ${stats.uniqueCampaigns}件取得 + ${stats.duplicates}件重複除外 (${stats.maxPage}ページ処理)`);
    });
    
    console.log('\n🚨 仕様書完全対応版との比較:');
    console.log('前回（122 URL）: 1,865件取得');
    console.log(`今回（10 URL）: ${this.campaigns.length}件取得`);
    console.log(`差分: ${1865 - this.campaigns.length}件 ${this.campaigns.length >= 1865 ? '（同等以上）' : '（不足）'}`);
    
    console.log('\n✅ 簡素化テスト完了！');
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
  const scraper = new MoppySimplifiedScraper();
  scraper.execute().catch(console.error);
}

module.exports = MoppySimplifiedScraper;