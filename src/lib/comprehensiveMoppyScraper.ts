import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';

export interface ComprehensiveCampaign {
  name: string;
  cashbackRate: string;
  normalizedCashback: string;
  url: string;
  description?: string;
  siteName: string;
  category: string;
  isPercentage: boolean;
}

export interface ComprehensiveScrapeResult {
  success: boolean;
  siteName: string;
  campaigns: ComprehensiveCampaign[];
  errors: string[];
  stats: {
    totalCategories: number;
    totalPagesProcessed: number;
    totalCampaigns: number;
    processingTimeMs: number;
    averageCampaignsPerCategory: number;
    targetAchieved: boolean;
    duplicatesRemoved: number;
    categoriesScraped: string[];
  };
  debug: {
    categoryResults: Record<string, number>;
    pageResults: Record<string, number>;
    effectiveSelectors: string[];
    processingLog: string[];
  };
}

export class ComprehensiveMoppyScraper {
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

    await this.page.setDefaultTimeout(60000);
    await this.page.setDefaultNavigationTimeout(60000);
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

  // 包括的モッピー全案件取得（どこ得方式）
  async scrapeAllMoppyComprehensive(): Promise<ComprehensiveScrapeResult> {
    const startTime = Date.now();
    const result: ComprehensiveScrapeResult = {
      success: false,
      siteName: 'モッピー',
      campaigns: [],
      errors: [],
      stats: {
        totalCategories: 0,
        totalPagesProcessed: 0,
        totalCampaigns: 0,
        processingTimeMs: 0,
        averageCampaignsPerCategory: 0,
        targetAchieved: false,
        duplicatesRemoved: 0,
        categoriesScraped: []
      },
      debug: {
        categoryResults: {},
        pageResults: {},
        effectiveSelectors: [],
        processingLog: []
      }
    };

    try {
      if (!this.page) {
        throw new Error('Pageが初期化されていません');
      }

      console.log('🎯 モッピー包括的スクレイピング開始（どこ得方式）...');
      console.log('   階層的アプローチ: カテゴリ → サブカテゴリ → 個別案件');
      console.log('   目標: 6,000件以上の案件取得');

      // どこ得方式の階層的URL戦略
      const comprehensiveCategories = [
        // メインカテゴリ
        { 
          url: 'https://pc.moppy.jp/service/', 
          name: 'メイン案件',
          description: 'メイン案件ページ（全案件）',
          maxPages: 50,
          priority: 'high'
        },
        
        // ショッピングカテゴリ詳細
        { 
          url: 'https://pc.moppy.jp/category/list.php?parent_category=1', 
          name: 'ショッピング全般',
          description: 'ショッピング全カテゴリ',
          maxPages: 30,
          priority: 'high'
        },
        { 
          url: 'https://pc.moppy.jp/category/list.php?parent_category=1&child_category=11', 
          name: 'ネットショッピング',
          description: 'ネットショッピング',
          maxPages: 25,
          priority: 'high'
        },
        { 
          url: 'https://pc.moppy.jp/category/list.php?parent_category=1&child_category=12', 
          name: 'ファッション',
          description: 'ファッション・アパレル',
          maxPages: 15,
          priority: 'medium'
        },
        { 
          url: 'https://pc.moppy.jp/category/list.php?parent_category=1&child_category=13', 
          name: '美容・コスメ',
          description: '美容・コスメ',
          maxPages: 20,
          priority: 'medium'
        },
        { 
          url: 'https://pc.moppy.jp/category/list.php?parent_category=1&child_category=14', 
          name: '食品・グルメ',
          description: '食品・グルメ',
          maxPages: 10,
          priority: 'medium'
        },
        
        // 金融カテゴリ詳細
        { 
          url: 'https://pc.moppy.jp/category/list.php?parent_category=3', 
          name: '金融全般',
          description: '金融全カテゴリ',
          maxPages: 20,
          priority: 'high'
        },
        { 
          url: 'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=31', 
          name: 'クレジットカード',
          description: 'クレジットカード',
          maxPages: 15,
          priority: 'high'
        },
        { 
          url: 'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=32', 
          name: '銀行・証券',
          description: '銀行・証券',
          maxPages: 10,
          priority: 'high'
        },
        { 
          url: 'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=33', 
          name: 'FX・投資',
          description: 'FX・投資',
          maxPages: 8,
          priority: 'medium'
        },
        { 
          url: 'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=34', 
          name: '保険',
          description: '保険',
          maxPages: 5,
          priority: 'medium'
        },
        
        // エンタメカテゴリ詳細
        { 
          url: 'https://pc.moppy.jp/category/list.php?parent_category=2', 
          name: 'エンタメ全般',
          description: 'エンタメ全カテゴリ',
          maxPages: 15,
          priority: 'medium'
        },
        { 
          url: 'https://pc.moppy.jp/category/list.php?parent_category=2&child_category=21', 
          name: '動画・音楽',
          description: '動画・音楽配信',
          maxPages: 10,
          priority: 'medium'
        },
        { 
          url: 'https://pc.moppy.jp/category/list.php?parent_category=2&child_category=22', 
          name: 'ゲーム',
          description: 'ゲーム・アプリ',
          maxPages: 12,
          priority: 'medium'
        },
        
        // その他カテゴリ
        { 
          url: 'https://pc.moppy.jp/category/list.php?parent_category=4', 
          name: 'その他全般',
          description: 'その他全カテゴリ',
          maxPages: 10,
          priority: 'medium'
        },
        { 
          url: 'https://pc.moppy.jp/category/list.php?parent_category=5', 
          name: '旅行・出張',
          description: '旅行・出張',
          maxPages: 8,
          priority: 'medium'
        },
        
        // 検索ベースの取得
        { 
          url: 'https://pc.moppy.jp/search/?q=楽天', 
          name: '楽天検索',
          description: '楽天関連案件',
          maxPages: 20,
          priority: 'high'
        },
        { 
          url: 'https://pc.moppy.jp/search/?q=Amazon', 
          name: 'Amazon検索',
          description: 'Amazon関連案件',
          maxPages: 15,
          priority: 'high'
        },
        { 
          url: 'https://pc.moppy.jp/search/?q=Yahoo', 
          name: 'Yahoo検索',
          description: 'Yahoo関連案件',
          maxPages: 15,
          priority: 'high'
        },
        { 
          url: 'https://pc.moppy.jp/search/?q=', 
          name: '全案件検索',
          description: '空クエリ全案件検索',
          maxPages: 50,
          priority: 'high'
        },
        
        // 追加の大手キーワード検索
        { 
          url: 'https://pc.moppy.jp/search/?q=au', 
          name: 'au検索',
          description: 'au関連案件',
          maxPages: 10,
          priority: 'high'
        },
        { 
          url: 'https://pc.moppy.jp/search/?q=docomo', 
          name: 'docomo検索',
          description: 'docomo関連案件',
          maxPages: 10,
          priority: 'high'
        },
        { 
          url: 'https://pc.moppy.jp/search/?q=SoftBank', 
          name: 'SoftBank検索',
          description: 'SoftBank関連案件',
          maxPages: 10,
          priority: 'high'
        },
        { 
          url: 'https://pc.moppy.jp/search/?q=カード', 
          name: 'カード検索',
          description: 'カード関連案件',
          maxPages: 20,
          priority: 'high'
        },
        { 
          url: 'https://pc.moppy.jp/search/?q=証券', 
          name: '証券検索',
          description: '証券関連案件',
          maxPages: 10,
          priority: 'high'
        },
        { 
          url: 'https://pc.moppy.jp/search/?q=銀行', 
          name: '銀行検索',
          description: '銀行関連案件',
          maxPages: 10,
          priority: 'high'
        },
        { 
          url: 'https://pc.moppy.jp/search/?q=旅行', 
          name: '旅行検索',
          description: '旅行関連案件',
          maxPages: 10,
          priority: 'medium'
        },
        { 
          url: 'https://pc.moppy.jp/search/?q=ホテル', 
          name: 'ホテル検索',
          description: 'ホテル関連案件',
          maxPages: 10,
          priority: 'medium'
        },
        { 
          url: 'https://pc.moppy.jp/search/?q=ゲーム', 
          name: 'ゲーム検索',
          description: 'ゲーム関連案件',
          maxPages: 10,
          priority: 'medium'
        },
        { 
          url: 'https://pc.moppy.jp/search/?q=アプリ', 
          name: 'アプリ検索',
          description: 'アプリ関連案件',
          maxPages: 10,
          priority: 'medium'
        },
        { 
          url: 'https://pc.moppy.jp/search/?q=保険', 
          name: '保険検索',
          description: '保険関連案件',
          maxPages: 8,
          priority: 'medium'
        },
        { 
          url: 'https://pc.moppy.jp/search/?q=美容', 
          name: '美容検索',
          description: '美容関連案件',
          maxPages: 10,
          priority: 'medium'
        },
        { 
          url: 'https://pc.moppy.jp/search/?q=健康', 
          name: '健康検索',
          description: '健康関連案件',
          maxPages: 8,
          priority: 'medium'
        },
        { 
          url: 'https://pc.moppy.jp/search/?q=食品', 
          name: '食品検索',
          description: '食品関連案件',
          maxPages: 8,
          priority: 'medium'
        },
        { 
          url: 'https://pc.moppy.jp/search/?q=ファッション', 
          name: 'ファッション検索',
          description: 'ファッション関連案件',
          maxPages: 8,
          priority: 'medium'
        },
        { 
          url: 'https://pc.moppy.jp/search/?q=コスメ', 
          name: 'コスメ検索',
          description: 'コスメ関連案件',
          maxPages: 8,
          priority: 'medium'
        },
        { 
          url: 'https://pc.moppy.jp/search/?q=資格', 
          name: '資格検索',
          description: '資格関連案件',
          maxPages: 5,
          priority: 'low'
        },
        { 
          url: 'https://pc.moppy.jp/search/?q=学習', 
          name: '学習検索',
          description: '学習関連案件',
          maxPages: 5,
          priority: 'low'
        },
        { 
          url: 'https://pc.moppy.jp/search/?q=転職', 
          name: '転職検索',
          description: '転職関連案件',
          maxPages: 5,
          priority: 'low'
        },
        { 
          url: 'https://pc.moppy.jp/search/?q=不動産', 
          name: '不動産検索',
          description: '不動産関連案件',
          maxPages: 5,
          priority: 'low'
        },
        { 
          url: 'https://pc.moppy.jp/search/?q=引越し', 
          name: '引越し検索',
          description: '引越し関連案件',
          maxPages: 5,
          priority: 'low'
        }
      ];

      // 最適化されたセレクタ（調査結果に基づく）
      const comprehensiveSelectors = [
        '[class*="item"]', // 最も効果的
        '[class*="service"]',
        '[class*="campaign"]',
        '[class*="ad"]'
      ];

      const allCampaigns = new Map<string, ComprehensiveCampaign>();
      let totalRawCampaigns = 0;
      result.stats.totalCategories = comprehensiveCategories.length;

      result.debug.processingLog.push(`開始: ${comprehensiveCategories.length}カテゴリの処理を開始`);

      // 優先度順にカテゴリを処理
      const sortedCategories = comprehensiveCategories.sort((a, b) => {
        const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

      // 各カテゴリを包括的に処理
      for (let i = 0; i < sortedCategories.length; i++) {
        const category = sortedCategories[i];
        
        try {
          console.log(`\n📂 カテゴリ処理 ${i + 1}/${sortedCategories.length}: ${category.name}`);
          console.log(`   URL: ${category.url}`);
          console.log(`   優先度: ${category.priority}`);
          console.log(`   最大ページ数: ${category.maxPages}`);
          
          const categoryResult = await this.processCategoryComprehensive(
            category.url,
            category.name,
            comprehensiveSelectors,
            category.maxPages
          );
          
          result.debug.categoryResults[category.name] = categoryResult.campaigns.length;
          result.stats.totalPagesProcessed += categoryResult.pagesProcessed;
          totalRawCampaigns += categoryResult.campaigns.length;
          
          // 重複除去しながら案件を追加
          let duplicatesFromThisCategory = 0;
          categoryResult.campaigns.forEach(campaign => {
            const key = `${campaign.name}-${campaign.cashbackRate}-${campaign.siteName}`;
            if (!allCampaigns.has(key) && campaign.name.length > 2) {
              allCampaigns.set(key, campaign);
            } else {
              duplicatesFromThisCategory++;
            }
          });

          result.errors.push(...categoryResult.errors);
          
          if (categoryResult.effectiveSelector) {
            result.debug.effectiveSelectors.push(categoryResult.effectiveSelector);
          }

          result.stats.categoriesScraped.push(category.name);

          console.log(`   → ${categoryResult.campaigns.length}件取得 (${categoryResult.pagesProcessed}ページ処理)`);
          console.log(`   → ${duplicatesFromThisCategory}件重複除去`);
          console.log(`   → 累計ユニーク案件: ${allCampaigns.size}件`);

          result.debug.processingLog.push(`${category.name}: ${categoryResult.campaigns.length}件取得, ${duplicatesFromThisCategory}件重複`);

          // 目標達成チェック
          if (allCampaigns.size >= 6000) {
            console.log(`🎉 目標6,000件達成！ 処理を継続して更に収集...`);
          }

          // カテゴリ間の待機時間（サーバー負荷軽減）
          if (i < sortedCategories.length - 1) {
            await this.delay(3000);
          }

        } catch (error) {
          const errorMsg = `カテゴリ ${category.name} 処理エラー: ${error}`;
          console.error(errorMsg);
          result.errors.push(errorMsg);
          result.debug.processingLog.push(`エラー: ${category.name} - ${error}`);
        }
      }

      result.campaigns = Array.from(allCampaigns.values());
      result.stats = {
        totalCategories: comprehensiveCategories.length,
        totalPagesProcessed: result.stats.totalPagesProcessed,
        totalCampaigns: result.campaigns.length,
        processingTimeMs: Date.now() - startTime,
        averageCampaignsPerCategory: result.stats.totalCategories > 0 ? 
          result.campaigns.length / result.stats.totalCategories : 0,
        targetAchieved: result.campaigns.length >= 6000,
        duplicatesRemoved: totalRawCampaigns - result.campaigns.length,
        categoriesScraped: result.stats.categoriesScraped
      };

      result.success = result.campaigns.length > 0;

      console.log(`\n✅ 包括的スクレイピング完了:`);
      console.log(`   処理カテゴリ数: ${result.stats.totalCategories}`);
      console.log(`   処理ページ数: ${result.stats.totalPagesProcessed}`);
      console.log(`   総取得数（重複込み）: ${totalRawCampaigns.toLocaleString()}件`);
      console.log(`   ユニーク案件数: ${result.campaigns.length.toLocaleString()}件`);
      console.log(`   重複除去数: ${result.stats.duplicatesRemoved.toLocaleString()}件`);
      console.log(`   目標6,000件達成: ${result.stats.targetAchieved ? 'Yes' : 'No'}`);
      console.log(`   処理時間: ${(result.stats.processingTimeMs / 1000 / 60).toFixed(1)}分`);

      result.debug.processingLog.push(`完了: ${result.campaigns.length}件のユニーク案件を取得`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('包括的スクレイピングエラー:', error);
      result.errors.push(`全体エラー: ${errorMessage}`);
      result.debug.processingLog.push(`全体エラー: ${errorMessage}`);
    }

    return result;
  }

  // カテゴリ包括処理
  private async processCategoryComprehensive(
    baseUrl: string,
    categoryName: string,
    selectors: string[],
    maxPages: number
  ): Promise<{
    campaigns: ComprehensiveCampaign[];
    errors: string[];
    effectiveSelector?: string;
    pagesProcessed: number;
  }> {
    const categoryResult = {
      campaigns: [] as ComprehensiveCampaign[],
      errors: [] as string[],
      effectiveSelector: undefined as string | undefined,
      pagesProcessed: 0
    };

    try {
      console.log(`     📄 ページネーション処理開始 (最大${maxPages}ページ)...`);

      // ページ1から開始
      for (let page = 1; page <= maxPages; page++) {
        try {
          const pageUrl = this.buildPageUrl(baseUrl, page);
          
          console.log(`       ページ ${page}/${maxPages} 処理中...`);
          
          const pageResult = await this.processPageComprehensive(pageUrl, selectors);
          
          if (pageResult.campaigns.length === 0) {
            console.log(`       → ページ ${page}: 案件なし, 処理終了`);
            break; // 案件がない場合は終了
          }
          
          categoryResult.campaigns.push(...pageResult.campaigns);
          categoryResult.errors.push(...pageResult.errors);
          categoryResult.pagesProcessed++;
          
          if (pageResult.effectiveSelector && !categoryResult.effectiveSelector) {
            categoryResult.effectiveSelector = pageResult.effectiveSelector;
          }
          
          console.log(`       → ページ ${page}: ${pageResult.campaigns.length}件取得`);
          
          // ページ間の待機時間
          if (page < maxPages) {
            await this.delay(2000);
          }
          
        } catch (pageError) {
          categoryResult.errors.push(`ページ ${page} 処理エラー: ${pageError}`);
          console.log(`       → ページ ${page}: エラー発生, 次のページへ`);
          continue;
        }
      }

    } catch (error) {
      categoryResult.errors.push(`カテゴリ処理エラー: ${error}`);
    }

    return categoryResult;
  }

  // 単一ページ処理
  private async processPageComprehensive(
    url: string,
    selectors: string[]
  ): Promise<{
    campaigns: ComprehensiveCampaign[];
    errors: string[];
    effectiveSelector?: string;
  }> {
    const pageResult = {
      campaigns: [] as ComprehensiveCampaign[],
      errors: [] as string[],
      effectiveSelector: undefined as string | undefined
    };

    try {
      await this.page!.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
      
      // JavaScript読み込み完了まで待機
      await this.delay(10000);

      // HTML取得してスクレイピング
      const html = await this.page!.content();
      const $ = cheerio.load(html);

      // 各セレクタを試して最も効果的なものを特定
      for (const selector of selectors) {
        try {
          const elements = $(selector);
          
          if (elements.length > 0) {
            const campaigns = await this.extractCampaignsComprehensive($, elements, selector);
            
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
      pageResult.errors.push(`ページ処理エラー: ${error}`);
    }

    return pageResult;
  }

  // ページURL構築
  private buildPageUrl(baseUrl: string, pageNumber: number): string {
    if (pageNumber === 1) {
      return baseUrl;
    }
    
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}page=${pageNumber}`;
  }

  // 案件抽出
  private async extractCampaignsComprehensive(
    $: cheerio.CheerioAPI, 
    elements: cheerio.Cheerio<any>, 
    selector: string
  ): Promise<ComprehensiveCampaign[]> {
    const campaigns: ComprehensiveCampaign[] = [];

    elements.each((index, element) => {
      try {
        const campaign = this.extractSingleCampaignComprehensive($, $(element));
        if (campaign) {
          campaigns.push(campaign);
        }
      } catch (error) {
        // 個別要素のエラーは無視して続行
      }
    });

    // 重複除去
    const uniqueCampaigns = new Map<string, ComprehensiveCampaign>();
    campaigns.forEach(campaign => {
      const key = `${campaign.name}-${campaign.cashbackRate}`;
      if (!uniqueCampaigns.has(key) && campaign.name.length > 2) {
        uniqueCampaigns.set(key, campaign);
      }
    });

    return Array.from(uniqueCampaigns.values());
  }

  // 単一案件抽出
  private extractSingleCampaignComprehensive($: cheerio.CheerioAPI, $el: cheerio.Cheerio<any>): ComprehensiveCampaign | null {
    try {
      // 名前抽出
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

      // 還元率抽出
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