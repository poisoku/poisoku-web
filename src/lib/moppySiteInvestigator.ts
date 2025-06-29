import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';

export interface SiteStructureAnalysis {
  siteName: string;
  totalPagesFound: number;
  navigationStructure: {
    mainCategories: string[];
    subCategories: string[];
    paginationInfo: {
      maxPageFound: number;
      paginationPattern: string;
      itemsPerPage: number;
    };
  };
  campaignStructure: {
    listSelectors: string[];
    itemSelectors: string[];
    nameSelectors: string[];
    cashbackSelectors: string[];
    urlSelectors: string[];
  };
  urlPatterns: {
    categoryUrls: string[];
    paginationUrls: string[];
    searchUrls: string[];
  };
  estimatedTotalCampaigns: number;
  recommendations: string[];
}

export class MoppySiteInvestigator {
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
      '--ignore-certificate-errors-spki-list'
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

  async investigateMoppyStructure(): Promise<SiteStructureAnalysis> {
    const analysis: SiteStructureAnalysis = {
      siteName: 'モッピー',
      totalPagesFound: 0,
      navigationStructure: {
        mainCategories: [],
        subCategories: [],
        paginationInfo: {
          maxPageFound: 0,
          paginationPattern: '',
          itemsPerPage: 0
        }
      },
      campaignStructure: {
        listSelectors: [],
        itemSelectors: [],
        nameSelectors: [],
        cashbackSelectors: [],
        urlSelectors: []
      },
      urlPatterns: {
        categoryUrls: [],
        paginationUrls: [],
        searchUrls: []
      },
      estimatedTotalCampaigns: 0,
      recommendations: []
    };

    try {
      if (!this.page) {
        throw new Error('Pageが初期化されていません');
      }

      console.log('🔍 モッピーサイト構造調査開始...');

      // 1. メインページの構造調査
      await this.page.goto('https://pc.moppy.jp/', { waitUntil: 'networkidle2' });
      await this.randomDelay(2000, 4000);

      const mainPageAnalysis = await this.analyzeMainPage();
      analysis.navigationStructure.mainCategories = mainPageAnalysis.categories;
      analysis.urlPatterns.categoryUrls = mainPageAnalysis.categoryUrls;

      // 2. 案件リストページの構造調査
      await this.page.goto('https://pc.moppy.jp/ad/', { waitUntil: 'networkidle2' });
      await this.randomDelay(2000, 4000);

      const listPageAnalysis = await this.analyzeListPage();
      analysis.campaignStructure = listPageAnalysis.campaignStructure;
      analysis.navigationStructure.paginationInfo = listPageAnalysis.paginationInfo;

      // 3. カテゴリページの詳細調査
      const categoryAnalysis = await this.analyzeCategoryPages(analysis.urlPatterns.categoryUrls);
      analysis.urlPatterns.paginationUrls = categoryAnalysis.paginationUrls;
      analysis.totalPagesFound = categoryAnalysis.totalPages;

      // 4. 総案件数の推定
      analysis.estimatedTotalCampaigns = this.estimateTotalCampaigns(analysis);

      // 5. 推奨事項の生成
      analysis.recommendations = this.generateRecommendations(analysis);

      console.log('✅ モッピーサイト構造調査完了');

    } catch (error) {
      console.error('モッピーサイト構造調査エラー:', error);
      analysis.recommendations.push(`調査エラー: ${error}`);
    }

    return analysis;
  }

