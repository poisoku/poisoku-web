import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';

export interface ComprehensiveInvestigationResult {
  totalSitesAnalyzed: number;
  realBrowserCount: number;
  scrapingCount: number;
  difference: number;
  analysisResults: Array<{
    url: string;
    description: string;
    browserElementCount: number;
    scrapingElementCount: number;
    difference: number;
    effectiveSelectors: string[];
    htmlSnapshot: string;
    analysisNotes: string[];
  }>;
  recommendations: string[];
  possibleCauses: string[];
}

export class ComprehensiveInvestigator {
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
      headless: false, // ヘッドレスを無効にして実際のブラウザ表示を確認
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

  // 包括的なモッピー構造調査
  async investigateMoppyComprehensive(): Promise<ComprehensiveInvestigationResult> {
    const result: ComprehensiveInvestigationResult = {
      totalSitesAnalyzed: 0,
      realBrowserCount: 0,
      scrapingCount: 0,
      difference: 0,
      analysisResults: [],
      recommendations: [],
      possibleCauses: []
    };

    try {
      if (!this.page) {
        throw new Error('Pageが初期化されていません');
      }

      console.log('🔍 モッピー包括的構造調査開始...');
      console.log('   実際のブラウザとスクレイピング結果の差異を詳細分析');

      // 主要URLの包括的調査
      const investigationUrls = [
        { 
          url: 'https://pc.moppy.jp/service/', 
          description: 'メイン案件ページ',
          expectedCount: 1103
        },
        { 
          url: 'https://pc.moppy.jp/service/?page=1', 
          description: 'メイン案件ページ（ページ1指定）',
          expectedCount: 1000
        },
        { 
          url: 'https://pc.moppy.jp/service/?page=2', 
          description: 'メイン案件ページ（ページ2指定）',
          expectedCount: 1000
        },
        { 
          url: 'https://pc.moppy.jp/category/list.php?parent_category=1', 
          description: 'ショッピングカテゴリ全体',
          expectedCount: 500
        },
        { 
          url: 'https://pc.moppy.jp/search/?q=', 
          description: '全案件検索（空クエリ）',
          expectedCount: 1500
        }
      ];

      // 検証用セレクタ
      const testSelectors = [
        '[class*="item"]',
        '[class*="service"]',
        '[class*="campaign"]',
        '[class*="ad"]',
        '.list-item',
        'li[class*="item"]',
        'div[class*="item"]',
        '[data-campaign]',
        '[data-service]',
        '.moppy-service'
      ];

      let totalBrowserCount = 0;
      let totalScrapingCount = 0;

      // 各URLを包括的に調査
      for (let i = 0; i < investigationUrls.length; i++) {
        const urlInfo = investigationUrls[i];
        
        try {
          console.log(`\n📂 調査中 ${i + 1}/${investigationUrls.length}: ${urlInfo.description}`);
          console.log(`   URL: ${urlInfo.url}`);
          
          const urlAnalysis = await this.analyzeUrlComprehensive(
            urlInfo.url, 
            urlInfo.description,
            testSelectors
          );
          
          result.analysisResults.push(urlAnalysis);
          totalBrowserCount += urlAnalysis.browserElementCount;
          totalScrapingCount += urlAnalysis.scrapingElementCount;
          
          console.log(`   ブラウザ表示: ${urlAnalysis.browserElementCount}要素`);
          console.log(`   スクレイピング: ${urlAnalysis.scrapingElementCount}要素`);
          console.log(`   差異: ${urlAnalysis.difference}要素`);
          
          // URL間の待機
          if (i < investigationUrls.length - 1) {
            await this.delay(3000);
          }
          
        } catch (error) {
          console.error(`URL ${urlInfo.url} 調査エラー:`, error);
        }
      }

      result.totalSitesAnalyzed = investigationUrls.length;
      result.realBrowserCount = totalBrowserCount;
      result.scrapingCount = totalScrapingCount;
      result.difference = totalBrowserCount - totalScrapingCount;

      // 分析と推奨事項の生成
      this.generateAnalysisAndRecommendations(result);

      console.log(`\n✅ 包括的構造調査完了:`);
      console.log(`   調査URL数: ${result.totalSitesAnalyzed}`);
      console.log(`   実ブラウザ総要素数: ${result.realBrowserCount.toLocaleString()}`);
      console.log(`   スクレイピング総要素数: ${result.scrapingCount.toLocaleString()}`);
      console.log(`   差異: ${result.difference.toLocaleString()}要素`);

    } catch (error) {
      console.error('包括的構造調査エラー:', error);
    }

    return result;
  }

