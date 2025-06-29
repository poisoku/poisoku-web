import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';

export interface FinalCampaign {
  name: string;
  cashbackRate: string;
  normalizedCashback: string;
  url: string;
  description?: string;
  siteName: string;
  category: string;
  isPercentage: boolean;
}

export interface FinalScrapeResult {
  success: boolean;
  siteName: string;
  campaigns: FinalCampaign[];
  errors: string[];
  stats: {
    totalUrls: number;
    totalPagesProcessed: number;
    totalCampaigns: number;
    processingTimeMs: number;
    averageCampaignsPerPage: number;
    targetAchieved: boolean;
    uniqueCampaigns: number;
    duplicatesRemoved: number;
  };
  debug: {
    urlsProcessed: string[];
    effectiveSelectors: string[];
    campaignCounts: Record<string, number>;
    pageResults: Record<string, number>;
  };
}

export class FinalScraper {
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

  // 最終版モッピー全案件取得（調査結果に基づく最適化）
  async scrapeAllMoppyFinal(): Promise<FinalScrapeResult> {
    const startTime = Date.now();
    const result: FinalScrapeResult = {
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
        uniqueCampaigns: 0,
        duplicatesRemoved: 0
      },
      debug: {
        urlsProcessed: [],
        effectiveSelectors: [],
        campaignCounts: {},
        pageResults: {}
      }
    };

