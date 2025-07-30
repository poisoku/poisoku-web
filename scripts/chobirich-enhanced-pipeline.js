const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// Supabase設定
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pjjhyzbnnslaauwzknrr.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqamh5emJubnNsYWF1d3prbnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5ODg4MzksImV4cCI6MjA2NjU2NDgzOX0.qcrcwNpwX83dCNbhxFaks2E68K_wp2W8urdYwfenDtM';

class ChobirichEnhancedPipeline {
  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.baseUrl = 'https://www.chobirich.com';
    this.listingUrl = 'https://www.chobirich.com/smartphone?sort=point';
    
    // iOS設定
    this.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
    this.viewport = { width: 390, height: 844, isMobile: true };
    
    // データファイル（タイムスタンプ付き）
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    this.dataFile = `chobirich_enhanced_${this.timestamp}.json`;
    this.checkpointFile = `chobirich_checkpoint_${this.timestamp}.json`;
    
    // データ管理
    this.existingData = new Map();
    this.existingHashes = new Map();
    this.processedCampaigns = [];
    this.errorLog = [];
    this.processedCount = 0;
    this.targetCount = 0;
    
    // チェックポイント機能
    this.checkpointInterval = 25; // 25件ごとに保存
    this.maxRetries = 3;
    this.browser = null;
    this.pointSiteId = null;
  }

  // ログ機能強化
  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    
    if (level === 'error') {
      this.errorLog.push({ timestamp, message, level });
    }
  }

  // チェックポイント保存
  async saveCheckpoint() {
    const checkpoint = {
      timestamp: new Date().toISOString(),
      processedCount: this.processedCount,
      targetCount: this.targetCount,
      processedCampaigns: this.processedCampaigns,
      errorLog: this.errorLog,
      progress: this.targetCount > 0 ? (this.processedCount / this.targetCount * 100).toFixed(1) : 0
    };
    
    try {
      await fs.writeFile(this.checkpointFile, JSON.stringify(checkpoint, null, 2));
      this.log(`💾 チェックポイント保存: ${this.processedCount}/${this.targetCount}件 (${checkpoint.progress}%)`);
    } catch (error) {
      this.log(`❌ チェックポイント保存エラー: ${error.message}`, 'error');
    }
  }

  // チェックポイント復元
  async loadCheckpoint() {
    try {
      const data = JSON.parse(await fs.readFile(this.checkpointFile, 'utf8'));
      this.processedCampaigns = data.processedCampaigns || [];
      this.processedCount = data.processedCount || 0;
      this.errorLog = data.errorLog || [];
      this.log(`🔄 チェックポイント復元: ${this.processedCount}件から再開`);
      return true;
    } catch (error) {
      this.log('📋 新規実行開始（チェックポイントなし）');
      return false;
    }
  }

  // 既存データ読み込み（最新ファイル自動選択）
  async loadExistingData() {
    try {
      // 最新のちょびリッチファイルを検索
      const files = await fs.readdir('.');
      const chobirichFiles = files.filter(f => 
        f.startsWith('chobirich_') && 
        f.endsWith('.json') && 
        !f.includes('checkpoint') &&
        !f.includes('android')
      ).sort().reverse();
      
      if (chobirichFiles.length === 0) {
        this.log('📋 既存データなし、全件取得モード');
        return;
      }
      
      const latestFile = chobirichFiles[0];
      const data = JSON.parse(await fs.readFile(latestFile, 'utf8'));
      
      if (data.app_campaigns && Array.isArray(data.app_campaigns)) {
        this.log(`📋 既存データ読み込み: ${latestFile} (${data.app_campaigns.length}件)`);
        
        data.app_campaigns.forEach(campaign => {
          this.existingData.set(campaign.id, campaign);
          this.existingHashes.set(campaign.id, this.createDataHash(campaign));
        });
        
        this.log(`🔍 ハッシュマップ生成完了: ${this.existingHashes.size}件`);
      }
      
    } catch (error) {
      this.log(`❌ 既存データ読み込みエラー: ${error.message}`, 'error');
    }
  }

  // データハッシュ生成（変更検出用）
  createDataHash(campaign) {
    const key = `${campaign.name}|${campaign.cashback}|${campaign.method}|${campaign.os}`;
    return crypto.createHash('md5').update(key).digest('hex');
  }

  // ブラウザ初期化（エラー耐性強化）
  async initBrowser() {
    let retryCount = 0;
    while (retryCount < this.maxRetries) {
      try {
        this.log('🚀 ブラウザ初期化中...');
        
        this.browser = await puppeteer.launch({
          headless: 'new',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--disable-features=VizDisplayCompositor',
            '--js-flags=--max-old-space-size=4096'
          ],
          timeout: 60000,
          protocolTimeout: 180000
        });
        
        this.log('✅ ブラウザ初期化完了');
        return;
        
      } catch (error) {
        retryCount++;
        this.log(`❌ ブラウザ初期化失敗 (${retryCount}/${this.maxRetries}): ${error.message}`, 'error');
        
        if (retryCount >= this.maxRetries) {
          throw new Error(`ブラウザ初期化に${this.maxRetries}回失敗しました`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  // ページセットアップ
  async setupPage() {
    const page = await this.browser.newPage();
    await page.setUserAgent(this.userAgent);
    await page.setViewport(this.viewport);
    
    // タイムアウト設定を延長
    await page.setDefaultNavigationTimeout(120000);
    await page.setDefaultTimeout(90000);
    
    return page;
  }

  // URL一覧取得（改善版）
  async extractAllUrls() {
    this.log('📚 全ページURL抽出開始');
    const allUrls = [];
    let pageNum = 1;
    let hasNextPage = true;
    
    while (hasNextPage && pageNum <= 25) {
      let retryCount = 0;
      let pageUrls = [];
      
      while (retryCount < this.maxRetries) {
        try {
          const page = await this.setupPage();
          const pageUrl = pageNum === 1 ? this.listingUrl : `${this.listingUrl}&page=${pageNum}`;
          
          this.log(`📄 ページ ${pageNum} スキャン中...`);
          await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
          
          // ページ読み込み完了を待機
          await page.waitForSelector('body', { timeout: 30000 });
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          pageUrls = await page.evaluate(() => {
            // より広範囲のセレクターで案件リンクを検索
            const selectors = [
              'a[href*="/ad_details/"]',
              'a[href*="redirect"]',
              '.campaign a',
              '.item a',
              'li a[href*="ad_details"]'
            ];
            
            const allLinks = [];
            selectors.forEach(selector => {
              const links = Array.from(document.querySelectorAll(selector));
              allLinks.push(...links);
            });
            
            return [...new Set(allLinks.map(link => link.href))]
              .filter(href => href && (href.includes('/ad_details/') || href.includes('redirect')));
          });
          
          await page.close();
          
          if (pageUrls.length === 0) {
            hasNextPage = false;
          } else {
            allUrls.push(...pageUrls);
            this.log(`📄 ページ ${pageNum}: ${pageUrls.length}件取得`);
          }
          
          break; // 成功したらリトライループを抜ける
          
        } catch (error) {
          retryCount++;
          this.log(`❌ ページ ${pageNum} 取得エラー (${retryCount}/${this.maxRetries}): ${error.message}`, 'error');
          
          if (retryCount >= this.maxRetries) {
            this.log(`⚠️ ページ ${pageNum} をスキップ`, 'error');
            hasNextPage = false;
            break;
          }
          
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      
      pageNum++;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // 重複削除
    const uniqueUrls = [...new Set(allUrls)];
    this.log(`🎯 全URL抽出完了: ${uniqueUrls.length}件`);
    this.targetCount = uniqueUrls.length;
    
    return uniqueUrls;
  }

  // 詳細データ取得（エラー耐性強化）
  async getDetailedData(url) {
    const campaignId = url.match(/\/ad_details\/(?:redirect\/)?(\d+)\/?/)?.[1];
    if (!campaignId) return null;
    
    let retryCount = 0;
    while (retryCount < this.maxRetries) {
      let page = null;
      try {
        page = await this.setupPage();
        
        // リダイレクトURL変換
        const directUrl = this.convertRedirectToDirectUrl(url);
        await page.goto(directUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
        
        // データ抽出
        const data = await page.evaluate(() => {
          const title = document.querySelector('h1, .campaign-title, .title')?.textContent?.trim() || '';
          
          // 還元率取得（複数パターン対応）
          let cashback = '';
          const cashbackPatterns = [
            'span[class*="point"], .cashback, .reward',
            'td:contains("獲得予定ポイント") + td',
            'strong:contains("ポイント"), strong:contains("pt")'
          ];
          
          for (const pattern of cashbackPatterns) {
            const element = document.querySelector(pattern);
            if (element) {
              const text = element.textContent;
              const match = text.match(/(\d+(?:,\d+)*)\s*(?:pt|ポイント|円)/);
              if (match) {
                cashback = match[1] + (text.includes('円') ? '円' : 'pt');
                break;
              }
            }
          }
          
          // 獲得条件取得
          let method = '';
          const bodyText = document.body.textContent || '';
          const methodPatterns = [
            /新規.*?(?:インストール|ダウンロード).*?(?:後|で).*?([^。\n]{1,100})/,
            /初回.*?(?:起動|利用|登録).*?(?:後|で).*?([^。\n]{1,100})/,
            /レベル.*?(\d+).*?(?:到達|達成)/,
            /条件.*?[:：]([^。\n]{1,100})/
          ];
          
          for (const pattern of methodPatterns) {
            const match = bodyText.match(pattern);
            if (match && match[1]) {
              method = match[1].trim().substring(0, 120);
              break;
            }
          }
          
          // OS判定
          let detectedOs = 'unknown';
          const titleLower = title.toLowerCase();
          const bodyTextLower = bodyText.toLowerCase();
          
          const androidKeywords = ['android', 'アンドロイド', 'google play'];
          const iosKeywords = ['ios', 'iphone', 'ipad', 'app store'];
          
          const isAndroid = androidKeywords.some(k => titleLower.includes(k) || bodyTextLower.includes(k));
          const isIOS = iosKeywords.some(k => titleLower.includes(k) || bodyTextLower.includes(k));
          
          if (isAndroid && isIOS) detectedOs = 'both';
          else if (isAndroid) detectedOs = 'android';
          else if (isIOS) detectedOs = 'ios';
          
          return { title, cashback, method, detectedOs, valid: !!title };
        });
        
        await page.close();
        
        if (!data.valid) return null;
        
        // アプリ案件かチェック
        if (this.isAppCampaign(data.title)) {
          return {
            id: campaignId,
            name: data.title,
            url: directUrl,
            cashback: data.cashback || '不明',
            os: data.detectedOs,
            method: data.method || '不明',
            timestamp: new Date().toISOString()
          };
        }
        
        return null;
        
      } catch (error) {
        if (page) await page.close().catch(() => {});
        
        retryCount++;
        this.log(`❌ [${campaignId}] 取得エラー (${retryCount}/${this.maxRetries}): ${error.message}`, 'error');
        
        if (retryCount >= this.maxRetries) {
          return null;
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    return null;
  }

  // URL変換
  convertRedirectToDirectUrl(url) {
    const redirectPattern = /\/ad_details\/redirect\/(\d+)\/?$/;
    const match = url.match(redirectPattern);
    if (match) {
      return `${this.baseUrl}/ad_details/${match[1]}/`;
    }
    return url;
  }

  // アプリ案件判定
  isAppCampaign(title) {
    const appKeywords = [
      'iOS', 'iPhone', 'iPad', 'Android', 'アプリ', 'App Store', 'Google Play',
      'インストール', 'ダウンロード', 'レベル', 'ゲーム', 'スマホ', 'モバイル'
    ];
    return appKeywords.some(keyword => title.includes(keyword));
  }

  // メイン処理（改善版）
  async processEnhanced() {
    try {
      this.log('🚀 ちょびリッチ強化パイプライン開始');
      
      // チェックポイント復元
      const resumeFromCheckpoint = await this.loadCheckpoint();
      
      if (!resumeFromCheckpoint) {
        await this.loadExistingData();
        await this.initBrowser();
        
        // URL一覧取得
        const allUrls = await this.extractAllUrls();
        this.urls = allUrls;
      }
      
      // 処理再開
      this.log(`🔄 処理開始: ${this.processedCount}/${this.targetCount}件から`);
      
      for (let i = this.processedCount; i < this.urls.length; i++) {
        const url = this.urls[i];
        const campaignId = url.match(/\/ad_details\/(?:redirect\/)?(\d+)\/?/)?.[1];
        
        this.log(`[${i + 1}/${this.urls.length}] ${campaignId} 処理中...`);
        
        const result = await this.getDetailedData(url);
        if (result) {
          this.processedCampaigns.push(result);
          this.log(`✅ ${result.name} (${result.cashback})`);
          
          // Supabaseに即座に保存
          await this.saveToDatabase(result);
        }
        
        this.processedCount = i + 1;
        
        // チェックポイント保存
        if (this.processedCount % this.checkpointInterval === 0) {
          await this.saveCheckpoint();
        }
        
        // 待機時間
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      
      // 最終保存
      await this.saveFinalData();
      await this.generateSearchData();
      
      this.log('🎉 強化パイプライン完了！');
      
    } catch (error) {
      this.log(`❌ システムエラー: ${error.message}`, 'error');
      await this.saveCheckpoint(); // エラー時もチェックポイント保存
      throw error;
      
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  // データベース保存（即座に）
  async saveToDatabase(campaign) {
    try {
      if (!this.pointSiteId) {
        const { data: pointSite } = await this.supabase
          .from('point_sites')
          .select('id')
          .eq('name', 'ちょびリッチ')
          .single();
        this.pointSiteId = pointSite?.id;
      }
      
      const campaignData = {
        name: campaign.name,
        point_site_id: this.pointSiteId,
        cashback_rate: campaign.cashback,
        device: campaign.os === 'both' ? 'All' : campaign.os === 'ios' ? 'iOS' : 'Android',
        campaign_url: campaign.url,
        description: campaign.method,
        category: 'app',
        is_active: true
      };
      
      await this.supabase
        .from('campaigns')
        .upsert(campaignData, { 
          onConflict: 'point_site_id,campaign_url',
          ignoreDuplicates: false 
        });
        
    } catch (error) {
      this.log(`❌ DB保存エラー [${campaign.id}]: ${error.message}`, 'error');
    }
  }

  // 最終データ保存
  async saveFinalData() {
    const output = {
      scrape_date: new Date().toISOString(),
      strategy: 'enhanced_pipeline',
      summary: {
        total_campaigns: this.processedCampaigns.length,
        errors: this.errorLog.length,
        os_breakdown: {
          ios: this.processedCampaigns.filter(c => c.os === 'ios').length,
          android: this.processedCampaigns.filter(c => c.os === 'android').length,
          both: this.processedCampaigns.filter(c => c.os === 'both').length,
          unknown: this.processedCampaigns.filter(c => c.os === 'unknown').length
        }
      },
      app_campaigns: this.processedCampaigns,
      error_log: this.errorLog
    };

    await fs.writeFile(this.dataFile, JSON.stringify(output, null, 2));
    this.log(`💾 最終データ保存: ${this.dataFile}`);
  }

  // 検索データ生成
  async generateSearchData() {
    this.log('🔄 検索データ生成中...');
    
    try {
      const { exec } = require('child_process');
      const util = require('util');
      const execPromise = util.promisify(exec);
      
      // 環境変数を設定して検索データ生成
      const env = {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseKey
      };
      
      await execPromise('node scripts/generate-search-data.js', { env });
      this.log('✅ 検索データ生成完了');
      
    } catch (error) {
      this.log(`❌ 検索データ生成エラー: ${error.message}`, 'error');
    }
  }
}

// 実行
if (require.main === module) {
  const pipeline = new ChobirichEnhancedPipeline();
  pipeline.processEnhanced().catch(error => {
    pipeline.log(`💥 パイプライン失敗: ${error.message}`, 'error');
    process.exit(1);
  });
}

module.exports = ChobirichEnhancedPipeline;