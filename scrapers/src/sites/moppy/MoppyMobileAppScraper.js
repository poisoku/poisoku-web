#!/usr/bin/env node

require('dotenv').config();
const puppeteer = require('puppeteer');

/**
 * モッピー スマホアプリ案件専用スクレイパー
 * iOS/Android別々のUser-Agentでアクセス
 * parent_category=4に対応
 */
class MoppyMobileAppScraper {
  constructor() {
    this.browser = null;
    this.results = [];
    this.stats = {
      startTime: null,
      endTime: null,
      pagesProcessed: 0,
      campaignsFound: 0,
      totalRequests: 0,
      errors: []
    };
    
    // iOS/Android別User-Agent
    this.userAgents = {
      ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      android: 'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    };
    
    // モッピーのスマホアプリ案件URL (parent_category=4)
    this.baseUrl = 'https://pc.moppy.jp/category/list.php?parent_category=4&af_sorter=1';
  }

  /**
   * 初期化
   */
  async initialize() {
    console.log('📱 モッピー スマホアプリ案件スクレイパー初期化中...');
    console.log('🎯 対応OS: iOS / Android');
    console.log('📍 対象URL: parent_category=4');
    
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
  async extractCampaigns(page, osType) {
    return await page.evaluate((osType) => {
      const campaigns = [];
      
      console.log('🔍 ページ構造を調査中...');
      
      // モッピーの案件アイテムセレクター（より広範囲に検索）
      const possibleSelectors = [
        '.campaign-item', '.ad-item', '.list-item', 
        '[class*="campaign"]', '[class*="ad-"]',
        '.item', '.box', '.content',
        'li', 'div[class*="item"]', 'div[class*="list"]',
        'a[href*="site_id"]', 'a[href*="/ad/"]'
      ];
      
      let campaignElements = [];
      
      // 各セレクターを試行
      for (const selector of possibleSelectors) {
        const elements = document.querySelectorAll(selector);
        console.log(`🔍 セレクター "${selector}": ${elements.length}個見つかりました`);
        
        if (elements.length > 0) {
          // site_idを含むリンクがあるかチェック
          const hasValidLinks = Array.from(elements).some(el => {
            const link = el.querySelector('a[href*="site_id"]') || (el.tagName === 'A' && el.href.includes('site_id'));
            return link;
          });
          
          if (hasValidLinks) {
            campaignElements = elements;
            console.log(`✅ 有効なセレクター発見: "${selector}" (${elements.length}個)`);
            break;
          }
        }
      }
      
      if (campaignElements.length === 0) {
        console.log('❌ 案件要素が見つかりませんでした');
        console.log('ページHTML構造:', document.body.innerHTML.substring(0, 1000));
        return [];
      }
      
      campaignElements.forEach((element, index) => {
        try {
          // タイトルとURL取得
          const linkElement = element.querySelector('a[href*="/ad/detail.php"]') || 
                             element.querySelector('a[href*="site_id"]') ||
                             element.querySelector('a');
          
          if (!linkElement) return;
          
          const title = linkElement.textContent?.trim() || 
                       element.querySelector('h3, h4, .title, [class*="title"]')?.textContent?.trim() || 
                       'タイトル不明';
          
          const url = linkElement.href;
          if (!url || !url.includes('moppy.jp')) return;
          
          // ポイント情報取得
          const pointElements = element.querySelectorAll('*');
          let points = null;
          
          for (const pointEl of pointElements) {
            const text = pointEl.textContent?.trim() || '';
            
            // ポイント表記のパターンマッチング
            const pointPatterns = [
              /(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*pt/i,
              /(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*ポイント/i,
              /(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*円/i,
              /(\d{1,2}(?:\.\d+)?)\s*%/i,
              /(\d+)\s*P/i
            ];
            
            for (const pattern of pointPatterns) {
              const match = text.match(pattern);
              if (match) {
                points = match[1] + (text.includes('%') ? '%' : 
                                   text.includes('円') ? '円' : 
                                   text.includes('ポイント') ? 'ポイント' : 'pt');
                break;
              }
            }
            
            if (points) break;
          }
          
          // アプリ案件のフィルタリング（より厳密に）
          const titleLower = title.toLowerCase();
          const isAppCase = (
            titleLower.includes('アプリ') ||
            titleLower.includes('app') ||
            titleLower.includes('ダウンロード') ||
            titleLower.includes('インストール') ||
            titleLower.includes('ios') ||
            titleLower.includes('android') ||
            titleLower.includes('iphone') ||
            titleLower.includes('google play') ||
            titleLower.includes('app store') ||
            titleLower.includes('プレイ') ||
            titleLower.includes('ストア')
          );
          
          // アプリ案件でない場合はスキップ
          if (!isAppCase) {
            return;
          }
          
          // OS判定
          let deviceType = osType; // デフォルトはアクセス時のOS
          
          if (titleLower.includes('ios') || titleLower.includes('iphone') || titleLower.includes('app store')) {
            deviceType = 'iOS';
          } else if (titleLower.includes('android') || titleLower.includes('google play') || titleLower.includes('プレイストア')) {
            deviceType = 'Android';
          } else if (titleLower.includes('両対応') || titleLower.includes('ios/android')) {
            deviceType = 'iOS/Android';
          }
          
          // site_id抽出
          const siteIdMatch = url.match(/site_id=(\d+)/);
          const siteId = siteIdMatch ? siteIdMatch[1] : `unknown_${Date.now()}_${index}`;
          
          const campaign = {
            id: `moppy_app_${siteId}`,
            title: title,
            url: url,
            points: points,
            device: deviceType,
            osType: osType,
            urlId: 'parent_category=4',
            scrapedAt: new Date().toISOString(),
            source: 'moppy_mobile_app_scraper'
          };
          
          campaigns.push(campaign);
          
        } catch (error) {
          console.error('案件抽出エラー:', error);
        }
      });
      
      return campaigns;
    }, osType);
  }

  /**
   * 指定されたOSタイプで全ページをスクレイピング
   */
  async scrapeWithOS(osType) {
    console.log(`\n📱 ${osType.toUpperCase()}でスクレイピング開始...`);
    
    const page = await this.browser.newPage();
    
    try {
      // User-Agent設定
      await page.setUserAgent(this.userAgents[osType]);
      
      // ビューポート設定（モバイル）
      await page.setViewport({ width: 375, height: 667 });
      
      let currentPage = 1;
      let hasNextPage = true;
      const osResults = [];
      
      while (hasNextPage && currentPage <= 10) { // 最大10ページ（アプリ案件用）
        const pageUrl = `${this.baseUrl}&page=${currentPage}`;
        console.log(`📄 ページ ${currentPage} 処理中: ${pageUrl}`);
        
        try {
          await page.goto(pageUrl, { 
            waitUntil: 'networkidle2',
            timeout: 30000 
          });
          
          this.stats.totalRequests++;
          
          // ページ読み込み待機
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // 案件データ抽出
          const campaigns = await this.extractCampaigns(page, osType);
          
          if (campaigns.length === 0) {
            console.log(`📄 ページ ${currentPage}: 案件が見つかりませんでした（終了）`);
            hasNextPage = false;
          } else {
            console.log(`📄 ページ ${currentPage}: ${campaigns.length}件取得`);
            osResults.push(...campaigns);
            this.stats.pagesProcessed++;
            
            // 30件未満の場合は最終ページ
            if (campaigns.length < 30) {
              hasNextPage = false;
            }
          }
          
          currentPage++;
          
          // レート制限
          await new Promise(resolve => setTimeout(resolve, 3000));
          
        } catch (error) {
          console.error(`❌ ページ ${currentPage} エラー:`, error);
          this.stats.errors.push(`Page ${currentPage}: ${error.message}`);
          hasNextPage = false;
        }
      }
      
      console.log(`✅ ${osType.toUpperCase()} 完了: ${osResults.length}件取得`);
      return osResults;
      
    } finally {
      await page.close();
    }
  }

  /**
   * 重複除去
   */
  removeDuplicates(campaigns) {
    const seen = new Set();
    return campaigns.filter(campaign => {
      const key = `${campaign.title}_${campaign.url}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * メインスクレイピング実行
   */
  async scrape() {
    this.stats.startTime = new Date();
    console.log('🚀 モッピー スマホアプリ案件スクレイピング開始');
    console.log(`⏰ 開始時刻: ${this.stats.startTime.toLocaleString('ja-JP')}`);
    
    try {
      await this.initialize();
      
      // iOS案件取得
      const iosCampaigns = await this.scrapeWithOS('ios');
      
      // Android案件取得  
      const androidCampaigns = await this.scrapeWithOS('android');
      
      // 結果統合
      this.results = [...iosCampaigns, ...androidCampaigns];
      
      // 重複除去
      const beforeDedup = this.results.length;
      this.results = this.removeDuplicates(this.results);
      const afterDedup = this.results.length;
      
      this.stats.campaignsFound = this.results.length;
      this.stats.endTime = new Date();
      
      console.log('\n🎉 スクレイピング完了!');
      console.log('📊 結果サマリー:');
      console.log(`📱 iOS案件: ${iosCampaigns.length}件`);
      console.log(`🤖 Android案件: ${androidCampaigns.length}件`);
      console.log(`🔗 統合前: ${beforeDedup}件`);
      console.log(`✨ 重複除去後: ${afterDedup}件`);
      console.log(`📄 処理ページ数: ${this.stats.pagesProcessed}ページ`);
      console.log(`⏱️ 実行時間: ${Math.round((this.stats.endTime - this.stats.startTime) / 1000)}秒`);
      
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
    const fs = require('fs').promises;
    const path = require('path');
    
    // iOS案件のみ
    const iosCampaigns = this.results.filter(c => c.osType === 'ios');
    
    // Android案件のみ
    const androidCampaigns = this.results.filter(c => c.osType === 'android');
    
    // 保存ディレクトリ
    const dataDir = path.join(__dirname, '..', '..', '..', 'data', 'moppy');
    await fs.mkdir(dataDir, { recursive: true });
    
    // ファイル保存
    const files = [
      {
        name: `moppy_ios_app_campaigns_${timestamp}.json`,
        data: { campaigns: iosCampaigns, stats: { ...this.stats, type: 'ios_only' } }
      },
      {
        name: `moppy_android_app_campaigns_${timestamp}.json`, 
        data: { campaigns: androidCampaigns, stats: { ...this.stats, type: 'android_only' } }
      },
      {
        name: `moppy_mobile_app_campaigns_combined_${timestamp}.json`,
        data: { campaigns: this.results, stats: { ...this.stats, type: 'combined' } }
      }
    ];
    
    for (const file of files) {
      const filePath = path.join(dataDir, file.name);
      await fs.writeFile(filePath, JSON.stringify(file.data, null, 2));
      console.log(`💾 保存完了: ${file.name} (${file.data.campaigns.length}件)`);
    }
    
    console.log('✅ 全ファイル保存完了');
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
  const scraper = new MoppyMobileAppScraper();
  
  try {
    const results = await scraper.scrape();
    await scraper.saveResults();
    
    console.log('\n🎯 モッピー スマホアプリ案件スクレイピング完了!');
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

module.exports = MoppyMobileAppScraper;