import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';

export interface ComprehensiveCampaign {
  name: string;
  cashbackRate: string;
  normalizedCashback: string; // 正規化された還元率 (123P → 123円, 1.5% → 1.5%)
  url: string;
  description?: string;
  siteName: string;
  category: string;
  isPercentage: boolean; // %表記かどうか
}

export interface ComprehensiveScrapeResult {
  success: boolean;
  siteName: string;
  campaigns: ComprehensiveCampaign[];
  errors: string[];
  stats: {
    totalPages: number;
    totalCampaigns: number;
    processingTimeMs: number;
    lastPageReached: boolean;
  };
  debug: {
    visitedUrls: string[];
    pagesTitles: string[];
    htmlSnippets: string[];
  };
}

export class ComprehensiveScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private baseDelay = 2000; // 基本待機時間
  private maxRetries = 3;

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
      '--ignore-certificate-errors-spki-list'
    ];

    this.browser = await puppeteer.launch({
      headless: true,
      args
    });

    this.page = await this.browser.newPage();

    // より自然なユーザーエージェント
    await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await this.page.setViewport({ width: 1920, height: 1080 });
    
    // 検出回避
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

  // モッピー全案件取得
  async scrapeAllMoppyCampaigns(testMode: boolean = false): Promise<ComprehensiveScrapeResult> {
    const startTime = Date.now();
    const result: ComprehensiveScrapeResult = {
      success: false,
      siteName: 'モッピー',
      campaigns: [],
      errors: [],
      stats: {
        totalPages: 0,
        totalCampaigns: 0,
        processingTimeMs: 0,
        lastPageReached: false
      },
      debug: {
        visitedUrls: [],
        pagesTitles: [],
        htmlSnippets: []
      }
    };

    try {
      if (!this.page) {
        throw new Error('Pageが初期化されていません');
      }

      console.log('🔍 モッピー全案件スクレイピング開始...');

      // 複数のカテゴリページから全案件を取得
      let categoryUrls = [
        'https://pc.moppy.jp/ad/category/1/', // ショッピング
        'https://pc.moppy.jp/ad/category/2/', // サービス
        'https://pc.moppy.jp/ad/category/3/', // クレジットカード
        'https://pc.moppy.jp/ad/category/4/', // 口座開設・投資
        'https://pc.moppy.jp/ad/category/5/', // 美容・健康
        'https://pc.moppy.jp/ad/category/6/', // 旅行・予約
        'https://pc.moppy.jp/ad/category/7/', // アプリ・ゲーム
        'https://pc.moppy.jp/ad/category/8/', // 無料登録・資料請求
        'https://pc.moppy.jp/ad/category/9/', // 動画・音楽
        'https://pc.moppy.jp/ad/category/10/', // 学習・教育
        'https://pc.moppy.jp/ad/', // 全案件リスト
      ];

      // テストモードの場合は1つのカテゴリのみ処理
      if (testMode) {
        categoryUrls = ['https://pc.moppy.jp/ad/category/1/']; // ショッピングのみ
        console.log('🧪 テストモード: ショッピングカテゴリのみ処理');
      }

      const processedUrls = new Set<string>();
      const allCampaigns = new Map<string, ComprehensiveCampaign>();

      for (const categoryUrl of categoryUrls) {
        try {
          console.log(`📂 カテゴリ処理中: ${categoryUrl}`);
          
          const categoryResult = await this.scrapeCategoryPages(categoryUrl, testMode);
          result.debug.visitedUrls.push(...categoryResult.visitedUrls);
          result.debug.pagesTitles.push(...categoryResult.pagesTitles);
          result.stats.totalPages += categoryResult.totalPages;

          // 重複除去して追加
          categoryResult.campaigns.forEach(campaign => {
            const key = `${campaign.name}-${campaign.siteName}`;
            if (!allCampaigns.has(key)) {
              allCampaigns.set(key, campaign);
            }
          });

          result.errors.push(...categoryResult.errors);

          // カテゴリ間で休憩
          await this.randomDelay(3000, 5000);

        } catch (error) {
          console.error(`カテゴリ ${categoryUrl} 処理エラー:`, error);
          result.errors.push(`カテゴリ処理エラー: ${categoryUrl} - ${error}`);
        }
      }

      result.campaigns = Array.from(allCampaigns.values());
      result.stats.totalCampaigns = result.campaigns.length;
      result.stats.processingTimeMs = Date.now() - startTime;
      result.success = result.campaigns.length > 0;

      console.log(`✅ モッピー全案件スクレイピング完了: ${result.campaigns.length}件取得`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('モッピー全案件スクレイピングエラー:', error);
      result.errors.push(`全体エラー: ${errorMessage}`);
      if (error instanceof Error && error.stack) {
        console.error('スタックトレース:', error.stack);
      }
    }

    return result;
  }

  // カテゴリページの全ページを処理
  private async scrapeCategoryPages(categoryUrl: string, testMode: boolean = false): Promise<{
    campaigns: ComprehensiveCampaign[];
    errors: string[];
    visitedUrls: string[];
    pagesTitles: string[];
    totalPages: number;
  }> {
    const categoryResult = {
      campaigns: [] as ComprehensiveCampaign[],
      errors: [] as string[],
      visitedUrls: [] as string[],
      pagesTitles: [] as string[],
      totalPages: 0
    };

    try {
      // 最初のページにアクセス
      await this.page!.goto(categoryUrl, { waitUntil: 'networkidle2' });
      await this.randomDelay(2000, 4000);

      let currentPage = 1;
      let hasNextPage = true;

      const maxPages = testMode ? 2 : 10; // テストモードでは2ページまで
      while (hasNextPage && currentPage <= maxPages) {
        try {
          console.log(`📄 ページ ${currentPage} 処理中...`);
          
          const pageUrl = currentPage === 1 ? categoryUrl : `${categoryUrl}?page=${currentPage}`;
          
          if (currentPage > 1) {
            await this.page!.goto(pageUrl, { waitUntil: 'networkidle2' });
            await this.randomDelay(2000, 4000);
          }

          categoryResult.visitedUrls.push(pageUrl);
          categoryResult.pagesTitles.push(await this.page!.title());
          categoryResult.totalPages++;

          // ページの案件を取得
          const pageCampaigns = await this.extractCampaignsFromPage();
          categoryResult.campaigns.push(...pageCampaigns);

          console.log(`📊 ページ ${currentPage}: ${pageCampaigns.length}件取得`);

          // 次のページの存在チェック
          hasNextPage = await this.hasNextPage();
          currentPage++;

          if (hasNextPage) {
            await this.randomDelay(3000, 5000);
          }

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

  // ページから案件を抽出
  private async extractCampaignsFromPage(): Promise<ComprehensiveCampaign[]> {
    const html = await this.page!.content();
    const $ = cheerio.load(html);
    const campaigns: ComprehensiveCampaign[] = [];

    // より包括的なセレクタで案件を検索
    const selectors = [
      '.service-list .service-item',
      '.ad-list .ad-item', 
      '.campaign-list .campaign-item',
      '.shop-list .shop-item',
      '.point-list .point-item',
      '[class*="service"][class*="item"]',
      '[class*="ad"][class*="item"]',
      '[class*="campaign"][class*="item"]',
      '[class*="shop"][class*="item"]',
      'article[class*="item"]',
      'div[class*="item"]',
      'li[class*="item"]',
      'a[href*="/ad/"]',
      'a[href*="/service/"]',
      'a[href*="/campaign/"]'
    ];

    for (const selector of selectors) {
      const elements = $(selector);
      
      if (elements.length > 0) {
        console.log(`🔍 セレクタ "${selector}": ${elements.length}件発見`);
        
        elements.each((index, element) => {
          try {
            const campaign = this.extractCampaignFromElement($, $(element));
            if (campaign && campaign.name && campaign.cashbackRate) {
              campaigns.push(campaign);
            }
          } catch (error) {
            // 個別要素のエラーは無視
          }
        });

        if (campaigns.length > 0) {
          break; // 最初に成功したセレクタで十分
        }
      }
    }

    return campaigns;
  }

  // 要素から案件情報を抽出
  private extractCampaignFromElement($: cheerio.CheerioAPI, $el: cheerio.Cheerio<any>): ComprehensiveCampaign | null {
    try {
      // 案件名を抽出
      const name = this.extractText($el, [
        '.title', '.name', '.service-name', '.ad-title', '.campaign-title',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        '.text', '.label', '.shop-name',
        '[title]'
      ]) || $el.attr('title') || '';

      if (!name || name.length < 2) return null;

      // 還元率を抽出
      const cashbackRate = this.extractText($el, [
        '.point', '.rate', '.mp', '.moppy-point', '.reward', '.cashback',
        '[class*="point"]', '[class*="rate"]', '[class*="mp"]', '[class*="reward"]',
        '.price', '.amount', '.value', '.percent'
      ]);

      if (!cashbackRate) return null;

      // 正規化された還元率
      const normalizedCashback = this.normalizeCashbackRate(cashbackRate);
      const isPercentage = cashbackRate.includes('%') || cashbackRate.includes('％');

      // URL抽出
      const url = this.extractUrl($el, 'https://pc.moppy.jp');

      // 説明文抽出
      const description = this.extractText($el, [
        '.description', '.desc', '.detail', '.summary',
        'p', '.text'
      ]) || $el.text().trim().substring(0, 200);

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

  // テキスト抽出ヘルパー
  private extractText($el: cheerio.Cheerio<any>, selectors: string[]): string {
    for (const selector of selectors) {
      const text = $el.find(selector).first().text().trim();
      if (text && text.length > 0) return text;
    }
    return '';
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

  // 還元率正規化 (1P=1円換算)
  private normalizeCashbackRate(text: string): string {
    if (!text) return '0円';
    
    // 前処理：余計な文字を除去
    let cleanText = text.replace(/[,，\s]/g, '').trim();
    
    // パーセント表記はそのまま（優先）
    if (cleanText.includes('%') || cleanText.includes('％')) {
      const match = cleanText.match(/[\d.]+/);
      const result = match ? `${match[0]}%` : '0%';
      return result;
    }
    
    // ポイント表記は円に変換 (1P=1円) - モッピーの場合
    if (cleanText.includes('P') || cleanText.includes('ポイント') || cleanText.includes('pt')) {
      // 数字部分を抽出（カンマも考慮）
      const match = cleanText.match(/[\d,，]+/);
      if (match) {
        const points = parseInt(match[0].replace(/[,，]/g, ''));
        const result = `${points.toLocaleString()}円`;
        return result;
      }
    }
    
    // 円表記はそのまま
    if (cleanText.includes('円')) {
      const match = cleanText.match(/[\d,，]+/);
      if (match) {
        const yen = parseInt(match[0].replace(/[,，]/g, ''));
        const result = `${yen.toLocaleString()}円`;
        return result;
      }
    }
    
    // 数字のみの場合はポイントとして扱い円に変換
    const numberMatch = cleanText.match(/^[\d,，]+$/);
    if (numberMatch) {
      const number = parseInt(numberMatch[0].replace(/[,，]/g, ''));
      const result = `${number.toLocaleString()}円`;
      return result;
    }
    
    // その他の場合は元のテキストを短縮して返す
    const result = text.substring(0, 20);
    return result;
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

  // 次のページが存在するかチェック
  private async hasNextPage(): Promise<boolean> {
    try {
      const nextPageSelectors = [
        'a[href*="page="]:contains("次")',
        'a[href*="page="]:contains(">")',
        '.pager a[href*="page="]',
        '.pagination a[href*="page="]',
        'a.next',
        'a[rel="next"]'
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