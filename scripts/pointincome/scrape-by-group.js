const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class PointIncomeGroupScraper {
  constructor(groupId, groupName) {
    this.baseUrl = 'https://pointi.jp';
    this.groupId = groupId;
    this.groupName = groupName;
    this.results = [];
    this.browser = null;
    this.processedUrls = new Set();
    this.processedCount = 0;
    this.errorCount = 0;
  }

  async init() {
    console.log(`🚀 ポイントインカム「${this.groupName}」グループスクレイピング開始`);
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  }

  async setupPage() {
    const page = await this.browser.newPage();
    
    // 画像の読み込みを無効化
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (['image', 'font', 'stylesheet'].includes(request.resourceType())) {
        request.abort();
      } else {
        request.continue();
      }
    });

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

  async scrapeList() {
    const page = await this.setupPage();
    
    try {
      const listUrl = `${this.baseUrl}/list.php?group=${this.groupId}`;
      console.log(`📂 アクセス: ${listUrl}`);
      
      await page.goto(listUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      
      let allCampaignLinks = [];
      let pageNum = 1;
      let hasNextPage = true;
      
      // 最大5ページまで
      while (hasNextPage && pageNum <= 5) {
        console.log(`  📄 ページ ${pageNum} を処理中...`);
        
        const campaignLinks = await page.$$eval('.box_ad_inner a[href*="/ad/"]', links => {
          return links.map(link => ({
            url: link.href,
            title: link.querySelector('img') ? link.querySelector('img').alt : ''
          }));
        });
        
        allCampaignLinks = allCampaignLinks.concat(campaignLinks);
        console.log(`  ✅ ${campaignLinks.length}件の案件を発見（合計: ${allCampaignLinks.length}件）`);
        
        // 次のページ確認
        const nextPageExists = await page.$('.pager a[href*="page=' + (pageNum + 1) + '"]');
        if (nextPageExists && pageNum < 5) {
          pageNum++;
          const nextPageUrl = `${listUrl}&page=${pageNum}`;
          await page.goto(nextPageUrl, { waitUntil: 'networkidle2' });
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          hasNextPage = false;
        }
      }
      
      console.log(`📊 ${allCampaignLinks.length}件の案件を処理開始`);
      
      // 詳細ページ処理（最大30件）
      const maxItems = Math.min(allCampaignLinks.length, 30);
      
      for (let i = 0; i < maxItems; i++) {
        const campaign = allCampaignLinks[i];
        
        try {
          const detailData = await this.scrapeCampaignDetail(campaign.url);
          if (detailData) {
            this.results.push({
              ...detailData,
              category: this.groupName,
              categoryType: 'group',
              device: 'PC'
            });
            this.processedCount++;
            
            console.log(`✅ [${this.processedCount}/${maxItems}] ${detailData.title}`);
          }
        } catch (error) {
          console.error(`❌ エラー: ${campaign.url}`, error.message);
          this.errorCount++;
        }
        
        // レート制限
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      
    } catch (error) {
      console.error(`❌ リストエラー:`, error);
    } finally {
      await page.close();
    }
  }

  async scrapeCampaignDetail(url) {
    const page = await this.setupPage();
    
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const detailData = await page.evaluate(() => {
        const data = {
          title: '',
          percentText: '',
          yenText: ''
        };
        
        // タイトル
        const titleEl = document.querySelector('h2');
        if (titleEl) {
          data.title = titleEl.textContent.trim();
        }
        
        // パーセント還元
        const percentEl = document.querySelector('.ad_pt.red.bold');
        if (percentEl) {
          data.percentText = percentEl.textContent.trim();
        }
        
        // 円分表記
        const yenEl = document.querySelector('.pt_yen.bold');
        if (yenEl) {
          data.yenText = yenEl.textContent.trim();
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
        cashbackYen = this.extractCashbackFromYen(detailData.yenText);
      }
      
      if (!detailData.title || (!cashback && !cashbackYen)) {
        return null;
      }
      
      return {
        id: id,
        title: detailData.title,
        url: url,
        campaignUrl: url,
        pointSiteUrl: 'https://pointi.jp',
        cashback: cashback,
        cashbackYen: cashbackYen,
        lastUpdated: new Date().toLocaleString('ja-JP'),
        siteName: 'ポイントインカム',
        searchKeywords: detailData.title.toLowerCase(),
        searchWeight: 1
      };
      
    } catch (error) {
      return null;
    } finally {
      await page.close();
    }
  }

  async saveResults() {
    const data = {
      siteName: 'ポイントインカム',
      groupName: this.groupName,
      groupId: this.groupId,
      scrapedAt: new Date().toISOString(),
      summary: {
        total_campaigns: this.results.length,
        total_processed: this.processedCount,
        errors: this.errorCount
      },
      campaigns: this.results
    };

    const filename = `pointincome_group_${this.groupId}_${this.groupName.replace(/[・\/]/g, '_')}.json`;
    await fs.writeFile(
      filename,
      JSON.stringify(data, null, 2),
      'utf8'
    );
    
    console.log(`\n💾 保存完了: ${filename}`);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async run() {
    try {
      await this.init();
      await this.scrapeList();
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
  // コマンドライン引数からグループを取得
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('使用方法: node scrape-by-group.js <グループID> <グループ名>');
    console.log('例: node scrape-by-group.js 65 "EC・ネットショッピング"');
    process.exit(1);
  }
  
  const groupId = parseInt(args[0]);
  const groupName = args[1];
  
  const scraper = new PointIncomeGroupScraper(groupId, groupName);
  await scraper.run();
})();