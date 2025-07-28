const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class SmallSampleTester {
  constructor() {
    this.baseUrl = 'https://pointi.jp';
    this.results = [];
    this.browser = null;
    
    // テスト用少数サンプル設定
    this.maxCampaignsPerCategory = 3; // 各カテゴリ3件ずつテスト
    this.testCategories = [
      // ショッピンググループから2つ
      { name: 'EC・ネットショッピング', id: 65, type: 'group' },
      { name: 'ファッション', id: 152, type: 'group' },
      
      // サービスカテゴリから2つ
      { name: 'サービスカテゴリ70', id: 70, type: 'category' },
      { name: 'サービスカテゴリ75', id: 75, type: 'category' }
    ];
  }

  async init() {
    console.log('🧪 ポイントインカム 少数サンプルテスト開始');
    console.log(`📊 テスト対象: ${this.testCategories.length}カテゴリ × ${this.maxCampaignsPerCategory}件`);
    console.log('🎯 取得データの品質確認\n');
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
    
    console.log('✅ ブラウザ初期化完了');
  }

  async setupPage() {
    const page = await this.browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    return page;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async testCategory(category) {
    const page = await this.setupPage();
    const categoryResults = [];
    
    try {
      console.log(`\n📍 ${category.name} テスト開始`);
      
      const listUrl = category.type === 'group' 
        ? `${this.baseUrl}/list.php?group=${category.id}`
        : `${this.baseUrl}/list.php?category=${category.id}`;
      
      console.log(`🌐 アクセス: ${listUrl}`);
      
      await page.goto(listUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await this.sleep(1000);
      
      // 案件リンクを取得
      const campaignLinks = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/ad/"]'));
        return links.map(link => ({
          url: link.href,
          title: link.textContent.trim()
        })).filter(link => link.url.includes('/ad/'));
      });
      
      console.log(`📋 発見した案件: ${campaignLinks.length}件`);
      
      // 最初の数件のみテスト
      const testLinks = campaignLinks.slice(0, this.maxCampaignsPerCategory);
      
      for (let i = 0; i < testLinks.length; i++) {
        const campaign = testLinks[i];
        console.log(`  🔍 [${i + 1}/${testLinks.length}] ${campaign.title}`);
        
        try {
          const detailData = await this.scrapeCampaignDetail(campaign.url);
          
          if (detailData) {
            const result = {
              ...detailData,
              category: category.name,
              categoryType: category.type,
              listUrl: listUrl,
              testIndex: i + 1
            };
            
            categoryResults.push(result);
            console.log(`    ✅ 取得完了: ${detailData.cashback || '還元率不明'}`);
          }
          
        } catch (error) {
          console.log(`    ❌ エラー: ${error.message}`);
        }
        
        await this.sleep(2000); // 2秒待機
      }
      
      console.log(`✅ ${category.name}: ${categoryResults.length}件テスト完了`);
      return categoryResults;
      
    } finally {
      await page.close();
    }
  }

  async scrapeCampaignDetail(url) {
    const page = await this.setupPage();
    
    try {
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      await this.sleep(500);
      
      const detailData = await page.evaluate(() => {
        // タイトル取得（複数セレクターを試行）
        let title = '';
        const titleSelectors = ['h1', '.ad-title', '.campaign-title', '.title', 'h2', 'h3'];
        
        for (const selector of titleSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim() && 
              element.textContent.trim() !== 'TOP' && 
              element.textContent.trim().length > 3) {
            title = element.textContent.trim();
            break;
          }
        }
        
        if (!title) {
          const titleElement = document.querySelector('title');
          if (titleElement) {
            const titleText = titleElement.textContent.trim();
            if (titleText && !titleText.includes('TOP') && !titleText.includes('ポイントサイト')) {
              title = titleText.split('|')[0].trim();
            }
          }
        }
        
        // 還元率取得（複数パターン対応）
        let cashback = '';
        let cashbackYen = '';
        
        const allText = document.body.textContent;
        
        // パーセント形式
        const percentMatch = allText.match(/(\d+(?:\.\d+)?)\s*%/);
        if (percentMatch) {
          cashback = percentMatch[1] + '%';
        }
        
        // ポイント形式
        const pointMatch = allText.match(/(\d+(?:,\d+)*)\s*(?:pt|ポイント)/);
        if (pointMatch) {
          cashback = pointMatch[1] + 'pt';
        }
        
        // 円形式
        const yenMatch = allText.match(/(\d+(?:,\d+)*)\s*円/);
        if (yenMatch) {
          cashbackYen = yenMatch[1] + '円';
        }
        
        // 獲得条件を詳細取得
        let method = '';
        const methodKeywords = ['獲得条件', '成果条件', '条件', '対象条件'];
        
        for (const keyword of methodKeywords) {
          const regex = new RegExp(keyword + '[：:：]?([^。]+)', 'i');
          const match = allText.match(regex);
          if (match && match[1]) {
            method = match[1].trim();
            break;
          }
        }
        
        // デバイス情報
        let device = 'すべて';
        const titleLower = title.toLowerCase();
        if (titleLower.includes('ios') || titleLower.includes('iphone') || titleLower.includes('ipad') || titleLower.includes('app store')) {
          device = 'iOS';
        } else if (titleLower.includes('android') || titleLower.includes('google play') || titleLower.includes('アンドロイド')) {
          device = 'Android';
        } else if (titleLower.includes('pc') || titleLower.includes('パソコン')) {
          device = 'PC';
        }
        
        return {
          title: title || 'タイトル取得失敗',
          cashback: cashback,
          cashbackYen: cashbackYen,
          method: method,
          device: device,
          scrapedAt: new Date().toISOString()
        };
      });
      
      const urlParts = url.split('/');
      const adId = urlParts[urlParts.length - 2] || urlParts[urlParts.length - 1];
      
      return {
        id: `pi_${adId}`,
        url: url,
        campaignUrl: url,
        displayName: detailData.title,
        description: detailData.title,
        ...detailData
      };
      
    } finally {
      await page.close();
    }
  }

  async run() {
    try {
      await this.init();
      
      console.log('🎯 カテゴリ別テスト開始\n');
      
      for (const category of this.testCategories) {
        const categoryResults = await this.testCategory(category);
        this.results.push(...categoryResults);
      }
      
      // 結果保存
      const output = {
        testType: 'small_sample_test',
        testDate: new Date().toISOString(),
        summary: {
          total_categories_tested: this.testCategories.length,
          total_campaigns_tested: this.results.length,
          max_per_category: this.maxCampaignsPerCategory
        },
        categories: this.testCategories.map(cat => ({
          name: cat.name,
          type: cat.type,
          id: cat.id,
          results_count: this.results.filter(r => r.category === cat.name).length
        })),
        results: this.results
      };
      
      await fs.writeFile('test_sample_results.json', JSON.stringify(output, null, 2));
      
      console.log('\n🎉 サンプルテスト完了！');
      console.log(`📊 総取得数: ${this.results.length}件`);
      console.log('📄 結果保存: test_sample_results.json');
      
      // 取得データのサマリー表示
      console.log('\n📋 取得データサマリー:');
      this.results.forEach((result, index) => {
        console.log(`${index + 1}. ${result.title}`);
        console.log(`   📍 カテゴリ: ${result.category}`);
        console.log(`   💰 還元: ${result.cashback || '不明'} ${result.cashbackYen || ''}`);
        console.log(`   📱 デバイス: ${result.device}`);
        console.log(`   🔗 URL: ${result.url}`);
        if (result.method) {
          console.log(`   📝 条件: ${result.method.substring(0, 50)}${result.method.length > 50 ? '...' : ''}`);
        }
        console.log('');
      });
      
      return output;
      
    } catch (error) {
      console.error('❌ テスト実行エラー:', error);
      throw error;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

// 実行
(async () => {
  const tester = new SmallSampleTester();
  await tester.run();
})();