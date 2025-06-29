import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';

export interface MassiveCampaign {
  name: string;
  cashbackRate: string;
  normalizedCashback: string;
  url: string;
  description?: string;
  siteName: string;
  category: string;
  isPercentage: boolean;
}

export interface MassiveScrapeResult {
  success: boolean;
  siteName: string;
  campaigns: MassiveCampaign[];
  errors: string[];
  stats: {
    totalCategories: number;
    totalPagesProcessed: number;
    totalCampaigns: number;
    processingTimeMs: number;
    averageCampaignsPerPage: number;
  };
  debug: {
    categoriesProcessed: string[];
    pagesUrls: string[];
    errors: string[];
  };
}

export class MassiveScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private baseDelay = 1500; // 基本待機時間を短縮
  private maxRetries = 2; // リトライ回数を減らして効率化

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
      '--ignore-certificate-errors-spki-list',
      '--disable-images', // 画像を無効化して高速化
      '--disable-javascript', // JavaScriptを無効化（静的コンテンツのみ）
    ];

    this.browser = await puppeteer.launch({
      headless: true,
      args
    });

    this.page = await this.browser.newPage();
    await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await this.page.setViewport({ width: 1920, height: 1080 });
    
    // WebDriver検出回避
    await this.page.evaluateOnNewDocument(() => {
      delete (navigator as any).webdriver;
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });
      Object.defineProperty(navigator, 'languages', {
        get: () => ['ja-JP', 'ja', 'en-US', 'en']
      });
    });

    await this.page.setDefaultTimeout(20000);
    await this.page.setDefaultNavigationTimeout(20000);
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

  // 大規模スクレイピング実行
  async scrapeAllMoppyMassive(): Promise<MassiveScrapeResult> {
    const startTime = Date.now();
    const result: MassiveScrapeResult = {
      success: false,
      siteName: 'モッピー',
      campaigns: [],
      errors: [],
      stats: {
        totalCategories: 0,
        totalPagesProcessed: 0,
        totalCampaigns: 0,
        processingTimeMs: 0,
        averageCampaignsPerPage: 0
      },
      debug: {
        categoriesProcessed: [],
        pagesUrls: [],
        errors: []
      }
    };

    try {
      if (!this.page) {
        throw new Error('Pageが初期化されていません');
      }

      console.log('🚀 モッピー大規模スクレイピング開始...');

      // 調査結果から得られた全カテゴリURL
      const categoryUrls = [
        'https://pc.moppy.jp/ad/',
        'https://pc.moppy.jp/ad/category/1/',
        'https://pc.moppy.jp/ad/category/2/',
        'https://pc.moppy.jp/ad/category/3/',
        'https://pc.moppy.jp/ad/category/4/',
        'https://pc.moppy.jp/ad/category/5/',
        'https://pc.moppy.jp/ad/category/6/',
        'https://pc.moppy.jp/ad/category/7/',
        'https://pc.moppy.jp/ad/category/8/',
        'https://pc.moppy.jp/ad/category/9/',
        'https://pc.moppy.jp/ad/category/10/',
        'https://pc.moppy.jp/ad/category/11/',
        'https://pc.moppy.jp/ad/category/12/',
      ];

      const allCampaigns = new Map<string, MassiveCampaign>();
      let totalPagesProcessed = 0;

      // 各カテゴリを処理
      for (let i = 0; i < categoryUrls.length; i++) {
        const categoryUrl = categoryUrls[i];
        
        try {
          console.log(`📂 カテゴリ ${i + 1}/${categoryUrls.length}: ${categoryUrl}`);
          
          const categoryResult = await this.processCategoryMassive(categoryUrl);
          result.debug.categoriesProcessed.push(categoryUrl);
          result.debug.pagesUrls.push(...categoryResult.pagesProcessed);
          
          // 重複除去しながら案件を追加
          categoryResult.campaigns.forEach(campaign => {
            const key = `${campaign.name}-${campaign.siteName}-${campaign.cashbackRate}`;
            if (!allCampaigns.has(key)) {
              allCampaigns.set(key, campaign);
            }
          });

          totalPagesProcessed += categoryResult.pagesCount;
          result.errors.push(...categoryResult.errors);

          console.log(`   → ${categoryResult.campaigns.length}件取得 (${categoryResult.pagesCount}ページ処理)`);

          // カテゴリ間の待機時間を短縮
          if (i < categoryUrls.length - 1) {
            await this.randomDelay(1000, 2000);
          }

        } catch (error) {
          const errorMsg = `カテゴリ ${categoryUrl} 処理エラー: ${error}`;
          console.error(errorMsg);
          result.errors.push(errorMsg);
          result.debug.errors.push(errorMsg);
        }
      }

      result.campaigns = Array.from(allCampaigns.values());
      result.stats = {
        totalCategories: categoryUrls.length,
        totalPagesProcessed,
        totalCampaigns: result.campaigns.length,
        processingTimeMs: Date.now() - startTime,
        averageCampaignsPerPage: totalPagesProcessed > 0 ? result.campaigns.length / totalPagesProcessed : 0
      };

      result.success = result.campaigns.length > 0;

      console.log(`✅ 大規模スクレイピング完了: ${result.campaigns.length.toLocaleString()}件取得`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('大規模スクレイピングエラー:', error);
      result.errors.push(`全体エラー: ${errorMessage}`);
    }

    return result;
  }

  // カテゴリの全ページを効率的に処理
  private async processCategoryMassive(categoryUrl: string): Promise<{
    campaigns: MassiveCampaign[];
    errors: string[];
    pagesProcessed: string[];
    pagesCount: number;
  }> {
    const categoryResult = {
      campaigns: [] as MassiveCampaign[],
      errors: [] as string[],
      pagesProcessed: [] as string[],
      pagesCount: 0
    };

    try {
      // 最初のページにアクセス
      await this.page!.goto(categoryUrl, { waitUntil: 'domcontentloaded' });
      await this.randomDelay(1000, 2000);

      let currentPage = 1;
      let hasNextPage = true;
      const maxPagesPerCategory = 50; // カテゴリあたり最大50ページまで処理

      while (hasNextPage && currentPage <= maxPagesPerCategory) {
        try {
          const pageUrl = currentPage === 1 ? categoryUrl : `${categoryUrl}?page=${currentPage}`;
          
          if (currentPage > 1) {
            await this.page!.goto(pageUrl, { waitUntil: 'domcontentloaded' });
            await this.randomDelay(800, 1500);
          }

          categoryResult.pagesProcessed.push(pageUrl);
          categoryResult.pagesCount++;

          // ページから案件を抽出（改良されたセレクタ使用）
          const pageCampaigns = await this.extractCampaignsImproved();
          categoryResult.campaigns.push(...pageCampaigns);

          console.log(`     ページ ${currentPage}: ${pageCampaigns.length}件`);

          // 次ページの存在確認
          hasNextPage = await this.hasNextPageImproved();
          
          // 案件が0件の場合は終了
          if (pageCampaigns.length === 0) {
            console.log(`     案件0件のため終了`);
            hasNextPage = false;
          }

          currentPage++;

        } catch (error) {
          console.error(`ページ ${currentPage} 処理エラー:`, error);
          categoryResult.errors.push(`ページ ${currentPage} エラー: ${error}`);
          hasNextPage = false;
        }
      }

    } catch (error) {
      console.error(`カテゴリ ${categoryUrl} 処理エラー:`, error);
      categoryResult.errors.push(`カテゴリエラー: ${error}`);
    }

    return categoryResult;
  }

  // 改良された案件抽出（調査結果のセレクタを使用）
  private async extractCampaignsImproved(): Promise<MassiveCampaign[]> {
    const html = await this.page!.content();
    const $ = cheerio.load(html);
    const campaigns: MassiveCampaign[] = [];

    // 調査で発見された効果的なセレクタ
    const improvedSelectors = [
      '[class*="service"][class*="item"]',
      'li[class*="item"]',
      'div[class*="item"]',
      '.service-item',
      '.ad-item',
      '.campaign-item',
      '.shop-item',
      '.point-item',
      'article[class*="item"]',
      '.item',
      '.card',
      // より広範囲なセレクタ
      'li', 'div[class*="box"]', 'div[class*="card"]',
      'a[href*="/ad/"], a[href*="/service/"]'
    ];

    for (const selector of improvedSelectors) {
      const elements = $(selector);
      
      if (elements.length > 0) {
        console.log(`     🔍 セレクタ "${selector}": ${elements.length}件発見`);
        
        elements.each((index, element) => {
          try {
            const campaign = this.extractCampaignDataImproved($, $(element));
            if (campaign && campaign.name && campaign.cashbackRate) {
              campaigns.push(campaign);
            }
          } catch (error) {
            // 個別要素のエラーは無視して続行
          }
        });

        // 案件が見つかったら他のセレクタは試さない（効率化）
        if (campaigns.length > 0) {
          break;
        }
      }
    }

    // 重複除去
    const uniqueCampaigns = new Map<string, MassiveCampaign>();
    campaigns.forEach(campaign => {
      const key = `${campaign.name}-${campaign.cashbackRate}`;
      if (!uniqueCampaigns.has(key)) {
        uniqueCampaigns.set(key, campaign);
      }
    });

    return Array.from(uniqueCampaigns.values());
  }

  // 改良された案件データ抽出
  private extractCampaignDataImproved($: cheerio.CheerioAPI, $el: cheerio.Cheerio<any>): MassiveCampaign | null {
    try {
      // より包括的な名前抽出
      const nameSelectors = [
        '.title', '.name', '.service-name', '.ad-title', '.campaign-title',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        '.text', '.label', '.shop-name', '.product-name',
        '[title]', 'strong', 'b',
        'a', '.link'
      ];
      
      let name = '';
      for (const selector of nameSelectors) {
        const text = $el.find(selector).first().text().trim();
        if (text && text.length > 2) {
          name = text;
          break;
        }
      }
      
      // title属性からも取得を試行
      if (!name) {
        name = $el.attr('title') || $el.find('[title]').first().attr('title') || '';
      }
      
      // テキスト全体から抽出を試行
      if (!name) {
        const fullText = $el.text().trim();
        if (fullText.length > 2 && fullText.length < 200) {
          name = fullText;
        }
      }

      if (!name || name.length < 2) return null;

      // より包括的な還元率抽出
      const cashbackSelectors = [
        '.point', '.rate', '.mp', '.moppy-point', '.reward', '.cashback',
        '[class*="point"]', '[class*="rate"]', '[class*="mp"]', '[class*="reward"]',
        '.price', '.amount', '.value', '.percent', '.yen', '.円',
        'strong', 'b', '.highlight', '.emphasis'
      ];

      let cashbackRate = '';
      for (const selector of cashbackSelectors) {
        const text = $el.find(selector).first().text().trim();
        // ポイントや%を含むテキストを優先
        if (text && (text.includes('P') || text.includes('%') || text.includes('円') || text.includes('ポイント'))) {
          cashbackRate = text;
          break;
        }
      }

      // 数字のみでも抽出を試行
      if (!cashbackRate) {
        for (const selector of cashbackSelectors) {
          const text = $el.find(selector).first().text().trim();
          if (text && /\d/.test(text)) {
            cashbackRate = text;
            break;
          }
        }
      }

      if (!cashbackRate) return null;

      // 正規化された還元率
      const normalizedCashback = this.normalizeCashbackRate(cashbackRate);
      const isPercentage = cashbackRate.includes('%') || cashbackRate.includes('％');

      // URL抽出
      const url = this.extractUrl($el, 'https://pc.moppy.jp');

      // 説明文抽出
      const description = $el.find('.description, .desc, .detail').first().text().trim() || 
                         $el.text().trim().substring(0, 100);

      // カテゴリ推定
      const category = this.estimateCategory(name, description);

      return {
        name: name.trim().substring(0, 100),
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

  // URL抽出ヘルパー
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
    
    const cleanText = text.replace(/[,，\s]/g, '').trim();
    
    // パーセント表記はそのまま
    if (cleanText.includes('%') || cleanText.includes('％')) {
      const match = cleanText.match(/[\d.]+/);
      return match ? `${match[0]}%` : '0%';
    }
    
    // ポイント表記は円に変換
    if (cleanText.includes('P') || cleanText.includes('ポイント') || cleanText.includes('pt')) {
      const match = cleanText.match(/[\d,，]+/);
      if (match) {
        const points = parseInt(match[0].replace(/[,，]/g, ''));
        return `${points.toLocaleString()}円`;
      }
    }
    
    // 円表記はそのまま
    if (cleanText.includes('円')) {
      const match = cleanText.match(/[\d,，]+/);
      if (match) {
        const yen = parseInt(match[0].replace(/[,，]/g, ''));
        return `${yen.toLocaleString()}円`;
      }
    }
    
    // 数字のみの場合は円として扱う
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
    if (text.includes('証券') || text.includes('投資') || text.includes('fx')) return 'finance';
    if (text.includes('銀行') || text.includes('口座')) return 'finance';
    if (text.includes('旅行') || text.includes('ホテル') || text.includes('じゃらん')) return 'travel';
    if (text.includes('動画') || text.includes('音楽') || text.includes('映画')) return 'entertainment';
    if (text.includes('ゲーム') || text.includes('アプリ')) return 'entertainment';
    if (text.includes('美容') || text.includes('健康') || text.includes('コスメ')) return 'other';
    
    return 'shopping';
  }

  // 改良された次ページ確認
  private async hasNextPageImproved(): Promise<boolean> {
    try {
      const nextPageSelectors = [
        'a[href*="page="]:contains("次")',
        'a[href*="page="]:contains(">")',
        'a[href*="page="]:contains("→")',
        '.pager a[href*="page="]',
        '.pagination a[href*="page="]',
        'a.next',
        'a[rel="next"]',
        '.next',
        '[class*="next"]'
      ];

      for (const selector of nextPageSelectors) {
        const nextElement = await this.page!.$(selector);
        if (nextElement) {
          return true;
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  // ランダム待機
  private async randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}