    try {
      if (!this.page) {
        throw new Error('Pageが初期化されていません');
      }

      console.log('🎯 モッピー最終版スクレイピング開始...');
      console.log('   調査結果に基づく最適化済みURL群を処理');
      console.log('   目標: 1,500件以上の案件取得');

      // 調査で効果的だったURL群
      const finalUrls = [
        { 
          url: 'https://pc.moppy.jp/service/', 
          expectedCount: 1103, 
          description: 'メイン案件ページ（1103件確認済み）'
        },
        { 
          url: 'https://pc.moppy.jp/service/?page=2', 
          expectedCount: 1108, 
          description: 'メイン案件ページ2（1108件確認済み）'
        },
        { 
          url: 'https://pc.moppy.jp/service/?page=3', 
          expectedCount: 1000, 
          description: 'メイン案件ページ3'
        },
        { 
          url: 'https://pc.moppy.jp/service/?page=4', 
          expectedCount: 1000, 
          description: 'メイン案件ページ4'
        },
        { 
          url: 'https://pc.moppy.jp/service/?page=5', 
          expectedCount: 1000, 
          description: 'メイン案件ページ5'
        },
        { 
          url: 'https://pc.moppy.jp/search/?q=', 
          expectedCount: 866, 
          description: '全案件検索（866件確認済み）'
        },
        { 
          url: 'https://pc.moppy.jp/category/list.php?parent_category=1', 
          expectedCount: 452, 
          description: 'ショッピングカテゴリ（452件確認済み）'
        },
        { 
          url: 'https://pc.moppy.jp/category/list.php?parent_category=3', 
          expectedCount: 300, 
          description: 'マネーカテゴリ'
        },
        { 
          url: 'https://pc.moppy.jp/category/list.php?parent_category=2', 
          expectedCount: 200, 
          description: 'エンタメカテゴリ'
        },
        { 
          url: 'https://pc.moppy.jp/category/list.php?parent_category=4', 
          expectedCount: 150, 
          description: 'その他カテゴリ'
        }
      ];

      // 調査で最も効果的だったセレクタ
      const finalSelectors = [
        '[class*="item"]', // 調査で100%効果的だった
        '[class*="service"]',
        '[class*="campaign"]',
        '[class*="ad"]'
      ];

      const allCampaigns = new Map<string, FinalCampaign>();
      let totalRawCampaigns = 0;
      result.stats.totalUrls = finalUrls.length;

      // 各URLを処理
      for (let i = 0; i < finalUrls.length; i++) {
        const urlInfo = finalUrls[i];
        
        try {
          console.log(`📂 処理中 ${i + 1}/${finalUrls.length}: ${urlInfo.description}`);
          console.log(`   URL: ${urlInfo.url}`);
          console.log(`   期待案件数: ${urlInfo.expectedCount}件`);
          
          const urlResult = await this.processUrlFinal(
            urlInfo.url, 
            finalSelectors, 
            urlInfo.expectedCount
          );
          
          result.debug.urlsProcessed.push(urlInfo.url);
          result.debug.campaignCounts[urlInfo.url] = urlResult.campaigns.length;
          result.debug.pageResults[urlInfo.url] = urlResult.campaigns.length;
          result.stats.totalPagesProcessed++;
          totalRawCampaigns += urlResult.campaigns.length;

          // 重複除去しながら案件を追加
          let duplicatesFromThisUrl = 0;
          urlResult.campaigns.forEach(campaign => {
            const key = `${campaign.name}-${campaign.cashbackRate}-${campaign.siteName}`;
            if (!allCampaigns.has(key) && campaign.name.length > 2) {
              allCampaigns.set(key, campaign);
            } else {
              duplicatesFromThisUrl++;
            }
          });

          result.errors.push(...urlResult.errors);
          
          if (urlResult.effectiveSelector) {
            result.debug.effectiveSelectors.push(urlResult.effectiveSelector);
          }

          console.log(`   → ${urlResult.campaigns.length}件取得 (重複除去前)`);
          console.log(`   → ${duplicatesFromThisUrl}件重複除去`);
          console.log(`   → 累計ユニーク案件: ${allCampaigns.size}件`);

          // URL間の待機時間
          if (i < finalUrls.length - 1) {
            await this.delay(3000);
          }

        } catch (error) {
          const errorMsg = `URL ${urlInfo.url} 処理エラー: ${error}`;
          console.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }

      result.campaigns = Array.from(allCampaigns.values());
      result.stats = {
        totalUrls: finalUrls.length,
        totalPagesProcessed: result.stats.totalPagesProcessed,
        totalCampaigns: result.campaigns.length,
        processingTimeMs: Date.now() - startTime,
        averageCampaignsPerPage: result.stats.totalPagesProcessed > 0 ? 
          result.campaigns.length / result.stats.totalPagesProcessed : 0,
        targetAchieved: result.campaigns.length >= 1500,
        uniqueCampaigns: result.campaigns.length,
        duplicatesRemoved: totalRawCampaigns - result.campaigns.length
      };

      result.success = result.campaigns.length > 0;

      console.log(`✅ 最終版スクレイピング完了:`);
      console.log(`   総取得数（重複込み）: ${totalRawCampaigns.toLocaleString()}件`);
      console.log(`   ユニーク案件数: ${result.campaigns.length.toLocaleString()}件`);
      console.log(`   重複除去数: ${result.stats.duplicatesRemoved.toLocaleString()}件`);
      console.log(`   目標達成: ${result.stats.targetAchieved ? 'Yes' : 'No'} (目標1500件以上)`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('最終版スクレイピングエラー:', error);
      result.errors.push(`全体エラー: ${errorMessage}`);
    }

    return result;
  }

  // 最終版URL処理
  private async processUrlFinal(
    url: string, 
    selectors: string[], 
    expectedCount: number
  ): Promise<{
    campaigns: FinalCampaign[];
    errors: string[];
    effectiveSelector?: string;
  }> {
    const urlResult = {
      campaigns: [] as FinalCampaign[],
      errors: [] as string[],
      effectiveSelector: undefined as string | undefined
    };

    try {
      console.log(`     🌐 ページ読み込み開始...`);
      await this.page!.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
      
      // JavaScript読み込み完了まで十分に待機（調査結果に基づく）
      console.log(`     ⏳ JavaScript読み込み完了まで15秒待機...`);
      await this.delay(15000);

      // HTML取得してスクレイピング
      const html = await this.page!.content();
      const $ = cheerio.load(html);

      // 各セレクタを試して最も効果的なものを特定
      for (const selector of selectors) {
        try {
          const elements = $(selector);
          console.log(`     🔍 セレクタ "${selector}": ${elements.length}件発見`);
          
          if (elements.length > 0) {
            const campaigns = await this.extractCampaignsFinal($, elements, selector);
            
            if (campaigns.length > urlResult.campaigns.length) {
              urlResult.campaigns = campaigns;
              urlResult.effectiveSelector = selector;
            }
          }
        } catch (error) {
          urlResult.errors.push(`セレクタ ${selector} エラー: ${error}`);
        }
      }

      console.log(`     ✅ 最終取得数: ${urlResult.campaigns.length}件`);

    } catch (error) {
      urlResult.errors.push(`URL処理エラー: ${error}`);
    }

    return urlResult;
  }

  // 最終版案件抽出
  private async extractCampaignsFinal(
    $: cheerio.CheerioAPI, 
    elements: cheerio.Cheerio<any>, 
    selector: string
  ): Promise<FinalCampaign[]> {
    const campaigns: FinalCampaign[] = [];

    elements.each((index, element) => {
      try {
        const campaign = this.extractSingleCampaignFinal($, $(element));
        if (campaign) {
          campaigns.push(campaign);
        }
      } catch (error) {
        // 個別要素のエラーは無視して続行
      }
    });

    // 重複除去
    const uniqueCampaigns = new Map<string, FinalCampaign>();
    campaigns.forEach(campaign => {
      const key = `${campaign.name}-${campaign.cashbackRate}`;
      if (!uniqueCampaigns.has(key) && campaign.name.length > 2) {
        uniqueCampaigns.set(key, campaign);
      }
    });

    return Array.from(uniqueCampaigns.values());
  }

  // 単一案件の最終版抽出
  private extractSingleCampaignFinal($: cheerio.CheerioAPI, $el: cheerio.Cheerio<any>): FinalCampaign | null {
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