const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class ImprovedSampleTester {
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
    console.log('🧪 ポイントインカム 改良版サンプルテスト開始');
    console.log(`📊 テスト対象: ${this.testCategories.length}カテゴリ × ${this.maxCampaignsPerCategory}件`);
    console.log('🎯 正確な還元率取得ロジック適用\n');
    
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
            console.log(`    ✅ 取得完了: ${detailData.cashback || '還元率不明'} ${detailData.cashbackYen ? '(' + detailData.cashbackYen + ')' : ''}`);
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
        
        // 改良版還元率取得ロジック
        let cashback = '';
        let cashbackYen = '';
        
        const allText = document.body.textContent;
        
        // 1. パーセント形式を優先検索（購入金額の◯%）
        const percentPatterns = [
          /購入金額の\s*(\d+(?:\.\d+)?)\s*%/,
          /(\d+(?:\.\d+)?)\s*%\s*還元/,
          /(\d+(?:\.\d+)?)\s*%/
        ];
        
        for (const pattern of percentPatterns) {
          const match = allText.match(pattern);
          if (match) {
            cashback = match[1] + '%';
            break;
          }
        }
        
        // 2. パーセントが見つからない場合、ポイント形式を検索
        if (!cashback) {
          // より具体的なポイント抽出（大きな数字を優先）
          const pointPatterns = [
            /(\d{1,3}(?:,\d{3})+)\s*pt/g,  // カンマ区切りの大きなポイント
            /(\d+)\s*pt/g  // 通常のポイント
          ];
          
          let maxPoints = 0;
          let bestMatch = '';
          
          for (const pattern of pointPatterns) {
            let match;
            while ((match = pattern.exec(allText)) !== null) {
              const points = parseInt(match[1].replace(/,/g, ''));
              if (points > maxPoints) {
                maxPoints = points;
                bestMatch = match[1] + 'pt';
              }
            }
          }
          
          if (bestMatch) {
            cashback = bestMatch;
            // 10pt = 1円でレート変換
            const points = parseInt(bestMatch.replace(/[pt,]/g, ''));
            const yenValue = Math.floor(points / 10);
            if (yenValue > 0) {
              cashbackYen = yenValue + '円';
            }
          }
        }
        
        // 獲得条件を正確に取得
        let method = '';
        
        // 成果条件の次の行を取得
        const methodPatterns = [
          /成果条件\s*([^\n]+)/,
          /ポイント獲得条件\s*([^\n]+)/,
          /獲得条件\s*([^\n]+)/
        ];
        
        for (const pattern of methodPatterns) {
          const match = allText.match(pattern);
          if (match && match[1]) {
            method = match[1].trim();
            // 不要な文字列を除去
            method = method.replace(/^\s*[:：]\s*/, '');
            method = method.replace(/\s+/g, ' ');
            break;
          }
        }
        
        // より詳細な成果条件検索
        if (!method) {
          // DOMから直接成果条件を探す
          const conditionElements = document.querySelectorAll('*');
          for (const element of conditionElements) {
            const text = element.textContent;
            if (text && text.includes('成果条件') && element.nextElementSibling) {
              const nextText = element.nextElementSibling.textContent.trim();
              if (nextText && nextText.length > 5 && nextText.length < 200) {
                method = nextText;
                break;
              }
            }
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
        testType: 'improved_sample_test',
        testDate: new Date().toISOString(),
        summary: {
          total_categories_tested: this.testCategories.length,
          total_campaigns_tested: this.results.length,
          max_per_category: this.maxCampaignsPerCategory
        },
        improvements: [
          "正確な還元率取得（pt→円変換: 10pt=1円）",
          "パーセント形式の優先検出",
          "獲得条件の精密抽出",
          "不要HTML除去"
        ],
        categories: this.testCategories.map(cat => ({
          name: cat.name,
          type: cat.type,
          id: cat.id,
          results_count: this.results.filter(r => r.category === cat.name).length
        })),
        results: this.results
      };
      
      await fs.writeFile('improved_sample_results.json', JSON.stringify(output, null, 2));
      
      console.log('\n🎉 改良版サンプルテスト完了！');
      console.log(`📊 総取得数: ${this.results.length}件`);
      console.log('📄 結果保存: improved_sample_results.json');
      
      // 取得データのサマリー表示
      console.log('\n📋 改良版取得データサマリー:');
      this.results.forEach((result, index) => {
        console.log(`${index + 1}. ${result.title}`);
        console.log(`   📍 カテゴリ: ${result.category}`);
        console.log(`   💰 還元: ${result.cashback || '不明'} ${result.cashbackYen ? '(' + result.cashbackYen + ')' : ''}`);
        console.log(`   📱 デバイス: ${result.device}`);
        console.log(`   🔗 URL: ${result.url}`);
        if (result.method) {
          console.log(`   📝 条件: ${result.method.substring(0, 80)}${result.method.length > 80 ? '...' : ''}`);
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
  const tester = new ImprovedSampleTester();
  await tester.run();
})();