  // メインページの構造分析
  private async analyzeMainPage(): Promise<{
    categories: string[];
    categoryUrls: string[];
  }> {
    const html = await this.page!.content();
    const $ = cheerio.load(html);

    const categories: string[] = [];
    const categoryUrls: string[] = [];

    // カテゴリリンクを検索
    const categorySelectors = [
      'nav a[href*="/ad/category/"]',
      '.category a[href*="/category/"]',
      '.nav a[href*="/ad/"]',
      'a[href*="/ad/category/"]'
    ];

    for (const selector of categorySelectors) {
      $(selector).each((index, element) => {
        const $el = $(element);
        const text = $el.text().trim();
        const href = $el.attr('href');
        
        if (text && href) {
          categories.push(text);
          const fullUrl = href.startsWith('http') ? href : `https://pc.moppy.jp${href}`;
          categoryUrls.push(fullUrl);
        }
      });
    }

    // デフォルトカテゴリURLも追加
    const defaultCategories = [
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

    defaultCategories.forEach(url => {
      if (!categoryUrls.includes(url)) {
        categoryUrls.push(url);
      }
    });

    console.log(`📂 発見されたカテゴリ: ${categories.length}個`);
    console.log(`🔗 カテゴリURL: ${categoryUrls.length}個`);

    return { categories, categoryUrls };
  }

  // リストページの構造分析
  private async analyzeListPage(): Promise<{
    campaignStructure: SiteStructureAnalysis['campaignStructure'];
    paginationInfo: SiteStructureAnalysis['navigationStructure']['paginationInfo'];
  }> {
    const html = await this.page!.content();
    const $ = cheerio.load(html);

    const campaignStructure: SiteStructureAnalysis['campaignStructure'] = {
      listSelectors: [],
      itemSelectors: [],
      nameSelectors: [],
      cashbackSelectors: [],
      urlSelectors: []
    };

    // 案件リストのセレクタを発見
    const possibleListSelectors = [
      '.service-list', '.ad-list', '.campaign-list', '.shop-list',
      '.point-list', '.item-list', '.product-list', '.offer-list',
      '[class*="service"][class*="list"]',
      '[class*="ad"][class*="list"]',
      '[class*="campaign"][class*="list"]',
      'ul[class*="list"]', 'div[class*="list"]'
    ];

    for (const selector of possibleListSelectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        campaignStructure.listSelectors.push(selector);
        console.log(`📋 リストセレクタ発見: ${selector} (${elements.length}個)`);
      }
    }

    // 案件アイテムのセレクタを発見
    const possibleItemSelectors = [
      '.service-item', '.ad-item', '.campaign-item', '.shop-item',
      '.point-item', '.item', '.product-item', '.offer-item',
      '[class*="service"][class*="item"]',
      '[class*="ad"][class*="item"]',
      '[class*="campaign"][class*="item"]',
      'li[class*="item"]', 'div[class*="item"]',
      'article', '.card'
    ];

    for (const selector of possibleItemSelectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        campaignStructure.itemSelectors.push(selector);
        console.log(`📦 アイテムセレクタ発見: ${selector} (${elements.length}個)`);
      }
    }

    // ページネーション情報の分析
    const paginationInfo = {
      maxPageFound: 0,
      paginationPattern: '',
      itemsPerPage: 0
    };

    const paginationSelectors = [
      '.pagination a', '.pager a', '.page-nav a',
      'a[href*="page="]', 'a[href*="p="]',
      '[class*="pagination"] a', '[class*="pager"] a'
    ];

