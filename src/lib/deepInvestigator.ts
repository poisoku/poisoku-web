import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';

export interface DeepInvestigationResult {
  siteName: string;
  investigationTime: number;
  findings: {
    actualCampaignPages: Array<{
      url: string;
      title: string;
      campaignCount: number;
      htmlStructure: string;
      selectors: {
        campaignElements: string[];
        nameElements: string[];
        priceElements: string[];
        linkElements: string[];
      };
    }>;
    paginationAnalysis: {
      hasNextPage: boolean;
      paginationUrls: string[];
      maxPageFound: number;
      paginationPattern: string;
    };
    realStructure: {
      mostEffectiveSelectors: string[];
      campaignElementStructure: string;
      dataPatterns: string[];
    };
  };
  recommendations: string[];
  htmlSamples: string[];
}

export class DeepInvestigator {
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
      headless: false, // ヘッドレスモードをオフにして実際の表示を確認
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

  async investigateMoppyDeep(): Promise<DeepInvestigationResult> {
    const startTime = Date.now();
    
    const result: DeepInvestigationResult = {
      siteName: 'モッピー',
      investigationTime: 0,
      findings: {
        actualCampaignPages: [],
        paginationAnalysis: {
          hasNextPage: false,
          paginationUrls: [],
          maxPageFound: 0,
          paginationPattern: ''
        },
        realStructure: {
          mostEffectiveSelectors: [],
          campaignElementStructure: '',
          dataPatterns: []
        }
      },
      recommendations: [],
      htmlSamples: []
    };

    try {
      if (!this.page) {
        throw new Error('Page が初期化されていません');
      }

      console.log('🔍 モッピー深層調査開始...');

      // 1. メインサイトの調査
      await this.investigateMainSite(result);
      
      // 2. 案件リストページの詳細調査
      await this.investigateCampaignListPages(result);
      
      // 3. 異なるアプローチでの案件発見
      await this.investigateAlternativePages(result);
      
      // 4. 実際のHTML構造の詳細分析
      await this.analyzeHTMLStructure(result);
      
      // 5. 推奨事項の生成
      this.generateRecommendations(result);

      result.investigationTime = Date.now() - startTime;
      console.log('✅ 深層調査完了');

    } catch (error) {
      console.error('深層調査エラー:', error);
      result.recommendations.push(`調査エラー: ${error}`);
    }

    return result;
  }

  // メインサイトの調査
  private async investigateMainSite(result: DeepInvestigationResult): Promise<void> {
    console.log('📋 メインサイト調査中...');
    
    await this.page!.goto('https://pc.moppy.jp/', { waitUntil: 'networkidle2' });
    await this.delay(3000);

    const html = await this.page!.content();
    const $ = cheerio.load(html);
    
    // 案件リンクを探す
    const campaignLinks: string[] = [];
    $('a').each((index, element) => {
      const href = $(element).attr('href');
      const text = $(element).text().trim();
      
      if (href && (
        href.includes('/ad/') || 
        href.includes('/service/') || 
        href.includes('/campaign/') ||
        href.includes('案件') ||
        text.includes('案件') ||
        text.includes('サービス') ||
        text.includes('ショッピング')
      )) {
        const fullUrl = href.startsWith('http') ? href : `https://pc.moppy.jp${href}`;
        if (!campaignLinks.includes(fullUrl)) {
          campaignLinks.push(fullUrl);
        }
      }
    });

    console.log(`🔗 発見された案件関連リンク: ${campaignLinks.length}個`);
    
    // 最初のHTMLサンプルを保存
    result.htmlSamples.push(`メインページ HTML サンプル:\n${html.substring(0, 2000)}`);
  }

