import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';

export interface CampaignData {
  name: string;
  cashbackRate: string;
  pointSiteName: string;
  campaignUrl: string;
  description?: string;
  device?: 'PC' | 'iOS' | 'Android' | 'All';
  category?: string;
}

export interface ScrapingResult {
  success: boolean;
  data: CampaignData[];
  errors: string[];
  scrapedAt: Date;
  siteName: string;
}

export class PointSiteScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize(): Promise<void> {
    try {
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
      
      // ユーザーエージェントを設定
      await this.page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      );
      
      // タイムアウト設定
      await this.page.setDefaultTimeout(30000);
      await this.page.setDefaultNavigationTimeout(30000);
      
    } catch (error) {
      console.error('Puppeteer初期化エラー:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    } catch (error) {
      console.error('クリーンアップエラー:', error);
    }
  }

  // ハピタスのスクレイピング
  async scrapeHapitas(searchKeyword: string): Promise<ScrapingResult> {
    const result: ScrapingResult = {
      success: false,
      data: [],
      errors: [],
      scrapedAt: new Date(),
      siteName: 'ハピタス'
    };

    try {
      if (!this.page) {
        throw new Error('Pageが初期化されていません');
      }

      console.log(`ハピタス検索開始: ${searchKeyword}`);
      
      // ハピタスの検索URL
      const searchUrl = `https://hapitas.jp/search/?word=${encodeURIComponent(searchKeyword)}`;
      
      await this.page.goto(searchUrl, { waitUntil: 'networkidle2' });
      
      // ページ読み込み待機
      await this.page.waitForTimeout(2000);
      
      const html = await this.page.content();
      const $ = cheerio.load(html);
      
      // ハピタスの案件要素を抽出（実際のセレクタは要調整）
      $('.search-result-item, .shop-item, .campaign-item').each((index, element) => {
        try {
          const $el = $(element);
          const name = $el.find('.shop-name, .title, h3, h4').first().text().trim();
          const cashbackText = $el.find('.point, .cashback, .rate').first().text().trim();
          const linkEl = $el.find('a').first();
          const campaignUrl = linkEl.attr('href') || '';
          
          if (name && cashbackText) {
            // 還元率を正規化
            const cashbackRate = this.normalizeCashbackRate(cashbackText);
            
            result.data.push({
              name: name,
              cashbackRate: cashbackRate,
              pointSiteName: 'ハピタス',
              campaignUrl: campaignUrl.startsWith('http') ? campaignUrl : `https://hapitas.jp${campaignUrl}`,
              device: 'All',
              category: 'shopping'
            });
          }
        } catch (error) {
          result.errors.push(`要素解析エラー: ${error}`);
        }
      });
      
      result.success = true;
      console.log(`ハピタス取得完了: ${result.data.length}件`);
      
    } catch (error) {
      console.error('ハピタススクレイピングエラー:', error);
      result.errors.push(`ハピタススクレイピングエラー: ${error}`);
    }

    return result;
  }

  // モッピーのスクレイピング
  async scrapeMoppy(searchKeyword: string): Promise<ScrapingResult> {
    const result: ScrapingResult = {
      success: false,
      data: [],
      errors: [],
      scrapedAt: new Date(),
      siteName: 'モッピー'
    };

    try {
      if (!this.page) {
        throw new Error('Pageが初期化されていません');
      }

      console.log(`モッピー検索開始: ${searchKeyword}`);
      
      // モッピーの検索URL
      const searchUrl = `https://pc.moppy.jp/ad/search/?q=${encodeURIComponent(searchKeyword)}`;
      
      await this.page.goto(searchUrl, { waitUntil: 'networkidle2' });
      
      // ページ読み込み待機
      await this.page.waitForTimeout(2000);
      
      const html = await this.page.content();
      const $ = cheerio.load(html);
      
      // モッピーの案件要素を抽出（実際のセレクタは要調整）
      $('.shop-list-item, .ad-item, .search-item').each((index, element) => {
        try {
          const $el = $(element);
          const name = $el.find('.shop-name, .title, h3, h4').first().text().trim();
          const cashbackText = $el.find('.point, .cashback, .rate').first().text().trim();
          const linkEl = $el.find('a').first();
          const campaignUrl = linkEl.attr('href') || '';
          
          if (name && cashbackText) {
            // 還元率を正規化
            const cashbackRate = this.normalizeCashbackRate(cashbackText);
            
            result.data.push({
              name: name,
              cashbackRate: cashbackRate,
              pointSiteName: 'モッピー',
              campaignUrl: campaignUrl.startsWith('http') ? campaignUrl : `https://pc.moppy.jp${campaignUrl}`,
              device: 'All',
              category: 'shopping'
            });
          }
        } catch (error) {
          result.errors.push(`要素解析エラー: ${error}`);
        }
      });
      
      result.success = true;
      console.log(`モッピー取得完了: ${result.data.length}件`);
      
    } catch (error) {
      console.error('モッピースクレイピングエラー:', error);
      result.errors.push(`モッピースクレイピングエラー: ${error}`);
    }

    return result;
  }

  // 還元率文字列を正規化
  private normalizeCashbackRate(text: string): string {
    // 「1.0%」「100P」「100ポイント」「1.0％」などを統一
    const cleaned = text.replace(/[^\d.％%ポイントPp]/g, '');
    
    // パーセント表記を統一
    if (cleaned.includes('%') || cleaned.includes('％')) {
      const rate = cleaned.replace(/[％%]/g, '');
      return `${rate}%`;
    }
    
    // ポイント表記の場合
    if (cleaned.includes('ポイント') || cleaned.includes('P') || cleaned.includes('p')) {
      const points = cleaned.replace(/[ポイントPp]/g, '');
      return `${points}P`;
    }
    
    return cleaned || '0%';
  }

  // 複数サイトを並行スクレイピング
  async scrapeMultipleSites(searchKeyword: string): Promise<ScrapingResult[]> {
    const results: ScrapingResult[] = [];
    
    try {
      await this.initialize();
      
      // 各サイトを順番にスクレイピング（並行処理はレート制限対策で避ける）
      const hapitasResult = await this.scrapeHapitas(searchKeyword);
      results.push(hapitasResult);
      
      // サイト間でのレート制限対策
      await this.page?.waitForTimeout(3000);
      
      const moppyResult = await this.scrapeMoppy(searchKeyword);
      results.push(moppyResult);
      
    } catch (error) {
      console.error('複数サイトスクレイピングエラー:', error);
    } finally {
      await this.cleanup();
    }
    
    return results;
  }
}