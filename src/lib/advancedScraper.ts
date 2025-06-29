import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';

export interface AdvancedCampaign {
  name: string;
  cashbackRate: string;
  normalizedCashback: string;
  url: string;
  description?: string;
  siteName: string;
  category: string;
  isPercentage: boolean;
}

export interface AdvancedScrapeResult {
  success: boolean;
  siteName: string;
  campaigns: AdvancedCampaign[];
  errors: string[];
  stats: {
    totalUrls: number;
    totalPagesProcessed: number;
    totalCampaigns: number;
    processingTimeMs: number;
    averageCampaignsPerPage: number;
    targetAchieved: boolean;
    infiniteScrollAttempts: number;
    successfulScrolls: number;
    manualPaginationAttempts: number;
    successfulPageNavigations: number;
  };
  debug: {
    urlsProcessed: string[];
    effectiveSelectors: string[];
    campaignCounts: Record<string, number>;
    scrollingData: Record<string, any>;
    paginationAttempts: Record<string, any>;
    loadingStrategies: Record<string, string>;
  };
}

export class AdvancedScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize(): Promise<void> {
    const args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920x1080',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=VizDisplayCompositor',
      '--ignore-certificate-errors',
      '--ignore-ssl-errors',
      '--disable-web-security',
      '--allow-running-insecure-content'
    ];

    this.browser = await puppeteer.launch({
      headless: true,
      args
    });

    this.page = await this.browser.newPage();
    await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await this.page.setViewport({ width: 1920, height: 1080 });
    
    await this.page.evaluateOnNewDocument(() => {
      delete (navigator as any).webdriver;
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });
      Object.defineProperty(navigator, 'languages', {
        get: () => ['ja-JP', 'ja', 'en-US', 'en']
      });
    });

    await this.page.setDefaultTimeout(90000); // 90秒に延長
    await this.page.setDefaultNavigationTimeout(90000);
  }

  async cleanup(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  // 高度なモッピー全案件取得（無限スクロール＋手動ページネーション）
  async scrapeAllMoppyAdvanced(): Promise<AdvancedScrapeResult> {
    const startTime = Date.now();
    const result: AdvancedScrapeResult = {
      success: false,
      siteName: 'モッピー',
      campaigns: [],
      errors: [],
      stats: {
        totalUrls: 0,
        totalPagesProcessed: 0,
        totalCampaigns: 0,
        processingTimeMs: 0,
        averageCampaignsPerPage: 0,
        targetAchieved: false,
        infiniteScrollAttempts: 0,
        successfulScrolls: 0,
        manualPaginationAttempts: 0,
        successfulPageNavigations: 0
      },
      debug: {
        urlsProcessed: [],
        effectiveSelectors: [],
        campaignCounts: {},
        scrollingData: {},
        paginationAttempts: {},
        loadingStrategies: {}
      }
    };

    try {
      if (!this.page) {
        throw new Error('Pageが初期化されていません');
      }

      console.log('🎯 モッピー高度スクレイピング開始...');
      console.log('   無限スクロール対応');
      console.log('   手動ページネーション');
      console.log('   複数読み込み戦略');

      // より包括的なURL戦略
      const advancedUrls = [
        { 
          url: 'https://pc.moppy.jp/service/', 
          expectedCount: 1103, 
          description: 'メイン案件ページ（無限スクロール＋ページネーション）', 
          strategy: 'infinite-scroll-pagination',
          maxPages: 28
        },
        { 
          url: 'https://pc.moppy.jp/service/?page=1', 
          expectedCount: 1000, 
          description: 'メイン案件ページ（手動ページネーション）', 
          strategy: 'manual-pagination',
          maxPages: 28
        },
        { 
          url: 'https://pc.moppy.jp/category/list.php?parent_category=1', 
          expectedCount: 500, 
          description: 'ショッピングカテゴリ全体', 
          strategy: 'infinite-scroll',
          maxPages: 10
        },
        { 
          url: 'https://pc.moppy.jp/category/list.php?parent_category=3', 
          expectedCount: 300, 
          description: 'マネーカテゴリ全体', 
          strategy: 'infinite-scroll',
          maxPages: 8
        },
        { 
          url: 'https://pc.moppy.jp/search/?q=', 
          expectedCount: 1500, 
          description: '全案件検索（空クエリ）', 
          strategy: 'search-infinite-scroll',
          maxPages: 20
        }
      ];

      // 最適化されたセレクタ
      const advancedSelectors = [
        '[class*="item"]',
        '[class*="service"]',
        '[class*="campaign"]',
        '[class*="ad"]',
        '.list-item',
        'li[class*="item"]',
        'div[class*="item"]',
        '[data-campaign]',
        '[data-service]',
        '.moppy-service'
      ];

      const allCampaigns = new Map<string, AdvancedCampaign>();
      result.stats.totalUrls = advancedUrls.length;

      // 各URLを高度な戦略で処理
      for (let i = 0; i < advancedUrls.length; i++) {
        const urlInfo = advancedUrls[i];
        
        try {
          console.log(`📂 処理中 ${i + 1}/${advancedUrls.length}: ${urlInfo.description}`);
          console.log(`   URL: ${urlInfo.url}`);
          console.log(`   戦略: ${urlInfo.strategy}`);
          console.log(`   期待案件数: ${urlInfo.expectedCount}件`);
          console.log(`   最大ページ数: ${urlInfo.maxPages}ページ`);
          
          const urlResult = await this.processUrlWithAdvancedStrategy(
            urlInfo.url, 
            advancedSelectors, 
            urlInfo.expectedCount,
            urlInfo.strategy,
            urlInfo.maxPages
          );
          
          result.debug.urlsProcessed.push(urlInfo.url);
          result.debug.campaignCounts[urlInfo.url] = urlResult.campaigns.length;
          result.debug.scrollingData[urlInfo.url] = urlResult.scrollingInfo;
          result.debug.paginationAttempts[urlInfo.url] = urlResult.paginationAttempts;
          result.debug.loadingStrategies[urlInfo.url] = urlInfo.strategy;
          
          result.stats.totalPagesProcessed++;
          result.stats.infiniteScrollAttempts += urlResult.scrollingInfo.attempts || 0;
          result.stats.successfulScrolls += urlResult.scrollingInfo.successful || 0;
          result.stats.manualPaginationAttempts += urlResult.paginationAttempts.total || 0;
          result.stats.successfulPageNavigations += urlResult.paginationAttempts.successful || 0;

          // 重複除去しながら案件を追加
          urlResult.campaigns.forEach(campaign => {
            const key = `${campaign.name}-${campaign.cashbackRate}-${campaign.siteName}`;
            if (!allCampaigns.has(key) && campaign.name.length > 2) {
              allCampaigns.set(key, campaign);
            }
          });

          result.errors.push(...urlResult.errors);
          
          if (urlResult.effectiveSelector) {
            result.debug.effectiveSelectors.push(urlResult.effectiveSelector);
          }

          console.log(`   → ${urlResult.campaigns.length}件取得 (累計: ${allCampaigns.size}件)`);
          console.log(`   スクロール: ${urlResult.scrollingInfo.successful || 0}/${urlResult.scrollingInfo.attempts || 0}回成功`);
          console.log(`   ページ移動: ${urlResult.paginationAttempts.successful || 0}/${urlResult.paginationAttempts.total || 0}回成功`);

          // URL間の待機時間
          if (i < advancedUrls.length - 1) {
            await this.delay(5000);
          }

        } catch (error) {
          const errorMsg = `URL ${urlInfo.url} 処理エラー: ${error}`;
          console.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }

      result.campaigns = Array.from(allCampaigns.values());
      result.stats = {
        totalUrls: advancedUrls.length,
        totalPagesProcessed: result.stats.totalPagesProcessed,
        totalCampaigns: result.campaigns.length,
        processingTimeMs: Date.now() - startTime,
        averageCampaignsPerPage: result.stats.totalPagesProcessed > 0 ? 
          result.campaigns.length / result.stats.totalPagesProcessed : 0,
        targetAchieved: result.campaigns.length >= 1000,
        infiniteScrollAttempts: result.stats.infiniteScrollAttempts,
        successfulScrolls: result.stats.successfulScrolls,
        manualPaginationAttempts: result.stats.manualPaginationAttempts,
        successfulPageNavigations: result.stats.successfulPageNavigations
      };

      result.success = result.campaigns.length > 0;

      console.log(`✅ 高度スクレイピング完了: ${result.campaigns.length.toLocaleString()}件取得`);
      console.log(`🎯 目標達成: ${result.stats.targetAchieved ? 'Yes' : 'No'} (目標1000件以上)`);
      console.log(`🔄 スクロール成功率: ${result.stats.infiniteScrollAttempts > 0 ? (result.stats.successfulScrolls / result.stats.infiniteScrollAttempts * 100).toFixed(1) : 0}%`);
      console.log(`📄 ページ移動成功率: ${result.stats.manualPaginationAttempts > 0 ? (result.stats.successfulPageNavigations / result.stats.manualPaginationAttempts * 100).toFixed(1) : 0}%`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('高度スクレイピングエラー:', error);
      result.errors.push(`全体エラー: ${errorMessage}`);
    }

    return result;
  }

  // 高度な戦略でのURL処理
  private async processUrlWithAdvancedStrategy(
    url: string, 
    selectors: string[], 
    expectedCount: number,
    strategy: string,
    maxPages: number
  ): Promise<{
    campaigns: AdvancedCampaign[];
    errors: string[];
    effectiveSelector?: string;
    scrollingInfo: any;
    paginationAttempts: any;
  }> {
    const urlResult = {
      campaigns: [] as AdvancedCampaign[],
      errors: [] as string[],
      effectiveSelector: undefined as string | undefined,
      scrollingInfo: { attempts: 0, successful: 0, elementsFound: [] },
      paginationAttempts: { total: 0, successful: 0, pages: [] }
    };

    try {
      console.log(`     🌐 ページ読み込み開始 (戦略: ${strategy})...`);
      await this.page!.goto(url, { waitUntil: 'networkidle0', timeout: 90000 });
      
      // 戦略に応じた処理
      switch (strategy) {
        case 'infinite-scroll-pagination':
          await this.processInfiniteScrollWithPagination(urlResult, selectors, maxPages);
          break;
        case 'manual-pagination':
          await this.processManualPagination(urlResult, selectors, maxPages);
          break;
        case 'infinite-scroll':
          await this.processInfiniteScroll(urlResult, selectors);
          break;
        case 'search-infinite-scroll':
          await this.processSearchInfiniteScroll(urlResult, selectors);
          break;
        default:
          await this.processStandardScraping(urlResult, selectors);
      }

    } catch (error) {
      urlResult.errors.push(`URL処理エラー: ${error}`);
    }

    return urlResult;
  }

  // 無限スクロール＋ページネーション処理
  private async processInfiniteScrollWithPagination(
    urlResult: any, 
    selectors: string[], 
    maxPages: number
  ): Promise<void> {
    console.log(`     🔄 無限スクロール＋ページネーション処理開始...`);
    
    // まず無限スクロールを試行
    await this.processInfiniteScroll(urlResult, selectors);
    
    // 次にページネーションを試行
    for (let page = 2; page <= maxPages; page++) {
      urlResult.paginationAttempts.total++;
      
      try {
        console.log(`       📄 ページ ${page} への移動試行...`);
        
        // 複数の方法でページ移動を試行
        const navigationSuccess = await this.tryMultipleNavigationMethods(page);
        
        if (navigationSuccess) {
          urlResult.paginationAttempts.successful++;
          urlResult.paginationAttempts.pages.push(page);
          
          // このページでも無限スクロールを実行
          await this.delay(3000);
          await this.processInfiniteScroll(urlResult, selectors);
          
          console.log(`       → ページ ${page} 処理完了`);
        } else {
          console.log(`       → ページ ${page} への移動に失敗`);
          break; // 移動に失敗したら以降のページも無理
        }
        
        await this.delay(2000);
        
      } catch (error) {
        urlResult.errors.push(`ページ ${page} 処理エラー: ${error}`);
      }
    }
  }

  // 手動ページネーション処理
  private async processManualPagination(
    urlResult: any, 
    selectors: string[], 
    maxPages: number
  ): Promise<void> {
    console.log(`     📄 手動ページネーション処理開始...`);
    
    // 最初のページの案件を取得
    await this.extractCampaignsFromCurrentPage(urlResult, selectors);
    
    // 各ページを順次処理
    for (let page = 2; page <= maxPages; page++) {
      urlResult.paginationAttempts.total++;
      
      try {
        console.log(`       📄 ページ ${page} への移動...`);
        
        // URLパラメータを使った直接移動
        const pageUrl = this.buildPageUrl(url, page);
        await this.page!.goto(pageUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        
        urlResult.paginationAttempts.successful++;
        urlResult.paginationAttempts.pages.push(page);
        
        // このページの案件を取得
        await this.delay(3000);
        await this.extractCampaignsFromCurrentPage(urlResult, selectors);
        
        console.log(`       → ページ ${page} 処理完了`);
        
        await this.delay(2000);
        
      } catch (error) {
        urlResult.errors.push(`ページ ${page} 処理エラー: ${error}`);
      }
    }
  }

  // 無限スクロール処理
  private async processInfiniteScroll(
    urlResult: any, 
    selectors: string[]
  ): Promise<void> {
    console.log(`     🔄 無限スクロール処理開始...`);
    
    let previousCount = 0;
    let stableScrollCount = 0;
    const maxScrollAttempts = 50; // 最大50回スクロール
    
    for (let scroll = 0; scroll < maxScrollAttempts; scroll++) {
      urlResult.scrollingInfo.attempts++;
      
      try {
        // 現在の要素数をチェック
        const currentCount = await this.getCurrentElementCount(selectors);
        urlResult.scrollingInfo.elementsFound.push(currentCount);
        
        // スクロール実行
        await this.page!.evaluate(() => {
          window.scrollBy(0, window.innerHeight);
        });
        
        // スクロール後の待機
        await this.delay(2000);
        
        // 要素数が増加したかチェック
        const newCount = await this.getCurrentElementCount(selectors);
        
        if (newCount > currentCount) {
          urlResult.scrollingInfo.successful++;
          stableScrollCount = 0; // リセット
          console.log(`       🔄 スクロール ${scroll + 1}: ${currentCount} → ${newCount}要素`);
        } else {
          stableScrollCount++;
          if (stableScrollCount >= 5) {
            console.log(`       ⏹️ 5回連続で要素数が増加しなかったため終了`);
            break;
          }
        }
        
        previousCount = newCount;
        
      } catch (error) {
        urlResult.errors.push(`スクロール ${scroll + 1} エラー: ${error}`);
      }
    }
    
    // 最終的に全要素を抽出
    await this.extractCampaignsFromCurrentPage(urlResult, selectors);
  }

  // 検索ページの無限スクロール処理
  private async processSearchInfiniteScroll(
    urlResult: any, 
    selectors: string[]
  ): Promise<void> {
    console.log(`     🔍 検索無限スクロール処理開始...`);
    
    // 検索フィールドがあれば空の検索を実行
    try {
      const searchInput = await this.page!.$('input[type="search"], input[name="q"], #search');
      if (searchInput) {
        await searchInput.click();
        await searchInput.type('');
        await this.page!.keyboard.press('Enter');
        await this.delay(3000);
      }
    } catch (error) {
      // 検索フィールドが見つからない場合は継続
    }
    
    // 無限スクロール実行
    await this.processInfiniteScroll(urlResult, selectors);
  }

  // 標準スクレイピング処理
  private async processStandardScraping(
    urlResult: any, 
    selectors: string[]
  ): Promise<void> {
    console.log(`     📋 標準スクレイピング処理開始...`);
    
    await this.delay(5000); // 十分な待機
    await this.extractCampaignsFromCurrentPage(urlResult, selectors);
  }

  // 複数のナビゲーション方法を試行
  private async tryMultipleNavigationMethods(pageNumber: number): Promise<boolean> {
    const methods = [
      // 方法1: ページネーションリンクをクリック
      async () => {
        const linkSelector = `a[href*="page=${pageNumber}"], a:contains("${pageNumber}")`;
        const link = await this.page!.$(linkSelector);
        if (link) {
          await link.click();
          await this.page!.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 });
          return true;
        }
        return false;
      },
      
      // 方法2: URLパラメータを直接変更
      async () => {
        const currentUrl = this.page!.url();
        const pageUrl = this.buildPageUrl(currentUrl, pageNumber);
        await this.page!.goto(pageUrl, { waitUntil: 'networkidle0', timeout: 30000 });
        return true;
      },
      
      // 方法3: JavaScriptでページ移動
      async () => {
        await this.page!.evaluate((page) => {
          const pageLinks = Array.from(document.querySelectorAll('a'));
          const targetLink = pageLinks.find(link => 
            link.textContent?.trim() === page.toString() || 
            link.href.includes(`page=${page}`)
          );
          if (targetLink) {
            (targetLink as HTMLElement).click();
            return true;
          }
          return false;
        }, pageNumber);
        
        await this.page!.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 });
        return true;
      }
    ];

    for (const method of methods) {
      try {
        const success = await method();
        if (success) {
          return true;
        }
      } catch (error) {
        // 次の方法を試行
        continue;
      }
    }

    return false;
  }

  // ページURLの構築
  private buildPageUrl(baseUrl: string, pageNumber: number): string {
    const url = new URL(baseUrl);
    url.searchParams.set('page', pageNumber.toString());
    return url.toString();
  }

  // 現在の要素数を取得
  private async getCurrentElementCount(selectors: string[]): Promise<number> {
    let maxCount = 0;
    
    for (const selector of selectors) {
      try {
        const count = await this.page!.evaluate((sel) => {
          return document.querySelectorAll(sel).length;
        }, selector);
        
        maxCount = Math.max(maxCount, count);
      } catch (error) {
        // エラーは無視して次のセレクタを試行
      }
    }
    
    return maxCount;
  }

  // 現在ページからの案件抽出
  private async extractCampaignsFromCurrentPage(
    urlResult: any, 
    selectors: string[]
  ): Promise<void> {
    try {
      const html = await this.page!.content();
      const $ = cheerio.load(html);

      // 各セレクタを試して最も効果的なものを特定
      for (const selector of selectors) {
        try {
          const elements = $(selector);
          
          if (elements.length > 0) {
            const campaigns = await this.extractCampaignsAdvanced($, elements, selector);
            
            if (campaigns.length > urlResult.campaigns.length) {
              urlResult.campaigns = campaigns;
              urlResult.effectiveSelector = selector;
            }
          }
        } catch (error) {
          urlResult.errors.push(`セレクタ ${selector} エラー: ${error}`);
        }
      }

    } catch (error) {
      urlResult.errors.push(`ページ抽出エラー: ${error}`);
    }
  }

  // 高度な案件抽出
  private async extractCampaignsAdvanced(
    $: cheerio.CheerioAPI, 
    elements: cheerio.Cheerio<any>, 
    selector: string
  ): Promise<AdvancedCampaign[]> {
    const campaigns: AdvancedCampaign[] = [];

    elements.each((index, element) => {
      try {
        const campaign = this.extractSingleCampaignAdvanced($, $(element));
        if (campaign) {
          campaigns.push(campaign);
        }
      } catch (error) {
        // 個別要素のエラーは無視して続行
      }
    });

    // 重複除去
    const uniqueCampaigns = new Map<string, AdvancedCampaign>();
    campaigns.forEach(campaign => {
      const key = `${campaign.name}-${campaign.cashbackRate}`;
      if (!uniqueCampaigns.has(key) && campaign.name.length > 2) {
        uniqueCampaigns.set(key, campaign);
      }
    });

    return Array.from(uniqueCampaigns.values());
  }

  // 単一案件の高度抽出
  private extractSingleCampaignAdvanced($: cheerio.CheerioAPI, $el: cheerio.Cheerio<any>): AdvancedCampaign | null {
    try {
      // 名前抽出（より包括的）
      let name = '';
      const nameSelectors = [
        '.title', '.name', '.service-name', '.ad-title', '.campaign-title',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        '.text', '.label', '.shop-name', '.product-name', '.merchant-name',
        'strong', 'b', '.highlight', '.emphasis',
        'span[class*="title"]', 'div[class*="title"]',
        'a', '.link', '[data-name]',
        '.service', '.ad', '.campaign'
      ];

      for (const selector of nameSelectors) {
        const text = $el.find(selector).first().text().trim();
        if (text && text.length > 2 && text.length < 200) {
          name = text;
          break;
        }
      }

      if (!name) {
        const directText = $el.text().trim();
        if (directText.length > 2 && directText.length < 200) {
          name = directText.length > 100 ? directText.substring(0, 100) + '...' : directText;
        }
      }

      if (!name || name.length < 2) return null;

      // 還元率抽出（より包括的）
      let cashbackRate = '';
      const cashbackSelectors = [
        '.point', '.rate', '.mp', '.moppy-point', '.reward', '.cashback',
        '[class*="point"]', '[class*="rate"]', '[class*="mp"]', '[class*="reward"]',
        '.price', '.amount', '.value', '.percent', '.yen', '.円',
        'strong', 'b', '.highlight', '.emphasis', '.number',
        '[data-point]', '[data-rate]', '[data-price]',
        '.pt', '.ポイント'
      ];

      for (const selector of cashbackSelectors) {
        const elements = $el.find(selector);
        elements.each((index, elem) => {
          const text = $(elem).text().trim();
          if (text && (
            text.includes('P') || text.includes('%') || text.includes('円') || 
            text.includes('ポイント') || text.includes('pt') || /^\d+$/.test(text)
          )) {
            if (!cashbackRate || text.length < cashbackRate.length) {
              cashbackRate = text;
            }
          }
        });
        
        if (cashbackRate) break;
      }

      // より積極的な数字抽出
      if (!cashbackRate) {
        const allText = $el.text();
        const patterns = [
          /(\d+(?:[,，]\d+)*(?:\.\d+)?)\s*[P%円ポイントpt]/,
          /(\d+(?:\.\d+)?)\s*[%％]/,
          /(\d+(?:[,，]\d+)*)\s*[P円ポイント]/
        ];
        
        for (const pattern of patterns) {
          const match = allText.match(pattern);
          if (match) {
            cashbackRate = match[0];
            break;
          }
        }
      }

      if (!cashbackRate) return null;

      // 正規化
      const normalizedCashback = this.normalizeCashbackRate(cashbackRate);
      const isPercentage = cashbackRate.includes('%') || cashbackRate.includes('％');

      // URL抽出
      const url = this.extractUrl($el, 'https://pc.moppy.jp');

      // 説明文抽出
      const description = name.substring(0, 100);

      // カテゴリ推定
      const category = this.estimateCategory(name, description);

      return {
        name: this.cleanName(name),
        cashbackRate: cashbackRate.trim(),
        normalizedCashback,
        url,
        description: description.trim(),
        siteName: 'モッピー',
        category,
        isPercentage
      };

    } catch (error) {
      return null;
    }
  }

  // 名前のクリーニング
  private cleanName(name: string): string {
    return name
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, ' ')
      .replace(/\t+/g, ' ')
      .replace(/【[^】]*】/g, '')
      .replace(/\([^)]*\)/g, '')
      .replace(/\s*[\d,，]+\.?\d*[P円ポイントpt%％]\s*/g, '')
      .replace(/\s*最大\s*[\d,，]+\.?\d*[P円ポイントpt%％]\s*/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100);
  }

  // URL抽出
  private extractUrl($el: cheerio.Cheerio<any>, baseUrl: string): string {
    const linkEl = $el.is('a') ? $el : $el.find('a').first();
    if (linkEl.length > 0) {
      const href = linkEl.attr('href') || '';
      return href.startsWith('http') ? href : `${baseUrl}${href}`;
    }
    return '';
  }

  // 還元率正規化
  private normalizeCashbackRate(text: string): string {
    if (!text) return '0円';
    
    const cleanText = text.replace(/[,，\s　]/g, '').trim();
    
    if (cleanText.includes('%') || cleanText.includes('％')) {
      const match = cleanText.match(/[\d.]+/);
      return match ? `${match[0]}%` : '0%';
    }
    
    if (cleanText.includes('P') || cleanText.includes('ポイント') || cleanText.includes('pt')) {
      const match = cleanText.match(/[\d,，]+/);
      if (match) {
        const points = parseInt(match[0].replace(/[,，]/g, ''));
        return `${points.toLocaleString()}円`;
      }
    }
    
    if (cleanText.includes('円')) {
      const match = cleanText.match(/[\d,，]+/);
      if (match) {
        const yen = parseInt(match[0].replace(/[,，]/g, ''));
        return `${yen.toLocaleString()}円`;
      }
    }
    
    const numberMatch = cleanText.match(/^[\d,，]+$/);
    if (numberMatch) {
      const number = parseInt(numberMatch[0].replace(/[,，]/g, ''));
      return `${number.toLocaleString()}円`;
    }
    
    return text.substring(0, 20);
  }

  // カテゴリ推定
  private estimateCategory(name: string, description: string): string {
    const text = (name + ' ' + description).toLowerCase();
    
    if (text.includes('カード') || text.includes('クレジット')) return 'finance';
    if (text.includes('証券') || text.includes('銀行')) return 'finance';
    if (text.includes('旅行') || text.includes('ホテル')) return 'travel';
    if (text.includes('ゲーム') || text.includes('アプリ')) return 'entertainment';
    if (text.includes('美容') || text.includes('健康')) return 'other';
    
    return 'shopping';
  }

  // 待機
  private async delay(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }
}