  // 案件リストページの詳細調査
  private async investigateCampaignListPages(result: DeepInvestigationResult): Promise<void> {
    console.log('📋 案件リストページ詳細調査中...');
    
    const investigationUrls = [
      'https://pc.moppy.jp/ad/',
      'https://pc.moppy.jp/ad/list/',
      'https://pc.moppy.jp/service/',
      'https://pc.moppy.jp/campaign/',
      'https://pc.moppy.jp/ad/category/1/',
      'https://pc.moppy.jp/ad/category/2/',
      'https://pc.moppy.jp/ad/category/3/'
    ];

    for (const url of investigationUrls) {
      try {
        console.log(`🔍 調査中: ${url}`);
        
        await this.page!.goto(url, { waitUntil: 'networkidle2' });
        await this.delay(3000);

        const title = await this.page!.title();
        const html = await this.page!.content();
        const $ = cheerio.load(html);

        // ページの案件数を詳細に分析
        const campaignAnalysis = await this.analyzeCampaignsOnPage($);
        
        result.findings.actualCampaignPages.push({
          url,
          title,
          campaignCount: campaignAnalysis.count,
          htmlStructure: campaignAnalysis.structure,
          selectors: campaignAnalysis.selectors
        });

        // HTMLサンプルを保存
        result.htmlSamples.push(`${url} HTML サンプル:\n${html.substring(0, 1500)}`);

        // ページネーション分析
        const paginationInfo = await this.analyzePaginationOnPage($);
        if (paginationInfo.hasNext) {
          result.findings.paginationAnalysis.hasNextPage = true;
          result.findings.paginationAnalysis.paginationUrls.push(...paginationInfo.urls);
          result.findings.paginationAnalysis.maxPageFound = Math.max(
            result.findings.paginationAnalysis.maxPageFound,
            paginationInfo.maxPage
          );
          result.findings.paginationAnalysis.paginationPattern = paginationInfo.pattern;
        }

        await this.delay(2000);

      } catch (error) {
        console.error(`URL調査エラー ${url}:`, error);
      }
    }
  }

  // 代替ページの調査
  private async investigateAlternativePages(result: DeepInvestigationResult): Promise<void> {
    console.log('🔍 代替ページ調査中...');
    
    // 検索ページを試す
    const searchUrls = [
      'https://pc.moppy.jp/search/?q=楽天',
      'https://pc.moppy.jp/search/?q=Amazon',
      'https://pc.moppy.jp/search/?keyword=ショッピング',
      'https://pc.moppy.jp/ad/search/?q=カード'
    ];

    for (const url of searchUrls) {
      try {
        await this.page!.goto(url, { waitUntil: 'networkidle2' });
        await this.delay(2000);

        const html = await this.page!.content();
        const $ = cheerio.load(html);
        const analysis = await this.analyzeCampaignsOnPage($);

        if (analysis.count > 0) {
          result.findings.actualCampaignPages.push({
            url,
            title: await this.page!.title(),
            campaignCount: analysis.count,
            htmlStructure: analysis.structure,
            selectors: analysis.selectors
          });
        }

      } catch (error) {
        console.error(`代替URL調査エラー ${url}:`, error);
      }
    }
  }

  // HTML構造の詳細分析
  private async analyzeHTMLStructure(result: DeepInvestigationResult): Promise<void> {
    console.log('🔬 HTML構造詳細分析中...');
    
    // 最も案件数が多いページを特定
    const bestPage = result.findings.actualCampaignPages.reduce((best, current) => 
      current.campaignCount > best.campaignCount ? current : best,
      result.findings.actualCampaignPages[0]
    );

    if (bestPage) {
      await this.page!.goto(bestPage.url, { waitUntil: 'networkidle2' });
      await this.delay(3000);

      const html = await this.page!.content();
      const $ = cheerio.load(html);

      // 最も効果的なセレクタを特定
      const effectiveSelectors = this.findMostEffectiveSelectors($);
      result.findings.realStructure.mostEffectiveSelectors = effectiveSelectors;

      // 実際の案件要素の構造を保存
      const sampleElement = $(effectiveSelectors[0]).first();
      if (sampleElement.length > 0) {
        result.findings.realStructure.campaignElementStructure = sampleElement.html() || '';
      }

      // データパターンを分析
      result.findings.realStructure.dataPatterns = this.analyzeDataPatterns($);
    }
  }

  // ページ上の案件を分析
  private async analyzeCampaignsOnPage($: cheerio.CheerioAPI): Promise<{
    count: number;
    structure: string;
    selectors: {
      campaignElements: string[];
      nameElements: string[];
      priceElements: string[];
      linkElements: string[];
    };
  }> {
    const selectors = {
      campaignElements: [] as string[],
      nameElements: [] as string[],
      priceElements: [] as string[],
      linkElements: [] as string[]
    };

    // 様々なセレクタで案件要素を検索
    const testSelectors = [
      '.service-item', '.ad-item', '.campaign-item', '.shop-item',
      '.point-item', '.item', '.card', '.product',
      '[class*="service"]', '[class*="ad"]', '[class*="campaign"]',
      '[class*="shop"]', '[class*="point"]', '[class*="item"]',
      'li', 'div', 'article', 'section',
      'a[href*="/ad/"]', 'a[href*="/service/"]'
    ];

    let maxCount = 0;
    let bestStructure = '';

    for (const selector of testSelectors) {
      const elements = $(selector);
      if (elements.length > maxCount) {
        maxCount = elements.length;
        selectors.campaignElements.push(selector);
        
        // 最初の要素の構造を保存
        if (elements.first().html()) {
          bestStructure = elements.first().html()!.substring(0, 500);
        }
      }
    }

    // 名前要素を検索
    const nameSelectors = ['.title', '.name', 'h1', 'h2', 'h3', 'h4', 'strong', 'b'];
    nameSelectors.forEach(sel => {
      if ($(sel).length > 0) {
        selectors.nameElements.push(sel);
      }
    });

    // 価格要素を検索
    const priceSelectors = ['.point', '.price', '.rate', '.mp', '.reward'];
    priceSelectors.forEach(sel => {
      if ($(sel).length > 0) {
        selectors.priceElements.push(sel);
      }
    });

    // リンク要素を検索
    const linkSelectors = ['a[href*="/ad/"]', 'a[href*="/service/"]', 'a'];
    linkSelectors.forEach(sel => {
      if ($(sel).length > 0) {
        selectors.linkElements.push(sel);
      }
    });

    return {
      count: maxCount,
      structure: bestStructure,
      selectors
    };
  }