    for (const selector of paginationSelectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        paginationInfo.paginationPattern = selector;
        
        // 最大ページ数を検索
        elements.each((index, element) => {
          const $el = $(element);
          const href = $el.attr('href') || '';
          const text = $el.text().trim();
          
          // URLから最大ページ数を抽出
          const pageMatch = href.match(/page=(\d+)|p=(\d+)/);
          if (pageMatch) {
            const pageNum = parseInt(pageMatch[1] || pageMatch[2]);
            if (pageNum > paginationInfo.maxPageFound) {
              paginationInfo.maxPageFound = pageNum;
            }
          }
          
          // テキストから最大ページ数を抽出
          const textMatch = text.match(/(\d+)/);
          if (textMatch) {
            const pageNum = parseInt(textMatch[1]);
            if (pageNum > paginationInfo.maxPageFound) {
              paginationInfo.maxPageFound = pageNum;
            }
          }
        });
        
        break; // 最初に見つかったパターンを使用
      }
    }

    // 1ページあたりのアイテム数を計算
    const totalItems = Math.max(
      ...campaignStructure.itemSelectors.map(selector => $(selector).length)
    );
    paginationInfo.itemsPerPage = totalItems;

    console.log(`📄 ページネーション: 最大${paginationInfo.maxPageFound}ページ、1ページ${paginationInfo.itemsPerPage}件`);

    return { campaignStructure, paginationInfo };
  }

  // カテゴリページの詳細分析
  private async analyzeCategoryPages(categoryUrls: string[]): Promise<{
    paginationUrls: string[];
    totalPages: number;
  }> {
    const paginationUrls: string[] = [];
    let totalPages = 0;

    // 最初の3つのカテゴリだけをサンプル調査
    const sampleUrls = categoryUrls.slice(0, 3);

    for (const categoryUrl of sampleUrls) {
      try {
        console.log(`🔍 カテゴリ調査中: ${categoryUrl}`);
        
        await this.page!.goto(categoryUrl, { waitUntil: 'networkidle2' });
        await this.randomDelay(2000, 4000);

        const html = await this.page!.content();
        const $ = cheerio.load(html);

        // このカテゴリの最大ページ数を調査
        let maxPageInCategory = 1;
        
        const paginationLinks = $('a[href*="page="], a[href*="p="]');
        paginationLinks.each((index, element) => {
          const $el = $(element);
          const href = $el.attr('href') || '';
          const pageMatch = href.match(/page=(\d+)|p=(\d+)/);
          if (pageMatch) {
            const pageNum = parseInt(pageMatch[1] || pageMatch[2]);
            if (pageNum > maxPageInCategory) {
              maxPageInCategory = pageNum;
            }
            
            // ページネーションURLを記録
            const fullUrl = href.startsWith('http') ? href : `https://pc.moppy.jp${href}`;
            if (!paginationUrls.includes(fullUrl)) {
              paginationUrls.push(fullUrl);
            }
          }
        });

        totalPages += maxPageInCategory;
        console.log(`📊 ${categoryUrl}: ${maxPageInCategory}ページ`);

      } catch (error) {
        console.error(`カテゴリ調査エラー ${categoryUrl}:`, error);
      }

      await this.randomDelay(3000, 5000); // カテゴリ間の待機
    }

    return { paginationUrls, totalPages };
  }

  // 総案件数の推定
  private estimateTotalCampaigns(analysis: SiteStructureAnalysis): number {
    const itemsPerPage = analysis.navigationStructure.paginationInfo.itemsPerPage || 20;
    const totalPages = analysis.totalPagesFound || 100; // 保守的な推定
    const categoryCount = analysis.urlPatterns.categoryUrls.length || 10;
    
    // カテゴリ数 × ページ数 × アイテム数で推定
    const estimated = categoryCount * Math.max(totalPages / categoryCount, 10) * itemsPerPage;
    
    console.log(`📈 推定総案件数: ${estimated}件 (${categoryCount}カテゴリ × 平均${Math.ceil(totalPages / categoryCount)}ページ × ${itemsPerPage}件)`);
    
    return estimated;
  }

  // 推奨事項の生成
  private generateRecommendations(analysis: SiteStructureAnalysis): string[] {
    const recommendations: string[] = [];

    if (analysis.navigationStructure.paginationInfo.maxPageFound === 0) {
      recommendations.push('ページネーションが検出されませんでした。全ページを取得するための別の方法を検討してください。');
    }

    if (analysis.campaignStructure.itemSelectors.length === 0) {
      recommendations.push('案件アイテムのセレクタが検出されませんでした。より包括的なセレクタを使用してください。');
    }

    if (analysis.estimatedTotalCampaigns < 1000) {
      recommendations.push('推定案件数が少なすぎます。より多くのカテゴリやページを対象にしてください。');
    }

    if (analysis.urlPatterns.categoryUrls.length < 5) {
      recommendations.push('カテゴリURLが少ないです。より多くのカテゴリを発見する必要があります。');
    }

    recommendations.push('各カテゴリで全ページを確実に処理するように、ページネーション処理を改善してください。');
    recommendations.push('スクレイピング速度を向上させるため、並列処理の導入を検討してください。');
    
    return recommendations;
  }

  // ランダム待機
  private async randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}