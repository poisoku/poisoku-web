import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';

export interface DynamicCampaign {
  name: string;
  cashbackRate: string;
  normalizedCashback: string;
  url: string;
  description?: string;
  siteName: string;
  category: string;
  isPercentage: boolean;
}

export interface DynamicScrapeResult {
  success: boolean;
  siteName: string;
  campaigns: DynamicCampaign[];
  errors: string[];
  stats: {
    totalUrls: number;
    totalPagesProcessed: number;
    totalCampaigns: number;
    processingTimeMs: number;
    averageCampaignsPerPage: number;
    targetAchieved: boolean;
    paginationPagesFound: number;
    ajaxRequestsDetected: number;
  };
  debug: {
    urlsProcessed: string[];
    effectiveSelectors: string[];
    campaignCounts: Record<string, number>;
    paginationData: Record<string, any>;
    ajaxDetection: Record<string, boolean>;
    dynamicLoadEvents: Record<string, string[]>;
  };
}

export class DynamicScraper {
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
      '--ignore-ssl-errors'
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

    await this.page.setDefaultTimeout(30000);
    await this.page.setDefaultNavigationTimeout(30000);
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

  // 動的コンテンツ対応モッピー全案件取得
  async scrapeAllMoppyDynamic(): Promise<DynamicScrapeResult> {
    const startTime = Date.now();
    const result: DynamicScrapeResult = {
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
        paginationPagesFound: 0,
        ajaxRequestsDetected: 0
      },
      debug: {
        urlsProcessed: [],
        effectiveSelectors: [],
        campaignCounts: {},
        paginationData: {},
        ajaxDetection: {},
        dynamicLoadEvents: {}
      }
    };

