#!/usr/bin/env node

/**
 * モッピーページネーション対応スクレイパー
 * 全ページの案件を取得
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

class MoppyPaginationScraper {
  constructor() {
    this.baseUrl = 'https://pc.moppy.jp';
    this.campaigns = [];
    this.errors = [];
    this.stats = {
      totalCategories: 0,
      processedCategories: 0,
      totalCampaigns: 0,
      campaignsWithPoints: 0,
      totalPages: 0,
      pointDetectionRate: 0,
      startTime: new Date()
    };
    
    // テスト用カテゴリ（ページネーション対応）
    this.categoryUrls = [
      { 
        baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=80&af_sorter=1&page=',
        name: '総合通販', 
        type: 'shopping' 
      },
      { 
        baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=51&af_sorter=1&page=',
        name: '金融・投資', 
        type: 'service' 
      },
      { 
        baseUrl: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=143&af_sorter=1&page=',
        name: 'ファッション', 
        type: 'shopping' 
      }
    ];
    
    this.stats.totalCategories = this.categoryUrls.length;
  }

  /**
   * メイン実行関数
   */
  async execute() {
    console.log('🚀 モッピーページネーション対応スクレイパー起動');
    console.log('='.repeat(60));
    console.log('📋 全ページ対応・正確な案件抽出版');
    console.log('='.repeat(60));

    let browser;
    try {
      browser = await this.launchOptimizedBrowser();
      
      for (const category of this.categoryUrls) {
        await this.processCategoryWithPagination(browser, category);
        await this.sleep(2000);
      }
      
      // 統計計算
      this.stats.pointDetectionRate = this.stats.campaignsWithPoints / this.stats.totalCampaigns;
      
      await this.saveResults();
      this.generateReport();
      
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
   * ページネーション対応カテゴリ処理
   */
  async processCategoryWithPagination(browser, category) {
    console.log(`\n📂 カテゴリ処理開始: ${category.name}`);
    
    let currentPage = 1;
    let hasMorePages = true;
    let categoryTotalCampaigns = 0;
    let categoryTotalPages = 0;
    
    while (hasMorePages) {
      const pageUrl = `${category.baseUrl}${currentPage}`;
      console.log(`  📄 ページ${currentPage}処理中...`);
      
      const page = await browser.newPage();
      
      try {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.goto(pageUrl, {
          waitUntil: 'networkidle2',
          timeout: 45000
        });
        
        // 十分な待機時間
        await this.sleep(3000);
        
        // スクロール操作で全要素を表示
        await page.evaluate(async () => {
          const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
          
          // ページ全体を段階的にスクロール
          const scrollHeight = document.body.scrollHeight;
          const viewportHeight = window.innerHeight;
          
          for (let y = 0; y < scrollHeight; y += viewportHeight / 3) {
            window.scrollTo(0, y);
            await delay(500);
          }
          
          window.scrollTo(0, scrollHeight);
          await delay(1000);
          window.scrollTo(0, 0);
          await delay(500);
        });
        
        // 案件抽出
        const campaigns = await this.extractMainContentCampaigns(page, category, currentPage);
        
        if (campaigns.length > 0) {
          this.campaigns.push(...campaigns);
          categoryTotalCampaigns += campaigns.length;
          categoryTotalPages++;
          
          // ポイント検出数をカウント
          const withPoints = campaigns.filter(c => c.points && c.points !== '').length;
          this.stats.campaignsWithPoints += withPoints;
          
          console.log(`    ✅ ページ${currentPage}: ${campaigns.length}件取得 (ポイント情報: ${withPoints}件)`);
          
          // 次のページの存在確認
          const hasNext = await page.evaluate(() => {
            // 次のページへのリンクを探す
            const nextPageNum = parseInt(window.location.href.match(/page=(\d+)/)[1]) + 1;
            const nextPageUrl = window.location.href.replace(/page=\d+/, `page=${nextPageNum}`);
            
            // 実際に次ページURLへのリンクが存在するかチェック
            const nextLinks = document.querySelectorAll(`a[href*="page=${nextPageNum}"]`);
            return nextLinks.length > 0;
          });
          
          if (!hasNext) {
            // 最終確認：次のページに直接アクセスしてみる
            const nextPageUrl = `${category.baseUrl}${currentPage + 1}`;
            const testPage = await browser.newPage();
            
            try {
              await testPage.goto(nextPageUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
              await this.sleep(2000);
              
              const nextPageCampaigns = await testPage.evaluate(() => {
                return document.querySelectorAll('.m-list__item').length;
              });
              
              if (nextPageCampaigns === 0) {
                hasMorePages = false;
                console.log(`    🏁 ページ${currentPage}が最終ページです`);
              }
              
            } catch (error) {
              hasMorePages = false;
              console.log(`    🏁 ページ${currentPage + 1}にアクセスできないため、ページ${currentPage}が最終ページです`);
            } finally {
              await testPage.close();
            }
          }
          
          currentPage++;
          
        } else {
          hasMorePages = false;
          console.log(`    🏁 ページ${currentPage}に案件なし。処理終了`);
        }
        
      } catch (error) {
        console.error(`    ❌ ページ${currentPage}エラー: ${error.message}`);
        this.errors.push({
          category: category.name,
          page: currentPage,
          error: error.message
        });
        hasMorePages = false;
      } finally {
        await page.close();
      }
      
      // ページ間での待機
      await this.sleep(1500);
    }
    
    this.stats.totalCampaigns += categoryTotalCampaigns;
    this.stats.totalPages += categoryTotalPages;
    this.stats.processedCategories++;
    
    console.log(`  📊 ${category.name}完了: ${categoryTotalCampaigns}件 (${categoryTotalPages}ページ)`);
  }

  /**
   * メインコンテンツエリアからの正確な案件抽出（ページネーション対応版）
   */
  async extractMainContentCampaigns(page, category, pageNumber) {
    return await page.evaluate((categoryInfo, pageNum) => {
      const campaigns = new Map();
      
      // メインコンテンツエリアの特定
      const mainContentSelectors = [
        '.m-list__item',
        '#content .m-list__item',
      ];
      
      // 除外すべきエリア
      const excludeSelectors = [
        '.m-trending-words__list-item',
        '.m-trending-words',
        '[class*="trending"]',
        '[class*="recommend"]',
        '[class*="popular"]',
        '.sidebar',
        '.header',
        '.footer'
      ];
      
      // メインコンテンツエリアから案件を抽出
      mainContentSelectors.forEach(selector => {
        const containers = document.querySelectorAll(selector);
        
        containers.forEach(container => {
          // 除外エリアに含まれているかチェック
          let isExcluded = false;
          excludeSelectors.forEach(excludeSelector => {
            if (container.closest(excludeSelector)) {
              isExcluded = true;
            }
          });
          
          if (isExcluded) {
            return;
          }
          
          // 案件リンクの抽出
          const links = container.querySelectorAll('a[href]');
          
          links.forEach(link => {
            const href = link.href;
            
            // 案件URLパターンのチェック
            if (href.includes('/shopping/detail.php') || 
                href.includes('/ad/detail.php')) {
              
              // track_ref=tw のリンクは除外
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
                  pointsYen: '',
                  image: '',
                  containerClass: container.className || '',
                  linkContainer: 'main-content',
                  pageNumber: pageNum
                };
                
                // タイトル取得
                campaign.title = link.title || 
                                link.getAttribute('data-title') ||
                                link.getAttribute('alt');
                
                // 画像からタイトル
                const img = link.querySelector('img');
                if (img && !campaign.title) {
                  campaign.title = img.alt || img.title;
                  campaign.image = img.src;
                }
                
                // テキストからタイトル
                if (!campaign.title) {
                  const linkText = link.textContent.trim();
                  if (linkText && linkText.length > 0 && linkText.length < 200) {
                    campaign.title = linkText.replace(/\s+/g, ' ').replace(/\n+/g, ' ').trim();
                  }
                }
                
                // ポイント情報の抽出
                campaign.points = extractPointsFromContainer(container);
                
                // タイトルがある場合のみ追加
                if (campaign.title && campaign.title.length > 0) {
                  campaigns.set(siteId, campaign);
                }
              }
            }
          });
        });
      });
      
      // ポイント抽出関数
      function extractPointsFromContainer(container) {
        const containerText = container.textContent || '';
        
        const patterns = [
          { regex: /(\d{1,6}(?:,\d{3})*)(?:\s*)([PpＰ])/g, confidence: 5, format: (num, unit) => `${num}${unit}` },
          { regex: /(\d{1,6}(?:,\d{3})*)(?:\s*)ポイント/g, confidence: 5, format: (num) => `${num}P` },
          { regex: /(\d+(?:\.\d+)?)(?:\s*)([%％])/g, confidence: 5, format: (num, unit) => `${num}${unit}` },
          { regex: /最大(?:\s*)(\d{1,6}(?:,\d{3})*)(?:\s*)([PpＰ])/g, confidence: 4, format: (num, unit) => `最大${num}${unit}` },
          { regex: /最高(?:\s*)(\d{1,6}(?:,\d{3})*)(?:\s*)([PpＰ])/g, confidence: 4, format: (num, unit) => `最高${num}${unit}` },
          { regex: /(\d{1,6}(?:,\d{3})*)(?:\s*)円相当/g, confidence: 4, format: (num) => `${num}円相当` },
          { regex: /(\d{1,6}(?:,\d{3})*)(?:\s*)円分/g, confidence: 4, format: (num) => `${num}円分` },
          { regex: /獲得(?:\s*)(\d{1,6}(?:,\d{3})*)(?:\s*)([PpＰ])/g, confidence: 4, format: (num, unit) => `${num}${unit}` },
          { regex: /(\d{1,6}(?:,\d{3})*)(?:\s*)(pt)/gi, confidence: 4, format: (num, unit) => `${num}${unit}` }
        ];
        
        let bestPoints = '';
        let confidence = 0;
        
        patterns.forEach(pattern => {
          const matches = [...containerText.matchAll(pattern.regex)];
          matches.forEach(match => {
            if (pattern.confidence > confidence) {
              if (match[2]) {
                bestPoints = pattern.format(match[1], match[2]);
              } else {
                bestPoints = pattern.format(match[1]);
              }
              confidence = pattern.confidence;
            }
          });
        });
        
        return bestPoints;
      }
      
      // 結果の整形と返却
      const results = [];
      campaigns.forEach(campaign => {
        // 1pt = 1円の換算
        if (campaign.points && !campaign.points.includes('%')) {
          const pointMatch = campaign.points.match(/(\d{1,6}(?:,\d{3})*)/);
          if (pointMatch) {
            const pointValue = parseInt(pointMatch[1].replace(/,/g, ''));
            campaign.pointsYen = `${pointValue.toLocaleString()}円`;
          }
        }
        
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
    const filename = `moppy_pagination_${timestamp}.json`;
    const filepath = path.join(__dirname, '..', '..', '..', 'data', 'moppy', filename);
    
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    
    const output = {
      scrapeDate: new Date().toISOString(),
      version: '5.0.0',
      systemType: 'moppy_pagination_scraper',
      description: 'ページネーション対応・全ページ取得版',
      stats: {
        totalCampaigns: this.campaigns.length,
        campaignsWithPoints: this.stats.campaignsWithPoints,
        pointDetectionRate: Math.round(this.stats.pointDetectionRate * 100),
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
    console.log('📊 ページネーション対応完了レポート');
    console.log('='.repeat(60));
    console.log(`✅ 取得案件数: ${this.campaigns.length}件`);
    console.log(`💰 ポイント情報取得: ${this.stats.campaignsWithPoints}件`);
    console.log(`📈 ポイント検出率: ${Math.round(this.stats.pointDetectionRate * 100)}%`);
    console.log(`📂 処理カテゴリ: ${this.stats.processedCategories}/${this.stats.totalCategories}`);
    console.log(`📄 総ページ数: ${this.stats.totalPages}ページ`);
    console.log(`⏱️ 実行時間: ${executionTime}秒`);
    console.log(`❌ エラー数: ${this.errors.length}件`);
    
    if (this.campaigns.length > 0) {
      // カテゴリ別・ページ別の統計
      const categoryStats = {};
      const pageStats = {};
      
      this.campaigns.forEach(c => {
        if (!categoryStats[c.category]) {
          categoryStats[c.category] = { total: 0, withPoints: 0, pages: new Set() };
        }
        categoryStats[c.category].total++;
        categoryStats[c.category].pages.add(c.pageNumber);
        if (c.points && c.points !== '') {
          categoryStats[c.category].withPoints++;
        }
        
        const pageKey = `${c.category}-ページ${c.pageNumber}`;
        if (!pageStats[pageKey]) {
          pageStats[pageKey] = 0;
        }
        pageStats[pageKey]++;
      });
      
      console.log('\n📊 カテゴリ別統計:');
      Object.entries(categoryStats).forEach(([category, stats]) => {
        console.log(`  ${category}: ${stats.total}件 (${stats.pages.size}ページ, ポイント付き: ${stats.withPoints}件)`);
      });
      
      console.log('\n📄 ページ別取得数:');
      Object.entries(pageStats).forEach(([page, count]) => {
        console.log(`  ${page}: ${count}件`);
      });
      
      // 成功例を表示
      const withPoints = this.campaigns.filter(c => c.points && c.points !== '');
      if (withPoints.length > 0) {
        console.log('\n💎 全ページ取得案件例（最初の5件）:');
        withPoints.slice(0, 5).forEach((c, i) => {
          console.log(`${i + 1}. [${c.category}-P${c.pageNumber}] ${c.title.slice(0, 40)}...`);
          console.log(`   💰 ポイント: ${c.points}`);
          if (c.pointsYen) console.log(`   💴 円換算: ${c.pointsYen}`);
        });
      }
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
  const scraper = new MoppyPaginationScraper();
  scraper.execute().catch(console.error);
}

module.exports = MoppyPaginationScraper;