const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class PointIncomeUnifiedScraper {
  constructor() {
    this.baseUrl = 'https://pointi.jp';
    this.results = [];
    this.browser = null;
    this.processedUrls = new Set();
    this.processedCount = 0;
    this.errorCount = 0;
    
    // カテゴリとグループの両方を管理
    this.categories = [
      // 主要カテゴリ
      { name: '総合通販・百貨店', type: 'category', id: 66 },
      { name: '無料アプリ一覧', type: 'category', id: 67 },
      { name: '条件クリアでポイントGET', type: 'category', id: 68 },
      { name: '即追加', type: 'category', id: 69 },
      { name: '会員登録・申込', type: 'category', id: 70 },
      { name: '融資・ローン・キャッシング', type: 'category', id: 72 },
      { name: '資料請求', type: 'category', id: 73 },
      { name: 'アンケート・口コミ', type: 'category', id: 74 },
      { name: '体験・トライアル', type: 'category', id: 75 },
      { name: '口座開設・入金', type: 'category', id: 76 },
      { name: '各種保険', type: 'category', id: 77 },
      { name: '予約・来店', type: 'category', id: 78 },
      { name: '見積もり・査定・調査', type: 'category', id: 79 },
      { name: '株・FX・暗号資産（取引）', type: 'category', id: 81 },
      { name: 'その他', type: 'category', id: 82 }
    ];
    
    this.groups = [
      // ショッピンググループ
      { name: 'EC・ネットショッピング', type: 'group', id: 65 },
      { name: 'ファッション', type: 'group', id: 152 },
      { name: 'グルメ', type: 'group', id: 154 },
      { name: '美容', type: 'group', id: 148 },
      { name: '衛生用品', type: 'group', id: 147 },
      { name: 'エンタメ・家電', type: 'group', id: 151 },
      { name: '住まい・暮らし', type: 'group', id: 155 },
      { name: 'その他（ショッピング）', type: 'group', id: 153 }
    ];
  }

  async init() {
    console.log('🚀 ポイントインカム統合スクレイピング開始');
    console.log(`📋 ${this.categories.length}カテゴリ + ${this.groups.length}グループを処理予定`);
    
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

  async scrapeList(listItem) {
    const page = await this.setupPage();
    const itemType = listItem.type === 'category' ? 'カテゴリ' : 'グループ';
    console.log(`\n📂 ${itemType}「${listItem.name}」の案件取得開始`);
    
    try {
      // URLを構築（categoryまたはgroupパラメータ）
      const listUrl = `${this.baseUrl}/list.php?${listItem.type}=${listItem.id}`;
      await page.goto(listUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      console.log(`✅ リストページアクセス成功: ${listUrl}`);
      
      let allCampaignLinks = [];
      let pageNum = 1;
      let hasNextPage = true;
      
      // ページネーション対応
      while (hasNextPage) {
        console.log(`  📄 ページ ${pageNum} を処理中...`);
        
        // 案件リンクを取得
        const campaignLinks = await page.$$eval('.box_ad_inner a[href*="/ad/"]', links => {
          return links.map(link => ({
            url: link.href,
            title: link.querySelector('img') ? link.querySelector('img').alt : ''
          }));
        });
        
        allCampaignLinks = allCampaignLinks.concat(campaignLinks);
        console.log(`  ✅ ${campaignLinks.length}件の案件を発見（合計: ${allCampaignLinks.length}件）`);
        
        // 次のページがあるかチェック
        const nextPageExists = await page.$('.pager a[href*="page="]');
        if (nextPageExists && pageNum < 10) { // 最大10ページまで
          pageNum++;
          const nextPageUrl = `${listUrl}&page=${pageNum}`;
          await page.goto(nextPageUrl, { waitUntil: 'networkidle2' });
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          hasNextPage = false;
        }
      }
      
      console.log(`📊 ${allCampaignLinks.length}件の案件を処理開始`);
      
      // 各案件の詳細を取得
      for (let i = 0; i < allCampaignLinks.length; i++) {
        const campaign = allCampaignLinks[i];
        
        if (this.processedUrls.has(campaign.url)) {
          console.log(`⏭️ スキップ（処理済み）: ${campaign.url}`);
          continue;
        }
        
        try {
          const detailData = await this.scrapeCampaignDetail(campaign.url);
          if (detailData) {
            this.results.push({
              ...detailData,
              category: listItem.name,
              categoryType: listItem.type,
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
        
        // 20件ごとに中間保存
        if (this.processedCount > 0 && this.processedCount % 20 === 0) {
          await this.saveResults();
          console.log(`💾 中間保存完了（${this.processedCount}件）`);
        }
      }
      
    } catch (error) {
      console.error(`❌ ${itemType}エラー: ${listItem.name}`, error);
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
          percentText: '',
          description: '',
          conditions: ''
        };
        
        // タイトル取得
        const titleEl = document.querySelector('h2');
        if (titleEl) {
          data.title = titleEl.textContent.trim();
        }
        
        // パーセント還元を取得（ショッピング系）
        const percentEl = document.querySelector('.ad_pt.red.bold');
        if (percentEl) {
          data.percentText = percentEl.textContent.trim();
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
      
      // パーセント還元（ショッピング系）
      if (detailData.percentText && detailData.percentText.match(/\d+(?:\.\d+)?%/)) {
        cashback = detailData.percentText;
      }
      
      // ポイント還元（サービス系）
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
        groups: this.groups.length,
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
      
      // グループをスクレイピング（ショッピング系）
      console.log('\n🛍️ ショッピンググループのスクレイピング開始');
      for (const group of this.groups) {
        await this.scrapeList(group);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      // カテゴリをスクレイピング（サービス系）
      console.log('\n🔧 サービスカテゴリのスクレイピング開始');
      for (const category of this.categories) {
        await this.scrapeList(category);
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
  const scraper = new PointIncomeUnifiedScraper();
  await scraper.run();
})();