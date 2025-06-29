import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';

export interface ScrapedCampaign {
  name: string;
  cashbackRate: string;
  url: string;
  description?: string;
  siteName: string;
}

export interface ScrapeResult {
  success: boolean;
  campaigns: ScrapedCampaign[];
  errors: string[];
  debug: {
    pageTitle: string;
    finalUrl: string;
    htmlSnippet: string;
    foundElements: number;
  };
}

export class RealSiteScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize(options: {
    headless?: boolean;
    useProxy?: boolean;
    customUserAgent?: string;
  } = {}): Promise<void> {
    const {
      headless = true,
      useProxy = false,
      customUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    } = options;

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

    if (useProxy) {
      // プロキシ設定（必要に応じて）
      // args.push('--proxy-server=http://proxy:port');
    }

    this.browser = await puppeteer.launch({
      headless,
      args
    });

    this.page = await this.browser.newPage();

    // より人間らしいブラウザ設定
    await this.page.setUserAgent(customUserAgent);
    await this.page.setViewport({ width: 1920, height: 1080 });
    
    // WebDriver検出を回避
    await this.page.evaluateOnNewDocument(() => {
      // navigator.webdriverを削除
      delete (navigator as any).webdriver;
      
      // プラグイン情報を偽装
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });
      
      // 言語設定
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

  // より効果的なハピタススクレイピング
  async scrapeHapitasAdvanced(keyword: string): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      campaigns: [],
      errors: [],
      debug: {
        pageTitle: '',
        finalUrl: '',
        htmlSnippet: '',
        foundElements: 0
      }
    };

    try {
      if (!this.page) {
        throw new Error('Pageが初期化されていません');
      }

      console.log(`ハピタス詳細スクレイピング開始: ${keyword}`);

      // まずハピタスのトップページにアクセス
      await this.page.goto('https://hapitas.jp', { 
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // ページが読み込まれるまで待機
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 検索機能を探す（複数のアプローチ）
      const searchApproaches = [
        // アプローチ1: 検索URLを直接構築
        async () => {
          const searchUrl = `https://hapitas.jp/search/?word=${encodeURIComponent(keyword)}`;
          await this.page!.goto(searchUrl, { waitUntil: 'networkidle2' });
        },
        
        // アプローチ2: 検索フォームを使用
        async () => {
          const searchInput = await this.page!.$('input[type="search"], input[name*="search"], input[name*="word"], #search');
          if (searchInput) {
            await searchInput.type(keyword);
            await this.page!.keyboard.press('Enter');
            await this.page!.waitForNavigation({ waitUntil: 'networkidle2' });
          } else {
            throw new Error('検索フォームが見つかりません');
          }
        },

        // アプローチ3: 検索ボタンをクリック
        async () => {
          const searchBtn = await this.page!.$('button[type="submit"], .search-btn, .btn-search');
          if (searchBtn) {
            await searchBtn.click();
            await this.page!.waitForNavigation({ waitUntil: 'networkidle2' });
          } else {
            throw new Error('検索ボタンが見つかりません');
          }
        }
      ];

      // 各アプローチを試行
      let searchSuccess = false;
      for (const approach of searchApproaches) {
        try {
          await approach();
          searchSuccess = true;
          break;
        } catch (error) {
          console.log('検索アプローチ失敗:', error);
          continue;
        }
      }

      if (!searchSuccess) {
        // 検索に失敗した場合、少なくとも案件一覧ページを試す
        await this.page.goto('https://hapitas.jp/ad/', { waitUntil: 'networkidle2' });
      }

      // デバッグ情報を収集
      result.debug.pageTitle = await this.page.title();
      result.debug.finalUrl = this.page.url();

      // ページの内容を解析
      const html = await this.page.content();
      const $ = cheerio.load(html);

      // HTML snippetを保存（デバッグ用）
      result.debug.htmlSnippet = $('body').html()?.substring(0, 1000) || '';

      // より包括的なセレクタで案件を検索
      const campaignSelectors = [
        // ハピタス固有
        '.shop-list .shop-item',
        '.campaign-list .campaign-item', 
        '.ad-list .ad-item',
        '.merchant-list .merchant-item',
        
        // 一般的なパターン
        '.shop-item, .campaign-item, .ad-item, .merchant-item',
        '[class*="shop"][class*="item"]',
        '[class*="campaign"][class*="item"]',
        '[class*="ad"][class*="item"]',
        
        // コンテナ内のリンク
        'a[href*="/campaign/"], a[href*="/shop/"], a[href*="/ad/"]',
        
        // より広いパターン
        '.list-item, .item, .card, .product'
      ];

      let foundCampaigns = false;

      for (const selector of campaignSelectors) {
        const elements = $(selector);
        console.log(`セレクタ "${selector}": ${elements.length}件見つかりました`);
        
        if (elements.length > 0) {
          result.debug.foundElements = Math.max(result.debug.foundElements, elements.length);
          
          elements.each((index, element) => {
            try {
              const $el = $(element);
              
              // 案件名を抽出（複数のパターン）
              const nameSelectors = [
                '.title, .name, .shop-name, .campaign-title',
                'h1, h2, h3, h4, h5',
                'a[title], [title]',
                '.text, .label'
              ];
              
              let name = '';
              for (const nameSelector of nameSelectors) {
                const nameEl = $el.find(nameSelector).first();
                if (nameEl.length > 0) {
                  name = nameEl.text().trim();
                  if (name) break;
                }
              }
              
              // タイトル属性からも試行
              if (!name) {
                name = $el.attr('title') || $el.find('[title]').first().attr('title') || '';
              }

              // 還元率を抽出
              const rateSelectors = [
                '.point, .rate, .cashback, .percent, .reward',
                '[class*="point"], [class*="rate"], [class*="percent"]',
                '.price, .amount, .value'
              ];
              
              let cashbackRate = '';
              for (const rateSelector of rateSelectors) {
                const rateEl = $el.find(rateSelector).first();
                if (rateEl.length > 0) {
                  cashbackRate = rateEl.text().trim();
                  if (cashbackRate) break;
                }
              }

              // URLを抽出
              let campaignUrl = '';
              const linkEl = $el.is('a') ? $el : $el.find('a').first();
              if (linkEl.length > 0) {
                const href = linkEl.attr('href') || '';
                campaignUrl = href.startsWith('http') ? href : `https://hapitas.jp${href}`;
              }

              // キーワードでフィルタリング（大雑把に）
              const isRelevant = !keyword || 
                name.toLowerCase().includes(keyword.toLowerCase()) ||
                $el.text().toLowerCase().includes(keyword.toLowerCase());

              if (name && cashbackRate && isRelevant) {
                result.campaigns.push({
                  name: name.substring(0, 100), // 長すぎる場合は切り詰め
                  cashbackRate: this.normalizeCashbackRate(cashbackRate),
                  url: campaignUrl,
                  description: $el.text().trim().substring(0, 200),
                  siteName: 'ハピタス'
                });
                foundCampaigns = true;
              }
            } catch (error) {
              result.errors.push(`要素解析エラー: ${error}`);
            }
          });

          if (foundCampaigns) break; // 成功したセレクタがあれば停止
        }
      }

      result.success = foundCampaigns;
      console.log(`ハピタススクレイピング完了: ${result.campaigns.length}件取得`);

    } catch (error) {
      console.error('ハピタススクレイピングエラー:', error);
      result.errors.push(`スクレイピングエラー: ${error}`);
    }

    return result;
  }

  // モッピーの詳細スクレイピング
  async scrapeMoppyAdvanced(keyword: string): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      campaigns: [],
      errors: [],
      debug: {
        pageTitle: '',
        finalUrl: '',
        htmlSnippet: '',
        foundElements: 0
      }
    };

    try {
      if (!this.page) {
        throw new Error('Pageが初期化されていません');
      }

      console.log(`モッピー詳細スクレイピング開始: ${keyword}`);

      // モッピーのトップページまたは検索ページ
      const searchUrl = `https://pc.moppy.jp/ad/search/?q=${encodeURIComponent(keyword)}`;
      await this.page.goto(searchUrl, { waitUntil: 'networkidle2' });

      // デバッグ情報を収集
      result.debug.pageTitle = await this.page.title();
      result.debug.finalUrl = this.page.url();

      const html = await this.page.content();
      const $ = cheerio.load(html);
      result.debug.htmlSnippet = $('body').html()?.substring(0, 1000) || '';

      // モッピー固有のセレクタ
      const campaignSelectors = [
        '.ad-list .ad-item',
        '.service-list .service-item',
        '.shop-list .shop-item',
        '.campaign-list .campaign-item',
        '[class*="ad"][class*="item"]',
        '[class*="service"][class*="item"]',
        'a[href*="/ad/"], a[href*="/service/"]'
      ];

      let foundCampaigns = false;

      for (const selector of campaignSelectors) {
        const elements = $(selector);
        console.log(`モッピー セレクタ "${selector}": ${elements.length}件`);
        
        if (elements.length > 0) {
          result.debug.foundElements = Math.max(result.debug.foundElements, elements.length);
          
          elements.each((index, element) => {
            try {
              const $el = $(element);
              
              const name = this.extractText($el, [
                '.title, .name, .service-name, .ad-title',
                'h1, h2, h3, h4',
                '[title]'
              ]);

              const cashbackRate = this.extractText($el, [
                '.point, .rate, .mp, .moppy-point',
                '[class*="point"], [class*="rate"], [class*="mp"]'
              ]);

              const campaignUrl = this.extractUrl($el, 'https://pc.moppy.jp');

              const isRelevant = !keyword || 
                name.toLowerCase().includes(keyword.toLowerCase()) ||
                $el.text().toLowerCase().includes(keyword.toLowerCase());

              if (name && cashbackRate && isRelevant) {
                result.campaigns.push({
                  name: name.substring(0, 100),
                  cashbackRate: this.normalizeCashbackRate(cashbackRate),
                  url: campaignUrl,
                  description: $el.text().trim().substring(0, 200),
                  siteName: 'モッピー'
                });
                foundCampaigns = true;
              }
            } catch (error) {
              result.errors.push(`モッピー要素解析エラー: ${error}`);
            }
          });

          if (foundCampaigns) break;
        }
      }

      result.success = foundCampaigns;
      console.log(`モッピースクレイピング完了: ${result.campaigns.length}件取得`);

    } catch (error) {
      console.error('モッピースクレイピングエラー:', error);
      result.errors.push(`モッピースクレイピングエラー: ${error}`);
    }

    return result;
  }

  // テキスト抽出ヘルパー
  private extractText($el: cheerio.Cheerio<any>, selectors: string[]): string {
    for (const selector of selectors) {
      const text = $el.find(selector).first().text().trim();
      if (text) return text;
    }
    return $el.attr('title') || $el.text().trim() || '';
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
    if (!text) return '0%';
    
    // 数字とポイント関連文字のみ抽出
    const numbers = text.match(/[\d.,]+/g) || [];
    
    // パーセント表記
    if (text.includes('%') || text.includes('％')) {
      const rate = numbers[0] || '0';
      return `${rate}%`;
    }
    
    // ポイント表記（P、ポイント、円）
    if (text.includes('P') || text.includes('ポイント') || text.includes('円')) {
      const points = numbers[0] || '0';
      return `${points}P`;
    }
    
    // 数字のみの場合は%として扱う
    if (numbers.length > 0) {
      return `${numbers[0]}%`;
    }
    
    return text.substring(0, 20); // 長すぎる場合は切り詰め
  }

  // 複数サイトの自動スクレイピング
  async scrapeAllSites(keyword: string): Promise<ScrapeResult[]> {
    const results: ScrapeResult[] = [];
    
    try {
      // ヘッドレスモードで実行（より検出されにくい）
      await this.initialize({ 
        headless: true,
        customUserAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      // ハピタスをスクレイピング
      try {
        const hapitasResult = await this.scrapeHapitasAdvanced(keyword);
        results.push(hapitasResult);
        console.log(`ハピタス結果: 成功=${hapitasResult.success}, 案件数=${hapitasResult.campaigns.length}`);
      } catch (error) {
        console.error('ハピタススクレイピング失敗:', error);
      }

      // サイト間の間隔を空ける
      await new Promise(resolve => setTimeout(resolve, 5000));

      // モッピーをスクレイピング
      try {
        const moppyResult = await this.scrapeMoppyAdvanced(keyword);
        results.push(moppyResult);
        console.log(`モッピー結果: 成功=${moppyResult.success}, 案件数=${moppyResult.campaigns.length}`);
      } catch (error) {
        console.error('モッピースクレイピング失敗:', error);
      }

    } finally {
      await this.cleanup();
    }

    return results;
  }
}