  // ページネーション分析
  private async analyzePaginationOnPage($: cheerio.CheerioAPI): Promise<{
    hasNext: boolean;
    urls: string[];
    maxPage: number;
    pattern: string;
  }> {
    const paginationUrls: string[] = [];
    let maxPage = 1;
    let pattern = '';

    const paginationSelectors = [
      'a[href*="page="]', 'a[href*="p="]',
      '.pagination a', '.pager a', '.page-nav a',
      '.next', '.prev', '[class*="page"]'
    ];

    for (const selector of paginationSelectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        pattern = selector;
        
        elements.each((index, element) => {
          const href = $(element).attr('href');
          if (href) {
            const fullUrl = href.startsWith('http') ? href : `https://pc.moppy.jp${href}`;
            paginationUrls.push(fullUrl);
            
            const pageMatch = href.match(/page=(\d+)|p=(\d+)/);
            if (pageMatch) {
              const pageNum = parseInt(pageMatch[1] || pageMatch[2]);
              maxPage = Math.max(maxPage, pageNum);
            }
          }
        });
      }
    }

    return {
      hasNext: paginationUrls.length > 0,
      urls: paginationUrls,
      maxPage,
      pattern
    };
  }

  // 最も効果的なセレクタを特定
  private findMostEffectiveSelectors($: cheerio.CheerioAPI): string[] {
    const selectorCounts: Array<{selector: string, count: number}> = [];
    
    const testSelectors = [
      '.service-item', '.ad-item', '.campaign-item', '.shop-item',
      '.point-item', '.item', '.card', '.product', '.offer',
      '[class*="service"]', '[class*="ad"]', '[class*="campaign"]',
      '[class*="shop"]', '[class*="point"]', '[class*="item"]',
      'li[class]', 'div[class*="box"]', 'article',
      'a[href*="/ad/"]', 'a[href*="/service/"]'
    ];

    testSelectors.forEach(selector => {
      const count = $(selector).length;
      if (count > 0) {
        selectorCounts.push({selector, count});
      }
    });

    return selectorCounts
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(item => item.selector);
  }

  // データパターン分析
  private analyzeDataPatterns($: cheerio.CheerioAPI): string[] {
    const patterns: string[] = [];
    
    // ポイント/価格のパターンを検索
    $('*').each((index, element) => {
      const text = $(element).text().trim();
      if (text.match(/\d+P|\d+%|\d+円|\d+ポイント/)) {
        const tagName = element.tagName;
        const className = $(element).attr('class') || '';
        patterns.push(`${tagName}.${className}: ${text.substring(0, 50)}`);
      }
    });

    return patterns.slice(0, 10); // 最初の10個のパターンを返す
  }

  // 推奨事項生成
  private generateRecommendations(result: DeepInvestigationResult): void {
    const recommendations: string[] = [];

    const totalCampaigns = result.findings.actualCampaignPages.reduce(
      (sum, page) => sum + page.campaignCount, 0
    );

    if (totalCampaigns === 0) {
      recommendations.push('案件が発見されませんでした。モッピーのサイト構造が変更されている可能性があります。');
    } else if (totalCampaigns < 100) {
      recommendations.push('発見された案件数が少ないです。より包括的なページを調査する必要があります。');
    }

    if (result.findings.paginationAnalysis.maxPageFound === 0) {
      recommendations.push('ページネーションが発見されませんでした。全案件を取得するために別のアプローチが必要です。');
    }

    if (result.findings.realStructure.mostEffectiveSelectors.length > 0) {
      recommendations.push(`最も効果的なセレクタが発見されました: ${result.findings.realStructure.mostEffectiveSelectors[0]}`);
    }

    result.recommendations = recommendations;
  }

  private async delay(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }
}