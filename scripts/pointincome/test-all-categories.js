const puppeteer = require('puppeteer');

class TestAllCategoriesScraper {
  constructor() {
    this.baseUrl = 'https://pointi.jp';
    this.rateLimitMs = 2000;
    this.maxPagesPerGroup = 5; // テスト用に短縮
    
    // テスト用の少数カテゴリ
    this.testCategories = [
      { name: 'ファッション', id: 152, type: 'group' },
      { name: 'クレジットカード', id: 69, type: 'category' }
    ];
  }

  async init() {
    console.log('🧪 全カテゴリ対応テスト開始');
    console.log(`📋 ${this.testCategories.length}カテゴリをテスト予定\n`);
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox'],
      defaultViewport: { width: 1920, height: 1080 }
    });
  }

  async setupPage() {
    const page = await this.browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    page.setDefaultTimeout(30000);
    return page;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async testCategory(category) {
    const page = await this.setupPage();
    const typeEmoji = category.type === 'group' ? '🛍️' : '🔧';
    console.log(`${typeEmoji} カテゴリ「${category.name}」(${category.type})のテスト開始`);
    
    try {
      let allCampaignLinks = [];
      let pageNum = 1;
      
      // URL構築
      const firstUrl = category.type === 'group' 
        ? `${this.baseUrl}/list.php?group=${category.id}`
        : `${this.baseUrl}/list.php?category=${category.id}`;
      
      console.log(`  🌐 URL: ${firstUrl}`);
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
        
        allCampaignLinks = allCampaignLinks.concat(campaignLinks);
        console.log(`    ✅ ${campaignLinks.length}件発見（累計: ${allCampaignLinks.length}件）`);
        
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
      
      console.log(`📊 カテゴリ「${category.name}」: ${pageNum}ページ処理、総計${allCampaignLinks.length}件 → 重複除去後${uniqueLinks.length}件`);
      
      return { total: allCampaignLinks.length, unique: uniqueLinks.length, pages: pageNum };
      
    } catch (error) {
      console.error(`❌ カテゴリ「${category.name}」でエラー:`, error.message);
      return { total: 0, unique: 0, pages: 0 };
    } finally {
      await page.close();
    }
  }

  async run() {
    try {
      await this.init();
      
      const results = [];
      
      for (const category of this.testCategories) {
        const result = await this.testCategory(category);
        results.push({ ...category, ...result });
        
        console.log(`⏸️ カテゴリ間待機中...\n`);
        await this.sleep(3000);
      }
      
      console.log('📋 テスト結果まとめ:');
      results.forEach(result => {
        const typeEmoji = result.type === 'group' ? '🛍️' : '🔧';
        console.log(`  ${typeEmoji} ${result.name}: ${result.pages}ページ、${result.total}件 → ${result.unique}件`);
      });
      
      const totalUnique = results.reduce((sum, r) => sum + r.unique, 0);
      console.log(`\n🎉 テスト完了！ 総計${totalUnique}件の案件を取得`);
      
    } catch (error) {
      console.error('❌ 致命的エラー:', error);
    } finally {
      await this.browser.close();
    }
  }
}

new TestAllCategoriesScraper().run();