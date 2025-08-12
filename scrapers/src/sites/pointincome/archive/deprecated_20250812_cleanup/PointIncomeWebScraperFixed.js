#!/usr/bin/env node

require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

/**
 * ポイントインカムWebスクレイパー（ページネーション修正版）
 * 2ページ目以降の取得問題を根本解決
 */
class PointIncomeWebScraperFixed {
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
      paginationMethods: {
        direct_url: 0,
        ajax_success: 0,
        ajax_retry: 0,
        fallback_used: 0
      }
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
      
      // 改良されたページネーション設定
      paginationWaitTime: 20000,
      paginationCheckInterval: 1000,
      maxPaginationRetries: 3,
      ajaxWaitTime: 8000,
      domStabilityWait: 2000
    };
  }

  initializeCategories() {
    // 問題があったカテゴリを優先的にテスト
    const testCategories = [161, 179, 75, 258, 177];
    
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
      headless: false,  // デバッグのため可視化
      devtools: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    
    await new Promise(resolve => setTimeout(resolve, this.config.browserStartupWait));
  }

  async execute() {
    console.log('🎯 ポイントインカムWebスクレイピング開始（ページネーション修正版）');
    console.log('='.repeat(70));
    console.log(`📊 対象カテゴリ数: ${Object.keys(this.categories).length}`);

    this.stats.startTime = new Date();

    try {
      await this.initializeBrowser();
      
      let categoryIndex = 0;
      for (const [categoryKey, categoryConfig] of Object.entries(this.categories)) {
        await this.processCategory(categoryKey, categoryConfig);
        
        categoryIndex++;
        if (categoryIndex % this.config.browserRestartInterval === 0) {
          console.log(`🔄 定期ブラウザ再起動 (${categoryIndex}カテゴリ処理完了)`);
          await this.initializeBrowser();
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      this.stats.endTime = new Date();
      await this.generateReport();
      
    } catch (error) {
      console.error('💥 実行エラー:', error);
      this.stats.errors.push({
        phase: 'execution',
        error: error.message
      });
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  async processCategory(categoryKey, categoryConfig) {
    console.log(`\n📂 ${categoryConfig.type.toUpperCase()}: ${categoryConfig.name}`);

    const categoryResults = [];
    let retryCount = 0;

    while (retryCount < this.config.maxRetriesPerCategory) {
      let page = null;
      try {
        if (!this.browser || !this.browser.isConnected()) {
          console.log('⚠️ ブラウザ接続失効、再初期化中...');
          await this.initializeBrowser();
        }

        page = await this.browser.newPage();
        await page.setUserAgent(this.config.userAgent);
        await page.setViewport(this.config.viewport);

        // ネットワーク監視（デバッグ用）
        page.on('response', response => {
          if (response.url().includes('list.php') && response.status() === 200) {
            console.log(`      🌐 AJAX応答: ${response.url()}`);
          }
        });

        await page.goto(categoryConfig.url, {
          waitUntil: 'networkidle2',
          timeout: this.config.timeout
        });
        
        await new Promise(resolve => setTimeout(resolve, this.config.pageLoadWait));
        
        let currentPage = 1;
        let hasNextPage = true;
        let consecutiveFailures = 0;

        while (hasNextPage && currentPage <= this.config.maxPagesPerCategory && consecutiveFailures < 3) {
          console.log(`   📄 ページ${currentPage}処理中...`);

          const campaigns = await this.extractCampaigns(page, categoryConfig);
          
          let newCampaigns = 0;
          campaigns.forEach(campaign => {
            if (!this.seenCampaignIds.has(campaign.id)) {
              this.seenCampaignIds.add(campaign.id);
              categoryResults.push(campaign);
              this.results.push(campaign);
              newCampaigns++;
            } else {
              this.stats.duplicatesSkipped++;
            }
          });

          console.log(`      ✅ ${campaigns.length}件取得 (新規: ${newCampaigns}件)`);

          // 改良されたページネーション実行
          const paginationResult = await this.navigateToNextPageImproved(page, currentPage);
          
          if (paginationResult.success) {
            currentPage++;
            this.stats.pagesProcessed++;
            this.stats.paginationSuccesses++;
            consecutiveFailures = 0;
            
            // 方法別統計
            this.stats.paginationMethods[paginationResult.method]++;
            
            await new Promise(resolve => setTimeout(resolve, this.config.pageWaitTime));
          } else {
            console.log(`      ❌ ページネーション失敗: ${paginationResult.reason}`);
            this.stats.paginationFailures++;
            
            if (paginationResult.reason === 'no_next_button') {
              hasNextPage = false;
            } else {
              consecutiveFailures++;
              if (consecutiveFailures < 3) {
                console.log(`      🔄 ページネーションリトライ (${consecutiveFailures}/3)`);
                await new Promise(resolve => setTimeout(resolve, 5000));
              } else {
                hasNextPage = false;
              }
            }
          }
        }

        if (page) {
          await page.close();
        }
        break;

      } catch (error) {
        retryCount++;
        console.log(`   ⚠️ エラー (リトライ ${retryCount}/${this.config.maxRetriesPerCategory}): ${error.message}`);
        
        if (page) {
          try {
            await page.close();
          } catch (closeError) {
            console.log('      ⚠️ ページクローズエラー:', closeError.message);
          }
        }
        
        if (error.message.includes('Protocol error') || error.message.includes('Connection closed')) {
          console.log('   🔄 接続エラーのためブラウザ再初期化中...');
          await this.initializeBrowser();
        }
        
        if (retryCount >= this.config.maxRetriesPerCategory) {
          this.stats.errors.push({
            category: categoryKey,
            error: error.message
          });
        }
        
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    this.stats.categoriesProcessed++;
    this.stats.categoryBreakdown[categoryKey] = categoryResults.length;
    console.log(`   📊 カテゴリ合計: ${categoryResults.length}件`);
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

  // 大幅に改良されたページネーション処理
  async navigateToNextPageImproved(page, currentPage) {
    try {
      console.log(`      🔍 ページ${currentPage} → ページ${currentPage + 1} への遷移を試行`);
      
      // 1. 次へボタンの詳細情報を取得
      const nextButtonInfo = await this.getDetailedNextButtonInfo(page);
      
      if (!nextButtonInfo.found) {
        return { success: false, reason: 'no_next_button', method: 'none' };
      }
      
      console.log(`      📋 次へボタン情報: ${nextButtonInfo.text} (ページ${nextButtonInfo.targetPage})`);
      
      // 2. 現在のページ状態を記録
      const beforeState = await this.getPageState(page);
      console.log(`      📊 遷移前: ${beforeState.count}件 (最初: "${beforeState.firstTitle?.substring(0, 30)}...")`);
      
      // 3. 複数の方法でページネーションを試行
      let result = null;
      
      // 方法1: 直接URLアクセス（最も確実）
      if (nextButtonInfo.directUrl) {
        result = await this.tryDirectUrlPagination(page, nextButtonInfo.directUrl, beforeState);
        if (result.success) return result;
      }
      
      // 方法2: 改良されたAJAXページネーション
      if (nextButtonInfo.onclick) {
        result = await this.tryImprovedAjaxPagination(page, nextButtonInfo, beforeState, currentPage + 1);
        if (result.success) return result;
      }
      
      // 方法3: フォールバック - 要素クリック
      result = await this.tryElementClickPagination(page, beforeState);
      if (result.success) return result;
      
      return { success: false, reason: 'all_methods_failed', method: 'none' };
      
    } catch (error) {
      console.log(`      ⚠️ ページネーション例外: ${error.message}`);
      return { success: false, reason: 'exception', method: 'none' };
    }
  }

  async getDetailedNextButtonInfo(page) {
    return await page.evaluate(() => {
      const PAGE_NUMBER_PATTERN = /tab_select\([^,]+,\s*\d+,\s*\d+,\s*(\d+)\)/;
      
      // 「次へ」ボタンを検索
      const links = Array.from(document.querySelectorAll('a[onclick*="tab_select"]'));
      
      for (const link of links) {
        const text = link.textContent.trim();
        if (text.includes('次へ') || text === '次へ>') {
          const onclick = link.getAttribute('onclick');
          const pageMatch = onclick.match(PAGE_NUMBER_PATTERN);
          const targetPage = pageMatch ? parseInt(pageMatch[1]) : null;
          
          // 直接URL形式を生成（可能な場合）
          let directUrl = null;
          const currentUrl = new URL(window.location.href);
          if (targetPage && currentUrl.searchParams.get('category')) {
            const categoryId = currentUrl.searchParams.get('category');
            directUrl = `https://pointi.jp/list.php?category=${categoryId}&page=${targetPage}`;
          }
          
          return {
            found: true,
            onclick: onclick,
            text: text,
            targetPage: targetPage,
            element: link,
            directUrl: directUrl
          };
        }
      }
      
      return { found: false };
    });
  }

  // 方法1: 直接URLアクセス
  async tryDirectUrlPagination(page, directUrl, beforeState) {
    try {
      console.log(`      🔗 直接URL遷移: ${directUrl}`);
      
      await page.goto(directUrl, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      });
      
      await new Promise(resolve => setTimeout(resolve, this.config.domStabilityWait));
      
      const afterState = await this.getPageState(page);
      
      if (afterState.count > 0 && afterState.firstTitle !== beforeState.firstTitle) {
        console.log(`      ✅ 直接URL遷移成功: ${afterState.count}件`);
        return { success: true, method: 'direct_url' };
      }
      
      console.log(`      ❌ 直接URL遷移失敗: ${afterState.count}件`);
      return { success: false, method: 'direct_url' };
      
    } catch (error) {
      console.log(`      ❌ 直接URL例外: ${error.message}`);
      return { success: false, method: 'direct_url' };
    }
  }

  // 方法2: 改良されたAJAXページネーション
  async tryImprovedAjaxPagination(page, buttonInfo, beforeState, targetPage) {
    try {
      console.log(`      🖱️ AJAX遷移実行: ${buttonInfo.onclick}`);
      
      // パラメータを解析
      const paramMatch = buttonInfo.onclick.match(/tab_select\('([^']+)',\s*(\d+),\s*(\d+),\s*(\d+)\)/);
      if (!paramMatch) {
        return { success: false, method: 'ajax_failed' };
      }
      
      const [, tab, param2, param3, param4] = paramMatch;
      
      // 複数回リトライでAJAX実行
      for (let attempt = 1; attempt <= this.config.maxPaginationRetries; attempt++) {
        console.log(`      🔄 AJAX実行 (試行 ${attempt}/${this.config.maxPaginationRetries})`);
        
        // tab_select関数を実行
        const executeResult = await page.evaluate((tab, p2, p3, targetPage) => {
          if (typeof window.tab_select === 'function') {
            console.log(`tab_select実行: ('${tab}', ${p2}, ${p3}, ${targetPage})`);
            window.tab_select(tab, parseInt(p2), parseInt(p3), targetPage);
            return true;
          }
          return false;
        }, tab, parseInt(param2), parseInt(param3), targetPage);
        
        if (!executeResult) {
          console.log(`      ❌ tab_select関数が見つかりません`);
          return { success: false, method: 'ajax_failed' };
        }
        
        // AJAX完了を待機（段階的チェック）
        await new Promise(resolve => setTimeout(resolve, this.config.ajaxWaitTime));
        
        // DOM更新をより長期間監視
        const contentChanged = await this.waitForContentChangeImproved(page, beforeState);
        
        if (contentChanged) {
          const afterState = await this.getPageState(page);
          if (afterState.count > 0) {
            console.log(`      ✅ AJAX遷移成功 (試行 ${attempt}): ${afterState.count}件`);
            return { 
              success: true, 
              method: attempt === 1 ? 'ajax_success' : 'ajax_retry' 
            };
          }
        }
        
        if (attempt < this.config.maxPaginationRetries) {
          console.log(`      ⏳ AJAX遷移失敗、再試行まで待機...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      
      return { success: false, method: 'ajax_failed' };
      
    } catch (error) {
      console.log(`      ❌ AJAX例外: ${error.message}`);
      return { success: false, method: 'ajax_failed' };
    }
  }

  // 方法3: 要素クリック
  async tryElementClickPagination(page, beforeState) {
    try {
      console.log(`      🖱️ 要素クリック遷移`);
      
      const clickResult = await page.evaluate(() => {
        const nextButton = Array.from(document.querySelectorAll('a[onclick*="tab_select"]'))
          .find(link => link.textContent.trim().includes('次へ'));
        
        if (nextButton) {
          nextButton.click();
          return true;
        }
        return false;
      });
      
      if (!clickResult) {
        return { success: false, method: 'click_failed' };
      }
      
      await new Promise(resolve => setTimeout(resolve, this.config.ajaxWaitTime));
      
      const contentChanged = await this.waitForContentChangeImproved(page, beforeState);
      const afterState = await this.getPageState(page);
      
      if (contentChanged && afterState.count > 0) {
        console.log(`      ✅ クリック遷移成功: ${afterState.count}件`);
        return { success: true, method: 'fallback_used' };
      }
      
      return { success: false, method: 'click_failed' };
      
    } catch (error) {
      console.log(`      ❌ クリック例外: ${error.message}`);
      return { success: false, method: 'click_failed' };
    }
  }

  async getPageState(page) {
    return await page.evaluate(() => {
      const firstAd = document.querySelector('.box_ad .title_list');
      const allAds = document.querySelectorAll('.box_ad');
      return {
        firstTitle: firstAd ? firstAd.textContent.trim() : null,
        count: allAds.length,
        bodyLength: document.body.innerHTML.length,
        timestamp: Date.now()
      };
    }).catch(() => ({ firstTitle: null, count: 0, bodyLength: 0, timestamp: Date.now() }));
  }

  // 改良された内容変化待機
  async waitForContentChangeImproved(page, beforeState) {
    let waitedTime = 0;
    let lastCheckTime = Date.now();
    let stableCount = 0; // 連続して同じ状態の回数
    
    console.log(`      ⏳ 内容変化待機 (最大${this.config.paginationWaitTime/1000}秒)`);
    
    while (waitedTime < this.config.paginationWaitTime) {
      await new Promise(resolve => setTimeout(resolve, this.config.paginationCheckInterval));
      waitedTime += this.config.paginationCheckInterval;
      
      const currentState = await this.getPageState(page);
      
      // 内容が変化した場合
      if (currentState.firstTitle && 
          currentState.firstTitle !== beforeState.firstTitle && 
          currentState.count > 0) {
        console.log(`      📝 内容変化検出: "${beforeState.firstTitle?.substring(0, 20)}..." → "${currentState.firstTitle.substring(0, 20)}..."`);
        
        // 少し待ってからもう一度確認（DOM安定化のため）
        await new Promise(resolve => setTimeout(resolve, this.config.domStabilityWait));
        const finalState = await this.getPageState(page);
        
        if (finalState.count > 0) {
          return true;
        }
      }
      
      // 0件が続く場合は早期終了
      if (currentState.count === 0) {
        stableCount++;
        if (stableCount >= 3) {
          console.log(`      ❌ 0件状態が継続、早期終了`);
          return false;
        }
      } else {
        stableCount = 0;
      }
      
      // 進捗表示
      if (waitedTime % 3000 === 0) {
        console.log(`      ⌛ 待機中... ${waitedTime/1000}s (現在: ${currentState.count}件)`);
      }
    }
    
    console.log(`      ⏰ タイムアウト: ${this.config.paginationWaitTime/1000}秒経過`);
    return false;
  }

  async generateReport() {
    console.log('\n' + '='.repeat(70));
    console.log('📊 ページネーション修正版スクレイピング完了レポート');
    console.log('='.repeat(70));

    const duration = (this.stats.endTime - this.stats.startTime) / 1000 / 60;
    
    console.log(`⏱️ 実行時間: ${duration.toFixed(2)}分`);
    console.log(`📂 処理カテゴリ数: ${this.stats.categoriesProcessed}/${Object.keys(this.categories).length}`);
    console.log(`📄 処理ページ数: ${this.stats.pagesProcessed}`);
    console.log(`🎯 取得案件数: ${this.results.length}`);
    console.log(`🔁 重複スキップ数: ${this.stats.duplicatesSkipped}`);
    
    console.log(`\n📊 ページネーション統計:`);
    console.log(`   ✅ 成功: ${this.stats.paginationSuccesses}回`);
    console.log(`   ❌ 失敗: ${this.stats.paginationFailures}回`);
    console.log(`   📈 成功率: ${((this.stats.paginationSuccesses / (this.stats.paginationSuccesses + this.stats.paginationFailures)) * 100).toFixed(1)}%`);
    
    console.log(`\n🛠️ ページネーション方法別統計:`);
    console.log(`   🔗 直接URL: ${this.stats.paginationMethods.direct_url}回`);
    console.log(`   ⚡ AJAX成功: ${this.stats.paginationMethods.ajax_success}回`);
    console.log(`   🔄 AJAXリトライ: ${this.stats.paginationMethods.ajax_retry}回`);
    console.log(`   🆘 フォールバック: ${this.stats.paginationMethods.fallback_used}回`);
    
    if (this.stats.errors.length > 0) {
      console.log(`\n⚠️ エラー: ${this.stats.errors.length}件`);
      this.stats.errors.forEach((error, i) => {
        console.log(`   ${i + 1}. ${error.category || error.phase}: ${error.error}`);
      });
    }

    console.log(`\n📂 カテゴリ別取得数:`);
    Object.entries(this.stats.categoryBreakdown).forEach(([cat, count]) => {
      console.log(`   ${cat}: ${count}件`);
    });

    await this.saveResults();
  }

  async saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.join(__dirname, '../../../data/pointincome', `pointincome_fixed_${timestamp}.json`);
    
    const data = {
      scrape_date: new Date().toISOString(),
      version: 'pagination_fixed_v1',
      stats: this.stats,
      total_campaigns: this.results.length,
      campaigns: this.results
    };

    await fs.writeFile(filename, JSON.stringify(data, null, 2));
    console.log(`\n💾 データ保存完了: ${filename}`);
  }
}

if (require.main === module) {
  const scraper = new PointIncomeWebScraperFixed();
  scraper.execute().then(() => {
    console.log('\n✅ 全処理完了');
    process.exit(0);
  }).catch(error => {
    console.error('\n💥 致命的エラー:', error);
    process.exit(1);
  });
}

module.exports = PointIncomeWebScraperFixed;