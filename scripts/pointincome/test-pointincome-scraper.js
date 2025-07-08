const puppeteer = require('puppeteer');
const fs = require('fs').promises;

// テスト用：1カテゴリ、5件まで
class PointIncomeTestScraper {
  constructor() {
    this.baseUrl = 'https://pointi.jp';
    this.results = [];
    this.browser = null;
    this.maxItems = 5; // テスト用に5件まで
  }

  async init() {
    console.log('🧪 ポイントインカムテストスクレイピング開始（最大5件）');
    
    this.browser = await puppeteer.launch({
      headless: false, // デバッグ用に表示
      args: ['--no-sandbox']
    });
  }

  async setupPage() {
    const page = await this.browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    return page;
  }

  extractCashbackFromYen(yenText) {
    if (!yenText) return null;
    const match = yenText.match(/[(（](\d{1,3}(?:,\d{3})*(?:\.\d+)?)円分[)）]/);
    if (match) {
      return match[1].replace(/,/g, '') + '円';
    }
    return null;
  }

  async run() {
    try {
      await this.init();
      const page = await this.setupPage();
      
      // 即追加カテゴリ（ID: 69）をテスト
      const listUrl = `${this.baseUrl}/list.php?category=69`;
      console.log(`\n📂 テストカテゴリアクセス: ${listUrl}`);
      
      await page.goto(listUrl, { waitUntil: 'networkidle2' });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 案件リンクを取得（最大5件）
      const campaignLinks = await page.$$eval('.box_ad_inner a[href*="/ad/"]', (links, max) => {
        return links.slice(0, max).map(link => ({
          url: link.href,
          imgAlt: link.querySelector('img') ? link.querySelector('img').alt : ''
        }));
      }, this.maxItems);
      
      console.log(`📊 ${campaignLinks.length}件の案件をテスト処理`);
      
      // 各案件の詳細を取得
      for (let i = 0; i < campaignLinks.length; i++) {
        const campaign = campaignLinks[i];
        console.log(`\n🔍 案件 ${i + 1}/${campaignLinks.length}: ${campaign.url}`);
        
        await page.goto(campaign.url, { waitUntil: 'networkidle2' });
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 詳細情報を取得
        const detailData = await page.evaluate(() => {
          const data = {
            title: '',
            pointText: '',
            yenText: '',
            fullPointText: ''
          };
          
          // タイトル
          const titleEl = document.querySelector('h2');
          if (titleEl) {
            data.title = titleEl.textContent.trim();
          }
          
          // ポイント表示部分を探す
          // 500pt (50円分) のような表示を探す
          const allElements = Array.from(document.querySelectorAll('*'));
          for (const el of allElements) {
            const text = el.textContent.trim();
            if (text.match(/^\d+pt\s*[(（]\d+円分[)）]$/) && el.children.length === 0) {
              data.fullPointText = text;
              break;
            }
          }
          
          // 円分表記を個別に探す
          const yenEl = document.querySelector('.pt_yen.bold');
          if (yenEl) {
            data.yenText = yenEl.textContent.trim();
          }
          
          // デバッグ用：ページ内のテキスト抜粋
          data.pageText = document.body.textContent.substring(0, 500);
          
          return data;
        });
        
        console.log('  タイトル:', detailData.title);
        console.log('  ポイント表記:', detailData.fullPointText || '見つかりません');
        console.log('  円分表記:', detailData.yenText || '見つかりません');
        
        // データ解析
        let cashback = null;
        let cashbackYen = null;
        
        if (detailData.fullPointText) {
          const ptMatch = detailData.fullPointText.match(/(\d+)pt/);
          const yenMatch = detailData.fullPointText.match(/[(（](\d+(?:,\d{3})*)円分[)）]/);
          
          if (ptMatch) {
            cashback = ptMatch[1] + 'ポイント';
          }
          if (yenMatch) {
            cashbackYen = yenMatch[1].replace(/,/g, '') + '円';
          }
        } else if (detailData.yenText) {
          cashbackYen = this.extractCashbackFromYen(detailData.yenText);
        }
        
        const idMatch = campaign.url.match(/\/ad\/(\d+)/);
        const id = idMatch ? `pi_${idMatch[1]}` : `pi_${Date.now()}`;
        
        this.results.push({
          id: id,
          title: detailData.title,
          url: campaign.url,
          cashback: cashback,
          cashbackYen: cashbackYen,
          siteName: 'ポイントインカム',
          device: 'PC',
          category: '即追加',
          lastUpdated: new Date().toLocaleString('ja-JP')
        });
        
        console.log('  ✅ データ取得成功');
        
        // 待機
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      await page.close();
      
      // 結果を保存
      const data = {
        siteName: 'ポイントインカム',
        testRun: true,
        scrapedAt: new Date().toISOString(),
        summary: {
          total_campaigns: this.results.length
        },
        campaigns: this.results
      };
      
      await fs.writeFile(
        'pointincome_test_results.json',
        JSON.stringify(data, null, 2),
        'utf8'
      );
      
      console.log('\n✅ テスト完了！');
      console.log(`📊 取得件数: ${this.results.length}件`);
      console.log('\n結果例:');
      this.results.slice(0, 3).forEach((result, i) => {
        console.log(`${i + 1}. ${result.title}`);
        console.log(`   還元: ${result.cashbackYen || result.cashback || '不明'}`);
      });
      
    } catch (error) {
      console.error('❌ エラー:', error);
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

// 実行
(async () => {
  const scraper = new PointIncomeTestScraper();
  await scraper.run();
})();