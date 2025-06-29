import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';

export interface UltraCampaign {
  name: string;
  cashbackRate: string;
  normalizedCashback: string;
  url: string;
  description?: string;
  siteName: string;
  category: string;
  isPercentage: boolean;
}

export interface UltraScrapeResult {
  success: boolean;
  siteName: string;
  campaigns: UltraCampaign[];
  errors: string[];
  stats: {
    totalQueries: number;
    totalPagesProcessed: number;
    totalCampaigns: number;
    processingTimeMs: number;
    averagePageTime: number;
    targetAchieved: boolean;
    duplicatesRemoved: number;
    batchesSaved: number;
  };
  debug: {
    queryResults: Record<string, number>;
    progressLog: string[];
    totalRawCampaigns: number;
  };
}

export class UltraEfficientMoppyScraper {
  private browser: Browser | null = null;

  async initialize(): Promise<void> {
    console.log('🚀 超効率的全案件スクレイピング用ブラウザ初期化中...');
    
    this.browser = await puppeteer.launch({
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
  }

  async cleanup(): Promise<void> {
    console.log('🧹 ブラウザクリーンアップ中...');
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  // 超効率的モッピー全案件取得
  async scrapeAllMoppyUltraEfficient(): Promise<UltraScrapeResult> {
    const startTime = Date.now();
    const result: UltraScrapeResult = {
      success: false,
      siteName: 'モッピー',
      campaigns: [],
      errors: [],
      stats: {
        totalQueries: 0,
        totalPagesProcessed: 0,
        totalCampaigns: 0,
        processingTimeMs: 0,
        averagePageTime: 0,
        targetAchieved: false,
        duplicatesRemoved: 0,
        batchesSaved: 0
      },
      debug: {
        queryResults: {},
        progressLog: [],
        totalRawCampaigns: 0
      }
    };

    try {
      console.log('🎯 超効率的モッピー全案件スクレイピング開始...');
      console.log('   戦略: 最高効率クエリのみ + 並列処理 + 深度ページネーション');
      console.log('   目標: 短時間で最大数の案件取得');

      // 超効率的クエリ戦略（実証データに基づく最高効率のみ）
      const ultraEfficientQueries = [
        // 最高効率確認済み
        { query: '', description: '全案件（空クエリ）', maxPages: 100, priority: 1 },
        { query: '楽天', description: '楽天案件', maxPages: 30, priority: 1 },
        { query: 'Amazon', description: 'Amazon案件', maxPages: 20, priority: 1 },
        { query: 'Yahoo', description: 'Yahoo案件', maxPages: 20, priority: 1 },
        
        // 高効率確認済み
        { query: 'カード', description: 'カード案件', maxPages: 25, priority: 2 },
        { query: '証券', description: '証券案件', maxPages: 15, priority: 2 },
        { query: '銀行', description: '銀行案件', maxPages: 15, priority: 2 },
        { query: 'au', description: 'au案件', maxPages: 15, priority: 2 },
        { query: 'docomo', description: 'docomo案件', maxPages: 15, priority: 2 },
        { query: 'SoftBank', description: 'SoftBank案件', maxPages: 15, priority: 2 },
        
        // 中効率カテゴリ
        { query: '旅行', description: '旅行案件', maxPages: 12, priority: 3 },
        { query: 'ホテル', description: 'ホテル案件', maxPages: 12, priority: 3 },
        { query: 'ゲーム', description: 'ゲーム案件', maxPages: 12, priority: 3 },
        { query: 'アプリ', description: 'アプリ案件', maxPages: 12, priority: 3 },
        { query: '美容', description: '美容案件', maxPages: 10, priority: 3 },
        { query: '健康', description: '健康案件', maxPages: 10, priority: 3 },
        { query: 'コスメ', description: 'コスメ案件', maxPages: 10, priority: 3 },
        { query: '保険', description: '保険案件', maxPages: 10, priority: 3 },
        { query: 'ファッション', description: 'ファッション案件', maxPages: 8, priority: 3 },
        { query: '食品', description: '食品案件', maxPages: 8, priority: 3 }
      ];

      result.stats.totalQueries = ultraEfficientQueries.length;
      const allCampaigns = new Map<string, UltraCampaign>();
      let totalRawCampaigns = 0;

      // 優先度順に処理
      const sortedQueries = ultraEfficientQueries.sort((a, b) => a.priority - b.priority);

      console.log(`\\n📊 ${sortedQueries.length}個の超効率クエリを優先度順に処理開始`);

      for (let i = 0; i < sortedQueries.length; i++) {
        const queryInfo = sortedQueries[i];
        
        try {
          console.log(`\\n🔍 クエリ ${i + 1}/${sortedQueries.length}: "${queryInfo.query}" (${queryInfo.description})`);
          console.log(`   優先度: ${queryInfo.priority}, 最大ページ数: ${queryInfo.maxPages}`);
          
          let queryCampaigns = 0;
          let queryRawCampaigns = 0;

          // 深度ページネーション処理
          for (let page = 1; page <= queryInfo.maxPages; page++) {
            try {
              const searchUrl = queryInfo.query === '' ? 
                (page === 1 ? 'https://pc.moppy.jp/service/' : `https://pc.moppy.jp/service/?page=${page}`) :
                (page === 1 ? `https://pc.moppy.jp/search/?q=${encodeURIComponent(queryInfo.query)}` : 
                 `https://pc.moppy.jp/search/?q=${encodeURIComponent(queryInfo.query)}&page=${page}`);
              
              console.log(`     📄 ページ${page} 処理中...`);
              
              const pageCampaigns = await this.scrapePageUltraEfficient(searchUrl);
              queryRawCampaigns += pageCampaigns.length;
              
              if (pageCampaigns.length === 0) {
                console.log(`     → ページ${page}: 案件なし、クエリ終了`);
                break;
              }
              
              // リアルタイム重複除去
              let newCampaigns = 0;
              pageCampaigns.forEach(campaign => {
                const key = `${campaign.name}-${campaign.cashbackRate}`;
                if (!allCampaigns.has(key) && campaign.name.length > 2) {
                  allCampaigns.set(key, campaign);
                  newCampaigns++;
                }
              });

              queryCampaigns += newCampaigns;
              result.stats.totalPagesProcessed++;
              
              console.log(`     → ページ${page}: ${pageCampaigns.length}件raw, ${newCampaigns}件新規 (累計${allCampaigns.size}件)`);
              
              // ページ間の最適化された待機
              if (page < queryInfo.maxPages) {
                await this.delay(1500); // 高速化
              }
              
            } catch (pageError) {
              result.errors.push(`${queryInfo.description}ページ${page}エラー: ${pageError}`);
              console.log(`     → ページ${page}: エラー、次のページへ`);
              continue;
            }
          }

          result.debug.queryResults[queryInfo.description] = queryCampaigns;
          totalRawCampaigns += queryRawCampaigns;
          
          console.log(`   ✅ ${queryInfo.description}: ${queryCampaigns}件新規, ${queryRawCampaigns}件raw (累計${allCampaigns.size}件)`);
          
          // 中間報告
          if (allCampaigns.size >= 2000) {
            console.log(`🎉 2,000件突破！ 処理継続中...`);
          }
          if (allCampaigns.size >= 3000) {
            console.log(`🎉 3,000件突破！ 大規模データ取得成功！`);
          }
          
          // クエリ間の待機
          if (i < sortedQueries.length - 1) {
            await this.delay(2000); // 最適化
          }
          
        } catch (error) {
          result.errors.push(`クエリ"${queryInfo.description}"エラー: ${error}`);
          console.log(`   ⚠️ エラー: ${error}`);
        }
      }

      result.campaigns = Array.from(allCampaigns.values());
      result.debug.totalRawCampaigns = totalRawCampaigns;
      
      result.stats = {
        ...result.stats,
        totalPagesProcessed: result.stats.totalPagesProcessed,
        totalCampaigns: result.campaigns.length,
        processingTimeMs: Date.now() - startTime,
        averagePageTime: result.stats.totalPagesProcessed > 0 ? 
          (Date.now() - startTime) / result.stats.totalPagesProcessed : 0,
        targetAchieved: result.campaigns.length >= 2000, // 実用的目標: 2000件
        duplicatesRemoved: totalRawCampaigns - result.campaigns.length
      };

      result.success = result.campaigns.length > 0;

      console.log(`\\n✅ 超効率的スクレイピング完了:`);
      console.log(`   処理クエリ数: ${result.stats.totalQueries}個`);
      console.log(`   処理ページ数: ${result.stats.totalPagesProcessed}ページ`);
      console.log(`   総取得数（raw）: ${totalRawCampaigns.toLocaleString()}件`);
      console.log(`   ユニーク案件数: ${result.campaigns.length.toLocaleString()}件`);
      console.log(`   重複除去数: ${result.stats.duplicatesRemoved.toLocaleString()}件`);
      console.log(`   処理時間: ${(result.stats.processingTimeMs / 1000 / 60).toFixed(1)}分`);
      console.log(`   目標達成: ${result.stats.targetAchieved ? 'Yes' : 'No'}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('超効率的スクレイピングエラー:', error);
      result.errors.push(`全体エラー: ${errorMessage}`);
    }

    return result;
  }

  // 単一ページ超効率処理
  private async scrapePageUltraEfficient(url: string): Promise<UltraCampaign[]> {
    if (!this.browser) {
      throw new Error('ブラウザが初期化されていません');
    }

    const page = await this.browser.newPage();
    const campaigns: UltraCampaign[] = [];

    try {
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1920, height: 1080 });

      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
      
      // 最適化された待機時間
      await this.delay(3000);
      
      const html = await page.content();
      const $ = cheerio.load(html);
      
      // 最も効果的なセレクタのみ使用
      const elements = $('[class*="item"]');
      
      campaigns.push(...this.extractCampaignsUltraEfficient($, elements));
      
    } catch (error) {
      throw new Error(`URL"${url}"処理エラー: ${error}`);
    } finally {
      await page.close();
    }

    return campaigns;
  }

  // 超効率的案件抽出
  private extractCampaignsUltraEfficient($: cheerio.CheerioAPI, elements: cheerio.Cheerio<any>): UltraCampaign[] {
    const campaigns: UltraCampaign[] = [];

    elements.each((index, element) => {
      try {
        const $el = $(element);
        
        // 名前抽出（最適化）
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

        // 還元率抽出（最適化）
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
          const match = allText.match(/(\\d+(?:[,，]\\d+)*(?:\\.\\d+)?)\\s*[P%円ポイントpt]/);
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

  // ヘルパーメソッド
  private cleanName(name: string): string {
    return name
      .replace(/\\s+/g, ' ')
      .replace(/\\n+/g, ' ')
      .replace(/【[^】]*】/g, '')
      .replace(/\\([^)]*\\)/g, '')
      .replace(/\\s*[\\d,，]+\\.?\\d*[P円ポイントpt%％]\\s*/g, '')
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
    
    const cleanText = text.replace(/[,，\\s　]/g, '').trim();
    
    if (cleanText.includes('%') || cleanText.includes('％')) {
      const match = cleanText.match(/[\\d.]+/);
      return match ? `${match[0]}%` : '0%';
    }
    
    if (cleanText.includes('P') || cleanText.includes('ポイント')) {
      const match = cleanText.match(/[\\d,，]+/);
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