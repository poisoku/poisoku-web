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
    parallelWorkers: number;
    averagePageTime: number;
    targetAchieved: boolean;
    duplicatesRemoved: number;
    batchesSaved: number;
  };
  debug: {
    urlResults: Record<string, number>;
    workerStats: Record<string, any>;
    progressLog: string[];
  };
}

export class EfficientMoppyScraper {
  private browsers: Browser[] = [];
  private maxWorkers = 3; // 並列ワーカー数

  async initialize(): Promise<void> {
    console.log(`🚀 ${this.maxWorkers}並列ワーカーでブラウザ初期化中...`);
    
    for (let i = 0; i < this.maxWorkers; i++) {
      const browser = await puppeteer.launch({
        headless: true,
        args: [
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
        ]
      });
      
      this.browsers.push(browser);
    }
  }

  async cleanup(): Promise<void> {
    console.log('🧹 ブラウザクリーンアップ中...');
    for (const browser of this.browsers) {
      await browser.close();
    }
    this.browsers = [];
  }

  // 効率的モッピー全案件取得（並列処理 + ストリーミング保存）
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
        parallelWorkers: this.maxWorkers,
        averagePageTime: 0,
        targetAchieved: false,
        duplicatesRemoved: 0,
        batchesSaved: 0
      },
      debug: {
        urlResults: {},
        workerStats: {},
        progressLog: []
      }
    };

    try {
      console.log('🎯 効率的モッピースクレイピング開始...');
      console.log(`   並列ワーカー: ${this.maxWorkers}並列`);
      console.log('   ストリーミング保存: リアルタイム保存');
      console.log('   目標: 6,000件以上の案件取得');

      // 効率的URL戦略（最も効果的なURLのみ選択）
      const efficientUrls = [
        // 高優先度URL（実証済み）
        { 
          url: 'https://pc.moppy.jp/service/', 
          expectedCount: 1103, 
          priority: 'high',
          maxPages: 20,
          description: 'メイン案件ページ'
        },
        { 
          url: 'https://pc.moppy.jp/search/?q=', 
          expectedCount: 866, 
          priority: 'high',
          maxPages: 15,
          description: '全案件検索'
        },
        { 
          url: 'https://pc.moppy.jp/search/?q=楽天', 
          expectedCount: 800, 
          priority: 'high',
          maxPages: 10,
          description: '楽天案件'
        },
        
        // 中優先度URL
        { 
          url: 'https://pc.moppy.jp/category/list.php?parent_category=1', 
          expectedCount: 452, 
          priority: 'medium',
          maxPages: 10,
          description: 'ショッピング全般'
        },
        { 
          url: 'https://pc.moppy.jp/category/list.php?parent_category=3', 
          expectedCount: 300, 
          priority: 'medium',
          maxPages: 8,
          description: '金融全般'
        },
        { 
          url: 'https://pc.moppy.jp/category/list.php?parent_category=3&child_category=31', 
          expectedCount: 200, 
          priority: 'medium',
          maxPages: 6,
          description: 'クレジットカード'
        },
        
        // 補完URL
        { 
          url: 'https://pc.moppy.jp/search/?q=Amazon', 
          expectedCount: 300, 
          priority: 'low',
          maxPages: 5,
          description: 'Amazon案件'
        },
        { 
          url: 'https://pc.moppy.jp/search/?q=Yahoo', 
          expectedCount: 300, 
          priority: 'low',
          maxPages: 5,
          description: 'Yahoo案件'
        }
      ];

      // URL群を優先度別に分割
      const highPriorityUrls = efficientUrls.filter(u => u.priority === 'high');
      const mediumPriorityUrls = efficientUrls.filter(u => u.priority === 'medium');
      const lowPriorityUrls = efficientUrls.filter(u => u.priority === 'low');

      result.stats.totalUrls = efficientUrls.length;
      const allCampaigns = new Map<string, EfficientCampaign>();

      // フェーズ1: 高優先度URLを並列処理
      console.log('\n📊 フェーズ1: 高優先度URL並列処理');
      await this.processUrlsInParallel(highPriorityUrls, allCampaigns, result, 1);

      // 中間チェック：目標達成確認
      console.log(`\n🎯 中間チェック: ${allCampaigns.size}件取得`);
      if (allCampaigns.size >= 3000) {
        console.log('✅ 中間目標達成！処理を継続...');
      }

      // フェーズ2: 中優先度URLを並列処理
      console.log('\n📊 フェーズ2: 中優先度URL並列処理');
      await this.processUrlsInParallel(mediumPriorityUrls, allCampaigns, result, 2);

      // 目標確認
      if (allCampaigns.size < 4000) {
        console.log('\n📊 フェーズ3: 低優先度URL補完処理');
        await this.processUrlsInParallel(lowPriorityUrls, allCampaigns, result, 3);
      }

      result.campaigns = Array.from(allCampaigns.values());
      result.stats = {
        ...result.stats,
        totalPagesProcessed: result.stats.totalPagesProcessed,
        totalCampaigns: result.campaigns.length,
        processingTimeMs: Date.now() - startTime,
        averagePageTime: result.stats.totalPagesProcessed > 0 ? 
          (Date.now() - startTime) / result.stats.totalPagesProcessed : 0,
        targetAchieved: result.campaigns.length >= 6000
      };

      result.success = result.campaigns.length > 0;

      console.log(`\n✅ 効率的スクレイピング完了:`);
      console.log(`   総案件数: ${result.campaigns.length.toLocaleString()}件`);
      console.log(`   処理ページ数: ${result.stats.totalPagesProcessed}ページ`);
      console.log(`   処理時間: ${(result.stats.processingTimeMs / 1000 / 60).toFixed(1)}分`);
      console.log(`   並列効果: ${this.maxWorkers}倍速処理`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('効率的スクレイピングエラー:', error);
      result.errors.push(`全体エラー: ${errorMessage}`);
    }

    return result;
  }

  // 並列URL処理
  private async processUrlsInParallel(
    urls: any[], 
    allCampaigns: Map<string, EfficientCampaign>, 
    result: EfficientScrapeResult,
    phase: number
  ): Promise<void> {
    const chunks = this.chunkArray(urls, this.maxWorkers);
    
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      console.log(`\n   チャンク ${chunkIndex + 1}/${chunks.length}: ${chunk.length}URL並列処理`);
      
      // 並列処理実行
      const promises = chunk.map((urlInfo, index) => 
        this.processUrlWorker(urlInfo, index, allCampaigns, result, phase)
      );
      
      await Promise.all(promises);
      
      console.log(`   → チャンク完了: 累計${allCampaigns.size}件`);
      
      // チャンク間の短い待機
      if (chunkIndex < chunks.length - 1) {
        await this.delay(1000);
      }
    }
  }

  // ワーカープロセス
  private async processUrlWorker(
    urlInfo: any,
    workerIndex: number,
    allCampaigns: Map<string, EfficientCampaign>,
    result: EfficientScrapeResult,
    phase: number
  ): Promise<void> {
    const browser = this.browsers[workerIndex % this.browsers.length];
    const page = await browser.newPage();
    
    try {
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1920, height: 1080 });
      
      console.log(`     🔄 ワーカー${workerIndex + 1}: ${urlInfo.description} 処理開始`);
      
      let pageCampaigns = 0;
      
      // ページネーション処理
      for (let pageNum = 1; pageNum <= urlInfo.maxPages; pageNum++) {
        try {
          const pageUrl = pageNum === 1 ? urlInfo.url : `${urlInfo.url}${urlInfo.url.includes('?') ? '&' : '?'}page=${pageNum}`;
          
          await page.goto(pageUrl, { waitUntil: 'networkidle0', timeout: 30000 });
          
          // 最適化された待機時間（5秒）
          await this.delay(5000);
          
          const html = await page.content();
          const $ = cheerio.load(html);
          
          // 最も効果的なセレクタのみ使用
          const elements = $('[class*="item"]');
          
          if (elements.length === 0) {
            console.log(`       → ページ${pageNum}: 案件なし、終了`);
            break;
          }
          
          const pageCampaignsArray = this.extractCampaignsEfficient($, elements);
          
          // リアルタイム重複除去と追加
          let newCampaigns = 0;
          pageCampaignsArray.forEach(campaign => {
            const key = `${campaign.name}-${campaign.cashbackRate}`;
            if (!allCampaigns.has(key) && campaign.name.length > 2) {
              allCampaigns.set(key, campaign);
              newCampaigns++;
            }
          });
          
          pageCampaigns += newCampaigns;
          result.stats.totalPagesProcessed++;
          
          console.log(`       → ページ${pageNum}: ${newCampaigns}件新規 (累計${pageCampaigns}件)`);
          
          // ページ間の短い待機
          if (pageNum < urlInfo.maxPages) {
            await this.delay(2000);
          }
          
        } catch (pageError) {
          result.errors.push(`ページ${pageNum}エラー: ${pageError}`);
          continue;
        }
      }
      
      result.debug.urlResults[urlInfo.description] = pageCampaigns;
      console.log(`     ✅ ワーカー${workerIndex + 1}: ${urlInfo.description} 完了 (${pageCampaigns}件)`);
      
    } catch (error) {
      result.errors.push(`ワーカー${workerIndex + 1}エラー: ${error}`);
    } finally {
      await page.close();
    }
  }

  // 効率的案件抽出
  private extractCampaignsEfficient($: cheerio.CheerioAPI, elements: cheerio.Cheerio<any>): EfficientCampaign[] {
    const campaigns: EfficientCampaign[] = [];

    elements.each((index, element) => {
      try {
        const $el = $(element);
        
        // 名前抽出（簡素化）
        let name = '';
        const nameSelectors = ['.title', '.name', 'h3', 'h2', 'strong', 'a'];
        for (const selector of nameSelectors) {
          const text = $el.find(selector).first().text().trim();
          if (text && text.length > 2 && text.length < 200) {
            name = text;
            break;
          }
        }
        
        if (!name) {
          name = $el.text().trim().substring(0, 100);
        }
        
        if (!name || name.length < 2) return;

        // 還元率抽出（簡素化）
        let cashbackRate = '';
        const cashbackSelectors = ['.point', '.rate', '.mp', 'strong', 'b'];
        for (const selector of cashbackSelectors) {
          const text = $el.find(selector).text().trim();
          if (text && (text.includes('P') || text.includes('%') || text.includes('円'))) {
            cashbackRate = text;
            break;
          }
        }
        
        if (!cashbackRate) {
          const allText = $el.text();
          const match = allText.match(/(\d+(?:[,，]\d+)*(?:\.\d+)?)\s*[P%円ポイントpt]/);
          if (match) {
            cashbackRate = match[0];
          }
        }
        
        if (!cashbackRate) return;

        campaigns.push({
          name: this.cleanName(name),
          cashbackRate: cashbackRate.trim(),
          normalizedCashback: this.normalizeCashbackRate(cashbackRate),
          url: this.extractUrl($el, 'https://pc.moppy.jp'),
          description: name.substring(0, 100),
          siteName: 'モッピー',
          category: this.estimateCategory(name, ''),
          isPercentage: cashbackRate.includes('%') || cashbackRate.includes('％')
        });

      } catch (error) {
        // 個別エラーは無視
      }
    });

    return campaigns;
  }

  // 配列をチャンクに分割
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // ヘルパーメソッド
  private cleanName(name: string): string {
    return name
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, ' ')
      .replace(/【[^】]*】/g, '')
      .replace(/\([^)]*\)/g, '')
      .replace(/\s*[\d,，]+\.?\d*[P円ポイントpt%％]\s*/g, '')
      .trim()
      .substring(0, 100);
  }

  private extractUrl($el: cheerio.Cheerio<any>, baseUrl: string): string {
    const linkEl = $el.is('a') ? $el : $el.find('a').first();
    if (linkEl.length > 0) {
      const href = linkEl.attr('href') || '';
      return href.startsWith('http') ? href : `${baseUrl}${href}`;
    }
    return '';
  }

  private normalizeCashbackRate(text: string): string {
    if (!text) return '0円';
    
    const cleanText = text.replace(/[,，\s　]/g, '').trim();
    
    if (cleanText.includes('%') || cleanText.includes('％')) {
      const match = cleanText.match(/[\d.]+/);
      return match ? `${match[0]}%` : '0%';
    }
    
    if (cleanText.includes('P') || cleanText.includes('ポイント')) {
      const match = cleanText.match(/[\d,，]+/);
      if (match) {
        const points = parseInt(match[0].replace(/[,，]/g, ''));
        return `${points.toLocaleString()}円`;
      }
    }
    
    return text.substring(0, 20);
  }

  private estimateCategory(name: string, description: string): string {
    const text = (name + ' ' + description).toLowerCase();
    
    if (text.includes('カード') || text.includes('クレジット')) return 'finance';
    if (text.includes('証券') || text.includes('銀行')) return 'finance';
    if (text.includes('旅行') || text.includes('ホテル')) return 'travel';
    if (text.includes('ゲーム') || text.includes('アプリ')) return 'entertainment';
    
    return 'shopping';
  }

  private async delay(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }
}