    try {
      if (!this.page) {
        throw new Error('Pageが初期化されていません');
      }

      console.log('🎯 モッピー動的コンテンツ対応スクレイピング開始...');
      console.log('   ページネーション自動処理');
      console.log('   Ajax読み込み完了検知');
      console.log('   特定要素表示待機');

      // 効果的なURLでページネーション処理
      const dynamicUrls = [
        { url: 'https://pc.moppy.jp/service/', expectedCount: 1103, description: 'メイン案件ページ（ページネーション対応）', hasPagination: true },
        { url: 'https://pc.moppy.jp/category/list.php?parent_category=1&child_category=11', expectedCount: 200, description: 'ショッピング（ページネーション対応）', hasPagination: true },
        { url: 'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=31', expectedCount: 200, description: 'クレジットカード（ページネーション対応）', hasPagination: true }
      ];

      // 動的読み込み対応セレクタ
      const dynamicSelectors = [
        '[class*="item"]',
        '[class*="service"]',
        '[class*="ad"]',
        '.campaign-item',
        '.list-item',
        '[data-campaign]'
      ];

      const allCampaigns = new Map<string, DynamicCampaign>();
      result.stats.totalUrls = dynamicUrls.length;

      // 各URLを動的コンテンツ対応で処理
      for (let i = 0; i < dynamicUrls.length; i++) {
        const urlInfo = dynamicUrls[i];
        
        try {
          console.log(`📂 処理中 ${i + 1}/${dynamicUrls.length}: ${urlInfo.description}`);
          console.log(`   URL: ${urlInfo.url}`);
          console.log(`   期待案件数: ${urlInfo.expectedCount}件`);
          console.log(`   ページネーション: ${urlInfo.hasPagination ? 'あり' : 'なし'}`);
          
          const urlResult = await this.processUrlWithDynamicHandling(
            urlInfo.url, 
            dynamicSelectors, 
            urlInfo.expectedCount,
            urlInfo.hasPagination
          );
          
          result.debug.urlsProcessed.push(urlInfo.url);
          result.debug.campaignCounts[urlInfo.url] = urlResult.campaigns.length;
          result.debug.paginationData[urlInfo.url] = urlResult.paginationInfo;
          result.debug.ajaxDetection[urlInfo.url] = urlResult.ajaxDetected;
          result.debug.dynamicLoadEvents[urlInfo.url] = urlResult.loadEvents;
          
          result.stats.totalPagesProcessed++;
          result.stats.paginationPagesFound += urlResult.paginationInfo.totalPages || 0;
          result.stats.ajaxRequestsDetected += urlResult.ajaxDetected ? 1 : 0;

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
          console.log(`   ページネーション: ${urlResult.paginationInfo.totalPages || 0}ページ発見`);
          console.log(`   Ajax検知: ${urlResult.ajaxDetected ? 'あり' : 'なし'}`);

          // URL間の待機時間
          if (i < dynamicUrls.length - 1) {
            await this.delay(2000);
          }

        } catch (error) {
          const errorMsg = `URL ${urlInfo.url} 処理エラー: ${error}`;
          console.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }

      result.campaigns = Array.from(allCampaigns.values());
      result.stats = {
        totalUrls: dynamicUrls.length,
        totalPagesProcessed: result.stats.totalPagesProcessed,
        totalCampaigns: result.campaigns.length,
        processingTimeMs: Date.now() - startTime,
        averageCampaignsPerPage: result.stats.totalPagesProcessed > 0 ? 
          result.campaigns.length / result.stats.totalPagesProcessed : 0,
        targetAchieved: result.campaigns.length >= 500,
        paginationPagesFound: result.stats.paginationPagesFound,
        ajaxRequestsDetected: result.stats.ajaxRequestsDetected
      };

      result.success = result.campaigns.length > 0;

      console.log(`✅ 動的コンテンツ対応スクレイピング完了: ${result.campaigns.length.toLocaleString()}件取得`);
      console.log(`🎯 目標達成: ${result.stats.targetAchieved ? 'Yes' : 'No'} (目標500件以上)`);
      console.log(`📄 ページネーション: ${result.stats.paginationPagesFound}ページ発見`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('動的コンテンツ対応スクレイピングエラー:', error);
      result.errors.push(`全体エラー: ${errorMessage}`);
    }

    return result;
  }

  // 動的コンテンツ対応URL処理
  private async processUrlWithDynamicHandling(
    url: string, 
    selectors: string[], 
    expectedCount: number,
    hasPagination: boolean
  ): Promise<{
    campaigns: DynamicCampaign[];
    errors: string[];
    effectiveSelector?: string;
    paginationInfo: any;
    ajaxDetected: boolean;
    loadEvents: string[];
  }> {
    const urlResult = {
      campaigns: [] as DynamicCampaign[],
      errors: [] as string[],
      effectiveSelector: undefined as string | undefined,
      paginationInfo: { totalPages: 0, currentPage: 1 },
      ajaxDetected: false,
      loadEvents: [] as string[]
    };

    try {
      // Ajax リクエスト監視を設定
      await this.setupAjaxMonitoring();
      
      console.log(`     🌐 ページ読み込み開始...`);
      await this.page!.goto(url, { waitUntil: 'domcontentloaded' });
      
      // 動的コンテンツの読み込み完了を待機
      console.log(`     ⏳ 動的コンテンツ読み込み完了を待機...`);
      await this.waitForDynamicContent();
      
      // Ajax リクエストの検知
      urlResult.ajaxDetected = await this.detectAjaxRequests();
      urlResult.loadEvents.push(`Ajax検知: ${urlResult.ajaxDetected}`);
      
      // ページネーション情報の取得
      if (hasPagination) {
        console.log(`     📄 ページネーション情報取得...`);
        urlResult.paginationInfo = await this.getPaginationInfo();
        urlResult.loadEvents.push(`ページネーション: ${urlResult.paginationInfo.totalPages}ページ`);
      }
      
      // 初期ページの案件取得
      const initialCampaigns = await this.extractCampaignsFromCurrentPage(selectors);
      urlResult.campaigns.push(...initialCampaigns.campaigns);
      if (initialCampaigns.effectiveSelector) {
        urlResult.effectiveSelector = initialCampaigns.effectiveSelector;
      }
      urlResult.errors.push(...initialCampaigns.errors);
      
      // ページネーションがある場合は各ページを処理
      if (hasPagination && urlResult.paginationInfo.totalPages > 1) {
        console.log(`     📑 ページネーション処理: ${urlResult.paginationInfo.totalPages}ページ`);
        
        for (let page = 2; page <= Math.min(urlResult.paginationInfo.totalPages, 5); page++) { // 最大5ページまで
          try {
            console.log(`       ページ ${page}/${urlResult.paginationInfo.totalPages} 処理中...`);
            
            const success = await this.navigateToPage(page);
            if (success) {
              await this.waitForDynamicContent();
              
              const pageCampaigns = await this.extractCampaignsFromCurrentPage(selectors);
              urlResult.campaigns.push(...pageCampaigns.campaigns);
              urlResult.errors.push(...pageCampaigns.errors);
              
              console.log(`       → ページ ${page}: ${pageCampaigns.campaigns.length}件取得`);
              urlResult.loadEvents.push(`ページ${page}: ${pageCampaigns.campaigns.length}件`);
              
              // ページ間の待機
              await this.delay(1000);
            } else {
              urlResult.errors.push(`ページ ${page} への移動に失敗`);
              break;
            }
          } catch (pageError) {
            urlResult.errors.push(`ページ ${page} 処理エラー: ${pageError}`);
          }
        }
      }
      
      console.log(`     📊 最終取得数: ${urlResult.campaigns.length}件`);

    } catch (error) {
      urlResult.errors.push(`動的処理エラー: ${error}`);
    }

    return urlResult;
  }

  // Ajax監視設定
  private async setupAjaxMonitoring(): Promise<void> {
    await this.page!.evaluateOnNewDocument(() => {
      (window as any).ajaxRequestCount = 0;
      (window as any).ajaxCompletedCount = 0;
      
      const originalXHR = window.XMLHttpRequest;
      window.XMLHttpRequest = function() {
        const xhr = new originalXHR();
        (window as any).ajaxRequestCount++;
        
        const originalSend = xhr.send;
        xhr.send = function(...args) {
          xhr.addEventListener('loadend', () => {
            (window as any).ajaxCompletedCount++;
          });
          return originalSend.apply(xhr, args);
        };
        
        return xhr;
      };
    });
  }

  // 動的コンテンツ読み込み完了待機
  private async waitForDynamicContent(): Promise<void> {
    try {
      // 特定の要素が表示されるまで待機
      await this.page!.waitForFunction(
        () => {
          const elements = document.querySelectorAll('[class*="item"], [class*="service"], [class*="ad"]');
          return elements.length > 5; // 5個以上の要素が見つかるまで待機
        },
        { timeout: 10000 }
      );
      
      // Ajax リクエスト完了まで待機
      await this.page!.waitForFunction(
        () => {
          const requestCount = (window as any).ajaxRequestCount || 0;
          const completedCount = (window as any).ajaxCompletedCount || 0;
          return requestCount === 0 || requestCount === completedCount;
        },
        { timeout: 8000 }
      );
      
      // 追加の安定待機
      await this.delay(2000);
      
    } catch (error) {
      console.log(`     ⚠️ 動的コンテンツ待機タイムアウト: ${error}`);
    }
  }

  // Ajax リクエスト検知
  private async detectAjaxRequests(): Promise<boolean> {
    try {
      const ajaxData = await this.page!.evaluate(() => {
        return {
          requestCount: (window as any).ajaxRequestCount || 0,
          completedCount: (window as any).ajaxCompletedCount || 0
        };
      });
      
      return ajaxData.requestCount > 0;
    } catch (error) {
      return false;
    }
  }

  // ページネーション情報取得
  private async getPaginationInfo(): Promise<any> {
    try {
      const paginationInfo = await this.page!.evaluate(() => {
        // 一般的なページネーションセレクタを試行
        const paginationSelectors = [
          '.pagination',
          '.pager',
          '[class*="pagination"]',
          '[class*="pager"]',
          '.page-nav',
          '.page-numbers'
        ];
        
        for (const selector of paginationSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            const links = element.querySelectorAll('a');
            const numbers = Array.from(links)
              .map(link => parseInt(link.textContent || '0'))
              .filter(num => !isNaN(num));
            
            if (numbers.length > 0) {
              return {
                totalPages: Math.max(...numbers),
                currentPage: 1,
                selector: selector
              };
            }
          }
        }
        
        // 数字ベースのページネーション検索
        const allLinks = document.querySelectorAll('a');
        const pageNumbers = Array.from(allLinks)
          .map(link => parseInt(link.textContent || '0'))
          .filter(num => !isNaN(num) && num > 1 && num < 100);
        
        if (pageNumbers.length > 0) {
          return {
            totalPages: Math.max(...pageNumbers),
            currentPage: 1,
            selector: 'auto-detected'
          };
        }
        
        return { totalPages: 1, currentPage: 1, selector: 'none' };
      });
      
      return paginationInfo;
    } catch (error) {
      return { totalPages: 1, currentPage: 1, selector: 'error' };
    }
  }

