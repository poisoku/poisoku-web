import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';

export interface SiteAnalysis {
  siteName: string;
  url: string;
  pageTitle: string;
  possibleSelectors: {
    containers: string[];
    titles: string[];
    cashback: string[];
    links: string[];
  };
  sampleElements: Array<{
    selector: string;
    count: number;
    samples: string[];
  }>;
  robotsTxt?: string;
  analysisDate: Date;
}

export class SiteInvestigator {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080'
      ]
    });
    this.page = await this.browser.newPage();
    
    await this.page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    );
    
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

  // robots.txtを確認
  async checkRobotsTxt(baseUrl: string): Promise<string | null> {
    try {
      const robotsUrl = new URL('/robots.txt', baseUrl).toString();
      if (this.page) {
        await this.page.goto(robotsUrl, { waitUntil: 'networkidle2' });
        const content = await this.page.content();
        const $ = cheerio.load(content);
        return $('body').text().trim();
      }
    } catch (error) {
      console.log(`robots.txt取得エラー (${baseUrl}):`, error);
    }
    return null;
  }

  // ハピタスのサイト構造を調査
  async investigateHapitas(searchKeyword: string = 'Yahoo'): Promise<SiteAnalysis> {
    const siteName = 'ハピタス';
    const baseUrl = 'https://hapitas.jp';
    const searchUrl = `${baseUrl}/search/?word=${encodeURIComponent(searchKeyword)}`;
    
    console.log(`${siteName}調査開始: ${searchUrl}`);

    if (!this.page) {
      throw new Error('Pageが初期化されていません');
    }

    const analysis: SiteAnalysis = {
      siteName,
      url: searchUrl,
      pageTitle: '',
      possibleSelectors: {
        containers: [],
        titles: [],
        cashback: [],
        links: []
      },
      sampleElements: [],
      analysisDate: new Date()
    };

    try {
      // robots.txtを確認
      analysis.robotsTxt = await this.checkRobotsTxt(baseUrl) || undefined;

      // メインページに移動
      await this.page.goto(searchUrl, { waitUntil: 'networkidle2' });
      await this.page.waitForTimeout(3000);

      // ページタイトルを取得
      analysis.pageTitle = await this.page.title();

      // HTMLを取得して解析
      const html = await this.page.content();
      const $ = cheerio.load(html);

      // 案件コンテナの候補を特定
      const containerSelectors = [
        '.shop-item', '.campaign-item', '.search-item', '.result-item',
        '.point-item', '.deal-item', '.offer-item', '.merchant-item',
        '[class*="shop"]', '[class*="campaign"]', '[class*="search"]',
        '[class*="result"]', '[class*="item"]', '[class*="card"]'
      ];

      containerSelectors.forEach(selector => {
        const elements = $(selector);
        if (elements.length > 0) {
          analysis.possibleSelectors.containers.push(selector);
          
          const samples: string[] = [];
          elements.slice(0, 3).each((i, el) => {
            const text = $(el).text().trim();
            if (text && text.length < 200) {
              samples.push(text.substring(0, 100));
            }
          });

          analysis.sampleElements.push({
            selector,
            count: elements.length,
            samples
          });
        }
      });

      // タイトル要素の候補
      const titleSelectors = [
        'h1', 'h2', 'h3', 'h4', '.title', '.name', '.shop-name',
        '.campaign-title', '.offer-title', '.merchant-name',
        '[class*="title"]', '[class*="name"]'
      ];

      titleSelectors.forEach(selector => {
        const elements = $(selector);
        if (elements.length > 0) {
          analysis.possibleSelectors.titles.push(selector);
        }
      });

      // 還元率要素の候補
      const cashbackSelectors = [
        '.point', '.cashback', '.rate', '.percent', '.reward',
        '.bonus', '.earn', '.back', '[class*="point"]', '[class*="rate"]',
        '[class*="percent"]', '[class*="cashback"]', '[class*="reward"]'
      ];

      cashbackSelectors.forEach(selector => {
        const elements = $(selector);
        if (elements.length > 0) {
          analysis.possibleSelectors.cashback.push(selector);
        }
      });

      // リンク要素の候補
      const linkSelectors = [
        'a[href*="redirect"]', 'a[href*="track"]', 'a[href*="go"]',
        'a[href*="visit"]', 'a[href*="shop"]'
      ];

      linkSelectors.forEach(selector => {
        const elements = $(selector);
        if (elements.length > 0) {
          analysis.possibleSelectors.links.push(selector);
        }
      });

      console.log(`${siteName}調査完了:`, {
        containers: analysis.possibleSelectors.containers.length,
        samples: analysis.sampleElements.length
      });

    } catch (error) {
      console.error(`${siteName}調査エラー:`, error);
      throw error;
    }

    return analysis;
  }

  // モッピーのサイト構造を調査
  async investigateMoppy(searchKeyword: string = 'Yahoo'): Promise<SiteAnalysis> {
    const siteName = 'モッピー';
    const baseUrl = 'https://pc.moppy.jp';
    const searchUrl = `${baseUrl}/ad/search/?q=${encodeURIComponent(searchKeyword)}`;
    
    console.log(`${siteName}調査開始: ${searchUrl}`);

    if (!this.page) {
      throw new Error('Pageが初期化されていません');
    }

    const analysis: SiteAnalysis = {
      siteName,
      url: searchUrl,
      pageTitle: '',
      possibleSelectors: {
        containers: [],
        titles: [],
        cashback: [],
        links: []
      },
      sampleElements: [],
      analysisDate: new Date()
    };

    try {
      // robots.txtを確認
      analysis.robotsTxt = await this.checkRobotsTxt(baseUrl) || undefined;

      // メインページに移動
      await this.page.goto(searchUrl, { waitUntil: 'networkidle2' });
      await this.page.waitForTimeout(3000);

      // ページタイトルを取得
      analysis.pageTitle = await this.page.title();

      // HTMLを取得して解析
      const html = await this.page.content();
      const $ = cheerio.load(html);

      // 案件コンテナの候補を特定（モッピー用）
      const containerSelectors = [
        '.ad-item', '.shop-item', '.search-item', '.result-item',
        '.service-item', '.merchant-item', '.campaign-item',
        '[class*="ad"]', '[class*="shop"]', '[class*="service"]',
        '[class*="merchant"]', '[class*="item"]', '[class*="card"]'
      ];

      containerSelectors.forEach(selector => {
        const elements = $(selector);
        if (elements.length > 0) {
          analysis.possibleSelectors.containers.push(selector);
          
          const samples: string[] = [];
          elements.slice(0, 3).each((i, el) => {
            const text = $(el).text().trim();
            if (text && text.length < 200) {
              samples.push(text.substring(0, 100));
            }
          });

          analysis.sampleElements.push({
            selector,
            count: elements.length,
            samples
          });
        }
      });

      // 他の要素も同様に調査（ハピタスと同じロジック）
      const titleSelectors = [
        'h1', 'h2', 'h3', 'h4', '.title', '.name', '.shop-name',
        '.service-name', '.ad-title', '[class*="title"]', '[class*="name"]'
      ];

      titleSelectors.forEach(selector => {
        const elements = $(selector);
        if (elements.length > 0) {
          analysis.possibleSelectors.titles.push(selector);
        }
      });

      const cashbackSelectors = [
        '.point', '.cashback', '.rate', '.percent', '.reward',
        '.moppy-point', '.mp', '[class*="point"]', '[class*="rate"]',
        '[class*="percent"]', '[class*="mp"]'
      ];

      cashbackSelectors.forEach(selector => {
        const elements = $(selector);
        if (elements.length > 0) {
          analysis.possibleSelectors.cashback.push(selector);
        }
      });

      console.log(`${siteName}調査完了:`, {
        containers: analysis.possibleSelectors.containers.length,
        samples: analysis.sampleElements.length
      });

    } catch (error) {
      console.error(`${siteName}調査エラー:`, error);
      throw error;
    }

    return analysis;
  }

  // 複数サイトを一括調査
  async investigateAllSites(searchKeyword: string = 'Yahoo'): Promise<SiteAnalysis[]> {
    const results: SiteAnalysis[] = [];
    
    try {
      await this.initialize();
      
      // ハピタスを調査
      try {
        const hapitasAnalysis = await this.investigateHapitas(searchKeyword);
        results.push(hapitasAnalysis);
      } catch (error) {
        console.error('ハピタス調査エラー:', error);
      }

      // サイト間でレート制限
      await new Promise(resolve => setTimeout(resolve, 5000));

      // モッピーを調査
      try {
        const moppyAnalysis = await this.investigateMoppy(searchKeyword);
        results.push(moppyAnalysis);
      } catch (error) {
        console.error('モッピー調査エラー:', error);
      }

    } finally {
      await this.cleanup();
    }

    return results;
  }

  // 調査結果をファイルに保存
  static saveAnalysisReport(analyses: SiteAnalysis[], filename: string = 'site-analysis-report.json'): void {
    const report = {
      generatedAt: new Date().toISOString(),
      totalSites: analyses.length,
      analyses
    };

    const fs = require('fs');
    fs.writeFileSync(filename, JSON.stringify(report, null, 2));
    console.log(`調査レポートを保存しました: ${filename}`);
  }
}