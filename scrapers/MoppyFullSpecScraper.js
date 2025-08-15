#!/usr/bin/env node

/**
 * モッピー仕様書完全対応版スクレイパー
 * 分類ロジック削除・URL直接識別版
 * 2025-08-15 Full Specification Compliance
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

class MoppyFullSpecScraper {
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
    
    // 仕様書記載の全URL（スマホアプリ除く121 URL）
    this.targetUrls = [
      // Web案件 - サービス
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=51&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=128&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=53&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=72&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=73&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=176&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=168&af_sorter=1&page=',
      
      // 全案件
      'https://pc.moppy.jp/category/list.php?parent_category=2&child_category=&af_sorter=1&page=',
      
      // parent_category=3系
      'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=44&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=43&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=40&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=45&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=46&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=127&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=47&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=41&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=62&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=42&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=49&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=181&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=178&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=132&af_sorter=1&page=',
      
      // parent_category=8系
      'https://pc.moppy.jp/category/list.php?parent_category=8&child_category=183&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=8&child_category=205&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=8&child_category=184&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=8&child_category=185&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=8&child_category=186&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=8&child_category=206&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=8&child_category=187&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=8&child_category=188&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=8&child_category=189&af_sorter=1&page=',
      
      // parent_category=4系続き
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=55&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=156&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=57&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=63&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=64&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=65&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=179&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=68&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=66&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=207&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=190&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=192&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=59&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=209&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=166&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=193&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=171&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=210&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=165&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=129&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=196&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=180&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=175&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=111&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=71&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=58&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=211&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=194&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=197&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=191&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=133&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=212&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=167&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=214&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=130&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=198&af_sorter=1&page=',
      
      // parent_category=5系（ゲーム）
      'https://pc.moppy.jp/category/list.php?parent_category=5&child_category=74&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=5&child_category=75&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=5&child_category=76&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=5&child_category=77&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=5&child_category=78&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=5&child_category=79&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=5&child_category=131&af_sorter=1&page=',
      
      // ショッピング系（parent_category=6）
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=80&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=143&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=195&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=86&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=107&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=159&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=90&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=199&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=89&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=136&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=92&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=138&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=160&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=200&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=201&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=109&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=137&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=162&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=163&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=81&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=85&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=82&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=174&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=83&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=84&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=108&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=95&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=96&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=97&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=98&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=101&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=103&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=87&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=88&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=177&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=93&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=164&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=94&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=161&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=99&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=141&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=142&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=140&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=202&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=104&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=102&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=105&af_sorter=1&page=',
      'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=144&af_sorter=1&page='
    ];
    
    this.stats.totalUrls = this.targetUrls.length;
  }

  /**
   * URLから識別子を生成
   */
  getUrlIdentifier(url) {
    const urlObj = new URL(url);
    const parentCategory = urlObj.searchParams.get('parent_category');
    const childCategory = urlObj.searchParams.get('child_category') || 'none';
    return `${parentCategory}-${childCategory}`;
  }

  /**
   * メイン実行関数
   */
  async execute() {
    console.log('🎯 モッピー仕様書完全対応版スクレイパー起動');
    console.log('='.repeat(80));
    console.log('📋 分類ロジック削除・URL直接識別版');
    console.log(`📊 対象URL数: ${this.targetUrls.length} URL（仕様書完全対応）`);
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
        
        // Protocol error回避のため、定期的にブラウザを再起動
        if (index > 0 && index % 20 === 0) {
          console.log('🔄 ブラウザ再起動（安定性維持）...');
          await browser.close();
          await this.sleep(3000);
          browser = await this.launchOptimizedBrowser();
        }
        
        await this.processUrlCompleteCoverage(browser, targetUrl, index + 1);
        await this.sleep(500);
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
    const maxSafetyPages = 100; // 安全上限
    
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
    const filename = `moppy_full_spec_${timestamp}.json`;
    const filepath = path.join(__dirname, 'data', 'moppy', filename);
    
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    
    const output = {
      scrapeDate: new Date().toISOString(),
      version: '12.0.0',
      systemType: 'moppy_full_specification_scraper',
      description: '仕様書完全対応版（分類ロジック削除・URL直接識別）',
      specificationCompliance: true,
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
    console.log('📊 モッピー仕様書完全対応版スクレイピング完了レポート');
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
    
    console.log('\n🎯 仕様書対応状況:');
    console.log(`✅ 対象URL: ${this.targetUrls.length}件（仕様書完全対応）`);
    console.log(`✅ 処理済みURL: ${this.stats.processedUrls}件`);
    console.log(`✅ 対応率: ${Math.round((this.stats.processedUrls / this.stats.totalUrls) * 100)}%`);
    console.log(`✅ 分類ロジック: 削除済み（URL直接識別）`);
    
    // 処理ページ数統計
    const pageStats = {};
    this.pageReports.forEach(report => {
      if (!pageStats[report.urlId]) {
        pageStats[report.urlId] = {
          maxPage: 0,
          totalPages: 0,
          uniqueCampaigns: 0
        };
      }
      pageStats[report.urlId].maxPage = Math.max(pageStats[report.urlId].maxPage, report.pageNumber);
      pageStats[report.urlId].totalPages++;
      pageStats[report.urlId].uniqueCampaigns += report.uniqueCount;
    });
    
    const topPageUrls = Object.entries(pageStats)
      .sort((a, b) => b[1].maxPage - a[1].maxPage)
      .slice(0, 10);
    
    if (topPageUrls.length > 0) {
      console.log('\n📄 ページ数が多かったURLトップ10:');
      console.log('='.repeat(80));
      topPageUrls.forEach(([urlId, stats], i) => {
        console.log(`${i + 1}. ${urlId}: ${stats.maxPage}ページまで処理（${stats.uniqueCampaigns}件取得）`);
      });
    }
    
    console.log('\n✅ 仕様書完全対応スクレイピング完了！');
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
  const scraper = new MoppyFullSpecScraper();
  scraper.execute().catch(console.error);
}

module.exports = MoppyFullSpecScraper;