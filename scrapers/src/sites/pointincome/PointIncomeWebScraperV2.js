#!/usr/bin/env node

require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

/**
 * ポイントインカムWebスクレイパーV2（AJAX問題完全解決版）
 * AJAXリクエストのpage計算ロジックを修正
 */
class PointIncomeWebScraperV2 {
  constructor() {
    this.browser = null;
    this.results = [];
    this.stats = this.initializeStats();
    this.config = this.getConfig();
    this.categories = this.initializeCategories();
    this.seenCampaignIds = new Set();
  }

  initializeStats() {
    return {
      startTime: null,
      endTime: null,
      categoriesProcessed: 0,
      pagesProcessed: 0,
      duplicatesSkipped: 0,
      paginationSuccesses: 0,
      paginationFailures: 0,
      errors: [],
      categoryBreakdown: {},
      ajaxRequests: []
    };
  }

  getConfig() {
    return {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      timeout: 45000,
      pageWaitTime: 3000,
      maxRetriesPerCategory: 3,
      maxPagesPerCategory: 999,
      browserRestartInterval: 8,
      browserStartupWait: 2000,
      pageLoadWait: 5000,
      
      // AJAX修正版設定
      ajaxWaitTime: 10000,
      domStabilityWait: 3000,
      maxAjaxRetries: 2
    };
  }

  initializeCategories() {
    // 問題があったカテゴリで集中テスト
    const testCategories = [161, 179, 75];
    
    const categories = {};
    testCategories.forEach(id => {
      categories[`test_${id}`] = {
        id,
        name: `テストカテゴリ${id}`,
        url: `https://pointi.jp/list.php?category=${id}`,
        type: id >= 160 ? 'shopping' : 'service'
      };
    });

    return categories;
  }

