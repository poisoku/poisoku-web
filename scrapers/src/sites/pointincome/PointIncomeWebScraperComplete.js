#!/usr/bin/env node

require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

/**
 * ポイントインカムWebスクレイパー（完全版）
 * 「次へ」ボタンクリックによる全ページ取得対応
 */
class PointIncomeWebScraperComplete {
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
      totalCampaigns: 0,
      duplicatesSkipped: 0,
      multiPageCategories: 0,
      singlePageCategories: 0,
      maxPagesFound: 0,
      errors: [],
      categoryBreakdown: {},
      pageBreakdown: {}
    };
  }

  getConfig() {
    return {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      timeout: 45000,
      pageWaitTime: 3000,
      clickWaitTime: 2000,
      maxRetriesPerCategory: 2,
      maxPagesPerCategory: 50,
      browserRestartInterval: 15,
      browserStartupWait: 2000
    };
  }

  initializeCategories() {
    // 完全なカテゴリリスト（83カテゴリ）
    const shoppingCategories = [
      66, 161, 160, 229, 244, 245, 246, 177, 179, 247, 178, 248, 249, 262, 250,
      251, 184, 185, 263, 252, 264, 265, 183, 253, 169, 166, 168, 167, 255, 256,
      261, 254, 171, 162, 163, 164, 173, 174, 175, 176, 230, 225, 195, 257, 258,
      194, 196, 193, 259, 260, 180
    ];

    const serviceCategories = [
      69, 70, 75, 281, 73, 74, 276, 78, 235, 79, 240, 72, 76, 81, 274, 237,
      209, 271, 232, 269, 234, 238, 280, 272, 278, 277, 283, 279, 77, 236, 270, 82
    ];

    const categories = {};

    shoppingCategories.forEach(id => {
      categories[`shopping_${id}`] = {
        id,
        name: `ショッピングカテゴリ${id}`,
        url: `https://pointi.jp/list.php?category=${id}`,
        type: 'shopping'
      };
    });

    serviceCategories.forEach(id => {
      categories[`service_${id}`] = {
        id,
        name: `サービスカテゴリ${id}`,
        url: `https://pointi.jp/list.php?category=${id}`,
        type: 'service'
      };
    });

    return categories;
  }

  async execute() {
    console.log('🎯 ポイントインカムWebスクレイピング開始（完全版）');
    console.log('='.repeat(70));
    console.log('🔥 新機能: 「次へ」ボタンクリックによる全ページ取得');
    console.log(`📊 対象カテゴリ数: ${Object.keys(this.categories).length}`);
    
    this.stats.startTime = new Date();

    try {
      await this.initializeBrowser();
      await this.processAllCategories();
      await this.saveResults();
      
      this.stats.endTime = new Date();
      this.printFinalStats();
      
    } catch (error) {
      console.error('❌ スクレイピング中にエラーが発生:', error);
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
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
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080'
      ]
    });

    await new Promise(resolve => setTimeout(resolve, this.config.browserStartupWait));
  }

  async processAllCategories() {
    const categoryKeys = Object.keys(this.categories);
    
    const testLimit = process.env.TEST_MODE === 'true' ? 3 : categoryKeys.length;
    const processCount = Math.min(testLimit, categoryKeys.length);
    
    for (let i = 0; i < processCount; i++) {
      const categoryKey = categoryKeys[i];
      const categoryConfig = this.categories[categoryKey];
      
      // 定期的なブラウザ再起動
      if (i > 0 && i % this.config.browserRestartInterval === 0) {
        console.log(`🔄 定期ブラウザ再起動 (${i}カテゴリ処理完了)`);
        await this.initializeBrowser();
      }
      
      await this.processCategory(categoryKey, categoryConfig);
      
      // 進捗表示
      if (i % 10 === 0 || i === processCount - 1) {
        console.log(`📈 進捗: ${i + 1}/${processCount} (${((i + 1) / processCount * 100).toFixed(1)}%) - 取得済み案件数: ${this.stats.totalCampaigns}`);
      }
      
      // テストモードでの早期終了
      if (process.env.TEST_MODE === 'true' && i >= 2) {
        console.log('🧪 テストモード: 3カテゴリ処理完了、テスト終了');
        break;
      }
    }
  }

  async processCategory(categoryKey, categoryConfig) {
    const isMainProgress = this.stats.categoriesProcessed % 10 === 0;
    if (isMainProgress) {
      console.log(`\n📂 ${categoryConfig.type.toUpperCase()}: ${categoryConfig.name}`);
    }

    let retryCount = 0;
    let categoryResults = [];

    while (retryCount < this.config.maxRetriesPerCategory) {
      let page = null;
      try {
        if (!this.browser || !this.browser.isConnected()) {
          await this.initializeBrowser();
        }

        page = await this.browser.newPage();
        await page.setUserAgent(this.config.userAgent);
        await page.setViewport(this.config.viewport);

        await page.goto(categoryConfig.url, {
          waitUntil: 'networkidle2',
          timeout: this.config.timeout
        });
        
        await new Promise(resolve => setTimeout(resolve, this.config.pageWaitTime));
        
        // 全ページを取得
        categoryResults = await this.scrapeAllPages(page, categoryConfig);
        
        if (page) {
          await page.close();
        }
        break;

      } catch (error) {
        retryCount++;
        if (isMainProgress) {
          console.log(`      ⚠️ エラー (リトライ ${retryCount}/${this.config.maxRetriesPerCategory}): ${error.message}`);
        }
        
        if (page) {
          try {
            await page.close();
          } catch (closeError) {}
        }
        
        if (error.message.includes('Protocol error') || error.message.includes('Connection closed')) {
          await this.initializeBrowser();
        }
        
        if (retryCount >= this.config.maxRetriesPerCategory) {
          this.stats.errors.push({
            category: categoryKey,
            error: error.message
          });
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // 結果を追加
    let newCampaigns = 0;
    categoryResults.forEach(campaign => {
      if (!this.seenCampaignIds.has(campaign.id)) {
        this.seenCampaignIds.add(campaign.id);
        this.results.push(campaign);
        newCampaigns++;
        this.stats.totalCampaigns++;
      } else {
        this.stats.duplicatesSkipped++;
      }
    });

    const pagesCount = this.stats.pageBreakdown[categoryKey] || 0;
    if (pagesCount > 1) {
      this.stats.multiPageCategories++;
    } else {
      this.stats.singlePageCategories++;
    }
    
    if (pagesCount > this.stats.maxPagesFound) {
      this.stats.maxPagesFound = pagesCount;
    }

    this.stats.categoriesProcessed++;
    this.stats.categoryBreakdown[categoryKey] = newCampaigns;
    
    if (isMainProgress) {
      console.log(`      📊 完了: ${newCampaigns}件 (${pagesCount}ページ)`);
    }
  }

  async scrapeAllPages(page, categoryConfig) {
    let allCampaigns = [];
    let currentPage = 1;
    let hasNextPage = true;

    while (hasNextPage && currentPage <= this.config.maxPagesPerCategory) {
      try {
        // 現在のページの案件を取得
        const pageCampaigns = await this.extractCampaigns(page, categoryConfig, currentPage);
        allCampaigns.push(...pageCampaigns);
        
        this.stats.pagesProcessed++;
        
        // 次へボタンの存在確認とクリック
        const nextButtonInfo = await this.checkAndClickNextButton(page);
        
        if (nextButtonInfo.hasNext && nextButtonInfo.clicked) {
          // ページロード待機
          await new Promise(resolve => setTimeout(resolve, this.config.clickWaitTime));
          
          // ページが正常に遷移したか確認
          await page.waitForSelector('.box_ad', { timeout: 10000 });
          
          currentPage++;
        } else {
          hasNextPage = false;
        }
        
      } catch (error) {
        console.log(`      ⚠️ ページ${currentPage}でエラー: ${error.message}`);
        hasNextPage = false;
      }
    }

    // ページ数を記録
    this.stats.pageBreakdown[`${categoryConfig.type}_${categoryConfig.id}`] = currentPage;
    
    return allCampaigns;
  }

  async checkAndClickNextButton(page) {
    return await page.evaluate(() => {
      // 次へボタンを検索
      const nextButtonSelectors = [
        'a.next',
        'a[onclick*="tab_select"]',
        'a:contains("次へ")',
        '.pager_wrap a:last-child'
      ];
      
      let nextButton = null;
      let hasNext = false;
      
      // セレクタを順番に試す
      for (const selector of nextButtonSelectors) {
        if (selector.includes('contains')) {
          // :containsは標準CSSセレクタではないので手動検索
          const buttons = Array.from(document.querySelectorAll('a'));
          nextButton = buttons.find(a => 
            a.textContent.includes('次へ') || 
            a.textContent.includes('次へ>') ||
            a.textContent.includes('>')
          );
        } else {
          nextButton = document.querySelector(selector);
        }
        
        if (nextButton) {
          // ボタンが有効か確認（非活性ではない）
          const isDisabled = nextButton.classList.contains('disabled') || 
                           nextButton.classList.contains('current') ||
                           nextButton.getAttribute('onclick') === null;
          
          if (!isDisabled) {
            hasNext = true;
            break;
          }
        }
      }
      
      let clicked = false;
      if (hasNext && nextButton) {
        try {
          // onclick属性がある場合はJavaScript実行
          const onclickAttr = nextButton.getAttribute('onclick');
          if (onclickAttr) {
            eval(onclickAttr);
            clicked = true;
          } else {
            // 通常のクリック
            nextButton.click();
            clicked = true;
          }
        } catch (error) {
          console.log('クリックエラー:', error);
        }
      }
      
      return {
        hasNext: hasNext,
        clicked: clicked,
        buttonText: nextButton ? nextButton.textContent.trim() : '',
        onclick: nextButton ? nextButton.getAttribute('onclick') : null
      };
    });
  }

  async extractCampaigns(page, categoryConfig, pageNumber) {
    return await page.evaluate((config, pageNum) => {
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

          const url = relativeUrl ? `https://pointi.jp${relativeUrl}` : '';

          if (title && url) {
            campaigns.push({
              id: id,
              title: title,
              url: url,
              points: points,
              category: config.name,
              categoryId: config.id,
              categoryType: config.type,
              page: pageNum,
              scrapedAt: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error('案件解析エラー:', error);
        }
      });
      
      return campaigns;
    }, categoryConfig, pageNumber);
  }

  async saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const dataDir = path.join(__dirname, '../../data/pointincome');
    
    try {
      await fs.mkdir(dataDir, { recursive: true });
    } catch (error) {
      // ディレクトリが既に存在する場合は無視
    }

    const outputData = {
      scrape_date: new Date().toISOString(),
      version: "complete_pagination_v1",
      strategy: "complete_page_navigation_with_next_button",
      stats: this.stats,
      campaigns: this.results
    };

    const filename = `pointincome_web_complete_${timestamp}.json`;
    const filepath = path.join(dataDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify(outputData, null, 2));
    
    console.log(`\n💾 データ保存完了: ${filename}`);
    console.log(`📁 保存先: ${filepath}`);
  }

  printFinalStats() {
    const duration = this.stats.endTime - this.stats.startTime;
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);

    console.log('\n' + '='.repeat(70));
    console.log('📊 完全版スクレイピング完了レポート');
    console.log('='.repeat(70));
    console.log(`⏱️ 実行時間: ${minutes}分${seconds.toFixed(0)}秒`);
    console.log(`📂 処理カテゴリ数: ${this.stats.categoriesProcessed}/${Object.keys(this.categories).length}`);
    console.log(`📄 処理ページ数: ${this.stats.pagesProcessed}`);
    console.log(`🎯 取得案件数: ${this.stats.totalCampaigns}`);
    console.log(`🔁 重複スキップ数: ${this.stats.duplicatesSkipped}`);
    console.log(`📊 最大ページ数: ${this.stats.maxPagesFound}`);
    
    console.log('\n📊 カテゴリタイプ別統計:');
    const shoppingTotal = Object.keys(this.categories)
      .filter(key => this.categories[key].type === 'shopping')
      .reduce((sum, key) => sum + (this.stats.categoryBreakdown[key] || 0), 0);
    
    const serviceTotal = Object.keys(this.categories)
      .filter(key => this.categories[key].type === 'service')
      .reduce((sum, key) => sum + (this.stats.categoryBreakdown[key] || 0), 0);
      
    console.log(`   🛍️ ショッピング: ${Object.keys(this.categories).filter(key => this.categories[key].type === 'shopping').length}カテゴリ → ${shoppingTotal}件`);
    console.log(`   🔧 サービス: ${Object.keys(this.categories).filter(key => this.categories[key].type === 'service').length}カテゴリ → ${serviceTotal}件`);

    console.log('\n📄 ページ情報:');
    console.log(`   📄 単一ページカテゴリ: ${this.stats.singlePageCategories}`);
    console.log(`   📄📄 複数ページカテゴリ: ${this.stats.multiPageCategories}`);
    
    if (this.stats.errors.length > 0) {
      console.log(`\n⚠️ エラー: ${this.stats.errors.length}件`);
      this.stats.errors.forEach(error => {
        console.log(`   - ${error.category}: ${error.error}`);
      });
    }

    console.log('\n✅ 全処理完了 - 「次へ」ボタンクリック対応により全案件取得');
  }
}

// 実行
if (require.main === module) {
  const scraper = new PointIncomeWebScraperComplete();
  scraper.execute().catch(console.error);
}

module.exports = PointIncomeWebScraperComplete;