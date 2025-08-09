#!/usr/bin/env node

require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

/**
 * ポイントインカムWebスクレイパー
 * 82カテゴリ（ショッピング50、サービス32）対応
 */
class PointIncomeWebScraper {
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
      errors: [],
      categoryBreakdown: {}
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
      browserRestartInterval: 5
    };
  }

  initializeCategories() {
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
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--memory-pressure-off'
      ]
    });
    
    // ブラウザ起動後に少し待機
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  async execute() {
    console.log('🎯 ポイントインカムWeb案件スクレイピング開始');
    console.log('='.repeat(60));
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
        
        // カテゴリ間で少し休憩
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

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
      this.stats.endTime = new Date();
    }
  }

  async processCategory(categoryKey, categoryConfig) {
    console.log(`\n📂 ${categoryConfig.type.toUpperCase()}: ${categoryConfig.name}`);

    const categoryResults = [];
    let retryCount = 0;

    while (retryCount < this.config.maxRetriesPerCategory) {
      let page = null;
      try {
        // ブラウザの健康状態チェック
        if (!this.browser || !this.browser.isConnected()) {
          console.log('⚠️ ブラウザ接続失効、再初期化中...');
          await this.initializeBrowser();
        }

        page = await this.browser.newPage();
        await page.setUserAgent(this.config.userAgent);
        await page.setViewport(this.config.viewport);

        // より堅牢なページ読み込み
        await page.goto(categoryConfig.url, {
          waitUntil: 'networkidle2',
          timeout: this.config.timeout
        });
        
        // ページのJavaScript完全実行を待機
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        let currentPage = 1;
        let hasNextPage = true;

        while (hasNextPage && currentPage <= this.config.maxPagesPerCategory) {
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

          hasNextPage = await this.navigateToNextPage(page, currentPage);
          if (hasNextPage) {
            currentPage++;
            this.stats.pagesProcessed++;
            await new Promise(resolve => setTimeout(resolve, this.config.pageWaitTime));
          }
        }

        if (page) {
          await page.close();
        }
        break;

      } catch (error) {
        retryCount++;
        console.log(`   ⚠️ エラー (リトライ ${retryCount}/${this.config.maxRetriesPerCategory}): ${error.message}`);
        
        // ページクリーンアップ
        if (page) {
          try {
            await page.close();
          } catch (closeError) {
            console.log('      ⚠️ ページクローズエラー:', closeError.message);
          }
        }
        
        // 接続エラーの場合はブラウザを再初期化
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
        
        // リトライ前に少し待機
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
              device: 'すべて',  // スマホアプリ案件以外は全て「すべて」
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

  async navigateToNextPage(page, currentPage) {
    try {
      // 現在のページ番号を取得して次のページ番号を計算
      const nextPageNumber = currentPage + 1;
      console.log(`🔍 ページ${currentPage} → ページ${nextPageNumber} への遷移を試行`);
      
      // ページネーション要素の完全ロードを待機
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 利用可能なページ番号を確認（より厳密な検出）
      const availablePages = await page.evaluate(() => {
        // ページが完全にロードされるまで少し待機
        const pageLinks = Array.from(document.querySelectorAll('a[onclick*="tab_select"]'));
        
        console.log(`DEBUG: Found ${pageLinks.length} tab_select links`);
        
        const pageNumbers = pageLinks
          .map(link => {
            const onclick = link.getAttribute('onclick');
            const text = link.textContent.trim();
            console.log(`DEBUG: Link text: "${text}", onclick: "${onclick}"`);
            
            if (!onclick) return null;
            
            // より柔軟な正規表現パターン
            const patterns = [
              /tab_select\('tab1',\s*0,\s*\d+,\s*(\d+)\)/,  // 一般的なパターン
              /tab_select\('tab1',\s*\d+,\s*\d+,\s*(\d+)\)/, // インデックスが異なる場合
              /tab_select\(\s*'[^']+',\s*\d+,\s*\d+,\s*(\d+)\s*\)/ // より汎用的
            ];
            
            for (const pattern of patterns) {
              const match = onclick.match(pattern);
              if (match) {
                console.log(`DEBUG: Matched pattern with page ${match[1]}`);
                return parseInt(match[1]);
              }
            }
            
            return null;
          })
          .filter(num => num !== null)
          .sort((a, b) => a - b);
        
        console.log(`DEBUG: Extracted page numbers: [${pageNumbers.join(', ')}]`);
        return pageNumbers;
      });
      
      console.log(`📊 利用可能なページ: [${availablePages.join(', ')}]`);
      
      // ポイントインカムの「次へ」ボタンを正確に検出（最終ページ判定の主要な方法）
      const nextButtonInfo = await page.evaluate(() => {
        // 「次へ>」テキストを含み、tab_selectのonclickを持つ要素を探す
        const links = Array.from(document.querySelectorAll('a[onclick*="tab_select"]'));
        
        for (const link of links) {
          const text = link.textContent.trim();
          if (text.includes('次へ') || text === '次へ>') {
            // onclick属性から次のページ番号を取得
            const onclick = link.getAttribute('onclick');
            const pageMatch = onclick.match(/tab_select\([^,]+,\s*\d+,\s*\d+,\s*(\d+)\)/);
            const targetPage = pageMatch ? parseInt(pageMatch[1]) : null;
            
            return {
              found: true,
              onclick: onclick,
              href: link.getAttribute('href'),
              text: text,
              targetPage: targetPage
            };
          }
        }
        
        // フォールバック：class="next"を持つ要素
        const nextLinks = Array.from(document.querySelectorAll('a.next, a[class*="next"]'));
        if (nextLinks.length > 0 && nextLinks[0].getAttribute('onclick')) {
          const link = nextLinks[0];
          const onclick = link.getAttribute('onclick');
          const pageMatch = onclick.match(/tab_select\([^,]+,\s*\d+,\s*\d+,\s*(\d+)\)/);
          const targetPage = pageMatch ? parseInt(pageMatch[1]) : null;
          
          return {
            found: true,
            onclick: onclick,
            href: link.getAttribute('href'),
            text: link.textContent.trim(),
            targetPage: targetPage
          };
        }
        
        return { found: false };
      });

      if (!nextButtonInfo.found) {
        console.log('❌ 次へボタンが見つかりません（最終ページに到達）');
        return false;
      }

      // 次のページ番号が現在のページ番号より大きいかチェック
      if (nextButtonInfo.targetPage && nextButtonInfo.targetPage <= currentPage) {
        console.log(`❌ 次ページ番号が無効 (現在:${currentPage}, 次:${nextButtonInfo.targetPage})（最終ページに到達）`);
        return false;
      }

      console.log(`🔍 「次へ」ボタン発見 - onclick: ${nextButtonInfo.onclick}, href: ${nextButtonInfo.href}, 対象ページ: ${nextButtonInfo.targetPage}`);
      
      if (nextButtonInfo.onclick && nextButtonInfo.onclick.includes('tab_select')) {
        // JavaScriptによるページ遷移
        console.log('🖱️ JavaScriptページネーション実行中...');
        
        // クリック前の最初の案件タイトルを記録（変化検出用）
        const beforeFirstTitle = await page.evaluate(() => {
          const firstAd = document.querySelector('.box_ad .title_list');
          return firstAd ? firstAd.textContent.trim() : null;
        }).catch(() => null);
        
        const beforeCount = await page.$$eval('.box_ad', elements => elements.length).catch(() => 0);
        console.log(`📊 クリック前: ${beforeCount}件 (最初: "${beforeFirstTitle}")`);
        
        // jQueryベースのtab_select関数を動的なページ番号で実行
        const clickResult = await page.evaluate((nextPage) => {
          // 次へボタンをクリックして tab_select を実行
          if (typeof window.tab_select === 'function') {
            console.log(`tab_select関数を実行中... ページ${nextPage}へ`);
            // 動的なページ番号を使用
            window.tab_select('tab1', 0, 63, nextPage);
            return true;
          }
          return false;
        }, nextButtonInfo.targetPage || nextPageNumber);
        
        if (!clickResult) {
          console.log('❌ tab_select関数が見つかりません');
          return false;
        }
        
        console.log('⏳ jQuery .load() 完了待機中...');
        
        // より長い初期待機（jQueryのAJAXロード完了を確実に待つ）
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // DOM変更を監視して内容が変わるまで最大45秒待機
        let contentChanged = false;
        const maxWaitTime = 45000;
        const checkInterval = 2000; // 2秒間隔に延長
        let waitedTime = 0;
        
        while (waitedTime < maxWaitTime && !contentChanged) {
          await new Promise(resolve => setTimeout(resolve, checkInterval));
          waitedTime += checkInterval;
          
          // より確実な変化検出（複数の要素をチェック）
          const currentState = await page.evaluate(() => {
            const firstAd = document.querySelector('.box_ad .title_list');
            const allAds = document.querySelectorAll('.box_ad');
            return {
              firstTitle: firstAd ? firstAd.textContent.trim() : null,
              totalCount: allAds.length,
              // 2番目の案件タイトルも確認
              secondTitle: allAds.length > 1 && allAds[1].querySelector('.title_list') 
                ? allAds[1].querySelector('.title_list').textContent.trim() : null
            };
          }).catch(() => ({ firstTitle: null, totalCount: 0, secondTitle: null }));
          
          // より厳密な変化検出
          if (currentState.firstTitle && 
              (currentState.firstTitle !== beforeFirstTitle || 
               currentState.totalCount !== beforeCount)) {
            contentChanged = true;
            console.log(`📝 内容変化を検出: "${beforeFirstTitle}" → "${currentState.firstTitle}" (${beforeCount}→${currentState.totalCount}件)`);
            break;
          }
          
          // 3秒おきにプログレス表示
          if (waitedTime % 6000 === 0) {
            console.log(`⏳ 待機中... ${waitedTime/1000}秒経過 (現在: ${currentState.firstTitle || 'null'})`);
          }
        }
        
        const afterCount = await page.$$eval('.box_ad', elements => elements.length).catch(() => 0);
        const afterFirstTitle = await page.evaluate(() => {
          const firstAd = document.querySelector('.box_ad .title_list');
          return firstAd ? firstAd.textContent.trim() : null;
        }).catch(() => null);
        
        console.log(`📊 クリック後: ${afterCount}件 (最初: "${afterFirstTitle}")`);
        
        // 内容が変化していればページネーション成功
        if (contentChanged && afterCount > 0) {
          console.log('✅ ページネーション成功！');
          return true;
        } else {
          console.log('❌ ページネーション失敗：内容が変化しませんでした');
          return false;
        }
        
      } else if (nextButtonInfo.href && nextButtonInfo.href !== 'javascript:void(0);' && nextButtonInfo.href !== '#') {
        // 通常のリンク遷移
        console.log('🔗 通常リンク遷移実行中...');
        await page.goto(nextButtonInfo.href, {
          waitUntil: 'networkidle2',
          timeout: this.config.timeout
        });
        return true;
      } else {
        console.log('❌ 有効なページネーション方法が見つかりません');
        return false;
      }

      return true;
      
    } catch (error) {
      console.log('      ℹ️ 次ページなし');
      return false;
    }
  }

  async generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 スクレイピング完了レポート');
    console.log('='.repeat(60));

    const duration = (this.stats.endTime - this.stats.startTime) / 1000 / 60;
    
    console.log(`⏱️ 実行時間: ${duration.toFixed(2)}分`);
    console.log(`📂 処理カテゴリ数: ${this.stats.categoriesProcessed}/${Object.keys(this.categories).length}`);
    console.log(`📄 処理ページ数: ${this.stats.pagesProcessed}`);
    console.log(`🎯 取得案件数: ${this.results.length}`);
    console.log(`🔁 重複スキップ数: ${this.stats.duplicatesSkipped}`);
    
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
    const filename = path.join(__dirname, '../../../data/pointincome', `pointincome_web_${timestamp}.json`);
    
    const data = {
      scrape_date: new Date().toISOString(),
      stats: this.stats,
      total_campaigns: this.results.length,
      campaigns: this.results
    };

    await fs.writeFile(filename, JSON.stringify(data, null, 2));
    console.log(`\n💾 データ保存完了: ${filename}`);
  }
}

if (require.main === module) {
  const scraper = new PointIncomeWebScraper();
  scraper.execute().then(() => {
    console.log('\n✅ 全処理完了');
    process.exit(0);
  }).catch(error => {
    console.error('\n💥 致命的エラー:', error);
    process.exit(1);
  });
}

module.exports = PointIncomeWebScraper;