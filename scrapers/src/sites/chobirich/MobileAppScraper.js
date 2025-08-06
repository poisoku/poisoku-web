#!/usr/bin/env node

require('dotenv').config();
const puppeteer = require('puppeteer');

/**
 * ちょびリッチ スマホアプリ案件専用スクレイパー
 * iOS/Android別々のUser-Agentでアクセス
 */
class MobileAppScraper {
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
    
    this.baseUrl = 'https://www.chobirich.com/smartphone';
  }

  /**
   * 初期化
   */
  async initialize() {
    console.log('📱 スマホアプリ案件スクレイパー初期化中...');
    console.log('🎯 対応OS: iOS / Android');
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security'
      ]
    });
    
    console.log('✅ 初期化完了');
  }

  /**
   * スマホアプリページから案件データを取得
   */
  async scrapeAppPage(url, osType) {
    const page = await this.browser.newPage();
    
    try {
      // OS別User-Agent設定
      await page.setUserAgent(this.userAgents[osType]);
      await page.setViewport({ 
        width: osType === 'ios' ? 375 : 412, 
        height: osType === 'ios' ? 812 : 915,
        isMobile: true 
      });
      
      // キャッシュ無効化
      await page.setExtraHTTPHeaders({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      console.log(`   📱 ${osType.toUpperCase()}で取得中: ${url}`);
      
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      this.stats.totalRequests++;

      if (response.status() !== 200) {
        console.log(`   ❌ HTTPエラー: ${response.status()}`);
        return [];
      }

      // コンテンツ読み込み待機
      await new Promise(resolve => setTimeout(resolve, 5000));

      // アプリ案件データ抽出
      const campaigns = await page.evaluate((osType) => {
        const results = [];
        
        // ポイント数を抽出する関数
        function extractPoints(text) {
          if (!text) return '';
          
          // 矢印表記がある場合は右側のテキストのみを対象にする
          let targetText = text;
          if (text.includes('→')) {
            const parts = text.split('→');
            targetText = parts[parts.length - 1];
          }
          
          // ポイント抽出パターン（優先度順、より具体的なパターンから）
          const patterns = [
            /(\d{1,2},\d{3}pt)/gi,        // カンマ区切り4-5桁（12,345pt）
            /(\d{4,5}pt)/gi,              // 4-5桁連続（12345pt）
            /(\d{1,3},\d{3}pt)/gi,        // カンマ区切り標準形式（1,234pt）
            /(\d{1,3}pt)/gi,              // 1-3桁（123pt）
            /(\d+(?:\.\d+)?[%％])/gi      // パーセント形式（1.5%）
          ];
          
          // 全てのマッチを取得して最も長い（桁数が多い）ものを選択
          let bestMatch = '';
          let maxLength = 0;
          
          for (const pattern of patterns) {
            const matches = targetText.match(pattern);
            if (matches) {
              for (const match of matches) {
                // 数字部分の長さを比較（ptや%を除く）
                const numPart = match.replace(/[^\d,]/g, '');
                const numLength = numPart.replace(/,/g, '').length;
                
                if (numLength > maxLength) {
                  maxLength = numLength;
                  bestMatch = match;
                }
              }
            }
          }
          
          return bestMatch;
        }
        
        // 獲得条件を抽出する関数
        function extractMethod(text, title) {
          if (!text) return '';
          
          // 条件パターン
          const patterns = [
            /新規アプリインストール後、([^。\n]+)/,
            /初回([^。\n]+)/,
            /(レベル\d+到達)/,
            /(ステージ\d+到達)/,
            /(\d+日連続[^。\n]+)/
          ];
          
          for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
              return match[0].trim();
            }
          }
          
          // タイトルから推測
          if (title) {
            if (title.includes('レベル') || title.includes('ステージ')) {
              const match = title.match(/(レベル|ステージ)\d+/);
              if (match) {
                return match[0];
              }
            }
          }
          
          return '新規アプリインストール後、指定条件達成で成果';
        }
        
        // アプリ案件要素を取得（シンプル版）
        const appItems = document.querySelectorAll('li.CommonSearchItem.App__item') || 
                       document.querySelectorAll('li.CommonSearchItem');
        
        Array.from(appItems).forEach((item) => {
          const campaign = {
            id: '',
            title: '',
            url: '',
            points: '',
            method: '',
            os: osType,
            scrapedAt: new Date().toISOString(),
            source: 'mobile_app_scraper'
          };

          // リンク要素を取得
          const linkEl = item.querySelector('a[href*="/ad_details/"]');
          
          if (linkEl) {
            // タイトル取得：太字部分のみ
            const strongEl = linkEl.querySelector('strong');
            campaign.title = strongEl ? strongEl.textContent.trim() : 
                           linkEl.textContent.trim().split('\n')[0];
            
            // URL・ID取得
            campaign.url = linkEl.href;
            const idMatch = linkEl.href.match(/\/ad_details\/(\d+)/);
            if (idMatch) {
              campaign.id = idMatch[1];
            }
            
            // ポイント・獲得条件取得
            const fullText = item.textContent;
            campaign.points = extractPoints(fullText);
            campaign.method = extractMethod(fullText, campaign.title);
          }

          // 必須データが揃っている場合のみ追加
          if (campaign.id && campaign.title && campaign.url && campaign.points) {
            results.push(campaign);
          }
        });

        return results;
      }, osType);

      console.log(`   ✅ ${campaigns.length}件の${osType.toUpperCase()}用アプリ案件を取得`);
      this.stats.campaignsFound += campaigns.length;
      
      return campaigns;

    } catch (error) {
      console.log(`   ❌ エラー: ${error.message}`);
      this.stats.errors.push({
        url: url,
        os: osType,
        error: error.message,
        time: new Date().toISOString()
      });
      return [];
      
    } finally {
      await page.close();
    }
  }

  /**
   * OS別の全ページを処理
   */
  async processOS(osType, sortType = null, maxPages = 20) {
    console.log(`\n📱 ${osType.toUpperCase()} アプリ案件取得開始`);
    console.log('-'.repeat(50));
    
    const allCampaigns = [];
    
    for (let page = 1; page <= maxPages; page++) {
      const pageUrl = `${this.baseUrl}?page=${page}`;
      const campaigns = await this.scrapeAppPage(pageUrl, osType);
      
      if (campaigns.length === 0) {
        console.log(`   ➡️ ページ${page}: アプリ案件なし。終了`);
        break;
      }
      
      allCampaigns.push(...campaigns);
      this.stats.pagesProcessed++;
      
      // ページ間の待機（レート制限対策）
      if (page < maxPages) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    this.results.push(...allCampaigns);
    return allCampaigns;
  }

  /**
   * メインスクレイピング処理
   */
  async scrape(targetOS = ['ios', 'android']) {
    this.stats.startTime = new Date();
    console.log('📱 スマホアプリ案件スクレイピング開始');
    console.log('=' .repeat(60));
    
    await this.initialize();
    
    try {
      console.log(`🎯 対象OS: ${targetOS.join(', ').toUpperCase()}`);
      
      for (const osType of targetOS) {
        await this.processOS(osType);
      }
      
    } catch (error) {
      console.error('💥 致命的エラー:', error);
      this.stats.errors.push({
        type: 'fatal',
        message: error.message,
        time: new Date().toISOString()
      });
    } finally {
      await this.cleanup();
    }
    
    this.stats.endTime = new Date();
    this.displayStats();
    
    return this.results;
  }

  /**
   * 統計表示
   */
  displayStats() {
    const duration = (this.stats.endTime - this.stats.startTime) / 1000;
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 スマホアプリ案件スクレイピング完了');
    console.log('='.repeat(60));
    console.log(`実行時間: ${duration.toFixed(1)}秒`);
    console.log(`処理ページ数: ${this.stats.pagesProcessed}`);
    console.log(`取得アプリ案件数: ${this.stats.campaignsFound}`);
    console.log(`総リクエスト数: ${this.stats.totalRequests}`);
    console.log(`エラー数: ${this.stats.errors.length}`);
    
    // OS別統計
    const iosCampaigns = this.results.filter(c => c.os === 'ios').length;
    const androidCampaigns = this.results.filter(c => c.os === 'android').length;
    
    console.log(`\n📱 OS別取得数:`);
    console.log(`  iOS: ${iosCampaigns}件`);
    console.log(`  Android: ${androidCampaigns}件`);
    
    if (this.stats.totalRequests > 0) {
      const avgTime = duration / this.stats.totalRequests;
      console.log(`\n⚡ パフォーマンス:`);
      console.log(`  平均処理時間: ${avgTime.toFixed(2)}秒/リクエスト`);
      console.log(`  案件取得効率: ${(this.stats.campaignsFound / this.stats.totalRequests).toFixed(1)}件/リクエスト`);
    }
  }

  /**
   * クリーンアップ
   */
  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

module.exports = MobileAppScraper;