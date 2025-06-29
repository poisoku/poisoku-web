import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';

export interface PatientCampaign {
  name: string;
  cashbackRate: string;
  normalizedCashback: string;
  url: string;
  description?: string;
  siteName: string;
  category: string;
  isPercentage: boolean;
}

export interface PatientScrapeResult {
  success: boolean;
  siteName: string;
  campaigns: PatientCampaign[];
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
    waitTimes: Record<string, number>;
    contentLoadStages: Record<string, number[]>;
  };
}

export class PatientScraper {
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

    await this.page.setDefaultTimeout(60000); // 60秒に延長
    await this.page.setDefaultNavigationTimeout(60000); // 60秒に延長
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

  // 忍耐強いモッピー全案件取得
  async scrapeAllMoppyPatient(): Promise<PatientScrapeResult> {
    const startTime = Date.now();
    const result: PatientScrapeResult = {
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
        campaignCounts: {},
        waitTimes: {},
        contentLoadStages: {}
      }
    };

    try {
      if (!this.page) {
        throw new Error('Pageが初期化されていません');
      }

      console.log('🎯 モッピー忍耐強いスクレイピング開始...');
      console.log('   JavaScript読み込み完了まで十分に待機');
      console.log('   段階的コンテンツ読み込みを監視');

      // 最も効果的なURLから開始（段階的に増加）
      const patientUrls = [
        { url: 'https://pc.moppy.jp/service/', expectedCount: 1103, description: 'メイン案件ページ', waitTime: 15000 },
        { url: 'https://pc.moppy.jp/search/?q=楽天', expectedCount: 867, description: '楽天検索', waitTime: 12000 },
        { url: 'https://pc.moppy.jp/search/?q=Amazon', expectedCount: 867, description: 'Amazon検索', waitTime: 12000 },
        { url: 'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=31', expectedCount: 200, description: 'クレジットカード', waitTime: 10000 },
        { url: 'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=32', expectedCount: 150, description: '銀行・証券', waitTime: 10000 },
        { url: 'https://pc.moppy.jp/category/list.php?parent_category=1&child_category=11', expectedCount: 200, description: 'ショッピング', waitTime: 10000 }
      ];

      // 段階的待機に基づくセレクタ
      const patientSelectors = [
        '[class*="item"]',
        '[class*="service"]',
        '[class*="ad"]',
        '.campaign-item',
        '.service-item',
        '.ad-item',
        'li[class*="campaign"]',
        '[data-campaign]',
        '.list-item',
        '[class*="list"]'
      ];

      const allCampaigns = new Map<string, PatientCampaign>();
      result.stats.totalUrls = patientUrls.length;

      // 各URLを忍耐強く処理
      for (let i = 0; i < patientUrls.length; i++) {
        const urlInfo = patientUrls[i];
        
        try {
          console.log(`📂 処理中 ${i + 1}/${patientUrls.length}: ${urlInfo.description}`);
          console.log(`   URL: ${urlInfo.url}`);
          console.log(`   期待案件数: ${urlInfo.expectedCount}件`);
          console.log(`   待機時間: ${urlInfo.waitTime / 1000}秒`);
          
          const urlResult = await this.processUrlWithPatience(
            urlInfo.url, 
            patientSelectors, 
            urlInfo.expectedCount,
            urlInfo.waitTime
          );
          
          result.debug.urlsProcessed.push(urlInfo.url);
          result.debug.campaignCounts[urlInfo.url] = urlResult.campaigns.length;
          result.debug.waitTimes[urlInfo.url] = urlInfo.waitTime;
          result.debug.contentLoadStages[urlInfo.url] = urlResult.contentStages;
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
          console.log(`   読み込み段階: ${urlResult.contentStages.join(' → ')}件`);

          // URL間の待機時間（延長）
          if (i < patientUrls.length - 1) {
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
        totalUrls: patientUrls.length,
        totalPagesProcessed: result.stats.totalPagesProcessed,
        totalCampaigns: result.campaigns.length,
        processingTimeMs: Date.now() - startTime,
        averageCampaignsPerPage: result.stats.totalPagesProcessed > 0 ? 
          result.campaigns.length / result.stats.totalPagesProcessed : 0,
        targetAchieved: result.campaigns.length >= 800 // 800件以上で成功とみなす
      };

      result.success = result.campaigns.length > 0;

      console.log(`✅ 忍耐強いスクレイピング完了: ${result.campaigns.length.toLocaleString()}件取得`);
      console.log(`🎯 目標達成: ${result.stats.targetAchieved ? 'Yes' : 'No'} (目標800件以上)`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('忍耐強いスクレイピングエラー:', error);
      result.errors.push(`全体エラー: ${errorMessage}`);
    }

    return result;
  }

  // 忍耐強いURL処理
  private async processUrlWithPatience(
    url: string, 
    selectors: string[], 
    expectedCount: number,
    waitTime: number
  ): Promise<{
    campaigns: PatientCampaign[];
    errors: string[];
    effectiveSelector?: string;
    contentStages: number[];
  }> {
    const urlResult = {
      campaigns: [] as PatientCampaign[],
      errors: [] as string[],
      effectiveSelector: undefined as string | undefined,
      contentStages: [] as number[]
    };

    try {
      // ページ読み込み
      console.log(`     🌐 ページ読み込み開始...`);
      await this.page!.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
      
      // 段階的コンテンツ監視
      console.log(`     ⏳ JavaScript読み込み完了まで ${waitTime / 1000}秒待機...`);
      
      // 段階的に要素数をチェック
      const stageChecks = [2000, 5000, 8000, 12000, waitTime];
      
      for (const stageWait of stageChecks) {
        if (stageWait <= waitTime) {
          await this.delay(stageWait === 2000 ? 2000 : stageWait - (stageChecks[stageChecks.indexOf(stageWait) - 1] || 0));
          
          // この段階での要素数をチェック
          const html = await this.page!.content();
          const $ = cheerio.load(html);
          
          let maxElements = 0;
          for (const selector of selectors) {
            const elements = $(selector);
            if (elements.length > maxElements) {
              maxElements = elements.length;
            }
          }
          
          urlResult.contentStages.push(maxElements);
          console.log(`     📊 ${stageWait / 1000}秒後: ${maxElements}要素発見`);
        }
      }

      // 最終的な要素取得
      const html = await this.page!.content();
      const $ = cheerio.load(html);

      // 各セレクタを試して最も効果的なものを特定
      for (const selector of selectors) {
        try {
          const elements = $(selector);
          console.log(`     🔍 セレクタ \"${selector}\": ${elements.length}件発見`);
          
          if (elements.length > 0) {
            const campaigns = await this.extractCampaignsPatient($, elements, selector);
            
            if (campaigns.length > urlResult.campaigns.length) {
              urlResult.campaigns = campaigns;
              urlResult.effectiveSelector = selector;
            }
          }
        } catch (error) {
          urlResult.errors.push(`セレクタ ${selector} エラー: ${error}`);
        }
      }

      // スクロールして追加コンテンツを読み込み
      console.log(`     📜 スクロールして追加コンテンツ読み込み...`);
      try {
        await this.page!.evaluate(async () => {
          await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 500;
            const timer = setInterval(() => {
              const scrollHeight = document.body.scrollHeight;
              window.scrollBy(0, distance);
              totalHeight += distance;

              if (totalHeight >= scrollHeight) {
                clearInterval(timer);
                resolve(undefined);
              }
            }, 200);
          });
        });
        
        // スクロール後に追加待機
        await this.delay(3000);
        
        // スクロール後の要素再チェック
        const scrollHtml = await this.page!.content();
        const $scroll = cheerio.load(scrollHtml);
        
        for (const selector of selectors) {
          const elements = $scroll(selector);
          if (elements.length > urlResult.campaigns.length) {
            const campaigns = await this.extractCampaignsPatient($scroll, elements, selector);
            if (campaigns.length > urlResult.campaigns.length) {
              urlResult.campaigns = campaigns;
              urlResult.effectiveSelector = selector + ' (スクロール後)';
            }
          }
        }
        
      } catch (scrollError) {
        urlResult.errors.push(`スクロール処理エラー: ${scrollError}`);
      }

    } catch (error) {
      urlResult.errors.push(`URL処理エラー: ${error}`);
    }

    return urlResult;
  }

  // 忍耐強い案件抽出
  private async extractCampaignsPatient(
    $: cheerio.CheerioAPI, 
    elements: cheerio.Cheerio<any>, 
    selector: string
  ): Promise<PatientCampaign[]> {
    const campaigns: PatientCampaign[] = [];

    elements.each((index, element) => {
      try {
        const campaign = this.extractSingleCampaignPatient($, $(element));
        if (campaign) {
          campaigns.push(campaign);
        }
      } catch (error) {
        // 個別要素のエラーは無視して続行
      }
    });

    // 重複除去
    const uniqueCampaigns = new Map<string, PatientCampaign>();
    campaigns.forEach(campaign => {
      const key = `${campaign.name}-${campaign.cashbackRate}`;
      if (!uniqueCampaigns.has(key) && campaign.name.length > 2) {
        uniqueCampaigns.set(key, campaign);
      }
    });

    return Array.from(uniqueCampaigns.values());
  }

  // 単一案件の忍耐強い抽出
  private extractSingleCampaignPatient($: cheerio.CheerioAPI, $el: cheerio.Cheerio<any>): PatientCampaign | null {
    try {
      // より包括的な名前抽出
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

      // より包括的な還元率抽出
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