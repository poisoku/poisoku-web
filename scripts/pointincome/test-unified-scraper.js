const puppeteer = require('puppeteer');
const fs = require('fs').promises;

// テスト用：2グループ、各5件まで
class PointIncomeTestUnifiedScraper {
  constructor() {
    this.baseUrl = 'https://pointi.jp';
    this.results = [];
    this.browser = null;
    this.processedUrls = new Set();
    this.processedCount = 0;
    this.errorCount = 0;
    this.maxItemsPerGroup = 5; // テスト用に各グループ5件まで
    
    // テスト用に2つのグループのみ
    this.testGroups = [
      { name: 'EC・ネットショッピング', type: 'group', id: 65 },
      { name: 'ファッション', type: 'group', id: 152 }
    ];
  }

  async init() {
    console.log('🧪 ポイントインカム統合テストスクレイピング開始');
    console.log(`📋 ${this.testGroups.length}グループ × 最大${this.maxItemsPerGroup}件をテスト`);
    
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

  async scrapeList(listItem) {
    const page = await this.setupPage();
    const itemType = listItem.type === 'category' ? 'カテゴリ' : 'グループ';
    console.log(`\n📂 ${itemType}「${listItem.name}」のテスト開始`);
    
    try {
      const listUrl = `${this.baseUrl}/list.php?${listItem.type}=${listItem.id}`;
      console.log(`  URL: ${listUrl}`);
      
      await page.goto(listUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 案件リンクを取得（最大5件）
      const campaignLinks = await page.$$eval('.box_ad_inner a[href*="/ad/"]', (links, max) => {
        return links.slice(0, max).map(link => ({
          url: link.href,
          imgAlt: link.querySelector('img') ? link.querySelector('img').alt : ''
        }));
      }, this.maxItemsPerGroup);
      
      console.log(`  📊 ${campaignLinks.length}件の案件をテスト処理`);
      
      // 各案件の詳細を取得
      for (let i = 0; i < campaignLinks.length; i++) {
        const campaign = campaignLinks[i];
        
        if (this.processedUrls.has(campaign.url)) {
          console.log(`  ⏭️ スキップ（処理済み）: ${campaign.url}`);
          continue;
        }
        
        console.log(`\n  🔍 案件 ${i + 1}/${campaignLinks.length}: ${campaign.url}`);
        
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
            
            console.log(`    ✅ ${detailData.title}`);
            console.log(`    💰 ${detailData.cashbackYen || detailData.cashback || '不明'}`);
          }
        } catch (error) {
          console.error(`    ❌ エラー:`, error.message);
          this.errorCount++;
        }
        
        // レート制限対策
        await new Promise(resolve => setTimeout(resolve, 2000));
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
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const detailData = await page.evaluate(() => {
        const data = {
          title: '',
          pointText: '',
          yenText: '',
          percentText: '',
          fullText: ''
        };
        
        // タイトル
        const titleEl = document.querySelector('h2');
        if (titleEl) {
          data.title = titleEl.textContent.trim();
        }
        
        // パーセント還元を取得（ショッピング系）
        const percentEl = document.querySelector('.ad_pt.red.bold');
        if (percentEl) {
          data.percentText = percentEl.textContent.trim();
        }
        
        // ポイント表示を探す
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
        
        // ページ内のテキストサンプル（デバッグ用）
        data.fullText = document.body.textContent.substring(0, 300);
        
        return data;
      });
      
      // データ解析
      let cashback = null;
      let cashbackYen = null;
      
      // パーセント還元（ショッピング系）
      if (detailData.percentText && detailData.percentText.match(/\d+(?:\.\d+)?%/)) {
        cashback = detailData.percentText;
      }
      
      // ポイント還元（サービス系）
      if (detailData.fullPointText) {
        const ptMatch = detailData.fullPointText.match(/(\d+)pt/);
        const yenMatch = detailData.fullPointText.match(/[(（](\d+(?:,\d{3})*)円分[)）]/);
        
        if (ptMatch && !cashback) {
          cashback = ptMatch[1] + 'ポイント';
        }
        if (yenMatch) {
          cashbackYen = yenMatch[1].replace(/,/g, '') + '円';
        }
      } else if (detailData.yenText && !cashbackYen) {
        cashbackYen = this.extractCashbackFromYen(detailData.yenText);
      }
      
      const idMatch = url.match(/\/ad\/(\d+)/);
      const id = idMatch ? `pi_${idMatch[1]}` : `pi_${Date.now()}`;
      
      return {
        id: id,
        title: detailData.title || '不明',
        url: url,
        campaignUrl: url,
        pointSiteUrl: 'https://pointi.jp',
        cashback: cashback,
        cashbackYen: cashbackYen,
        lastUpdated: new Date().toLocaleString('ja-JP'),
        siteName: 'ポイントインカム',
        searchKeywords: (detailData.title || '').toLowerCase(),
        searchWeight: 1
      };
      
    } catch (error) {
      console.error(`詳細ページエラー: ${url}`, error.message);
      return null;
    } finally {
      await page.close();
    }
  }

  async saveResults() {
    const data = {
      siteName: 'ポイントインカム',
      testRun: true,
      scrapedAt: new Date().toISOString(),
      summary: {
        total_campaigns: this.results.length,
        total_processed: this.processedCount,
        errors: this.errorCount,
        groups_tested: this.testGroups.length
      },
      campaigns: this.results
    };

    await fs.writeFile(
      'pointincome_unified_test_results.json',
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
      
      // グループをテスト
      for (const group of this.testGroups) {
        await this.scrapeList(group);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      // 結果を保存
      await this.saveResults();
      
      console.log('\n✅ テスト完了！');
      console.log(`📊 取得件数: ${this.results.length}件`);
      console.log(`❌ エラー数: ${this.errorCount}件`);
      
      console.log('\n📋 結果サマリー:');
      const groupSummary = {};
      this.results.forEach(result => {
        if (!groupSummary[result.category]) {
          groupSummary[result.category] = [];
        }
        groupSummary[result.category].push({
          title: result.title,
          cashback: result.cashbackYen || result.cashback || '不明'
        });
      });
      
      for (const [group, items] of Object.entries(groupSummary)) {
        console.log(`\n${group}:`);
        items.slice(0, 3).forEach((item, i) => {
          console.log(`  ${i + 1}. ${item.title}`);
          console.log(`     還元: ${item.cashback}`);
        });
      }
      
    } catch (error) {
      console.error('❌ 致命的エラー:', error);
    } finally {
      await this.close();
    }
  }
}

// 実行
(async () => {
  const scraper = new PointIncomeTestUnifiedScraper();
  await scraper.run();
})();