  async initializeBrowser() {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        console.log('⚠️ ブラウザクローズエラー:', error.message);
      }
    }

    console.log('🔄 新しいブラウザインスタンス起動中...');
    this.browser = await puppeteer.launch({
      headless: true, // 高速化のためheadless
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security'
      ]
    });
    
    await new Promise(resolve => setTimeout(resolve, this.config.browserStartupWait));
  }

  async execute() {
    console.log('🎯 ポイントインカムWebスクレイピング開始（AJAX修正版V2）');
    console.log('='.repeat(70));

    this.stats.startTime = new Date();

    try {
      await this.initializeBrowser();
      
      for (const [categoryKey, categoryConfig] of Object.entries(this.categories)) {
        await this.processCategory(categoryKey, categoryConfig);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      this.stats.endTime = new Date();
      await this.generateReport();
      
    } catch (error) {
      console.error('💥 実行エラー:', error);
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  async processCategory(categoryKey, categoryConfig) {
    console.log(`\n📂 ${categoryConfig.type.toUpperCase()}: ${categoryConfig.name}`);

    const categoryResults = [];
    let page = null;

    try {
      page = await this.browser.newPage();
      await page.setUserAgent(this.config.userAgent);
      await page.setViewport(this.config.viewport);

      // AJAXリクエストを監視
      const ajaxRequests = [];
      page.on('response', response => {
        const url = response.url();
        if (url.includes('load_list.php')) {
          ajaxRequests.push({
            url,
            status: response.status(),
            timestamp: new Date().toISOString()
          });
          console.log(`      🌐 AJAX: ${url} (${response.status()})`);
        }
      });

      await page.goto(categoryConfig.url, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      });
      
      await new Promise(resolve => setTimeout(resolve, this.config.pageLoadWait));
      
      // 直接的なページネーション実装
      let currentPage = 1;
      let hasMorePages = true;

      while (hasMorePages && currentPage <= 5) { // テストのため最大5ページ
        console.log(`   📄 ページ${currentPage}処理中...`);

        const campaigns = await this.extractCampaigns(page, categoryConfig);
        
        let newCampaigns = 0;
        campaigns.forEach(campaign => {
          if (!this.seenCampaignIds.has(campaign.id)) {
            this.seenCampaignIds.add(campaign.id);
            categoryResults.push(campaign);
            this.results.push(campaign);
            newCampaigns++;
          }
        });

        console.log(`      ✅ ${campaigns.length}件取得 (新規: ${newCampaigns}件)`);

        // 次のページが存在するかチェック
        const nextPageExists = await this.checkNextPageExists(page, currentPage);
        
        if (!nextPageExists) {
          console.log(`      ℹ️ 最終ページに到達`);
          break;
        }

        // 直接AJAXリクエストでページ遷移を試行
        const paginationSuccess = await this.navigateWithDirectAjax(page, categoryConfig.id, currentPage + 1);
        
        if (paginationSuccess) {
          currentPage++;
          this.stats.pagesProcessed++;
          this.stats.paginationSuccesses++;
          await new Promise(resolve => setTimeout(resolve, this.config.pageWaitTime));
        } else {
          this.stats.paginationFailures++;
          console.log(`      ❌ ページネーション失敗、次のカテゴリへ`);
          break;
        }
      }

      this.stats.ajaxRequests.push(...ajaxRequests);

      if (page) {
        await page.close();
      }

    } catch (error) {
      console.log(`   ⚠️ カテゴリエラー: ${error.message}`);
      this.stats.errors.push({
        category: categoryKey,
        error: error.message
      });
      
      if (page) {
        try {
          await page.close();
        } catch (e) {}
      }
    }

    this.stats.categoriesProcessed++;
    this.stats.categoryBreakdown[categoryKey] = categoryResults.length;
    console.log(`   📊 カテゴリ合計: ${categoryResults.length}件`);
  }

  async checkNextPageExists(page, currentPage) {
    return await page.evaluate((currentPage) => {
      const nextButtons = Array.from(document.querySelectorAll('a[onclick*="tab_select"]'))
        .filter(link => link.textContent.trim().includes('次へ'));
      
      if (nextButtons.length === 0) {
        return false;
      }
      
      // 次へボタンのonclick属性から目標ページ番号を取得
      const nextButton = nextButtons[0];
      const onclick = nextButton.getAttribute('onclick');
      const pageMatch = onclick.match(/tab_select\([^,]+,\s*\d+,\s*\d+,\s*(\d+)\)/);
      
      if (pageMatch) {
        const targetPage = parseInt(pageMatch[1]);
        return targetPage > currentPage;
      }
      
      return true;
    }, currentPage);
  }

  // 直接AJAXリクエストでページネーション
  async navigateWithDirectAjax(page, categoryId, targetPage) {
    try {
      console.log(`      🔄 直接AJAX遷移: カテゴリ${categoryId} → ページ${targetPage}`);
      
      // 現在の状態を記録
      const beforeState = await this.getPageState(page);
      
      // 正しいAJAXエンドポイントを直接呼び出し
      const ajaxResult = await page.evaluate(async (categoryId, targetPage) => {
        try {
          // jQueryを使ってAJAXリクエストを送信
          if (typeof $ !== 'undefined' && $.ajax) {
            const response = await $.ajax({
              url: 'ajax_load/load_list.php',
              type: 'GET',
              data: {
                order: 1,
                page: targetPage, // 正確なページ番号を使用
                max: 24,
                narrow: 0,
                category: categoryId,
                data_type: ''
              },
              dataType: 'html',
              timeout: 10000
            });
            
            // レスポンスをDOM上の適切な場所に挿入
            const contentDiv = document.querySelector('#content_list, .list_area, .campaign_list');
            if (contentDiv && response) {
              contentDiv.innerHTML = response;
              return { success: true, responseLength: response.length };
            }
          }
          
          return { success: false, error: 'jQuery AJAX failed' };
          
        } catch (error) {
          return { success: false, error: error.message };
        }
      }, categoryId, targetPage);
      
      console.log(`      📊 AJAX結果: ${ajaxResult.success ? '成功' : '失敗'} ${ajaxResult.error || ''}`);
      
      if (!ajaxResult.success) {
        return false;
      }
      
      // DOM更新完了を待機
      await new Promise(resolve => setTimeout(resolve, this.config.ajaxWaitTime));
      
      // 内容が更新されたかチェック
      const afterState = await this.getPageState(page);
      
      const contentChanged = afterState.count > 0 && 
        (afterState.firstTitle !== beforeState.firstTitle || afterState.count !== beforeState.count);
      
      if (contentChanged) {
        console.log(`      ✅ AJAX遷移成功: ${beforeState.count} → ${afterState.count}件`);
        console.log(`      📝 タイトル変更: "${beforeState.firstTitle?.substring(0, 20)}..." → "${afterState.firstTitle?.substring(0, 20)}..."`);
        return true;
      } else {
        console.log(`      ❌ AJAX遷移失敗: 内容が変化せず`);
        return false;
      }
      
    } catch (error) {
      console.log(`      ❌ 直接AJAX例外: ${error.message}`);
      return false;
    }
  }

  async extractCampaigns(page, categoryConfig) {
    return await page.evaluate((config) => {
      const campaigns = [];
      
      function normalizePointsForPointIncome(pointsText) {
        if (!pointsText) return '';
        
        const percentageMatch = pointsText.match(/購入金額の(\d+(?:\.\d+)?)%/);
        if (percentageMatch) {
          return `${percentageMatch[1]}%`;
        }
        
        const pointMatch = pointsText.match(/(\d+(?:,\d+)?)pt/);
        if (pointMatch) {
          const points = parseInt(pointMatch[1].replace(/,/g, ''));
          const yen = Math.floor(points / 10);
          return `${yen.toLocaleString()}円`;
        }
        
        return pointsText;
      }
      
      const campaignElements = document.querySelectorAll('.box_ad');
      
      campaignElements.forEach((element, index) => {
        try {
          const titleElement = element.querySelector('.title_list');
          const title = titleElement ? titleElement.textContent.trim() : '';
          
          const linkElement = element.querySelector('a[href*="./ad/"]');
          const relativeUrl = linkElement ? linkElement.getAttribute('href') : '';
          
          const pointElement = element.querySelector('.list_pt_box .list_pt');
          let points = pointElement ? pointElement.textContent.trim() : '';
          points = normalizePointsForPointIncome(points);
          
          let id = '';
          if (relativeUrl) {
            const idMatch = relativeUrl.match(/\/ad\/(\d+)\//); 
            id = idMatch ? idMatch[1] : `gen_${Date.now()}_${index}`;
          } else {
            id = `gen_${Date.now()}_${index}`;
          }
          
          let absoluteUrl = '';
          if (relativeUrl) {
            absoluteUrl = relativeUrl.startsWith('http') 
              ? relativeUrl 
              : `https://pointi.jp${relativeUrl.replace('./', '/')}`;
          }

          if (title && id) {
            campaigns.push({
              id,
              title,
              url: absoluteUrl,
              points,
              device: 'すべて',
              category_id: config ? config.id : null,
              category_type: config ? config.type : null,
              timestamp: new Date().toISOString()
            });
          }
        } catch (e) {
          console.error('Campaign extraction error:', e);
        }
      });

      return campaigns;
    }, categoryConfig);
  }

  async getPageState(page) {
    return await page.evaluate(() => {
      const firstAd = document.querySelector('.box_ad .title_list');
      const allAds = document.querySelectorAll('.box_ad');
      return {
        firstTitle: firstAd ? firstAd.textContent.trim() : null,
        count: allAds.length,
        timestamp: Date.now()
      };
    }).catch(() => ({ firstTitle: null, count: 0, timestamp: Date.now() }));
  }

  async generateReport() {
    console.log('\n' + '='.repeat(70));
    console.log('📊 AJAX修正版V2スクレイピング完了レポート');
    console.log('='.repeat(70));

    const duration = (this.stats.endTime - this.stats.startTime) / 1000 / 60;
    
    console.log(`⏱️ 実行時間: ${duration.toFixed(2)}分`);
    console.log(`📂 処理カテゴリ数: ${this.stats.categoriesProcessed}`);
    console.log(`📄 処理ページ数: ${this.stats.pagesProcessed}`);
    console.log(`🎯 取得案件数: ${this.results.length}`);
    
    console.log(`\n📊 ページネーション統計:`);
    console.log(`   ✅ 成功: ${this.stats.paginationSuccesses}回`);
    console.log(`   ❌ 失敗: ${this.stats.paginationFailures}回`);
    
    if (this.stats.ajaxRequests.length > 0) {
      console.log(`\n🌐 AJAX リクエスト詳細:`);
      this.stats.ajaxRequests.forEach((req, i) => {
        console.log(`   ${i + 1}. ${req.url} (${req.status}) - ${req.timestamp}`);
      });
    }
    
    console.log(`\n📂 カテゴリ別取得数:`);
    Object.entries(this.stats.categoryBreakdown).forEach(([cat, count]) => {
      console.log(`   ${cat}: ${count}件`);
    });

    if (this.stats.errors.length > 0) {
      console.log(`\n⚠️ エラー: ${this.stats.errors.length}件`);
      this.stats.errors.forEach((error, i) => {
        console.log(`   ${i + 1}. ${error.category || error.phase}: ${error.error}`);
      });
    }

    await this.saveResults();
  }

  async saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.join(__dirname, '../../../data/pointincome', `pointincome_v2_${timestamp}.json`);
    
    const data = {
      scrape_date: new Date().toISOString(),
      version: 'ajax_fixed_v2',
      stats: this.stats,
      total_campaigns: this.results.length,
      campaigns: this.results
    };

    await fs.writeFile(filename, JSON.stringify(data, null, 2));
    console.log(`\n💾 データ保存完了: ${filename}`);
  }
}

if (require.main === module) {
  const scraper = new PointIncomeWebScraperV2();
  scraper.execute().then(() => {
    console.log('\n✅ 全処理完了');
    process.exit(0);
  }).catch(error => {
    console.error('\n💥 致命的エラー:', error);
    process.exit(1);
  });
}

module.exports = PointIncomeWebScraperV2;