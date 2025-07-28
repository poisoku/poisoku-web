const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class ServiceCategoriesScraper {
  constructor() {
    this.baseUrl = 'https://pointi.jp';
    this.results = [];
    this.browser = null;
    this.processedUrls = new Set();
    this.rateLimitMs = 2500;
    this.maxPagesPerGroup = 20;
    
    // ユーザーから提供されたサービス系カテゴリID
    this.serviceCategories = [
      { name: 'カテゴリID70', id: 70, type: 'category' },
      { name: 'カテゴリID75', id: 75, type: 'category' },
      { name: 'カテゴリID281', id: 281, type: 'category' },
      { name: 'カテゴリID73', id: 73, type: 'category' },
      { name: 'カテゴリID74', id: 74, type: 'category' },
      { name: 'カテゴリID276', id: 276, type: 'category' },
      { name: 'カテゴリID78', id: 78, type: 'category' },
      { name: 'カテゴリID235', id: 235, type: 'category' },
      { name: 'カテゴリID79', id: 79, type: 'category' },
      { name: 'カテゴリID240', id: 240, type: 'category' },
      { name: 'カテゴリID72', id: 72, type: 'category' },
      { name: 'カテゴリID76', id: 76, type: 'category' },
      { name: 'カテゴリID81', id: 81, type: 'category' },
      { name: 'カテゴリID274', id: 274, type: 'category' },
      { name: 'カテゴリID237', id: 237, type: 'category' },
      { name: 'カテゴリID209', id: 209, type: 'category' },
      { name: 'カテゴリID271', id: 271, type: 'category' },
      { name: 'カテゴリID232', id: 232, type: 'category' },
      { name: 'カテゴリID269', id: 269, type: 'category' },
      { name: 'カテゴリID234', id: 234, type: 'category' },
      { name: 'カテゴリID238', id: 238, type: 'category' },
      { name: 'カテゴリID280', id: 280, type: 'category' },
      { name: 'カテゴリID272', id: 272, type: 'category' },
      { name: 'カテゴリID278', id: 278, type: 'category' },
      { name: 'カテゴリID277', id: 277, type: 'category' },
      { name: 'カテゴリID283', id: 283, type: 'category' },
      { name: 'カテゴリID279', id: 279, type: 'category' },
      { name: 'カテゴリID77', id: 77, type: 'category' },
      { name: 'カテゴリID236', id: 236, type: 'category' },
      { name: 'カテゴリID270', id: 270, type: 'category' },
      { name: 'カテゴリID82', id: 82, type: 'category' }
    ];
  }

  async init() {
    console.log('🏭 ポイントインカム サービス系カテゴリスクレイピング開始');
    console.log(`📋 ${this.serviceCategories.length}カテゴリを処理予定`);
    console.log(`⏱️ レート制限: ${this.rateLimitMs / 1000}秒間隔\n`);
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      defaultViewport: { width: 1920, height: 1080 }
    });
  }

  async setupPage() {
    const page = await this.browser.newPage();
    
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

  extractCashbackFromYen(yenText) {
    if (!yenText) return null;
    const match = yenText.match(/[(（](\d{1,3}(?:,\d{3})*(?:\.\d+)?)円分[)）]/);
    if (match) {
      return match[1].replace(/,/g, '') + '円';
    }
    return null;
  }

  async scrapeCategory(category) {
    const page = await this.setupPage();
    console.log(`📂 カテゴリ「${category.name}」(ID: ${category.id})の処理開始`);
    
    try {
      let allCampaignLinks = [];
      let pageNum = 1;
      let hasNextPage = true;
      let detectedCategoryName = null;
      
      // 1ページ目にアクセス
      const firstUrl = `${this.baseUrl}/list.php?category=${category.id}`;
      console.log(`  🌐 URL: ${firstUrl}`);
      await page.goto(firstUrl, { waitUntil: 'networkidle2', timeout: this.pageTimeoutMs });
      await this.sleep(2000);
      
      // カテゴリ名を検出
      try {
        detectedCategoryName = await page.evaluate(() => {
          const breadcrumb = document.querySelector('.breadcrumb li:last-child');
          const h1 = document.querySelector('h1');
          
          if (breadcrumb && breadcrumb.textContent) {
            return breadcrumb.textContent.trim();
          } else if (h1) {
            const h1Text = h1.textContent.trim();
            // 「一覧」を除去
            return h1Text.replace(/一覧$/, '').trim();
          }
          return null;
        });
        
        if (detectedCategoryName) {
          console.log(`  📝 カテゴリ名検出: ${detectedCategoryName}`);
        }
      } catch (error) {
        console.log(`  ⚠️ カテゴリ名検出失敗`);
      }
      
      while (hasNextPage && pageNum <= this.maxPagesPerGroup) {
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
          
          const nextPageNum = currentPage + 1;
          for (let link of pagerLinks) {
            const text = link.textContent.trim();
            if (text === String(nextPageNum)) {
              nextButton = link;
              break;
            }
          }
          
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
        
        await this.sleep(3000);
        
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
      
      console.log(`📊 カテゴリ「${detectedCategoryName || category.name}」: ${uniqueLinks.length}件の案件を詳細取得開始`);
      
      // 詳細ページ処理（最初の50件のみ）
      const limitedLinks = uniqueLinks.slice(0, 50);
      for (let i = 0; i < limitedLinks.length; i++) {
        const campaign = limitedLinks[i];
        
        if (this.processedUrls.has(campaign.url)) {
          continue;
        }
        
        try {
          const detailData = await this.scrapeCampaignDetail(campaign.url);
          if (detailData) {
            this.results.push({
              ...detailData,
              category: detectedCategoryName || category.name,
              categoryId: category.id,
              categoryType: 'category',
              device: 'PC'
            });
            this.processedUrls.add(campaign.url);
            
            console.log(`✅ [${i + 1}/${limitedLinks.length}] ${detailData.title} - ${detailData.cashback || detailData.cashbackYen || '不明'}`);
          }
        } catch (error) {
          console.error(`❌ [${i + 1}/${limitedLinks.length}] 詳細エラー: ${campaign.url}`);
        }
        
        await this.sleep(this.rateLimitMs);
      }
      
      return {
        categoryName: detectedCategoryName || category.name,
        totalCampaigns: uniqueLinks.length,
        processedCampaigns: limitedLinks.length
      };
      
    } catch (error) {
      console.error(`❌ カテゴリ処理エラー: ${category.name}`, error);
      throw error;
    } finally {
      await page.close();
    }
  }

  async scrapeCampaignDetail(url) {
    const page = await this.setupPage();
    
    try {
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: this.pageTimeoutMs 
      });
      
      await this.sleep(1000);
      
      const detailData = await page.evaluate(() => {
        const data = {
          title: '',
          percentText: '',
          yenText: '',
          conditions: ''
        };
        
        const titleEl = document.querySelector('h2');
        if (titleEl) {
          data.title = titleEl.textContent.trim();
        }
        
        const percentEl = document.querySelector('.ad_pt.red.bold');
        if (percentEl) {
          data.percentText = percentEl.textContent.trim();
        }
        
        const yenEl = document.querySelector('.pt_yen.bold');
        if (yenEl) {
          data.yenText = yenEl.textContent.trim();
        }
        
        const conditionEl = document.querySelector('.box_point_joken');
        if (conditionEl) {
          data.conditions = conditionEl.textContent.trim().substring(0, 500);
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
        description: detailData.title,
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
      throw new Error(`詳細ページ取得失敗: ${error.message}`);
    } finally {
      await page.close();
    }
  }

  async saveResults() {
    const data = {
      siteName: 'ポイントインカム',
      scrapingType: 'service-categories',
      scrapedAt: new Date().toISOString(),
      summary: {
        total_campaigns: this.results.length,
        categories_processed: this.serviceCategories.length
      },
      campaigns: this.results
    };

    await fs.writeFile(
      'pointincome_service_categories.json',
      JSON.stringify(data, null, 2),
      'utf8'
    );

    console.log(`\n💾 データ保存完了: pointincome_service_categories.json`);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async run() {
    const startTime = Date.now();
    
    try {
      await this.init();
      
      const categoryInfo = [];
      
      // 各カテゴリを順次処理
      for (let i = 0; i < this.serviceCategories.length; i++) {
        const category = this.serviceCategories[i];
        console.log(`\n🔧 [${i + 1}/${this.serviceCategories.length}] カテゴリ処理開始: ${category.name}`);
        
        try {
          const result = await this.scrapeCategory(category);
          categoryInfo.push({
            id: category.id,
            name: result.categoryName,
            totalCampaigns: result.totalCampaigns,
            processedCampaigns: result.processedCampaigns
          });
        } catch (error) {
          console.error(`❌ カテゴリスキップ: ${category.name}`);
        }
        
        // カテゴリ間の待機時間
        if (i < this.serviceCategories.length - 1) {
          console.log(`⏸️ カテゴリ間待機中...`);
          await this.sleep(5000);
        }
      }
      
      // 最終保存
      await this.saveResults();
      
      const endTime = Date.now();
      const durationMinutes = Math.round((endTime - startTime) / 60000);
      
      console.log('\n🎉 サービス系カテゴリスクレイピング完了！');
      console.log(`📊 総案件数: ${this.results.length}件`);
      console.log(`⏱️ 実行時間: ${durationMinutes}分`);
      
      console.log('\n📋 検出されたカテゴリ名:');
      categoryInfo.forEach(info => {
        console.log(`  ID ${info.id}: ${info.name} (${info.totalCampaigns}件中${info.processedCampaigns}件処理)`);
      });
      
    } catch (error) {
      console.error('❌ 致命的エラー:', error);
    } finally {
      await this.close();
    }
  }
}

// 実行
(async () => {
  const scraper = new ServiceCategoriesScraper();
  await scraper.run();
})();