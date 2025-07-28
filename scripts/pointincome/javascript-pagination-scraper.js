const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class JavaScriptPaginationScraper {
  constructor() {
    this.baseUrl = 'https://pointi.jp';
    this.results = [];
    this.browser = null;
    this.processedUrls = new Set();
    this.rateLimitMs = 2500;
    this.maxPagesPerGroup = 20;
    
    // テスト用の1グループのみ
    this.testGroups = [
      { name: 'ファッション', id: 152 }
    ];
  }

  async init() {
    console.log('🧪 JavaScript ページネーション対応スクレイピング開始');
    console.log(`📋 ${this.testGroups.length}グループをテスト予定\n`);
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      defaultViewport: { width: 1920, height: 1080 }
    });
  }

  async setupPage() {
    const page = await this.browser.newPage();
    
    // リソース制限
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['image', 'font', 'stylesheet', 'media'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    page.setDefaultTimeout(45000);
    
    return page;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async scrapeGroup(group) {
    const page = await this.setupPage();
    console.log(`📂 グループ「${group.name}」の処理開始`);
    
    try {
      let allCampaignLinks = [];
      let pageNum = 1;
      
      // 1ページ目にアクセス
      const firstUrl = `${this.baseUrl}/list.php?group=${group.id}`;
      await page.goto(firstUrl, { waitUntil: 'networkidle2' });
      await this.sleep(2000);
      
      while (pageNum <= this.maxPagesPerGroup) {
        console.log(`  📄 ページ ${pageNum} を処理中...`);
        
        // 案件リンクを取得
        const campaignLinks = await page.$$eval('.box_ad_inner a[href*="/ad/"]', links => {
          return links.map(link => ({
            url: link.href,
            title: link.querySelector('img') ? link.querySelector('img').alt : ''
          }));
        });
        
        if (campaignLinks.length === 0) {
          console.log(`    ⚠️ 案件が見つかりません - ページ終了`);
          break;
        }
        
        console.log(`    ✅ ${campaignLinks.length}件発見`);
        console.log(`    🔗 最初: ${campaignLinks[0]?.url?.split('/').pop()}`);
        console.log(`    🔗 最後: ${campaignLinks[campaignLinks.length - 1]?.url?.split('/').pop()}`);
        
        allCampaignLinks = allCampaignLinks.concat(campaignLinks);
        
        // 次ページボタンの確認とクリック
        const nextPageResult = await page.evaluate((currentPage) => {
          const pagerLinks = document.querySelectorAll('.pager a');
          let nextButton = null;
          
          // 現在のページ + 1 のボタンを探す
          const nextPageNum = currentPage + 1;
          for (let link of pagerLinks) {
            const text = link.textContent.trim();
            if (text === String(nextPageNum)) {
              nextButton = link;
              break;
            }
          }
          
          // 見つからない場合は「次へ>」ボタンを探す
          if (!nextButton) {
            for (let link of pagerLinks) {
              const text = link.textContent.trim();
              if (text.includes('次へ') || text === '>') {
                nextButton = link;
                break;
              }
            }
          }
          
          if (nextButton && nextButton.onclick) {
            try {
              nextButton.click();
              return { success: true, buttonText: nextButton.textContent.trim() };
            } catch (error) {
              return { success: false, error: error.message };
            }
          }
          
          return { success: false, reason: 'no_button' };
        }, pageNum);
        
        console.log(`    📖 次ページクリック: ${nextPageResult.success ? `成功 (${nextPageResult.buttonText})` : `失敗 (${nextPageResult.reason || nextPageResult.error})`}`);
        
        if (!nextPageResult.success) {
          console.log(`    📝 最終ページ ${pageNum} で終了`);
          break;
        }
        
        // ページの変更を待機
        await this.sleep(3000);
        
        // ページが実際に変わったかチェック
        const newPageCampaigns = await page.$$eval('.box_ad_inner a[href*="/ad/"]', links => {
          return links.map(link => link.href);
        });
        
        // 前のページと同じ内容かチェック
        const previousPageLastUrl = campaignLinks[campaignLinks.length - 1]?.url;
        const newPageLastUrl = newPageCampaigns[newPageCampaigns.length - 1];
        
        if (previousPageLastUrl === newPageLastUrl) {
          console.log(`    ⚠️ ページ内容が変わらず - 最終ページ ${pageNum} で終了`);
          break;
        }
        
        pageNum++;
        await this.sleep(this.rateLimitMs);
      }
      
      // 重複除去
      const uniqueLinks = Array.from(
        new Map(allCampaignLinks.map(link => [link.url, link])).values()
      );
      
      console.log(`📊 グループ「${group.name}」: ${pageNum}ページ処理、総計${allCampaignLinks.length}件 → 重複除去後${uniqueLinks.length}件`);
      
      return uniqueLinks;
      
    } catch (error) {
      console.error(`❌ グループ処理エラー: ${group.name}`, error);
      throw error;
    } finally {
      await page.close();
    }
  }

  async run() {
    const startTime = Date.now();
    
    try {
      await this.init();
      
      const allResults = [];
      
      for (const group of this.testGroups) {
        console.log(`\n🏪 グループ処理開始: ${group.name}`);
        const groupResults = await this.scrapeGroup(group);
        
        groupResults.forEach(campaign => {
          allResults.push({
            ...campaign,
            category: group.name,
            categoryType: 'group',
            device: 'PC',
            siteName: 'ポイントインカム',
            lastUpdated: new Date().toLocaleString('ja-JP')
          });
        });
      }
      
      // 結果を保存
      const data = {
        siteName: 'ポイントインカム',
        scrapingType: 'javascript-pagination-test',
        scrapedAt: new Date().toISOString(),
        summary: {
          total_campaigns: allResults.length,
          groups_processed: this.testGroups.length
        },
        campaigns: allResults
      };

      await fs.writeFile(
        'pointincome_javascript_pagination_test.json',
        JSON.stringify(data, null, 2),
        'utf8'
      );

      const endTime = Date.now();
      const durationMinutes = Math.round((endTime - startTime) / 60000);
      
      console.log('\n🎉 JavaScript ページネーションテスト完了！');
      console.log(`📊 総案件数: ${allResults.length}件`);
      console.log(`⏱️ 実行時間: ${durationMinutes}分`);
      console.log(`💾 保存先: pointincome_javascript_pagination_test.json`);
      
    } catch (error) {
      console.error('❌ 致命的エラー:', error);
    } finally {
      await this.close();
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// 実行
(async () => {
  const scraper = new JavaScriptPaginationScraper();
  await scraper.run();
})();