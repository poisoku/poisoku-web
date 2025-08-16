#!/usr/bin/env node

/**
 * モッピー スマホアプリ案件専用スクレイパー V3
 * モバイル環境を完全に模擬してアプリ案件を取得
 * iOS/Android別環境でUser-Agent切替によるOS独立保持
 */

const puppeteer = require('puppeteer');

class MoppyAppScraperV3 {
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
    
    // 真のモバイルUser-Agent（より具体的）
    this.userAgents = {
      ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      android: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    };
    
    // 正しいアプリ案件URL
    this.baseUrl = 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=52&af_sorter=1';
  }

  /**
   * 初期化
   */
  async initialize() {
    console.log('📱 モッピー アプリ案件スクレイパー V3 初期化中...');
    console.log('🎯 対応OS: iOS / Android（OS独立保持）');
    console.log('📍 対象URL: parent_category=4&child_category=52');
    console.log('📊 取得方式: User-Agent別スクレイピング');
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--user-agent-override',
        '--disable-blink-features=AutomationControlled'
      ]
    });
    
    console.log('✅ 初期化完了');
  }

  /**
   * ページから案件データを抽出（正しいセレクター使用）
   */
  async extractCampaigns(page, osType) {
    return await page.evaluate((osType) => {
      const campaigns = [];
      
      // 真のアプリ案件セレクター（調査結果に基づく）
      // H3.a-list__item__title要素からアプリ案件タイトルを取得
      const titleElements = document.querySelectorAll('h3.a-list__item__title');
      
      console.log(`🔍 ${osType.toUpperCase()}で${titleElements.length}個のタイトル要素を発見`);
      
      titleElements.forEach((titleEl, index) => {
        try {
          const title = titleEl.textContent?.trim() || '';
          if (!title || title.length < 3) return;
          
          // アプリカテゴリ（child_category=52）なので、全案件をアプリ案件として取得
          // フィルタリングは削除：ユーザーの指摘により、キーワードに引っかからない案件も多数存在
          
          // 親要素からリンクとポイント情報を探す
          let container = titleEl.parentElement;
          let linkElement = null;
          let url = '';
          let points = 'ポイント不明';
          
          // 複数レベルの親要素を探索
          for (let level = 0; level < 5; level++) {
            if (!container) break;
            
            // リンク要素を探す
            linkElement = container.querySelector('a[href*="site_id"], a[href*="/ad"], a[href*="detail.php"]');
            if (linkElement) {
              url = linkElement.href;
              break;
            }
            
            container = container.parentElement;
          }
          
          // URLが見つからない場合はスキップ
          if (!url || !url.includes('moppy.jp')) {
            console.log(`⚠️ URLが見つかりません: ${title}`);
            return;
          }
          
          // ポイント情報取得
          if (container) {
            const containerText = container.textContent || '';
            
            // モッピー特有のポイント表記パターン
            const pointPatterns = [
              /(\d{1,3}(?:,\d{3})*)\s*P(?:t)?/i,              // 120P, 1,000P
              /(\d{1,3}(?:,\d{3})*)\s*ポイント/i,              // 120ポイント
              /(\d{1,2}(?:\.\d+)?)\s*%/i,                      // 1.5%
              /(\d{1,3}(?:,\d{3})*)\s*円/i                     // 120円
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
          }
          
          // OS分類：User-Agent別スクレイピングによる分類
          let deviceType;
          
          // 基本方針：取得時のOSを使用
          if (osType === 'ios') {
            deviceType = 'iOS';
          } else if (osType === 'android') {
            deviceType = 'Android';
          } else {
            deviceType = 'iOS/Android'; // フォールバック
          }
          
          // タイトルベースでのOS特定（精度向上）
          const titleLower = title.toLowerCase();
          if (titleLower.includes('ios') || titleLower.includes('iphone') || 
              titleLower.includes('app store') || titleLower.includes('_ios')) {
            deviceType = 'iOS';
          } else if (titleLower.includes('android') || titleLower.includes('google play') || 
                     titleLower.includes('プレイストア') || titleLower.includes('_android')) {
            deviceType = 'Android';
          } else if (titleLower.includes('ios') && titleLower.includes('android')) {
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
            urlId: 'parent_category=4&child_category=52',
            scrapedAt: new Date().toISOString(),
            source: 'moppy_app_scraper_v3_os_independent'
          };
          
          campaigns.push(campaign);
          console.log(`✅ 案件取得: ${title} [${points}]`);
          
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
      // 完全なモバイル環境設定
      await page.setUserAgent(this.userAgents[osType]);
      
      // モバイルデバイスのビューポート設定
      await page.setViewport({ 
        width: 375, 
        height: 812,  // iPhone 13 サイズ
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3
      });
      
      // 追加のモバイルヘッダー設定
      await page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      });
      
      let currentPage = 1;
      let hasNextPage = true;
      const osResults = [];
      
      while (hasNextPage && currentPage <= 10) { // 最大10ページ（263件なので約9ページ）
        const pageUrl = `${this.baseUrl}&page=${currentPage}`;
        console.log(`📄 ページ ${currentPage} 処理中: ${pageUrl}`);
        
        try {
          await page.goto(pageUrl, { 
            waitUntil: 'networkidle2',
            timeout: 30000 
          });
          
          this.stats.totalRequests++;
          
          // ページ読み込み完了を待機
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // JavaScriptの実行完了を待機
          await page.waitForFunction(() => {
            return document.readyState === 'complete';
          }, { timeout: 10000 }).catch(() => {
            console.log('⚠️ JavaScript完了待機タイムアウト');
          });
          
          // 案件データ抽出
          const campaigns = await this.extractCampaigns(page, osType);
          
          // ページネーション情報も取得
          const paginationInfo = await page.evaluate(() => {
            const bodyText = document.body.textContent;
            const paginationMatch = bodyText.match(/(\d+)\s*-\s*(\d+)を表示\s*\/\s*(\d+)件中/);
            if (paginationMatch) {
              return {
                start: parseInt(paginationMatch[1]),
                end: parseInt(paginationMatch[2]),
                total: parseInt(paginationMatch[3])
              };
            }
            return null;
          });
          
          if (campaigns.length === 0) {
            console.log(`📄 ページ ${currentPage}: 案件が見つかりませんでした（終了）`);
            hasNextPage = false;
          } else {
            console.log(`📄 ページ ${currentPage}: ${campaigns.length}件取得`);
            osResults.push(...campaigns);
            this.stats.pagesProcessed++;
            
            // ページネーション情報がある場合は、それに基づいて判定
            if (paginationInfo) {
              console.log(`📊 ページネーション: ${paginationInfo.start}-${paginationInfo.end} / ${paginationInfo.total}件中`);
              // 現在のページの終了位置が総件数に達している場合は終了
              if (paginationInfo.end >= paginationInfo.total) {
                hasNextPage = false;
                console.log('📄 最終ページに達しました');
              }
            } else {
              // ページネーション情報がない場合は案件数で判定
              // 10件未満の場合は最終ページとみなす
              if (campaigns.length < 10) {
                hasNextPage = false;
              }
            }
          }
          
          currentPage++;
          
          // レート制限（より長めに）
          await new Promise(resolve => setTimeout(resolve, 6000));
          
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
   * OS別案件数集計
   */
  analyzeOSDistribution(campaigns) {
    const iosCount = campaigns.filter(c => c.osType === 'ios').length;
    const androidCount = campaigns.filter(c => c.osType === 'android').length;
    
    return {
      iOS: iosCount,
      Android: androidCount
    };
  }


  /**
   * メインスクレイピング実行
   */
  async scrape() {
    this.stats.startTime = new Date();
    console.log('🚀 モッピー アプリ案件スクレイピング V3 開始');
    console.log(`⏰ 開始時刻: ${this.stats.startTime.toLocaleString('ja-JP')}`);
    
    try {
      await this.initialize();
      
      // iOS案件取得
      const iosCampaigns = await this.scrapeWithOS('ios');
      
      // OS間待機（ちょびリッチ式403エラー対策）
      console.log('\n⏳ iOS→Android切替のため30秒待機（403エラー対策）...');
      await new Promise(resolve => setTimeout(resolve, 30000)); // 30秒待機
      
      // Android案件取得  
      const androidCampaigns = await this.scrapeWithOS('android');
      
      // 結果統合（OS独立保持）
      this.results = [...iosCampaigns, ...androidCampaigns];
      
      this.stats.campaignsFound = this.results.length;
      this.stats.endTime = new Date();
      
      console.log('\n🎉 スクレイピング完了!');
      console.log('📊 結果サマリー（OS独立保持）:');
      console.log(`📱 iOS案件: ${iosCampaigns.length}件`);
      console.log(`🤖 Android案件: ${androidCampaigns.length}件`);
      console.log(`🔗 合計案件数: ${this.results.length}件`);
      
      // OS別統計
      const osStats = this.analyzeOSDistribution(this.results);
      console.log('\n📊 OS別分類:');
      console.log(`  🍎 iOS: ${osStats.iOS}件`);
      console.log(`  🤖 Android: ${osStats.Android}件`);
      
      console.log(`📄 処理ページ数: ${this.stats.pagesProcessed}ページ`);
      console.log(`⏱️ 実行時間: ${Math.round((this.stats.endTime - this.stats.startTime) / 1000)}秒`);
      
      if (this.results.length >= 500) {
        console.log('🎯 目標の500件以上を取得成功！');
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
        name: `moppy_app_v3_ios_${timestamp}.json`,
        data: { campaigns: iosCampaigns, stats: { ...this.stats, type: 'ios_only', version: 'v3' } }
      },
      {
        name: `moppy_app_v3_android_${timestamp}.json`, 
        data: { campaigns: androidCampaigns, stats: { ...this.stats, type: 'android_only', version: 'v3' } }
      },
      {
        name: `moppy_app_v3_combined_${timestamp}.json`,
        data: { campaigns: this.results, stats: { ...this.stats, type: 'combined', version: 'v3' } }
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
  const scraper = new MoppyAppScraperV3();
  
  try {
    const results = await scraper.scrape();
    await scraper.saveResults();
    
    console.log('\n🎯 モッピー アプリ案件スクレイピング V3 完了!');
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

module.exports = MoppyAppScraperV3;