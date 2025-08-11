#!/usr/bin/env node

require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

/**
 * ポイントインカム PC限定案件スクレイパー
 * AJAX応答のHTML構造に合わせて正しく案件を抽出
 */
class PointIncomePCOnlyScraper {
  constructor() {
    this.browser = null;
    this.results = [];
    this.seenIds = new Set();
    this.stats = {
      startTime: null,
      endTime: null,
      ajaxRequests: 0,
      duplicatesSkipped: 0
    };
  }

  get config() {
    return {
      category: {
        id: 270,
        name: 'PC限定案件（ブラウザゲーム）',
        url: 'https://pointi.jp/list.php?category=270'
      },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      timeout: 45000,
      ajaxWait: 3000
    };
  }

  async execute() {
    console.log('🖥️ ポイントインカム PC限定案件取得開始');
    console.log('='.repeat(70));
    console.log(`📍 対象カテゴリ: ${this.config.category.name} (ID: ${this.config.category.id})`);
    
    this.stats.startTime = new Date();

    try {
      await this.initializeBrowser();
      await this.scrapePCOnlyCategory();
      
      this.stats.endTime = new Date();
      
      await this.generateReport();
      await this.saveResults();
      
    } catch (error) {
      console.error('💥 実行エラー:', error);
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  async initializeBrowser() {
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--window-size=1920,1080'
      ]
    });
  }

  async scrapePCOnlyCategory() {
    const page = await this.browser.newPage();
    
    // AJAX応答をキャプチャして解析
    page.on('response', async (response) => {
      if (response.url().includes('load_list.php') && response.url().includes('category=270')) {
        try {
          const responseBody = await response.text();
          if (responseBody.length > 100) {
            console.log(`📥 AJAX応答解析: ${responseBody.length} bytes`);
            this.stats.ajaxRequests++;
            
            // AJAX応答から案件を抽出
            const ajaxCampaigns = this.extractCampaignsFromHTML(responseBody);
            console.log(`   🎯 抽出案件: ${ajaxCampaigns.length}件`);
            
            // 重複除去して結果に追加
            ajaxCampaigns.forEach(campaign => {
              if (!this.seenIds.has(campaign.id)) {
                this.seenIds.add(campaign.id);
                this.results.push(campaign);
              } else {
                this.stats.duplicatesSkipped++;
              }
            });
          }
        } catch (error) {
          console.log(`❌ AJAX応答処理エラー: ${error.message}`);
        }
      }
    });

    try {
      // PC環境設定
      await page.setUserAgent(this.config.userAgent);
      await page.setViewport(this.config.viewport);
      
      console.log(`\n🖥️ PC環境でアクセス: ${this.config.category.url}`);
      
      // ページアクセス
      await page.goto(this.config.category.url, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      });
      
      await this.sleep(this.config.ajaxWait);
      
      // 複数のソート順序とページでAJAX読み込みを実行
      const sortOrders = [1, 2, 3, 5];
      const pages = [1, 2]; // 複数ページも確認
      
      for (const order of sortOrders) {
        for (const pageNum of pages) {
          console.log(`🔄 ソート順序 ${order}, ページ ${pageNum} でAJAX読み込み...`);
          await page.evaluate((orderVal, pageVal) => {
            if (typeof window.tab_select === 'function') {
              window.tab_select('270', orderVal, 1, pageVal);
            }
          }, order, pageNum);
          
          await this.sleep(1500); // 各リクエストの間隔
        }
      }
      
      console.log(`📊 総AJAX応答数: ${this.stats.ajaxRequests}件`);
      console.log(`🎯 取得案件数: ${this.results.length}件 (重複除去: ${this.stats.duplicatesSkipped}件)`);
      
    } finally {
      await page.close();
    }
  }

  extractCampaignsFromHTML(htmlContent) {
    const campaigns = [];
    
    try {
      // box_ad_inner 要素ごとに案件を抽出（実際のHTML構造に基づく）
      const boxPattern = /<div class="box_ad_inner">([\s\S]*?)<\/div>(?=\s*<\/div>)/g;
      let match;
      
      while ((match = boxPattern.exec(htmlContent)) !== null) {
        const boxContent = match[1];
        
        try {
          // URL とID抽出
          const urlMatch = boxContent.match(/<a href="\.\/ad\/(\d+)\/"/);
          if (!urlMatch) continue;
          
          const adId = urlMatch[1];
          const fullUrl = `https://pointi.jp/ad/${adId}/`;
          
          // タイトル抽出（title_list クラス）
          const titleMatch = boxContent.match(/<div class="title_list">(.*?)<\/div>/);
          if (!titleMatch) continue;
          
          let title = titleMatch[1].replace(/<[^>]*>/g, '').trim();
          
          // ポイント抽出（list_pt内のspan構造）
          let points = '';
          const pointMatch = boxContent.match(/<div class="list_pt">[\s\S]*?<span class="big">([^<]+)<\/span>[\s\S]*?<span class="pt_after">([^<]+)<\/span>/);
          if (pointMatch) {
            const pointValue = pointMatch[1].replace(/,/g, '');
            const pointUnit = pointMatch[2];
            points = `${pointValue}${pointUnit}`;
            
            // pt → 円変換
            if (pointUnit === 'pt') {
              const pts = parseInt(pointValue);
              const yen = Math.floor(pts / 10);
              points = `${yen.toLocaleString()}円`;
            }
          }
          
          // カテゴリ情報抽出
          let category = '';
          const categoryMatch = boxContent.match(/<span class="statas_emphas">([^<]+)<\/span>/);
          if (categoryMatch) {
            category = categoryMatch[1];
          }
          
          // 獲得条件抽出
          let conditions = '';
          const conditionsMatch = boxContent.match(/<div class="list_way">([^<]*)/); 
          if (conditionsMatch) {
            conditions = conditionsMatch[1].replace(/獲得条件:/, '').trim();
          }
          
          if (title && adId) {
            campaigns.push({
              id: adId,
              title: title,
              url: fullUrl,
              points: points || '不明',
              category: category,
              conditions: conditions,
              device: 'PC',
              category_id: this.config.category.id,
              category_type: 'pc_only',
              category_name: this.config.category.name,
              source: 'ajax_response',
              timestamp: new Date().toISOString()
            });
          }
        } catch (e) {
          console.log(`   ⚠️ 案件抽出エラー: ${e.message}`);
        }
      }
      
    } catch (error) {
      console.log(`❌ HTML解析エラー: ${error.message}`);
    }
    
    return campaigns;
  }


  async generateReport() {
    const duration = (this.stats.endTime - this.stats.startTime) / 1000 / 60;
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 PC限定案件取得完了レポート');
    console.log('='.repeat(70));
    console.log(`⏱️ 実行時間: ${duration.toFixed(2)}分`);
    console.log(`📡 AJAX応答数: ${this.stats.ajaxRequests}件`);
    console.log(`🖥️ PC限定案件: ${this.results.length}件`);
    console.log(`🔁 重複スキップ: ${this.stats.duplicatesSkipped}件`);
    
    if (this.results.length > 0) {
      console.log('\n🔍 取得案件例:');
      this.results.forEach((campaign, i) => {
        console.log(`   ${i + 1}. ${campaign.title}`);
        console.log(`      ポイント: ${campaign.points}, カテゴリ: ${campaign.category}`);
        console.log(`      条件: ${campaign.conditions}`);
        console.log(`      URL: ${campaign.url}`);
        console.log('');
      });
      
      // 統計情報
      const categories = {};
      this.results.forEach(campaign => {
        categories[campaign.category] = (categories[campaign.category] || 0) + 1;
      });
      
      console.log('📈 カテゴリ別内訳:');
      Object.entries(categories).forEach(([cat, count]) => {
        console.log(`   - ${cat}: ${count}件`);
      });
      
    } else {
      console.log('\n❌ 案件が取得できませんでした');
      console.log('   考えられる原因:');
      console.log('   1. カテゴリ270に現在案件が存在しない');
      console.log('   2. HTML構造が変更されている');
      console.log('   3. AJAX応答の解析パターンが不適切');
    }
  }

  async saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const dataDir = path.join(__dirname, '../../../data/pointincome');
    
    await fs.mkdir(dataDir, { recursive: true });
    
    const data = {
      scrape_date: new Date().toISOString(),
      device: 'PC',
      category_id: this.config.category.id,
      category_name: this.config.category.name,
      ajax_requests: this.stats.ajaxRequests,
      total_campaigns: this.results.length,
      duplicates_skipped: this.stats.duplicatesSkipped,
      campaigns: this.results,
      stats: this.stats,
      notes: [
        'PC環境専用案件（モバイル環境では表示されない）',
        'AJAX応答のHTML解析により抽出',
        'カテゴリ270: PC限定・ブラウザゲーム案件',
        'box_ad_inner構造に基づく抽出ロジック'
      ]
    };
    
    const filename = path.join(dataDir, `pointincome_pc_only_campaigns_${timestamp}.json`);
    await fs.writeFile(filename, JSON.stringify(data, null, 2));
    console.log(`\n💾 保存完了: ${filename}`);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 実行
if (require.main === module) {
  const scraper = new PointIncomePCOnlyScraper();
  scraper.execute()
    .then(() => {
      console.log('\n✅ PC限定案件取得完了');
      process.exit(0);
    })
    .catch(error => {
      console.error('致命的エラー:', error);
      process.exit(1);
    });
}

module.exports = PointIncomePCOnlyScraper;