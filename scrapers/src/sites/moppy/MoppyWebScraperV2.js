#!/usr/bin/env node

/**
 * モッピー Web案件専用スクレイパー V2
 * 10カテゴリで全Web案件を効率的に取得
 * アプリ版と同レベルに洗練されたメンテナンス性重視版
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

class MoppyWebScraperV2 {
  constructor() {
    this.browser = null;
    this.results = [];
    this.seenSiteIds = new Set();
    this.stats = {
      startTime: null,
      endTime: null,
      categoriesProcessed: 0,
      pagesProcessed: 0,
      campaignsFound: 0,
      duplicatesRemoved: 0,
      errors: []
    };
    
    // 10カテゴリで全Web案件をカバー
    this.targetCategories = [
      { id: 1, name: 'アンケート・モニター' },
      { id: 2, name: 'サービス・他' },
      { id: 3, name: 'ショッピング' },
      { id: 4, name: 'サービス' },
      { id: 5, name: 'クレジットカード' },
      { id: 6, name: 'ショッピング詳細' },
      { id: 7, name: '旅行・レジャー' },
      { id: 8, name: 'エンタメ' },
      { id: 9, name: 'その他' },
      { id: 10, name: '特別カテゴリ' }
    ];
    
    this.baseUrl = 'https://pc.moppy.jp/category/list.php';
  }

  /**
   * 初期化
   */
  async initialize() {
    console.log('🌐 モッピー Web案件スクレイパー V2 初期化中...');
    console.log('🎯 対象: 10カテゴリのWeb案件');
    console.log('📊 取得方式: カテゴリページスキャン');
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    
    console.log('✅ 初期化完了');
  }

  /**
   * ページから案件データを抽出
   */
  async extractCampaigns(page, categoryId) {
    return await page.evaluate((categoryId) => {
      const campaigns = [];
      
      // 案件リンクを取得
      const links = document.querySelectorAll('a[href*="/shopping/detail.php"], a[href*="/ad/detail.php"]');
      
      console.log(`🔍 カテゴリ${categoryId}で${links.length}個のリンクを発見`);
      
      links.forEach((link, index) => {
        try {
          const href = link.href;
          
          // プロモーション案件を除外
          if (href.includes('track_ref=tw') || 
              href.includes('track_ref=reg') ||
              href.includes('track_ref=recommend') ||
              href.includes('track_ref=promotion')) {
            return;
          }
          
          // site_id抽出
          const siteIdMatch = href.match(/site_id=(\d+)/);
          if (!siteIdMatch) return;
          
          const siteId = siteIdMatch[1];
          const title = link.title || link.getAttribute('data-title') || link.getAttribute('alt') || '';
          
          // タイトルが空の場合、画像のaltやリンクテキストから取得
          let finalTitle = title;
          if (!finalTitle) {
            const img = link.querySelector('img');
            if (img) {
              finalTitle = img.alt || img.title || '';
            }
          }
          if (!finalTitle) {
            const linkText = link.textContent.trim();
            if (linkText && linkText.length < 200) {
              finalTitle = linkText.replace(/\s+/g, ' ').trim();
            }
          }
          
          // ポイント情報を親要素から抽出
          let points = '';
          let container = link.parentElement;
          for (let level = 0; level < 3; level++) {
            if (!container) break;
            
            const containerText = container.textContent || '';
            const pointPatterns = [
              /(\d{1,6}(?:,\d{3})*)(?:\s*)[PpＰ]/,    // 120P
              /(\d{1,6}(?:,\d{3})*)(?:\s*)ポイント/,    // 120ポイント
              /(\d{1,2}(?:\.\d+)?)(?:\s*)%/,          // 1.5%
              /(\d{1,6}(?:,\d{3})*)(?:\s*)円/          // 120円
            ];
            
            for (const pattern of pointPatterns) {
              const match = containerText.match(pattern);
              if (match) {
                points = match[1] + (containerText.includes('%') ? '%' : 
                                   containerText.includes('円') ? '円' :
                                   containerText.includes('ポイント') ? 'ポイント' : 'P');
                break;
              }
            }
            
            if (points) break;
            container = container.parentElement;
          }
          
          // デバイス分類
          let device = 'PC';
          if (href.includes('child_category=52')) {
            device = 'App';
          }
          
          const campaign = {
            id: `moppy_${siteId}`,
            title: finalTitle || 'タイトル不明',
            url: href,
            points: points || 'ポイント不明',
            device: device,
            categoryId: categoryId,
            scrapedAt: new Date().toISOString(),
            source: 'moppy_web_scraper_v2'
          };
          
          campaigns.push(campaign);
          console.log(`✅ 案件取得: ${campaign.title} [${points}]`);
          
        } catch (error) {
          console.error('案件抽出エラー:', error);
        }
      });
      
      return campaigns;
    }, categoryId);
  }

  /**
   * 指定カテゴリの全ページをスクレイピング
   */
  async scrapeCategory(categoryId, categoryName) {
    console.log(`\n🔍 カテゴリ${categoryId}（${categoryName}）処理開始...`);
    
    const page = await this.browser.newPage();
    
    try {
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      let currentPage = 1;
      let hasNextPage = true;
      const categoryResults = [];
      
      while (hasNextPage && currentPage <= 20) { // 最大20ページ
        const pageUrl = `${this.baseUrl}?parent_category=${categoryId}&af_sorter=1&page=${currentPage}`;
        console.log(`📄 ページ ${currentPage} 処理中...`);
        
        try {
          await page.goto(pageUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
          });
          
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // 「条件に一致する広告はありません」チェック
          const noAdsMessage = await page.evaluate(() => {
            const pageText = document.body.textContent;
            return pageText.includes('条件に一致する広告はありません') ||
                   pageText.includes('該当する広告がありません');
          });
          
          if (noAdsMessage) {
            console.log(`📄 ページ${currentPage}: 広告なしメッセージ検出（終了）`);
            hasNextPage = false;
            break;
          }
          
          // 案件データ抽出
          const campaigns = await this.extractCampaigns(page, categoryId);
          
          if (campaigns.length === 0) {
            console.log(`📄 ページ${currentPage}: 案件が見つかりませんでした（終了）`);
            hasNextPage = false;
          } else {
            // 重複除去
            const uniqueCampaigns = [];
            let duplicates = 0;
            
            for (const campaign of campaigns) {
              const siteId = campaign.id.replace('moppy_', '');
              if (!this.seenSiteIds.has(siteId)) {
                this.seenSiteIds.add(siteId);
                uniqueCampaigns.push(campaign);
              } else {
                duplicates++;
                this.stats.duplicatesRemoved++;
              }
            }
            
            categoryResults.push(...uniqueCampaigns);
            this.stats.pagesProcessed++;
            
            console.log(`📄 ページ${currentPage}: ${campaigns.length}件取得 → ${uniqueCampaigns.length}件追加（重複${duplicates}件除外）`);
          }
          
          currentPage++;
          
        } catch (error) {
          console.error(`❌ ページ ${currentPage} エラー:`, error);
          this.stats.errors.push(`Category ${categoryId} Page ${currentPage}: ${error.message}`);
          hasNextPage = false;
        }
      }
      
      console.log(`✅ カテゴリ${categoryId} 完了: ${categoryResults.length}件取得`);
      return categoryResults;
      
    } finally {
      await page.close();
    }
  }

  /**
   * メインスクレイピング実行
   */
  async scrape() {
    this.stats.startTime = new Date();
    console.log('🚀 モッピー Web案件スクレイピング V2 開始');
    console.log(`⏰ 開始時刻: ${this.stats.startTime.toLocaleString('ja-JP')}`);
    
    try {
      await this.initialize();
      
      // 各カテゴリを処理
      for (const category of this.targetCategories) {
        const categoryCampaigns = await this.scrapeCategory(category.id, category.name);
        this.results.push(...categoryCampaigns);
        this.stats.categoriesProcessed++;
        
        // カテゴリ間待機
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      this.stats.campaignsFound = this.results.length;
      this.stats.endTime = new Date();
      
      console.log('\n🎉 スクレイピング完了!');
      console.log('📊 結果サマリー:');
      console.log(`🌐 Web案件: ${this.results.length}件`);
      console.log(`📂 処理カテゴリ: ${this.stats.categoriesProcessed}カテゴリ`);
      console.log(`📄 処理ページ数: ${this.stats.pagesProcessed}ページ`);
      console.log(`🔄 重複除去: ${this.stats.duplicatesRemoved}件`);
      console.log(`⏱️ 実行時間: ${Math.round((this.stats.endTime - this.stats.startTime) / 1000)}秒`);
      
      if (this.results.length >= 1800) {
        console.log('🎯 目標の1800件以上を取得成功！');
      }
      
      if (this.stats.errors.length > 0) {
        console.log(`⚠️ エラー: ${this.stats.errors.length}件`);
      }
      
      return this.results;
      
    } catch (error) {
      console.error('💥 スクレイピングエラー:', error);
      throw error;
    }
  }

  /**
   * 結果をJSONファイルに保存
   */
  async saveResults() {
    if (this.results.length === 0) {
      console.log('📝 保存する結果がありません');
      return;
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // 保存ディレクトリ
    const dataDir = path.join(__dirname, '..', '..', '..', 'data', 'moppy');
    await fs.mkdir(dataDir, { recursive: true });
    
    // ファイル保存
    const fileName = `moppy_web_v2_${timestamp}.json`;
    const filePath = path.join(dataDir, fileName);
    
    const saveData = {
      campaigns: this.results,
      stats: { ...this.stats, type: 'web_campaigns', version: 'v2' }
    };
    
    await fs.writeFile(filePath, JSON.stringify(saveData, null, 2));
    console.log(`💾 保存完了: ${fileName} (${this.results.length}件)`);
  }

  /**
   * 終了処理
   */
  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      console.log('🔧 ブラウザ終了');
    }
  }
}

// 実行部分
async function main() {
  const scraper = new MoppyWebScraperV2();
  
  try {
    const results = await scraper.scrape();
    await scraper.saveResults();
    
    console.log('\n🎯 モッピー Web案件スクレイピング V2 完了!');
    console.log(`📊 最終結果: ${results.length}件の案件を取得`);
    
  } catch (error) {
    console.error('💥 実行エラー:', error);
    process.exit(1);
  } finally {
    await scraper.cleanup();
  }
}

if (require.main === module) {
  main();
}

module.exports = MoppyWebScraperV2;