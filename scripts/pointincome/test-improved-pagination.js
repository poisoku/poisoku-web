const puppeteer = require('puppeteer');

class TestImprovedPagination {
  constructor() {
    this.baseUrl = 'https://pointi.jp';
    this.rateLimitMs = 2000;
    this.maxPagesPerGroup = 20;
    this.lastPageLastUrl = null;
  }

  async testGroup(groupId, groupName) {
    console.log(`\n📂 グループ「${groupName}」のテスト開始`);
    
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox'],
      defaultViewport: { width: 1920, height: 1080 }
    });
    
    try {
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      let allCampaignLinks = [];
      let pageNum = 1;
      let hasNextPage = true;
      
      while (hasNextPage && pageNum <= this.maxPagesPerGroup) {
        console.log(`  📄 ページ ${pageNum} を処理中...`);
        
        const listUrl = pageNum === 1 
          ? `${this.baseUrl}/list.php?group=${groupId}`
          : `${this.baseUrl}/list.php?group=${groupId}&page=${pageNum}`;
        
        await page.goto(listUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 1000));
        
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
        
        // 前ページと同じ内容かチェック
        const lastCampaignUrl = campaignLinks[campaignLinks.length - 1]?.url;
        if (pageNum > 1 && this.lastPageLastUrl === lastCampaignUrl) {
          console.log(`    ⚠️ 前ページと同じ内容 - ページ終了`);
          break;
        }
        this.lastPageLastUrl = lastCampaignUrl;
        
        allCampaignLinks = allCampaignLinks.concat(campaignLinks);
        console.log(`    ✅ ${campaignLinks.length}件発見（累計: ${allCampaignLinks.length}件）`);
        
        // 最大ページ数を動的に確認
        const maxPageInfo = await page.evaluate(() => {
          const pagerLinks = document.querySelectorAll('.pager a');
          let maxPageNum = 0;
          let hasNextButton = false;
          const availablePages = [];
          
          for (let link of pagerLinks) {
            const text = link.textContent.trim();
            
            if (text.match(/^\d+$/)) {
              const num = parseInt(text);
              availablePages.push(num);
              if (num > maxPageNum) {
                maxPageNum = num;
              }
            }
            
            if (text.includes('次へ') || text === '>' || text.toLowerCase().includes('next')) {
              hasNextButton = true;
            }
          }
          
          return { maxPageNum, hasNextButton, availablePages: availablePages.sort((a, b) => a - b) };
        });
        
        console.log(`    📖 最大ページ: ${maxPageInfo.maxPageNum}, 利用可能: [${maxPageInfo.availablePages.join(', ')}], 次ページボタン: ${maxPageInfo.hasNextButton ? 'あり' : 'なし'}`);
        
        // 次ページの存在確認
        if (pageNum < Math.min(this.maxPagesPerGroup, maxPageInfo.maxPageNum) || 
            (maxPageInfo.hasNextButton && maxPageInfo.maxPageNum === 0)) {
          pageNum++;
          await new Promise(resolve => setTimeout(resolve, this.rateLimitMs));
        } else {
          hasNextPage = false;
        }
      }
      
      // 重複除去
      const uniqueLinks = Array.from(
        new Map(allCampaignLinks.map(link => [link.url, link])).values()
      );
      
      console.log(`📊 グループ「${groupName}」: 総計${allCampaignLinks.length}件 → 重複除去後${uniqueLinks.length}件`);
      return { total: allCampaignLinks.length, unique: uniqueLinks.length, pages: pageNum - 1 };
      
    } catch (error) {
      console.error(`❌ グループ「${groupName}」でエラー:`, error.message);
      return { total: 0, unique: 0, pages: 0 };
    } finally {
      await browser.close();
    }
  }

  async run() {
    console.log('🧪 改良版ページネーションテスト開始\n');
    
    const testGroups = [
      { name: 'EC・ネットショッピング', id: 65 },
      { name: 'ファッション', id: 152 }
    ];
    
    const results = [];
    
    for (const group of testGroups) {
      const result = await this.testGroup(group.id, group.name);
      results.push({ ...group, ...result });
    }
    
    console.log('\n📋 テスト結果まとめ:');
    results.forEach(result => {
      console.log(`  ${result.name}: ${result.pages}ページ、${result.total}件 → ${result.unique}件`);
    });
  }
}

new TestImprovedPagination().run();