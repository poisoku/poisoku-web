import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';

export interface GradualCampaign {
  name: string;
  cashbackRate: string;
  normalizedCashback: string;
  url: string;
  description?: string;
  siteName: string;
  category: string;
  isPercentage: boolean;
}

export interface GradualScrapeResult {
  success: boolean;
  siteName: string;
  campaigns: GradualCampaign[];
  errors: string[];
  stats: {
    totalKeywords: number;
    totalPagesProcessed: number;
    totalCampaigns: number;
    processingTimeMs: number;
    averagePageTime: number;
    targetAchieved: boolean;
    duplicatesRemoved: number;
    batchesSaved: number;
  };
  debug: {
    keywordResults: Record<string, number>;
    progressLog: string[];
  };
}

export class GradualMoppyScraper {
  private browser: Browser | null = null;

  async initialize(): Promise<void> {
    console.log('🚀 段階的スクレイピング用ブラウザ初期化中...');
    
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

  // 段階的モッピー案件取得（タイムアウト回避）
  async scrapeAllMoppyGradual(): Promise<GradualScrapeResult> {
    const startTime = Date.now();
    const result: GradualScrapeResult = {
      success: false,
      siteName: 'モッピー',
      campaigns: [],
      errors: [],
      stats: {
        totalKeywords: 0,
        totalPagesProcessed: 0,
        totalCampaigns: 0,
        processingTimeMs: 0,
        averagePageTime: 0,
        targetAchieved: false,
        duplicatesRemoved: 0,
        batchesSaved: 0
      },
      debug: {
        keywordResults: {},
        progressLog: []
      }
    };

    try {
      console.log('🎯 段階的モッピースクレイピング開始...');
      console.log('   戦略: 高頻度キーワードで段階的に案件収集');
      console.log('   目標: 短時間で効率的に多数の案件取得');

      // 高効率キーワード戦略（実証済みの効果的キーワード）
      const highImpactKeywords = [
        '楽天',     // 大手サービス
        'Amazon',   // 大手EC
        'Yahoo',    // 大手ポータル
        'au',       // 通信キャリア
        'docomo',   // 通信キャリア
        'SoftBank', // 通信キャリア
        'カード',    // クレジットカード案件
        '証券',     // 金融案件
        '銀行',     // 金融案件
        '旅行',     // 旅行案件
        'ホテル',   // 宿泊案件
        'ゲーム',   // ゲーム案件
        'アプリ',   // アプリ案件
        'ポイント', // ポイント案件
        'キャッシュバック', // キャッシュバック案件
        '無料',     // 無料案件
        'お試し',   // トライアル案件
        '申込',     // 申込案件
        '登録',     // 登録案件
        '会員'      // 会員案件
      ];

      result.stats.totalKeywords = highImpactKeywords.length;
      const allCampaigns = new Map<string, GradualCampaign>();

      // バッチ処理でキーワード検索（タイムアウト回避）
      const batchSize = 5; // 5キーワードずつ処理
      const batches = this.chunkArray(highImpactKeywords, batchSize);

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`\n📦 バッチ ${batchIndex + 1}/${batches.length}: ${batch.join(', ')}`);

        for (const keyword of batch) {
          try {
            console.log(`  🔍 キーワード処理: "${keyword}"`);
            
            const keywordCampaigns = await this.scrapeKeyword(keyword);
            
            // リアルタイム重複除去
            let newCampaigns = 0;
            keywordCampaigns.forEach(campaign => {
              const key = `${campaign.name}-${campaign.cashbackRate}`;
              if (!allCampaigns.has(key) && campaign.name.length > 2) {
                allCampaigns.set(key, campaign);
                newCampaigns++;
              }
            });

            result.debug.keywordResults[keyword] = newCampaigns;
            result.stats.totalPagesProcessed++;
            
            console.log(`    → ${newCampaigns}件新規取得 (累計${allCampaigns.size}件)`);
            
            // キーワード間の短い待機
            await this.delay(3000);
            
          } catch (error) {
            result.errors.push(`キーワード"${keyword}"エラー: ${error}`);
            console.log(`    ⚠️ エラー: ${error}`);
          }
        }

        // バッチ間の待機（サーバー負荷軽減）
        if (batchIndex < batches.length - 1) {
          console.log(`  💤 バッチ間待機...`);
          await this.delay(5000);
        }

        // 中間報告
        console.log(`  📊 バッチ完了: 累計${allCampaigns.size}件取得`);
      }

      result.campaigns = Array.from(allCampaigns.values());
      result.stats = {
        ...result.stats,
        totalPagesProcessed: result.stats.totalPagesProcessed,
        totalCampaigns: result.campaigns.length,
        processingTimeMs: Date.now() - startTime,
        averagePageTime: result.stats.totalPagesProcessed > 0 ? 
          (Date.now() - startTime) / result.stats.totalPagesProcessed : 0,
        targetAchieved: result.campaigns.length >= 1000 // 段階的目標: 1000件
      };

      result.success = result.campaigns.length > 0;

      console.log(`\n✅ 段階的スクレイピング完了:`);
      console.log(`   総案件数: ${result.campaigns.length.toLocaleString()}件`);
      console.log(`   処理キーワード数: ${result.stats.totalKeywords}個`);
      console.log(`   処理時間: ${(result.stats.processingTimeMs / 1000 / 60).toFixed(1)}分`);
      console.log(`   重複除去効果: 高品質データ確保`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('段階的スクレイピングエラー:', error);
      result.errors.push(`全体エラー: ${errorMessage}`);
    }

    return result;
  }

  // キーワード別案件取得
  private async scrapeKeyword(keyword: string): Promise<GradualCampaign[]> {
    if (!this.browser) {
      throw new Error('ブラウザが初期化されていません');
    }

    const page = await this.browser.newPage();
    const campaigns: GradualCampaign[] = [];

    try {
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1920, height: 1080 });

      // モッピー検索URL
      const searchUrl = `https://pc.moppy.jp/search/?q=${encodeURIComponent(keyword)}`;
      
      await page.goto(searchUrl, { waitUntil: 'networkidle0', timeout: 30000 });
      
      // 短い待機（最適化済み）
      await this.delay(5000);
      
      const html = await page.content();
      const $ = cheerio.load(html);
      
      // 効果的なセレクタ（実証済み）
      const elements = $('[class*="item"]');
      
      if (elements.length === 0) {
        return campaigns;
      }
      
      campaigns.push(...this.extractCampaignsOptimized($, elements));
      
    } catch (error) {
      throw new Error(`キーワード"${keyword}"処理エラー: ${error}`);
    } finally {
      await page.close();
    }

    return campaigns;
  }

  // 最適化された案件抽出
  private extractCampaignsOptimized($: cheerio.CheerioAPI, elements: cheerio.Cheerio<any>): GradualCampaign[] {
    const campaigns: GradualCampaign[] = [];

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