  // 単一URLの包括的分析
  private async analyzeUrlComprehensive(
    url: string, 
    description: string,
    selectors: string[]
  ): Promise<{
    url: string;
    description: string;
    browserElementCount: number;
    scrapingElementCount: number;
    difference: number;
    effectiveSelectors: string[];
    htmlSnapshot: string;
    analysisNotes: string[];
  }> {
    const analysis = {
      url,
      description,
      browserElementCount: 0,
      scrapingElementCount: 0,
      difference: 0,
      effectiveSelectors: [] as string[],
      htmlSnapshot: '',
      analysisNotes: [] as string[]
    };

    try {
      console.log(`     🌐 ページ読み込み...`);
      await this.page!.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
      
      // 1. JavaScript読み込み完了まで十分に待機
      console.log(`     ⏳ JavaScript読み込み完了まで15秒待機...`);
      await this.delay(15000);
      
      // 2. 実際のブラウザで表示されている要素数を取得
      console.log(`     🔍 実ブラウザ要素数カウント...`);
      const browserCounts = await this.page!.evaluate((sels) => {
        const counts: Record<string, number> = {};
        let maxCount = 0;
        let bestSelector = '';
        
        for (const selector of sels) {
          try {
            const elements = document.querySelectorAll(selector);
            counts[selector] = elements.length;
            if (elements.length > maxCount) {
              maxCount = elements.length;
              bestSelector = selector;
            }
          } catch (error) {
            counts[selector] = 0;
          }
        }
        
        return { counts, maxCount, bestSelector };
      }, selectors);
      
      analysis.browserElementCount = browserCounts.maxCount;
      
      // 3. HTML取得してCheerioでスクレイピング
      console.log(`     📄 HTML取得してスクレイピング...`);
      const html = await this.page!.content();
      const $ = cheerio.load(html);
      
      let maxScrapingCount = 0;
      const selectorResults: Record<string, number> = {};
      
      for (const selector of selectors) {
        try {
          const elements = $(selector);
          selectorResults[selector] = elements.length;
          if (elements.length > maxScrapingCount) {
            maxScrapingCount = elements.length;
            analysis.effectiveSelectors.push(selector);
          }
        } catch (error) {
          selectorResults[selector] = 0;
        }
      }
      
      analysis.scrapingElementCount = maxScrapingCount;
      analysis.difference = analysis.browserElementCount - analysis.scrapingElementCount;
      
      // 4. HTMLサンプルを保存（デバッグ用）
      analysis.htmlSnapshot = html.substring(0, 5000) + '...';
      
      // 5. 分析ノートの生成
      analysis.analysisNotes.push(`実ブラウザ最良セレクタ: ${browserCounts.bestSelector} (${browserCounts.maxCount}件)`);
      analysis.analysisNotes.push(`スクレイピング最良セレクタ: ${analysis.effectiveSelectors[0] || 'なし'} (${maxScrapingCount}件)`);
      
      if (analysis.difference > 100) {
        analysis.analysisNotes.push('⚠️ 大きな差異が検出されました - JavaScript動的読み込みの可能性');
      }
      
      if (analysis.difference < 0) {
        analysis.analysisNotes.push('⚠️ スクレイピングの方が多い - セレクタが関係のない要素も取得している可能性');
      }
      
      // 6. セレクタ別詳細ログ
      console.log(`     📊 セレクタ別結果:`);
      for (const selector of selectors) {
        const browserCount = browserCounts.counts[selector] || 0;
        const scrapingCount = selectorResults[selector] || 0;
        console.log(`       ${selector}: ブラウザ${browserCount} / スクレイピング${scrapingCount}`);
      }
      
    } catch (error) {
      analysis.analysisNotes.push(`エラー: ${error}`);
    }

    return analysis;
  }

  // 分析と推奨事項の生成
  private generateAnalysisAndRecommendations(result: ComprehensiveInvestigationResult): void {
    // 可能性のある原因の分析
    if (result.difference > 1000) {
      result.possibleCauses.push('JavaScript動的読み込みによる要素の後追加');
      result.possibleCauses.push('Ajax呼び出しによるコンテンツの非同期読み込み');
      result.possibleCauses.push('無限スクロールによる段階的コンテンツ表示');
      result.possibleCauses.push('ページネーションによる分割表示');
    }
    
    if (result.difference > 500) {
      result.possibleCauses.push('セレクタが重複要素を除外している');
      result.possibleCauses.push('表示条件によって非表示になっている要素の存在');
    }
    
    // 推奨事項の生成
    result.recommendations.push('より長い待機時間（30秒以上）でのJavaScript読み込み完了待機');
    result.recommendations.push('実ブラウザで最も効果的だったセレクタの活用');
    result.recommendations.push('段階的スクロールと要素数監視の実装');
    result.recommendations.push('Ajax完了検知の精度向上');
    
    if (result.analysisResults.some(r => r.difference > 200)) {
      result.recommendations.push('手動でのページネーション実装（全ページ処理）');
      result.recommendations.push('直接的なAPI呼び出しの調査と活用');
    }
  }

  // 待機
  private async delay(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }
}