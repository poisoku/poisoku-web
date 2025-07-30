const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

class ChobirichBatchScraper {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.listingUrl = 'https://www.chobirich.com/smartphone?sort=point';
    this.iosUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
    
    // バッチ設定
    this.batchSize = 50; // 1バッチあたりの処理数
    this.currentBatch = 0;
    
    // データファイル
    this.existingFile = 'chobirich_all_app_campaigns.json';
    this.batchFile = `chobirich_batch_${Date.now()}.json`;
    this.progressFile = 'chobirich_batch_progress.json';
    
    // 既存データとプログレス
    this.existingData = new Map();
    this.processedUrls = new Set();
    this.newCampaigns = [];
    this.allUrls = [];
  }

  async loadExistingData() {
    try {
      const data = await fs.readFile(this.existingFile, 'utf8');
      const json = JSON.parse(data);
      
      if (json.app_campaigns) {
        json.app_campaigns.forEach(campaign => {
          this.existingData.set(campaign.id, campaign);
          this.processedUrls.add(`${this.baseUrl}/ad_details/${campaign.id}/`);
        });
      }
      
      console.log(`📚 既存データ読み込み: ${this.existingData.size}件`);
    } catch (error) {
      console.log('📚 既存データなし - 新規開始');
    }
  }

  async loadProgress() {
    try {
      const data = await fs.readFile(this.progressFile, 'utf8');
      const progress = JSON.parse(data);
      
      this.currentBatch = progress.currentBatch || 0;
      this.allUrls = progress.allUrls || [];
      
      console.log(`📋 進捗読み込み: バッチ ${this.currentBatch}/${Math.ceil(this.allUrls.length / this.batchSize)}`);
    } catch {
      console.log('📋 新規バッチ処理開始');
    }
  }

  async saveProgress() {
    const progress = {
      currentBatch: this.currentBatch,
      allUrls: this.allUrls,
      processedCount: this.processedUrls.size,
      timestamp: new Date().toISOString()
    };
    
    await fs.writeFile(this.progressFile, JSON.stringify(progress, null, 2));
  }

  async collectAllUrls() {
    console.log('🔍 全URL収集開始...');
    
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const allUrls = new Set();
    
    try {
      const page = await browser.newPage();
      await page.setUserAgent(this.iosUserAgent);
      
      for (let pageNum = 1; pageNum <= 30; pageNum++) {
        const url = pageNum === 1 ? this.listingUrl : `${this.listingUrl}&page=${pageNum}`;
        console.log(`📄 ページ ${pageNum} スキャン中...`);
        
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const urls = await page.evaluate(() => {
          const links = document.querySelectorAll('a[href*="/ad_details/"]');
          return Array.from(links).map(link => link.href);
        });
        
        if (urls.length === 0) break;
        
        urls.forEach(u => allUrls.add(u));
        console.log(`✅ ${urls.length}件のURL取得`);
      }
      
    } finally {
      await browser.close();
    }
    
    this.allUrls = Array.from(allUrls);
    console.log(`🎯 合計 ${this.allUrls.length} 件のURL収集完了`);
  }

  isAppCampaign(title, bodyText) {
    const appKeywords = [
      'アプリ', 'app', 'インストール', 'ダウンロード',
      'ゲーム', 'game', 'レベル', 'level', 'クリア',
      'iOS', 'iPhone', 'iPad', 'Android', 'アンドロイド',
      'Google Play', 'App Store', 'プレイ', 'play',
      'チュートリアル', 'アプリランド', 'アプリdeちょ'
    ];
    
    const combined = (title + ' ' + bodyText).toLowerCase();
    return appKeywords.some(keyword => combined.includes(keyword.toLowerCase()));
  }

  async processBatch(urls) {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const results = [];
    
    try {
      for (const url of urls) {
        if (this.processedUrls.has(url)) continue;
        
        const page = await browser.newPage();
        
        try {
          await page.setUserAgent(this.iosUserAgent);
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const data = await page.evaluate(() => {
            const title = document.querySelector('h1, .campaign-title, [class*="title"]')?.innerText?.trim() || '';
            const cashbackEl = document.querySelector('.point, [class*="point"], [class*="cashback"]');
            const cashback = cashbackEl?.innerText?.match(/[\d,]+(?:ポイント|pt|円|%)/)?.[0] || '';
            const bodyText = document.body.innerText.substring(0, 3000);
            
            let method = '';
            const methodPatterns = [
              /(?:獲得条件|条件|成果条件)[：:]?\s*([^\n]+)/,
              /(?:新規.*?インストール.*?)([^\n]+)/,
              /(?:レベル\d+.*?到達.*?)([^\n]+)/
            ];
            
            for (const pattern of methodPatterns) {
              const match = bodyText.match(pattern);
              if (match && match[1]) {
                method = match[1].trim().substring(0, 120);
                break;
              }
            }
            
            return { title, cashback, method, bodyText };
          });
          
          if (this.isAppCampaign(data.title, data.bodyText)) {
            const campaignId = url.match(/\/ad_details\/(\d+)/)?.[1] || 'unknown';
            
            const campaign = {
              id: campaignId,
              name: data.title,
              url: url,
              cashback: data.cashback || '不明',
              method: data.method || '不明',
              timestamp: new Date().toISOString()
            };
            
            results.push(campaign);
            this.newCampaigns.push(campaign);
            console.log(`✅ [${campaignId}] ${data.title}`);
          }
          
        } catch (error) {
          console.log(`❌ エラー: ${error.message}`);
        } finally {
          await page.close();
        }
        
        this.processedUrls.add(url);
      }
      
    } finally {
      await browser.close();
    }
    
    return results;
  }

  async run() {
    console.log('🚀 ちょびリッチバッチスクレイピング開始\n');
    
    try {
      // データ読み込み
      await this.loadExistingData();
      await this.loadProgress();
      
      // URL収集（未収集の場合）
      if (this.allUrls.length === 0) {
        await this.collectAllUrls();
        await this.saveProgress();
      }
      
      // 未処理URLのフィルタリング
      const unprocessedUrls = this.allUrls.filter(url => !this.processedUrls.has(url));
      console.log(`\n📊 処理状況: 未処理 ${unprocessedUrls.length}件\n`);
      
      // バッチ処理
      const totalBatches = Math.ceil(unprocessedUrls.length / this.batchSize);
      
      for (let i = this.currentBatch; i < totalBatches; i++) {
        const start = i * this.batchSize;
        const end = Math.min(start + this.batchSize, unprocessedUrls.length);
        const batchUrls = unprocessedUrls.slice(start, end);
        
        console.log(`\n📦 バッチ ${i + 1}/${totalBatches} 処理中...`);
        
        await this.processBatch(batchUrls);
        
        this.currentBatch = i + 1;
        await this.saveProgress();
        
        // 中間保存
        await this.saveBatchResults();
        
        console.log(`✅ バッチ ${i + 1} 完了: ${this.newCampaigns.length}件のアプリ案件`);
        
        // 休憩
        if (i < totalBatches - 1) {
          console.log('⏸️ 5秒休憩...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
      
      // 最終結果の統合と保存
      await this.saveFinalResults();
      
      console.log('\n🎉 バッチ処理完了！');
      console.log(`📊 結果:`);
      console.log(`  既存案件: ${this.existingData.size}件`);
      console.log(`  新規案件: ${this.newCampaigns.length}件`);
      console.log(`  合計: ${this.existingData.size + this.newCampaigns.length}件`);
      
    } catch (error) {
      console.error('💥 エラー:', error);
      await this.saveProgress();
    }
  }

  async saveBatchResults() {
    const batchData = {
      timestamp: new Date().toISOString(),
      batch: this.currentBatch,
      newCampaigns: this.newCampaigns
    };
    
    await fs.writeFile(this.batchFile, JSON.stringify(batchData, null, 2));
  }

  async saveFinalResults() {
    // 既存データと新規データを統合
    const allCampaigns = [...this.existingData.values()];
    
    this.newCampaigns.forEach(campaign => {
      if (!this.existingData.has(campaign.id)) {
        allCampaigns.push(campaign);
      }
    });
    
    const finalData = {
      scrape_date: new Date().toISOString(),
      strategy: 'batch_scraper',
      summary: {
        total_processed: this.processedUrls.size,
        app_campaigns_found: allCampaigns.length,
        new_campaigns: this.newCampaigns.length
      },
      app_campaigns: allCampaigns
    };
    
    // バックアップ作成
    await fs.copyFile(this.existingFile, `${this.existingFile}.backup_${Date.now()}`);
    
    // 更新
    await fs.writeFile(this.existingFile, JSON.stringify(finalData, null, 2));
    
    console.log(`💾 ${this.existingFile} を更新しました`);
  }
}

// 実行
if (require.main === module) {
  const scraper = new ChobirichBatchScraper();
  scraper.run().catch(console.error);
}

module.exports = ChobirichBatchScraper;