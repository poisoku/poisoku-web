import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';

export interface EfficientCampaign {
  name: string;
  cashbackRate: string;
  normalizedCashback: string;
  url: string;
  description?: string;
  siteName: string;
  category: string;
  isPercentage: boolean;
}

export interface EfficientScrapeResult {
  success: boolean;
  siteName: string;
  campaigns: EfficientCampaign[];
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

export class EfficientScraper {
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

    await this.page.setDefaultTimeout(15000);
    await this.page.setDefaultNavigationTimeout(15000);
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

  // 効率的なモッピー全案件取得
  async scrapeAllMoppyEfficient(): Promise<EfficientScrapeResult> {
    const startTime = Date.now();
    const result: EfficientScrapeResult = {
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

      console.log('🎯 モッピー効率的スクレイピング開始...');
      console.log('   最も効果的なページを重点的に処理');

      // 調査結果に基づく最も効率的なURL（段階的アプローチ）
      const efficientUrls = [
        // 最も効果的なページから開始
        { url: 'https://pc.moppy.jp/service/', expectedCount: 1103, description: 'メイン案件ページ（最優先）' },
        
        // カテゴリページ（高効率）
        { url: 'https://pc.moppy.jp/category/list.php?parent_category=1&child_category=11', expectedCount: 200, description: 'ショッピング' },
        { url: 'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=31', expectedCount: 150, description: 'クレジットカード' },
        { url: 'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=32', expectedCount: 100, description: '銀行・証券' },
        { url: 'https://pc.moppy.jp/category/list.php?parent_category=2&child_category=21', expectedCount: 80, description: '旅行・宿泊' },
        { url: 'https://pc.moppy.jp/category/list.php?parent_category=1&child_category=12', expectedCount: 100, description: 'ファッション' },
        { url: 'https://pc.moppy.jp/category/list.php?parent_category=1&child_category=13', expectedCount: 80, description: '美容・健康' },
        { url: 'https://pc.moppy.jp/category/list.php?parent_category=5&child_category=51', expectedCount: 50, description: 'ゲーム' },
        { url: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=61', expectedCount: 40, description: '動画配信' }
      ];

      // 調査で発見された最も効果的なセレクタ
      const efficientSelectors = [
        '[class*="item"]',        // 最も効果的
        '[class*="service"]',     // サービス要素
        '[class*="ad"]',          // 広告要素
        'li[class*="campaign"]',  // キャンペーン要素
        '.campaign-item',         // 直接的なキャンペーン
        '[data-campaign]'         // データ属性
      ];

      const allCampaigns = new Map<string, EfficientCampaign>();
      result.stats.totalUrls = efficientUrls.length;

      // 各URLを効率的に処理
      for (let i = 0; i < efficientUrls.length; i++) {
        const urlInfo = efficientUrls[i];
        
        try {
          console.log(`📂 処理中 ${i + 1}/${efficientUrls.length}: ${urlInfo.description}`);
          console.log(`   URL: ${urlInfo.url}`);
          console.log(`   期待案件数: ${urlInfo.expectedCount}件`);
          
          const urlResult = await this.processUrlEfficiently(
            urlInfo.url, 
            efficientSelectors, 
            urlInfo.expectedCount
          );
          
          result.debug.urlsProcessed.push(urlInfo.url);
          result.debug.campaignCounts[urlInfo.url] = urlResult.campaigns.length;
          result.stats.totalPagesProcessed++;

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

          // URL間の待機時間（短縮）
          if (i < efficientUrls.length - 1) {
            await this.delay(1000);
          }

        } catch (error) {
          const errorMsg = `URL ${urlInfo.url} 処理エラー: ${error}`;
          console.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }

      result.campaigns = Array.from(allCampaigns.values());
      result.stats = {
        totalUrls: efficientUrls.length,
        totalPagesProcessed: result.stats.totalPagesProcessed,
        totalCampaigns: result.campaigns.length,
        processingTimeMs: Date.now() - startTime,
        averageCampaignsPerPage: result.stats.totalPagesProcessed > 0 ? 
          result.campaigns.length / result.stats.totalPagesProcessed : 0,
        targetAchieved: result.campaigns.length >= 1000 // 1000件以上で成功とみなす
      };

      result.success = result.campaigns.length > 0;

      console.log(`✅ 効率的スクレイピング完了: ${result.campaigns.length.toLocaleString()}件取得`);
      console.log(`🎯 目標達成: ${result.stats.targetAchieved ? 'Yes' : 'No'} (目標1000件以上)`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('効率的スクレイピングエラー:', error);
      result.errors.push(`全体エラー: ${errorMessage}`);
    }

    return result;
  }

  // 効率的なURL処理
  private async processUrlEfficiently(
    url: string, 
    selectors: string[], 
    expectedCount: number
  ): Promise<{
    campaigns: EfficientCampaign[];
    errors: string[];
    effectiveSelector?: string;
  }> {
    const urlResult = {
      campaigns: [] as EfficientCampaign[],
      errors: [] as string[],
      effectiveSelector: undefined as string | undefined
    };

    try {
      await this.page!.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await this.delay(2000);

      const html = await this.page!.content();
      const $ = cheerio.load(html);

      // 各セレクタを試して最も効果的なものを特定
      for (const selector of selectors) {
        try {
          const elements = $(selector);
          console.log(`     🔍 セレクタ \"${selector}\": ${elements.length}件発見`);
          
          if (elements.length > 0) {
            const campaigns = await this.extractCampaignsEfficiently($, elements, selector);
            
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
      urlResult.errors.push(`URL処理エラー: ${error}`);
    }

    return urlResult;
  }

  // 効率的な案件抽出
  private async extractCampaignsEfficiently(
    $: cheerio.CheerioAPI, 
    elements: cheerio.Cheerio<any>, 
    selector: string
  ): Promise<EfficientCampaign[]> {
    const campaigns: EfficientCampaign[] = [];

    elements.each((index, element) => {
      try {
        const campaign = this.extractSingleCampaignEfficient($, $(element));
        if (campaign) {
          campaigns.push(campaign);
        }
      } catch (error) {
        // 個別要素のエラーは無視して続行
      }
    });

    // 重複除去
    const uniqueCampaigns = new Map<string, EfficientCampaign>();
    campaigns.forEach(campaign => {
      const key = `${campaign.name}-${campaign.cashbackRate}`;
      if (!uniqueCampaigns.has(key) && campaign.name.length > 2) {
        uniqueCampaigns.set(key, campaign);
      }
    });

    return Array.from(uniqueCampaigns.values());
  }

  // 単一案件の効率的な抽出
  private extractSingleCampaignEfficient($: cheerio.CheerioAPI, $el: cheerio.Cheerio<any>): EfficientCampaign | null {
    try {
      // 効率的な名前抽出
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

      // 効率的な還元率抽出
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
            text.includes('ポイント') || /^\\d+$/.test(text)
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

  // 名前のクリーニング（効率化版）
  private cleanName(name: string): string {
    return name
      .replace(/\\s+/g, ' ')
      .replace(/\\n+/g, ' ')
      .replace(/\\t+/g, ' ')
      .replace(/【[^】]*】/g, '')
      .replace(/\\([^)]*\\)/g, '')
      .replace(/\\s*[\\d,，]+\\.?\\d*[P円ポイントpt%％]\\s*/g, '')
      .replace(/\\s*最大\\s*[\\d,，]+\\.?\\d*[P円ポイントpt%％]\\s*/g, '')
      .replace(/\\s+/g, ' ')
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
    
    const cleanText = text.replace(/[,，\\s　]/g, '').trim();
    
    if (cleanText.includes('%') || cleanText.includes('％')) {
      const match = cleanText.match(/[\\d.]+/);
      return match ? `${match[0]}%` : '0%';
    }
    
    if (cleanText.includes('P') || cleanText.includes('ポイント') || cleanText.includes('pt')) {
      const match = cleanText.match(/[\\d,，]+/);
      if (match) {
        const points = parseInt(match[0].replace(/[,，]/g, ''));
        return `${points.toLocaleString()}円`;
      }
    }
    
    if (cleanText.includes('円')) {
      const match = cleanText.match(/[\\d,，]+/);
      if (match) {
        const yen = parseInt(match[0].replace(/[,，]/g, ''));
        return `${yen.toLocaleString()}円`;
      }
    }
    
    const numberMatch = cleanText.match(/^[\\d,，]+$/);
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