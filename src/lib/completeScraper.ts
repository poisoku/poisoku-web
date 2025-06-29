import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';

export interface CompleteCampaign {
  name: string;
  cashbackRate: string;
  normalizedCashback: string;
  url: string;
  description?: string;
  siteName: string;
  category: string;
  isPercentage: boolean;
}

export interface CompleteScrapeResult {
  success: boolean;
  siteName: string;
  campaigns: CompleteCampaign[];
  errors: string[];
  stats: {
    totalUrls: number;
    totalPagesProcessed: number;
    totalCampaigns: number;
    processingTimeMs: number;
    averageCampaignsPerPage: number;
    targetAchieved: boolean;
  };
  debug: {
    urlsProcessed: string[];
    effectiveSelectors: string[];
    campaignCounts: Record<string, number>;
  };
}

export class CompleteScraper {
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

  // モッピーの全案件を完全取得
  async scrapeAllMoppyComplete(): Promise<CompleteScrapeResult> {
    const startTime = Date.now();
    const result: CompleteScrapeResult = {
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
        targetAchieved: false
      },
      debug: {
        urlsProcessed: [],
        effectiveSelectors: [],
        campaignCounts: {}
      }
    };

    try {
      if (!this.page) {
        throw new Error('Pageが初期化されていません');
      }

      console.log('🎯 モッピー完全スクレイピング開始...');
      console.log('   調査結果に基づき6,050件の全案件取得を目指します');

      // 調査で発見された全URLパターン
      const completeUrls = [
        // メインページ（最も効果的）
        { url: 'https://pc.moppy.jp/service/', expectedCount: 1103, description: 'メイン案件ページ' },
        
        // カテゴリページ（調査で発見された39個のページネーションURL）
        { url: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=111&af_sorter=1', expectedCount: 50, description: 'カテゴリ111' },
        { url: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=71&af_sorter=1', expectedCount: 50, description: 'カテゴリ71' },
        { url: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=156&af_sorter=1', expectedCount: 50, description: 'カテゴリ156' },
        { url: 'https://pc.moppy.jp/category/list.php?parent_category=1&child_category=11&af_sorter=1', expectedCount: 50, description: 'ショッピング' },
        { url: 'https://pc.moppy.jp/category/list.php?parent_category=1&child_category=12&af_sorter=1', expectedCount: 50, description: 'ファッション' },
        { url: 'https://pc.moppy.jp/category/list.php?parent_category=1&child_category=13&af_sorter=1', expectedCount: 50, description: '美容・健康' },
        { url: 'https://pc.moppy.jp/category/list.php?parent_category=1&child_category=14&af_sorter=1', expectedCount: 50, description: '食品・飲料' },
        { url: 'https://pc.moppy.jp/category/list.php?parent_category=2&child_category=21&af_sorter=1', expectedCount: 50, description: '旅行・宿泊' },
        { url: 'https://pc.moppy.jp/category/list.php?parent_category=2&child_category=22&af_sorter=1', expectedCount: 50, description: 'レンタカー' },
        { url: 'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=31&af_sorter=1', expectedCount: 50, description: 'クレジットカード' },
        { url: 'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=32&af_sorter=1', expectedCount: 50, description: '銀行・証券' },
        { url: 'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=33&af_sorter=1', expectedCount: 50, description: '保険' },
        { url: 'https://pc.moppy.jp/category/list.php?parent_category=5&child_category=51&af_sorter=1', expectedCount: 50, description: 'ゲーム' },
        { url: 'https://pc.moppy.jp/category/list.php?parent_category=5&child_category=52&af_sorter=1', expectedCount: 50, description: 'アプリ' },
        { url: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=61&af_sorter=1', expectedCount: 50, description: '動画配信' },
        { url: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=62&af_sorter=1', expectedCount: 50, description: '電子書籍' },
        
        // 検索ページ
        { url: 'https://pc.moppy.jp/search/?q=楽天', expectedCount: 866, description: '楽天検索' },
        { url: 'https://pc.moppy.jp/search/?q=Amazon', expectedCount: 866, description: 'Amazon検索' },
        { url: 'https://pc.moppy.jp/search/?q=Yahoo', expectedCount: 500, description: 'Yahoo検索' },
        { url: 'https://pc.moppy.jp/search/?q=クレジットカード', expectedCount: 300, description: 'クレカ検索' },
        
        // 広告ページ
        { url: 'https://pc.moppy.jp/ad/', expectedCount: 424, description: '広告ページ' }
      ];

      // 調査で発見された最も効果的なセレクタ
      const completeSelectors = [
        '[class*="item"]',        // 最も効果的
        '[class*="service"]',     // サービス要素
        '[class*="ad"]',          // 広告要素
        'li[class]',              // リスト要素
        '[class*="point"]',       // ポイント要素
        'a[href*="/ad/"]'         // 広告リンク
      ];

      const allCampaigns = new Map<string, CompleteCampaign>();
      result.stats.totalUrls = completeUrls.length;

      // 各URLを効率的に処理
      for (let i = 0; i < completeUrls.length; i++) {
        const urlInfo = completeUrls[i];
        
        try {
          console.log(`📂 処理中 ${i + 1}/${completeUrls.length}: ${urlInfo.description}`);
          console.log(`   URL: ${urlInfo.url}`);
          console.log(`   期待案件数: ${urlInfo.expectedCount}件`);
          
          const urlResult = await this.processUrlWithCompleteSelectors(
            urlInfo.url, 
            completeSelectors, 
            urlInfo.expectedCount
          );
          
          result.debug.urlsProcessed.push(urlInfo.url);
          result.debug.campaignCounts[urlInfo.url] = urlResult.campaigns.length;
          result.stats.totalPagesProcessed++;

          // 重複除去しながら案件を追加
          urlResult.campaigns.forEach(campaign => {
            const key = `${campaign.name}-${campaign.cashbackRate}-${campaign.siteName}`;
            if (!allCampaigns.has(key)) {
              allCampaigns.set(key, campaign);
            }
          });

          result.errors.push(...urlResult.errors);
          
          if (urlResult.effectiveSelector) {
            result.debug.effectiveSelectors.push(urlResult.effectiveSelector);
          }

          console.log(`   → ${urlResult.campaigns.length}件取得 (累計: ${allCampaigns.size}件)`);

          // URL間の待機時間（サーバー負荷軽減）
          if (i < completeUrls.length - 1) {
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
        totalUrls: completeUrls.length,
        totalPagesProcessed: result.stats.totalPagesProcessed,
        totalCampaigns: result.campaigns.length,
        processingTimeMs: Date.now() - startTime,
        averageCampaignsPerPage: result.stats.totalPagesProcessed > 0 ? 
          result.campaigns.length / result.stats.totalPagesProcessed : 0,
        targetAchieved: result.campaigns.length >= 3000 // 3000件以上で成功とみなす
      };

      result.success = result.campaigns.length > 0;

      console.log(`✅ 完全スクレイピング完了: ${result.campaigns.length.toLocaleString()}件取得`);
      console.log(`🎯 目標達成: ${result.stats.targetAchieved ? 'Yes' : 'No'} (目標3000件以上)`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('完全スクレイピングエラー:', error);
      result.errors.push(`全体エラー: ${errorMessage}`);
    }

    return result;
  }

  // 効果的なセレクタでURL処理
  private async processUrlWithCompleteSelectors(
    url: string, 
    selectors: string[], 
    expectedCount: number
  ): Promise<{
    campaigns: CompleteCampaign[];
    errors: string[];
    effectiveSelector?: string;
  }> {
    const urlResult = {
      campaigns: [] as CompleteCampaign[],
      errors: [] as string[],
      effectiveSelector: undefined as string | undefined
    };

    try {
      await this.page!.goto(url, { waitUntil: 'networkidle2' });
      await this.delay(3000);

      const html = await this.page!.content();
      const $ = cheerio.load(html);

      // 各セレクタを試して最も効果的なものを特定
      for (const selector of selectors) {
        try {
          const elements = $(selector);
          console.log(`     🔍 セレクタ \"${selector}\": ${elements.length}件発見`);
          
          if (elements.length > 0) {
            const campaigns = await this.extractCampaignsWithCompleteMethod($, elements, selector);
            
            if (campaigns.length > urlResult.campaigns.length) {
              urlResult.campaigns = campaigns;
              urlResult.effectiveSelector = selector;
            }
          }
        } catch (error) {
          urlResult.errors.push(`セレクタ ${selector} エラー: ${error}`);
        }
      }

      // 期待値と実際の取得数を比較
      if (urlResult.campaigns.length < expectedCount * 0.1) { // 期待値の10%未満の場合
        urlResult.errors.push(`期待値 ${expectedCount}件 に対して ${urlResult.campaigns.length}件のみ取得`);
      }

    } catch (error) {
      urlResult.errors.push(`URL処理エラー: ${error}`);
    }

    return urlResult;
  }

  // 完全な方法で案件抽出
  private async extractCampaignsWithCompleteMethod(
    $: cheerio.CheerioAPI, 
    elements: cheerio.Cheerio<any>, 
    selector: string
  ): Promise<CompleteCampaign[]> {
    const campaigns: CompleteCampaign[] = [];

    elements.each((index, element) => {
      try {
        const campaign = this.extractSingleCampaignComplete($, $(element));
        if (campaign) {
          campaigns.push(campaign);
        }
      } catch (error) {
        // 個別要素のエラーは無視して続行
      }
    });

    // 重複除去
    const uniqueCampaigns = new Map<string, CompleteCampaign>();
    campaigns.forEach(campaign => {
      const key = `${campaign.name}-${campaign.cashbackRate}`;
      if (!uniqueCampaigns.has(key) && campaign.name.length > 2) {
        uniqueCampaigns.set(key, campaign);
      }
    });

    return Array.from(uniqueCampaigns.values());
  }

  // 単一案件の完全な抽出
  private extractSingleCampaignComplete($: cheerio.CheerioAPI, $el: cheerio.Cheerio<any>): CompleteCampaign | null {
    try {
      // より高度な名前抽出
      let name = '';
      
      // 1. 子要素から詳細に検索
      const nameSelectors = [
        '.title', '.name', '.service-name', '.ad-title', '.campaign-title',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        '.text', '.label', '.shop-name', '.product-name', '.merchant-name',
        'strong', 'b', '.highlight', '.emphasis',
        'span[class*="title"]', 'div[class*="title"]',
        'a', '.link', '[data-name]'
      ];

      for (const selector of nameSelectors) {
        const text = $el.find(selector).first().text().trim();
        if (text && text.length > 2 && text.length < 200) {
          name = text;
          break;
        }
      }

      // 2. 属性から抽出を試行
      if (!name) {
        const attrs = ['title', 'data-title', 'data-name', 'alt'];
        for (const attr of attrs) {
          const value = $el.attr(attr) || $el.find(`[${attr}]`).first().attr(attr);
          if (value && value.length > 2 && value.length < 200) {
            name = value;
            break;
          }
        }
      }

      // 3. 直接テキストから抽出
      if (!name) {
        const directText = $el.text().trim();
        if (directText.length > 2 && directText.length < 200) {
          // 長すぎる場合は最初の部分を使用
          name = directText.length > 100 ? directText.substring(0, 100) + '...' : directText;
        }
      }

      if (!name || name.length < 2) return null;

      // より高度な還元率抽出
      let cashbackRate = '';
      
      const cashbackSelectors = [
        '.point', '.rate', '.mp', '.moppy-point', '.reward', '.cashback',
        '[class*="point"]', '[class*="rate"]', '[class*="mp"]', '[class*="reward"]',
        '.price', '.amount', '.value', '.percent', '.yen', '.円',
        'strong', 'b', '.highlight', '.emphasis', '.number',
        '[data-point]', '[data-rate]', '[data-price]'
      ];

      for (const selector of cashbackSelectors) {
        const elements = $el.find(selector);
        elements.each((index, elem) => {
          const text = $(elem).text().trim();
          // ポイント、パーセント、円の文字を含むものを優先
          if (text && (
            text.includes('P') || text.includes('%') || text.includes('円') || 
            text.includes('ポイント') || text.includes('pt') || /^\\d+$/.test(text)
          )) {
            if (!cashbackRate || text.length < cashbackRate.length) {
              cashbackRate = text;
            }
          }
        });
        
        if (cashbackRate) break;
      }

      // 数字のみでも抽出を試行
      if (!cashbackRate) {
        const allText = $el.text();
        const numberMatch = allText.match(/(\\d+(?:[,，]\\d+)*(?:\\.\\d+)?)\\s*[P%円ポイント]/);
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
      const description = $el.find('.description, .desc, .detail, .summary').first().text().trim() || 
                         name.substring(0, 100);

      // カテゴリ推定（より詳細）
      const category = this.estimateCategoryAdvanced(name, description);

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

  // 名前のクリーニング（完全版）
  private cleanName(name: string): string {
    return name
      .replace(/\\s+/g, ' ')           // 複数の空白を1つに
      .replace(/\\n+/g, ' ')           // 改行を空白に
      .replace(/\\t+/g, ' ')           // タブを空白に
      .replace(/【[^】]*】/g, '')      // 【】内のテキストを除去
      .replace(/\\([^)]*\\)/g, '')      // ()内のテキストを除去
      .replace(/\\s*[\\d,，]+\\.?\\d*[P円ポイントpt%％]\\s*/g, '') // 還元率を除去（例：800P, 1,000円, 5.2%, 1.5％）
      .replace(/\\s*-\\s*[\\d,，]+\\.?\\d*[P円ポイントpt%％]\\s*/g, '') // ハイフン付きの還元率を除去
      .replace(/\\s*:\\s*[\\d,，]+\\.?\\d*[P円ポイントpt%％]\\s*/g, '') // コロン付きの還元率を除去
      .replace(/\\s*～\\s*[\\d,，]+\\.?\\d*[P円ポイントpt%％]\\s*/g, '') // 波線付きの還元率を除去
      .replace(/\\s*最大\\s*[\\d,，]+\\.?\\d*[P円ポイントpt%％]\\s*/g, '') // 最大〇〇Pを除去
      .replace(/\\s*up\\s*to\\s*[\\d,，]+\\.?\\d*[P円ポイントpt%％]\\s*/gi, '') // up to 〇〇Pを除去
      .replace(/\\s*\\d+\\.?\\d*\\s*倍\\s*/g, '') // 〇倍を除去
      .replace(/\\s+/g, ' ')           // 再度空白を正規化
      .trim()
      .substring(0, 100);             // 最大100文字
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

  // 還元率正規化（改良版）
  private normalizeCashbackRate(text: string): string {
    if (!text) return '0円';
    
    const cleanText = text.replace(/[,，\\s　]/g, '').trim();
    
    // パーセント表記はそのまま
    if (cleanText.includes('%') || cleanText.includes('％')) {
      const match = cleanText.match(/[\\d.]+/);
      return match ? `${match[0]}%` : '0%';
    }
    
    // ポイント表記は円に変換 (1P=1円)
    if (cleanText.includes('P') || cleanText.includes('ポイント') || cleanText.includes('pt')) {
      const match = cleanText.match(/[\\d,，]+/);
      if (match) {
        const points = parseInt(match[0].replace(/[,，]/g, ''));
        return `${points.toLocaleString()}円`;
      }
    }
    
    // 円表記はそのまま
    if (cleanText.includes('円')) {
      const match = cleanText.match(/[\\d,，]+/);
      if (match) {
        const yen = parseInt(match[0].replace(/[,，]/g, ''));
        return `${yen.toLocaleString()}円`;
      }
    }
    
    // 数字のみの場合は円として扱う
    const numberMatch = cleanText.match(/^[\\d,，]+$/);
    if (numberMatch) {
      const number = parseInt(numberMatch[0].replace(/[,，]/g, ''));
      return `${number.toLocaleString()}円`;
    }
    
    return text.substring(0, 20);
  }

  // 高度なカテゴリ推定
  private estimateCategoryAdvanced(name: string, description: string): string {
    const text = (name + ' ' + description).toLowerCase();
    
    // 金融関連
    if (text.includes('カード') || text.includes('クレジット') || text.includes('クレカ')) return 'finance';
    if (text.includes('証券') || text.includes('投資') || text.includes('fx') || text.includes('株')) return 'finance';
    if (text.includes('銀行') || text.includes('口座') || text.includes('ローン')) return 'finance';
    if (text.includes('保険') || text.includes('キャッシング')) return 'finance';
    
    // 旅行関連
    if (text.includes('旅行') || text.includes('ホテル') || text.includes('宿泊')) return 'travel';
    if (text.includes('じゃらん') || text.includes('楽天トラベル') || text.includes('航空券')) return 'travel';
    
    // エンターテイメント
    if (text.includes('動画') || text.includes('音楽') || text.includes('映画')) return 'entertainment';
    if (text.includes('ゲーム') || text.includes('アプリ') || text.includes('配信')) return 'entertainment';
    if (text.includes('漫画') || text.includes('電子書籍') || text.includes('kindle')) return 'entertainment';
    
    // その他
    if (text.includes('美容') || text.includes('健康') || text.includes('コスメ')) return 'other';
    if (text.includes('医療') || text.includes('病院') || text.includes('薬')) return 'other';
    if (text.includes('学習') || text.includes('教育') || text.includes('資格')) return 'other';
    
    // デフォルトはショッピング
    return 'shopping';
  }

  // 待機
  private async delay(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }
}