const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class PointIncomeBatchMobileScraper {
  constructor() {
    this.baseUrl = 'https://sp.pointi.jp';
    this.results = [];
    this.browser = null;
    this.processedUrls = new Set();
    
    // バッチ処理設定
    this.batchSize = 20; // 20件ずつ処理
    this.rateLimitMs = 2500;
    this.pageTimeoutMs = 120000; // 2分タイムアウト（修正）
    this.maxScrollAttempts = 15;
    
    // チェックポイント機能
    this.checkpointFile = 'mobile_batch_checkpoint.json';
    this.processedCampaigns = new Set();
    
    this.appUrl = 'https://sp.pointi.jp/list.php?rf=1&n=1';
  }

  async init() {
    console.log('📱 ポイントインカム モバイルアプリ バッチスクレイピング開始');
    console.log(`📊 バッチサイズ: ${this.batchSize}件ずつ処理`);
    console.log(`⏱️ タイムアウト: ${this.pageTimeoutMs / 1000}秒\n`);
    
    await this.loadCheckpoint();
    await this.initBrowser();
  }

  async initBrowser() {
    if (this.browser) {
      await this.browser.close();
    }
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--memory-pressure-off'
      ],
      defaultViewport: { width: 375, height: 812 }
    });
    
    console.log('🔄 ブラウザインスタンス初期化完了');
  }

  async loadCheckpoint() {
    try {
      const checkpointData = await fs.readFile(this.checkpointFile, 'utf8');
      const checkpoint = JSON.parse(checkpointData);
      
      if (checkpoint.processedCampaigns) {
        this.processedCampaigns = new Set(checkpoint.processedCampaigns);
        console.log(`📋 チェックポイント読み込み: ${this.processedCampaigns.size}件完了済み`);
      }
      
      if (checkpoint.results) {
        this.results = checkpoint.results;
        console.log(`📋 既存結果読み込み: ${this.results.length}件`);
      }
    } catch (error) {
      console.log('📋 新規実行開始（チェックポイントなし）');
    }
  }

  async saveCheckpoint() {
    const checkpoint = {
      processedCampaigns: Array.from(this.processedCampaigns),
      results: this.results,
      lastUpdated: new Date().toISOString()
    };
    
    await fs.writeFile(this.checkpointFile, JSON.stringify(checkpoint, null, 2));
  }

  async setupPage() {
    const page = await this.browser.newPage();
    
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['image', 'font', 'stylesheet', 'media'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1');
    page.setDefaultTimeout(this.pageTimeoutMs);
    page.setDefaultNavigationTimeout(this.pageTimeoutMs);
    
    return page;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async scrapeAllApps() {
    const page = await this.setupPage();
    
    try {
      console.log(`📱 アプリ一覧ページにアクセス: ${this.appUrl}`);
      await page.goto(this.appUrl, { waitUntil: 'networkidle2', timeout: this.pageTimeoutMs });
      await this.sleep(3000);
      
      // スクロール読み込みで全案件を取得
      let previousCount = 0;
      let currentCount = 0;
      let scrollAttempts = 0;
      
      console.log('📊 スクロール読み込み開始...');
      
      while (scrollAttempts < this.maxScrollAttempts) {
        currentCount = await page.evaluate(() => {
          const campaigns = document.querySelectorAll('a[href*="/ad/"]');
          return campaigns.length;
        });
        
        console.log(`  📄 スクロール ${scrollAttempts + 1}: ${currentCount}件の案件`);
        
        if (scrollAttempts > 0 && currentCount === previousCount) {
          console.log('  ⚠️ 新しい案件が読み込まれなくなりました - 終了');
          break;
        }
        
        previousCount = currentCount;
        
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        
        await this.sleep(3000);
        
        const loadMoreButton = await page.$('button[onclick*="more"], .load-more, .btn-more, [data-action="load-more"]');
        if (loadMoreButton) {
          console.log('  🔄 「もっと見る」ボタンをクリック...');
          await loadMoreButton.click();
          await this.sleep(3000);
        }
        
        scrollAttempts++;
      }
      
      // 最終的な案件リストを取得
      const allCampaignLinks = await page.evaluate(() => {
        const campaigns = [];
        const campaignElements = document.querySelectorAll('a[href*="/ad/"]');
        
        campaignElements.forEach(element => {
          const campaign = {
            url: element.href,
            title: ''
          };
          
          const titleElement = element.querySelector('img') || element;
          campaign.title = titleElement.alt || titleElement.textContent || '';
          
          if (campaign.title && campaign.url) {
            campaigns.push(campaign);
          }
        });
        
        return campaigns;
      });
      
      // 重複除去
      const uniqueLinks = Array.from(
        new Map(allCampaignLinks.map(link => [link.url, link])).values()
      );
      
      console.log(`📊 発見された案件: ${uniqueLinks.length}件`);
      
      return uniqueLinks;
      
    } finally {
      await page.close();
    }
  }

  async processBatch(campaigns, batchIndex) {
    console.log(`\n🔥 バッチ ${batchIndex + 1} 開始（${campaigns.length}件）`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < campaigns.length; i++) {
      const campaign = campaigns[i];
      
      if (this.processedCampaigns.has(campaign.url)) {
        console.log(`⏭️ [${i + 1}/${campaigns.length}] スキップ（処理済み）`);
        continue;
      }
      
      try {
        const detailData = await this.scrapeCampaignDetailWithRetry(campaign.url);
        if (detailData) {
          let device = 'すべて';
          const title = detailData.title.toLowerCase();
          
          if (title.includes('ios用') || title.includes('iphone') || title.includes('ipad') || title.includes('app store')) {
            device = 'iOS';
          } else if (title.includes('android用') || title.includes('google play') || title.includes('アンドロイド')) {
            device = 'Android';
          } else if (title.includes('pcのみ') || title.includes('pc限定') || title.includes('パソコン限定')) {
            device = 'PC';
          }
          
          this.results.push({
            ...detailData,
            category: 'モバイルアプリ',
            categoryType: 'app',
            device: device
          });
          
          this.processedCampaigns.add(campaign.url);
          successCount++;
          
          console.log(`✅ [${i + 1}/${campaigns.length}] [${device}] ${detailData.title} - ${detailData.cashback || detailData.cashbackYen || '不明'}`);
        } else {
          console.log(`⚠️ [${i + 1}/${campaigns.length}] データ不完全: ${campaign.url}`);
        }
      } catch (error) {
        console.error(`❌ [${i + 1}/${campaigns.length}] 詳細エラー: ${campaign.url} - ${error.message}`);
        errorCount++;
      }
      
      await this.sleep(this.rateLimitMs);
    }
    
    // バッチ完了後にチェックポイント保存
    await this.saveCheckpoint();
    console.log(`\n🎯 バッチ ${batchIndex + 1} 完了 - 成功: ${successCount}件, エラー: ${errorCount}件`);
  }

  async scrapeCampaignDetailWithRetry(url, retryAttempt = 0) {
    try {
      return await this.scrapeCampaignDetail(url);
    } catch (error) {
      if (retryAttempt < 2) {
        console.log(`    🔄 詳細ページリトライ ${retryAttempt + 1}/2`);
        await this.sleep(2000 * (retryAttempt + 1));
        return await this.scrapeCampaignDetailWithRetry(url, retryAttempt + 1);
      } else {
        throw error;
      }
    }
  }

  async scrapeCampaignDetail(url) {
    const page = await this.setupPage();
    
    try {
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: this.pageTimeoutMs 
      });
      
      await this.sleep(1000);
      
      const detailData = await page.evaluate(() => {
        const data = {
          title: '',
          percentText: '',
          yenText: '',
          conditions: ''
        };
        
        // タイトル取得（モバイル版）
        const titleEl = document.querySelector('h2');
        if (titleEl) {
          data.title = titleEl.textContent.trim();
        }
        
        // ポイント数取得（モバイル版）
        const pointEl = document.querySelector('.point');
        if (pointEl) {
          const pointText = pointEl.textContent.trim();
          // "750pt" のような形式から数値を抽出
          const pointMatch = pointText.match(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?)pt/i);
          if (pointMatch) {
            const ptValue = parseFloat(pointMatch[1].replace(/,/g, ''));
            const yenValue = Math.floor(ptValue / 10); // 10pt = 1円で換算
            data.yenText = `(${yenValue}円分)`;
          }
        }
        
        // 還元率取得（モバイル版）
        const percentEl = document.querySelector('.point-triangle');
        if (percentEl) {
          data.percentText = percentEl.textContent.trim();
        }
        
        // 条件取得（モバイル版では異なる場所）
        const conditionEl = document.querySelector('.pt_10.pb_10.pl_5.pr_5.bdert_so.txt_center.pt_wrap');
        if (conditionEl) {
          data.conditions = conditionEl.textContent.trim().substring(0, 500);
        }
        
        return data;
      });
      
      const idMatch = url.match(/\/ad\/(\d+)/);
      const id = idMatch ? `pi_${idMatch[1]}` : `pi_${Date.now()}`;
      
      let cashback = null;
      let cashbackYen = null;
      
      if (detailData.percentText && detailData.percentText.match(/\d+(?:\.\d+)?%/)) {
        cashback = detailData.percentText;
      }
      
      if (detailData.yenText) {
        const match = detailData.yenText.match(/[（(](\d{1,3}(?:,\d{3})*(?:\.\d+)?)円分[）)]/);
        if (match) {
          cashbackYen = match[1].replace(/,/g, '') + '円';
        }
      }
      
      if (!detailData.title || (!cashback && !cashbackYen)) {
        return null;
      }
      
      return {
        id: id,
        title: detailData.title,
        description: detailData.title,
        displayName: detailData.title,
        url: url,
        campaignUrl: url,
        pointSiteUrl: 'https://pointi.jp',
        cashback: cashback,
        cashbackYen: cashbackYen,
        conditions: detailData.conditions,
        lastUpdated: new Date().toLocaleString('ja-JP'),
        siteName: 'ポイントインカム',
        searchKeywords: detailData.title.toLowerCase(),
        searchWeight: 1
      };
      
    } finally {
      await page.close();
    }
  }

  async saveResults() {
    const deviceBreakdown = { iOS: 0, Android: 0, PC: 0, すべて: 0 };
    this.results.forEach(campaign => {
      deviceBreakdown[campaign.device]++;
    });

    const data = {
      siteName: 'ポイントインカム',
      scrapingType: 'mobile-app-batch',
      scrapedAt: new Date().toISOString(),
      isComplete: true,
      summary: {
        total_campaigns: this.results.length,
        device_breakdown: deviceBreakdown,
        batch_size: this.batchSize,
        timeout_ms: this.pageTimeoutMs
      },
      campaigns: this.results
    };

    await fs.writeFile(
      'pointincome_mobile_batch_final.json',
      JSON.stringify(data, null, 2),
      'utf8'
    );

    console.log(`\n💾 最終データ保存完了: pointincome_mobile_batch_final.json`);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async run() {
    const startTime = Date.now();
    
    try {
      await this.init();
      
      // 全アプリ案件を取得
      const allCampaigns = await this.scrapeAllApps();
      
      // 未処理の案件のみ抽出
      const remainingCampaigns = allCampaigns.filter(campaign => 
        !this.processedCampaigns.has(campaign.url)
      );
      
      console.log(`🎯 処理対象: ${remainingCampaigns.length}件`);
      
      // バッチ処理実行
      for (let i = 0; i < remainingCampaigns.length; i += this.batchSize) {
        const batch = remainingCampaigns.slice(i, i + this.batchSize);
        const batchIndex = Math.floor(i / this.batchSize);
        
        await this.processBatch(batch, batchIndex);
        
        // バッチ間でブラウザ再起動
        if (i + this.batchSize < remainingCampaigns.length) {
          console.log(`\n🔄 ブラウザ再起動中...`);
          await this.initBrowser();
          await this.sleep(2000);
        }
      }
      
      await this.saveResults();
      
      const endTime = Date.now();
      const durationMinutes = Math.round((endTime - startTime) / 60000);
      
      const deviceBreakdown = { iOS: 0, Android: 0, PC: 0, すべて: 0 };
      this.results.forEach(campaign => {
        deviceBreakdown[campaign.device]++;
      });
      
      console.log('\n🎉 モバイルアプリ バッチスクレイピング完了！');
      console.log(`📊 総案件数: ${this.results.length}件`);
      console.log(`📱 デバイス別内訳:`);
      console.log(`  iOS: ${deviceBreakdown.iOS}件`);
      console.log(`  Android: ${deviceBreakdown.Android}件`);
      console.log(`  PC: ${deviceBreakdown.PC}件`);
      console.log(`  すべて: ${deviceBreakdown.すべて}件`);
      console.log(`⏱️ 実行時間: ${durationMinutes}分`);
      
    } catch (error) {
      console.error('❌ 致命的エラー:', error);
    } finally {
      await this.close();
    }
  }
}

// 実行
(async () => {
  const scraper = new PointIncomeBatchMobileScraper();
  await scraper.run();
})();