  // 特定ページへの移動
  private async navigateToPage(pageNumber: number): Promise<boolean> {
    try {
      // ページネーションリンクをクリック
      const success = await this.page!.evaluate((page) => {
        const paginationSelectors = [
          `.pagination a:contains("${page}")`,
          `.pager a:contains("${page}")`,
          `a[href*="page=${page}"]`,
          `a:contains("${page}")`
        ];
        
        for (const selector of paginationSelectors) {
          const elements = document.querySelectorAll('a');
          for (const element of elements) {
            if (element.textContent?.trim() === page.toString()) {
              (element as HTMLElement).click();
              return true;
            }
          }
        }
        
        return false;
      }, pageNumber);
      
      if (success) {
        await this.page!.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 });
        return true;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  // 現在ページからの案件抽出
  private async extractCampaignsFromCurrentPage(selectors: string[]): Promise<{
    campaigns: DynamicCampaign[];
    errors: string[];
    effectiveSelector?: string;
  }> {
    const pageResult = {
      campaigns: [] as DynamicCampaign[],
      errors: [] as string[],
      effectiveSelector: undefined as string | undefined
    };

    try {
      const html = await this.page!.content();
      const $ = cheerio.load(html);

      // 各セレクタを試して最も効果的なものを特定
      for (const selector of selectors) {
        try {
          const elements = $(selector);
          
          if (elements.length > 0) {
            const campaigns = await this.extractCampaignsDynamic($, elements, selector);
            
            if (campaigns.length > pageResult.campaigns.length) {
              pageResult.campaigns = campaigns;
              pageResult.effectiveSelector = selector;
            }
          }
        } catch (error) {
          pageResult.errors.push(`セレクタ ${selector} エラー: ${error}`);
        }
      }

    } catch (error) {
      pageResult.errors.push(`ページ抽出エラー: ${error}`);
    }

    return pageResult;
  }

  // 動的案件抽出
  private async extractCampaignsDynamic(
    $: cheerio.CheerioAPI, 
    elements: cheerio.Cheerio<any>, 
    selector: string
  ): Promise<DynamicCampaign[]> {
    const campaigns: DynamicCampaign[] = [];

    elements.each((index, element) => {
      try {
        const campaign = this.extractSingleCampaignDynamic($, $(element));
        if (campaign) {
          campaigns.push(campaign);
        }
      } catch (error) {
        // 個別要素のエラーは無視して続行
      }
    });

    // 重複除去
    const uniqueCampaigns = new Map<string, DynamicCampaign>();
    campaigns.forEach(campaign => {
      const key = `${campaign.name}-${campaign.cashbackRate}`;
      if (!uniqueCampaigns.has(key) && campaign.name.length > 2) {
        uniqueCampaigns.set(key, campaign);
      }
    });

    return Array.from(uniqueCampaigns.values());
  }

  // 単一案件の動的抽出
  private extractSingleCampaignDynamic($: cheerio.CheerioAPI, $el: cheerio.Cheerio<any>): DynamicCampaign | null {
    try {
      // 名前抽出
      let name = '';
      const nameSelectors = [
        '.title', '.name', '.service-name', 'h1', 'h2', 'h3',
        'strong', 'b', 'a', '.link'
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

      // 還元率抽出
      let cashbackRate = '';
      const cashbackSelectors = [
        '.point', '.rate', '.mp', '[class*="point"]', '[class*="rate"]',
        '.price', '.amount', 'strong', 'b'
      ];

      for (const selector of cashbackSelectors) {
        const elements = $el.find(selector);
        elements.each((index, elem) => {
          const text = $(elem).text().trim();
          if (text && (
            text.includes('P') || text.includes('%') || text.includes('円') || 
            text.includes('ポイント') || /^\d+$/.test(text)
          )) {
            if (!cashbackRate || text.length < cashbackRate.length) {
              cashbackRate = text;
            }
          }
        });
        
        if (cashbackRate) break;
      }

      if (!cashbackRate) {
        const allText = $el.text();
        const numberMatch = allText.match(/(\d+(?:[,，]\d+)*(?:\.\d+)?)\s*[P%円ポイント]/);
        if (numberMatch) {
          cashbackRate = numberMatch[0];
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