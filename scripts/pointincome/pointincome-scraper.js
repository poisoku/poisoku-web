const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class PointIncomeScraper {
  constructor() {
    this.baseUrl = 'https://pointi.jp';
    this.results = [];
    this.browser = null;
    this.processedUrls = new Set();
    this.processedCount = 0;
    this.errorCount = 0;
    this.categories = [
      { name: '総合通販・百貨店', id: 66 },
      { name: '無料アプリ一覧', id: 67 },
      { name: '条件クリアでポイントGET', id: 68 },
      { name: '即追加', id: 69 },
      { name: '会員登録・申込', id: 70 },
      { name: '融資・ローン・キャッシング', id: 72 },
      { name: '資料請求', id: 73 },
      { name: 'アンケート・口コミ', id: 74 },
      { name: '体験・トライアル', id: 75 },
      { name: '口座開設・入金', id: 76 },
      { name: '各種保険', id: 77 },
      { name: '予約・来店', id: 78 },
      { name: '見積もり・査定・調査', id: 79 },
      { name: '株・FX・暗号資産（取引）', id: 81 },
      { name: 'その他', id: 82 }
    ];
  }

  async init() {
    console.log('🚀 ポイントインカムスクレイピング開始');
    console.log(`📋 ${this.categories.length}カテゴリを処理予定`);
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      defaultViewport: {
        width: 1920,
        height: 1080
      }
    });
  }

  async setupPage() {
    const page = await this.browser.newPage();
    
    // 画像の読み込みを無効化して高速化
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (['image', 'font', 'stylesheet'].includes(request.resourceType())) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // PC用のUser-Agent設定
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    return page;
  }

  extractCashbackFromYen(yenText) {
    if (!yenText) return null;
    
    // (50円分) → 50円
    const match = yenText.match(/[(（](\d{1,3}(?:,\d{3})*(?:\.\d+)?)円分[)）]/);
    if (match) {
      return match[1].replace(/,/g, '') + '円';
    }
    return null;
  }

  async scrapeCategoryList(category) {
    const page = await this.setupPage();
    console.log(`\n📂 カテゴリ「${category.name}」の案件取得開始`);
    
    try {
      const listUrl = `${this.baseUrl}/list.php?category=${category.id}`;
      await page.goto(listUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      console.log(`✅ リストページアクセス成功: ${listUrl}`);
      
      // 案件リンクを取得
      const campaignLinks = await page.$$eval('.box_ad_inner a[href*="/ad/"]', links => {
        return links.map(link => ({
          url: link.href,
          title: link.querySelector('img') ? link.querySelector('img').alt : ''
        }));
      });
      
      console.log(`📊 ${campaignLinks.length}件の案件を発見`);
      
      // 各案件の詳細を取得
      for (let i = 0; i < campaignLinks.length; i++) {
        const campaign = campaignLinks[i];
        
        if (this.processedUrls.has(campaign.url)) {
          console.log(`⏭️ スキップ（処理済み）: ${campaign.url}`);
          continue;
        }
        
        try {
          const detailData = await this.scrapeCampaignDetail(campaign.url);
          if (detailData) {
            this.results.push({
              ...detailData,
              category: category.name,
              device: 'PC'
            });
            this.processedUrls.add(campaign.url);
            this.processedCount++;
            
            console.log(`✅ [${this.processedCount}] ${detailData.title} - ${detailData.cashback || detailData.cashbackYen}`);
          }
        } catch (error) {
          console.error(`❌ 詳細ページエラー: ${campaign.url}`, error.message);
          this.errorCount++;
        }
        
        // レート制限対策
        await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
        
        // 10件ごとに中間保存
        if (this.processedCount > 0 && this.processedCount % 10 === 0) {
          await this.saveResults();
          console.log(`💾 中間保存完了（${this.processedCount}件）`);
        }
      }
      
      // ページネーションがある場合の処理（必要に応じて実装）
      // TODO: 次のページがある場合は続けて処理
      
    } catch (error) {
      console.error(`❌ カテゴリエラー: ${category.name}`, error);
    } finally {
      await page.close();
    }
  }

  async scrapeCampaignDetail(url) {
    const page = await this.setupPage();
    
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 詳細ページの情報取得
      const detailData = await page.evaluate(() => {
        const data = {
          title: '',
          pointText: '',
          yenText: '',
          description: '',
          conditions: ''
        };
        
        // タイトル取得
        const titleEl = document.querySelector('h2');
        if (titleEl) {
          data.title = titleEl.textContent.trim();
        }
        
        // ポイント情報取得（500pt (50円分) の形式）
        const pointElements = document.querySelectorAll('*');
        for (const el of pointElements) {
          const text = el.textContent;
          if (text.match(/\d+pt\s*[(（]\d+円分[)）]/) && el.children.length === 0) {
            data.pointText = text.trim();
            break;
          }
        }
        
        // 円分表記を個別に取得
        const yenEl = document.querySelector('.pt_yen.bold');
        if (yenEl) {
          data.yenText = yenEl.textContent.trim();
        }
        
        // 成果条件を取得
        const conditionEl = document.querySelector('.box_point_joken');
        if (conditionEl) {
          data.conditions = conditionEl.textContent.trim();
        }
        
        return data;
      });
      
      // IDを生成（URLから）
      const idMatch = url.match(/\/ad\/(\d+)/);
      const id = idMatch ? `pi_${idMatch[1]}` : `pi_${Date.now()}`;
      
      // ポイントと円の解析
      let cashback = null;
      let cashbackYen = null;
      
      if (detailData.pointText) {
        // 500pt (50円分) のような形式
        const ptMatch = detailData.pointText.match(/(\d+)pt/);
        const yenMatch = detailData.pointText.match(/[(（](\d+(?:,\d{3})*)円分[)）]/);
        
        if (ptMatch) {
          cashback = ptMatch[1] + 'ポイント';
        }
        if (yenMatch) {
          cashbackYen = yenMatch[1].replace(/,/g, '') + '円';
        }
      } else if (detailData.yenText) {
        // (50円分) のような形式
        cashbackYen = this.extractCashbackFromYen(detailData.yenText);
      }
      
      // データが不完全な場合はスキップ
      if (!detailData.title || (!cashback && !cashbackYen)) {
        console.log(`⚠️ データ不完全: ${url}`);
        return null;
      }
      
      return {
        id: id,
        title: detailData.title,
        description: detailData.description || detailData.title,
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
      
    } catch (error) {
      console.error(`❌ 詳細ページエラー: ${url}`, error.message);
      return null;
    } finally {
      await page.close();
    }
  }

  async saveResults() {
    const data = {
      siteName: 'ポイントインカム',
      scrapedAt: new Date().toISOString(),
      summary: {
        total_campaigns: this.results.length,
        total_processed: this.processedCount,
        errors: this.errorCount,
        categories: this.categories.length,
        device: 'PC'
      },
      campaigns: this.results
    };

    await fs.writeFile(
      'pointincome_campaigns.json',
      JSON.stringify(data, null, 2),
      'utf8'
    );
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async run() {
    try {
      await this.init();
      
      // 各カテゴリをスクレイピング
      for (const category of this.categories) {
        await this.scrapeCategoryList(category);
        
        // カテゴリ間の待機
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      // 最終保存
      await this.saveResults();
      
      console.log('\n✅ スクレイピング完了！');
      console.log(`📊 総案件数: ${this.results.length}件`);
      console.log(`❌ エラー数: ${this.errorCount}件`);
      
    } catch (error) {
      console.error('❌ 致命的エラー:', error);
    } finally {
      await this.close();
    }
  }
}

// 実行
(async () => {
  const scraper = new PointIncomeScraper();
  await scraper.run();
})();