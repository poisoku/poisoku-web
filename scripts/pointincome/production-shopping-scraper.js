const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class PointIncomeProductionScraper {
  constructor() {
    this.baseUrl = 'https://pointi.jp';
    this.results = [];
    this.browser = null;
    this.processedUrls = new Set();
    this.processedCount = 0;
    this.errorCount = 0;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.lastPageLastUrl = null;
    
    // 本番用設定
    this.rateLimitMs = 2500; // 2.5秒間隔（サーバー負荷軽減）
    this.pageTimeoutMs = 45000; // 45秒タイムアウト
    this.maxPagesPerGroup = 20; // 最大20ページまで
    
    // ショッピンググループ一覧（group パラメータ）
    this.shoppingGroups = [
      { name: 'EC・ネットショッピング', id: 65, type: 'group' },
      { name: 'ファッション', id: 152, type: 'group' },
      { name: 'グルメ', id: 154, type: 'group' },
      { name: '美容', id: 148, type: 'group' },
      { name: '衛生用品', id: 147, type: 'group' },
      { name: 'エンタメ・家電', id: 151, type: 'group' },
      { name: '住まい・暮らし', id: 155, type: 'group' },
      { name: 'その他（ショッピング）', id: 153, type: 'group' }
    ];
    
    // サービスカテゴリ一覧（category パラメータ）- ユーザー提供のID
    this.serviceCategories = [
      { name: 'サービスカテゴリ70', id: 70, type: 'category' },
      { name: 'サービスカテゴリ75', id: 75, type: 'category' },
      { name: 'サービスカテゴリ281', id: 281, type: 'category' },
      { name: 'サービスカテゴリ73', id: 73, type: 'category' },
      { name: 'サービスカテゴリ74', id: 74, type: 'category' },
      { name: 'サービスカテゴリ276', id: 276, type: 'category' },
      { name: 'サービスカテゴリ78', id: 78, type: 'category' },
      { name: 'サービスカテゴリ235', id: 235, type: 'category' },
      { name: 'サービスカテゴリ79', id: 79, type: 'category' },
      { name: 'サービスカテゴリ240', id: 240, type: 'category' },
      { name: 'サービスカテゴリ72', id: 72, type: 'category' },
      { name: 'サービスカテゴリ76', id: 76, type: 'category' },
      { name: 'サービスカテゴリ81', id: 81, type: 'category' },
      { name: 'サービスカテゴリ274', id: 274, type: 'category' },
      { name: 'サービスカテゴリ237', id: 237, type: 'category' },
      { name: 'サービスカテゴリ209', id: 209, type: 'category' },
      { name: 'サービスカテゴリ271', id: 271, type: 'category' },
      { name: 'サービスカテゴリ232', id: 232, type: 'category' },
      { name: 'サービスカテゴリ269', id: 269, type: 'category' },
      { name: 'サービスカテゴリ234', id: 234, type: 'category' },
      { name: 'サービスカテゴリ238', id: 238, type: 'category' },
      { name: 'サービスカテゴリ280', id: 280, type: 'category' },
      { name: 'サービスカテゴリ272', id: 272, type: 'category' },
      { name: 'サービスカテゴリ278', id: 278, type: 'category' },
      { name: 'サービスカテゴリ277', id: 277, type: 'category' },
      { name: 'サービスカテゴリ283', id: 283, type: 'category' },
      { name: 'サービスカテゴリ279', id: 279, type: 'category' },
      { name: 'サービスカテゴリ77', id: 77, type: 'category' },
      { name: 'サービスカテゴリ236', id: 236, type: 'category' },
      { name: 'サービスカテゴリ270', id: 270, type: 'category' },
      { name: 'サービスカテゴリ82', id: 82, type: 'category' }
    ];
    
    // 全カテゴリを統合
    this.allCategories = [...this.shoppingGroups, ...this.serviceCategories];
  }

  async init() {
    console.log('🏭 ポイントインカム本番用全カテゴリスクレイピング開始');
    console.log(`📋 ショッピング${this.shoppingGroups.length}グループ + サービス${this.serviceCategories.length}カテゴリ × 最大${this.maxPagesPerGroup}ページを処理予定`);
    console.log(`📊 総計${this.allCategories.length}カテゴリを処理`);
    console.log(`⏱️ レート制限: ${this.rateLimitMs / 1000}秒間隔\n`);
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ],
      defaultViewport: {
        width: 1920,
        height: 1080
      }
    });
  }

  async setupPage() {
    const page = await this.browser.newPage();
    
    // リソース制限（本番用最適化）
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['image', 'font', 'stylesheet', 'media'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // 適切なUser-Agent設定
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // タイムアウト設定
    page.setDefaultTimeout(this.pageTimeoutMs);
    page.setDefaultNavigationTimeout(this.pageTimeoutMs);
    
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

  async scrapeGroupWithRetry(group, retryAttempt = 0) {
    try {
      await this.scrapeGroup(group);
    } catch (error) {
      console.error(`❌ グループ「${group.name}」でエラー: ${error.message}`);
      
      if (retryAttempt < this.maxRetries) {
        console.log(`🔄 ${retryAttempt + 1}回目のリトライを実行中...`);
        await this.sleep(5000 * (retryAttempt + 1)); // 指数バックオフ
        await this.scrapeGroupWithRetry(group, retryAttempt + 1);
      } else {
        console.error(`❌ グループ「${group.name}」を${this.maxRetries}回試行して失敗`);
        this.errorCount++;
      }
    }
  }

  async scrapeGroup(group) {
    const page = await this.setupPage();
    console.log(`\n📂 グループ「${group.name}」の処理開始`);
    
    try {
      let allCampaignLinks = [];
      let pageNum = 1;
      let hasNextPage = true;
      
      // 全ページを取得（JavaScript ページネーション対応）
      // 1ページ目にアクセス（カテゴリタイプに応じてURL構築）
      const firstUrl = group.type === 'group' 
        ? `${this.baseUrl}/list.php?group=${group.id}`
        : `${this.baseUrl}/list.php?category=${group.id}`;
      
      console.log(`  🌐 URL: ${firstUrl}`);
      await page.goto(firstUrl, { waitUntil: 'networkidle2', timeout: this.pageTimeoutMs });
      await this.sleep(2000);
      
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
        
        console.log(`    📖 次ページクリック: ${nextPageResult.success ? `成功 (${nextPageResult.buttonText})` : `失敗 - ページ終了`}`);
        
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
      
      console.log(`📊 グループ「${group.name}」: ${allCampaignLinks.length}件の案件を詳細取得開始`);
      
      // 重複除去
      const uniqueLinks = Array.from(
        new Map(allCampaignLinks.map(link => [link.url, link])).values()
      );
      
      console.log(`🔍 重複除去後: ${uniqueLinks.length}件`);
      
      // 詳細ページ処理
      for (let i = 0; i < uniqueLinks.length; i++) {
        const campaign = uniqueLinks[i];
        
        if (this.processedUrls.has(campaign.url)) {
          console.log(`⏭️ [${i + 1}/${uniqueLinks.length}] スキップ（処理済み）`);
          continue;
        }
        
        try {
          const detailData = await this.scrapeCampaignDetailWithRetry(campaign.url);
          if (detailData) {
            // デバイス分類ルール適用
            let device = 'すべて'; // デフォルト
            const title = detailData.title.toLowerCase();
            
            if (title.includes('ios用') || title.includes('iphone') || title.includes('ipad') || title.includes('app store')) {
              device = 'iOS';
            } else if (title.includes('android用') || title.includes('google play') || title.includes('アンドロイド')) {
              device = 'Android';
            } else if (title.includes('pcのみ') || title.includes('pc限定') || title.includes('パソコン限定')) {
              device = 'PC';
            }
            
            this.results.push({
              ...detailData,
              category: group.name,
              categoryType: 'group',
              device: device
            });
            this.processedUrls.add(campaign.url);
            this.processedCount++;
            
            console.log(`✅ [${i + 1}/${uniqueLinks.length}] ${detailData.title} - ${detailData.cashback || detailData.cashbackYen || '不明'}`);
          } else {
            console.log(`⚠️ [${i + 1}/${uniqueLinks.length}] データ不完全: ${campaign.url}`);
          }
        } catch (error) {
          console.error(`❌ [${i + 1}/${uniqueLinks.length}] 詳細エラー: ${campaign.url} - ${error.message}`);
          this.errorCount++;
        }
        
        // レート制限
        await this.sleep(this.rateLimitMs);
        
        // 進捗保存（50件ごと）
        if (this.processedCount > 0 && this.processedCount % 50 === 0) {
          await this.saveIntermediateResults();
          console.log(`💾 中間保存完了（${this.processedCount}件）`);
        }
      }
      
    } catch (error) {
      console.error(`❌ グループ処理エラー: ${group.name}`, error);
      throw error;
    } finally {
      await page.close();
    }
  }

  async scrapeCampaignDetailWithRetry(url, retryAttempt = 0) {
    try {
      return await this.scrapeCampaignDetail(url);
    } catch (error) {
      if (retryAttempt < this.maxRetries) {
        console.log(`    🔄 詳細ページリトライ ${retryAttempt + 1}/${this.maxRetries}`);
        await this.sleep(2000 * (retryAttempt + 1));
        return await this.scrapeCampaignDetailWithRetry(url, retryAttempt + 1);
      } else {
        throw error;
      }
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
      
      // 詳細情報取得
      const detailData = await page.evaluate(() => {
        const data = {
          title: '',
          percentText: '',
          yenText: '',
          conditions: ''
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
        
        // 成果条件
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
      
      // パーセント還元
      if (detailData.percentText && detailData.percentText.match(/\d+(?:\.\d+)?%/)) {
        cashback = detailData.percentText;
      }
      
      // 円分表記
      if (detailData.yenText) {
        cashbackYen = this.extractCashbackFromYen(detailData.yenText);
      }
      
      // データ検証
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

  async saveIntermediateResults() {
    const data = {
      siteName: 'ポイントインカム',
      scrapingType: 'production-all-categories',
      scrapedAt: new Date().toISOString(),
      isIntermediate: true,
      summary: {
        total_campaigns: this.results.length,
        total_processed: this.processedCount,
        errors: this.errorCount,
        categories: this.allCategories.length
      },
      campaigns: this.results
    };

    await fs.writeFile(
      'pointincome_shopping_intermediate.json',
      JSON.stringify(data, null, 2),
      'utf8'
    );
  }

  async saveResults() {
    const data = {
      siteName: 'ポイントインカム',
      scrapingType: 'production-all-categories',
      scrapedAt: new Date().toISOString(),
      isComplete: true,
      summary: {
        total_campaigns: this.results.length,
        total_processed: this.processedCount,
        errors: this.errorCount,
        categories_processed: this.allCategories.length,
        shopping_groups: this.shoppingGroups.length,
        service_categories: this.serviceCategories.length,
        rate_limit_ms: this.rateLimitMs,
        max_pages_per_group: this.maxPagesPerGroup
      },
      campaigns: this.results
    };

    await fs.writeFile(
      'pointincome_all_categories_production.json',
      JSON.stringify(data, null, 2),
      'utf8'
    );

    console.log(`\n💾 最終データ保存完了: pointincome_all_categories_production.json`);
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
      
      // 全カテゴリを順次処理
      for (let i = 0; i < this.allCategories.length; i++) {
        const category = this.allCategories[i];
        const typeEmoji = category.type === 'group' ? '🛍️' : '🔧';
        console.log(`\n${typeEmoji} [${i + 1}/${this.allCategories.length}] ${category.type}処理開始: ${category.name}`);
        
        await this.scrapeGroupWithRetry(category);
        
        // カテゴリ間の待機時間
        if (i < this.allCategories.length - 1) {
          console.log(`⏸️ カテゴリ間待機中...`);
          await this.sleep(5000);
        }
      }
      
      // 最終保存
      await this.saveResults();
      
      const endTime = Date.now();
      const durationMinutes = Math.round((endTime - startTime) / 60000);
      
      console.log('\n🎉 本番全カテゴリスクレイピング完了！');
      console.log(`📊 総案件数: ${this.results.length}件`);
      console.log(`✅ 成功数: ${this.processedCount}件`);
      console.log(`❌ エラー数: ${this.errorCount}件`);
      console.log(`⏱️ 実行時間: ${durationMinutes}分`);
      console.log(`📈 成功率: ${((this.processedCount / (this.processedCount + this.errorCount)) * 100).toFixed(1)}%`);
      
    } catch (error) {
      console.error('❌ 致命的エラー:', error);
    } finally {
      await this.close();
    }
  }
}

// 実行
(async () => {
  const scraper = new PointIncomeProductionScraper();
  await scraper.run();
})();