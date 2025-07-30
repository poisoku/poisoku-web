const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class ChobirichCompleteScraper {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.listingUrl = 'https://www.chobirich.com/smartphone?sort=point';
    this.results = [];
    this.browser = null;
    this.checkpointFile = 'chobirich_complete_checkpoint.json';
    this.outputFile = 'chobirich_complete_app_campaigns.json';
    this.processedUrls = new Set();
    this.iosUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
  }

  async initBrowser() {
    console.log('🚀 ブラウザ初期化中...');
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled'
      ],
      timeout: 60000
    });
    console.log('✅ ブラウザ初期化完了');
  }

  async loadCheckpoint() {
    try {
      const checkpoint = await fs.readFile(this.checkpointFile, 'utf8');
      const data = JSON.parse(checkpoint);
      this.processedUrls = new Set(data.processedUrls || []);
      this.results = data.results || [];
      console.log(`📋 チェックポイント読み込み: ${this.processedUrls.size}件処理済み`);
      return true;
    } catch {
      console.log('📋 新規実行開始');
      return false;
    }
  }

  async saveCheckpoint() {
    const checkpoint = {
      timestamp: new Date().toISOString(),
      processedUrls: Array.from(this.processedUrls),
      results: this.results,
      totalProcessed: this.processedUrls.size,
      appCampaignsFound: this.results.length
    };
    await fs.writeFile(this.checkpointFile, JSON.stringify(checkpoint, null, 2));
    console.log(`💾 チェックポイント保存: ${this.results.length}件のアプリ案件`);
  }

  async getAllUrls() {
    console.log('📚 全ページURL収集開始');
    const allUrls = new Set();
    const page = await this.browser.newPage();
    
    await page.setUserAgent(this.iosUserAgent);
    await page.setViewport({ width: 390, height: 844 });
    
    for (let pageNum = 1; pageNum <= 30; pageNum++) {
      try {
        const url = pageNum === 1 ? this.listingUrl : `${this.listingUrl}&page=${pageNum}`;
        console.log(`📄 ページ ${pageNum} スキャン中...`);
        
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const urls = await page.evaluate(() => {
          const links = document.querySelectorAll('a[href*="/ad_details/"]');
          return Array.from(links).map(link => link.href).filter(href => href.includes('/ad_details/'));
        });
        
        if (urls.length === 0) {
          console.log(`📝 ページ ${pageNum}: 案件なし - 終了`);
          break;
        }
        
        urls.forEach(url => allUrls.add(url));
        console.log(`✅ ページ ${pageNum}: ${urls.length}件収集`);
        
      } catch (error) {
        console.log(`⚠️ ページ ${pageNum} エラー: ${error.message}`);
      }
    }
    
    await page.close();
    console.log(`🎯 合計 ${allUrls.size} 件のURL収集完了`);
    return Array.from(allUrls);
  }

  isAppCampaign(title, bodyText) {
    const appKeywords = [
      'アプリ', 'app', 'インストール', 'ダウンロード',
      'ゲーム', 'game', 'レベル', 'level', 'クリア',
      'iOS', 'iPhone', 'iPad', 'Android', 'アンドロイド',
      'Google Play', 'App Store', 'プレイ', 'play',
      'チュートリアル', 'アプリランド'
    ];
    
    const combined = (title + ' ' + bodyText).toLowerCase();
    return appKeywords.some(keyword => combined.includes(keyword.toLowerCase()));
  }

  async processCampaign(url) {
    if (this.processedUrls.has(url)) {
      return null;
    }
    
    const page = await this.browser.newPage();
    try {
      await page.setUserAgent(this.iosUserAgent);
      await page.setViewport({ width: 390, height: 844 });
      
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const data = await page.evaluate(() => {
        const title = document.querySelector('h1, .campaign-title, [class*="title"]')?.innerText?.trim() || '';
        const cashbackEl = document.querySelector('.point, [class*="point"], [class*="cashback"]');
        const cashback = cashbackEl?.innerText?.match(/[\d,]+(?:ポイント|pt|円|%)/)?.[0] || '';
        const bodyText = document.body.innerText.substring(0, 3000);
        
        // 獲得条件の抽出
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
        const result = {
          id: campaignId,
          name: data.title,
          url: url,
          cashback: data.cashback || '不明',
          method: data.method || '不明',
          timestamp: new Date().toISOString()
        };
        
        this.results.push(result);
        console.log(`✅ [${campaignId}] ${data.title} (${data.cashback})`);
      }
      
      this.processedUrls.add(url);
      
    } catch (error) {
      console.log(`❌ エラー: ${error.message}`);
    } finally {
      await page.close();
    }
  }

  async run() {
    console.log('🌟 ちょびリッチ完全スクレイピング開始\n');
    
    try {
      await this.initBrowser();
      await this.loadCheckpoint();
      
      // URL収集
      const allUrls = await this.getAllUrls();
      const remainingUrls = allUrls.filter(url => !this.processedUrls.has(url));
      
      console.log(`\n📊 処理状況:`);
      console.log(`  処理済み: ${this.processedUrls.size}件`);
      console.log(`  未処理: ${remainingUrls.length}件`);
      console.log(`  アプリ案件: ${this.results.length}件\n`);
      
      // 未処理URLの処理
      let count = 0;
      for (const url of remainingUrls) {
        count++;
        console.log(`[${count}/${remainingUrls.length}] 処理中...`);
        
        await this.processCampaign(url);
        
        // 定期的にチェックポイント保存
        if (count % 20 === 0) {
          await this.saveCheckpoint();
        }
        
        // ブラウザ再起動
        if (count % 50 === 0) {
          console.log('🔄 ブラウザ再起動中...');
          await this.browser.close();
          await this.initBrowser();
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // 最終保存
      await this.saveCheckpoint();
      
      // 結果ファイル作成
      const output = {
        scrape_date: new Date().toISOString(),
        total_processed: this.processedUrls.size,
        app_campaigns_found: this.results.length,
        app_campaigns: this.results
      };
      
      await fs.writeFile(this.outputFile, JSON.stringify(output, null, 2));
      
      console.log('\n🎉 スクレイピング完了！');
      console.log(`📊 統計:`);
      console.log(`  総URL数: ${allUrls.length}`);
      console.log(`  処理済み: ${this.processedUrls.size}`);
      console.log(`  アプリ案件: ${this.results.length}`);
      console.log(`  出力ファイル: ${this.outputFile}`);
      
    } catch (error) {
      console.error('💥 エラー:', error);
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

// 実行
if (require.main === module) {
  const scraper = new ChobirichCompleteScraper();
  scraper.run().catch(console.error);
}

module.exports = ChobirichCompleteScraper;