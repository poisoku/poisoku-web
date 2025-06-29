import { NextRequest, NextResponse } from 'next/server';
import { PointSiteScraper } from '@/lib/scraper';
import { RealSiteScraper } from '@/lib/realSiteScraper';
import { ScraperDatabase } from '@/lib/scraperDb';

// 手動スクレイピング実行API
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // 認証チェック
    const authHeader = request.headers.get('authorization');
    const expectedAuth = process.env.SCRAPING_SECRET || 'default-scraping-secret';
    
    if (authHeader !== `Bearer ${expectedAuth}`) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const body = await request.json();
    const { keyword, sites } = body;

    if (!keyword) {
      return NextResponse.json({ error: 'キーワードが必要です' }, { status: 400 });
    }

    console.log(`リアルスクレイピング開始: ${keyword}, サイト: ${sites?.join(',') || 'すべて'}`);

    const realScraper = new RealSiteScraper();
    const scraperDb = new ScraperDatabase();
    
    let results;
    
    // 改良されたスクレイピングを実行
    try {
      if (sites && Array.isArray(sites) && sites.length > 0) {
        // 指定サイトのみ（個別実行）
        results = [];
        
        for (const site of sites) {
          console.log(`${site}をスクレイピング中...`);
          
          try {
            await realScraper.initialize({
              headless: true,
              customUserAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            });

            if (site === 'ハピタス') {
              const result = await realScraper.scrapeHapitasAdvanced(keyword);
              results.push({
                siteName: 'ハピタス',
                success: result.success,
                data: result.campaigns.map(c => ({
                  name: c.name,
                  cashbackRate: c.cashbackRate,
                  pointSiteName: c.siteName,
                  campaignUrl: c.url,
                  description: c.description,
                  device: 'All',
                  category: 'shopping'
                })),
                errors: result.errors,
                scrapedAt: new Date(),
                debug: result.debug
              });
            } else if (site === 'モッピー') {
              const result = await realScraper.scrapeMoppyAdvanced(keyword);
              results.push({
                siteName: 'モッピー',
                success: result.success,
                data: result.campaigns.map(c => ({
                  name: c.name,
                  cashbackRate: c.cashbackRate,
                  pointSiteName: c.siteName,
                  campaignUrl: c.url,
                  description: c.description,
                  device: 'All',
                  category: 'shopping'
                })),
                errors: result.errors,
                scrapedAt: new Date(),
                debug: result.debug
              });
            }

            await realScraper.cleanup();
            
            // サイト間でのレート制限
            if (sites.length > 1) {
              await new Promise(resolve => setTimeout(resolve, 5000));
            }
            
          } catch (error) {
            console.error(`${site}スクレイピングエラー:`, error);
            results.push({
              siteName: site,
              success: false,
              data: [],
              errors: [error instanceof Error ? error.message : '不明なエラー'],
              scrapedAt: new Date(),
              debug: { pageTitle: '', finalUrl: '', htmlSnippet: '', foundElements: 0 }
            });
            
            await realScraper.cleanup();
          }
        }
      } else {
        // 全サイトを一括スクレイピング
        const scrapeResults = await realScraper.scrapeAllSites(keyword);
        results = scrapeResults.map(result => ({
          siteName: result.campaigns[0]?.siteName || '不明',
          success: result.success,
          data: result.campaigns.map(c => ({
            name: c.name,
            cashbackRate: c.cashbackRate,
            pointSiteName: c.siteName,
            campaignUrl: c.url,
            description: c.description,
            device: 'All',
            category: 'shopping'
          })),
          errors: result.errors,
          scrapedAt: new Date(),
          debug: result.debug
        }));
      }
    } catch (error) {
      console.error('スクレイピング初期化エラー:', error);
      throw error;
    }

    // データベースに保存
    const saveResult = await scraperDb.saveCampaigns(results, keyword);
    
    const processingTime = Date.now() - startTime;
    
    // レスポンス（詳細なデバッグ情報付き）
    const response = {
      success: true,
      keyword,
      sites: results.map(r => ({
        siteName: r.siteName,
        success: r.success,
        campaignsFound: r.data.length,
        errors: r.errors,
        debug: {
          pageTitle: r.debug?.pageTitle || '',
          finalUrl: r.debug?.finalUrl || '',
          foundElements: r.debug?.foundElements || 0,
          htmlSnippet: r.debug?.htmlSnippet?.substring(0, 300) || ''
        }
      })),
      campaigns: results.flatMap(r => r.data).slice(0, 20), // 最初の20件を表示
      database: {
        savedCount: saveResult.savedCount,
        updatedCount: saveResult.updatedCount,
        errors: saveResult.errors
      },
      totalCampaigns: results.reduce((sum, r) => sum + r.data.length, 0),
      processingTimeMs: processingTime,
      scrapedAt: new Date().toISOString(),
      recommendations: generateRecommendations(results)
    };

    console.log('スクレイピング完了:', response);
    
    return NextResponse.json(response);

  } catch (error) {
    console.error('スクレイピングエラー:', error);
    
    const processingTime = Date.now() - startTime;
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '不明なエラー',
      processingTimeMs: processingTime,
      scrapedAt: new Date().toISOString()
    }, { status: 500 });
  }
}

// スクレイピング統計取得API
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '7');
    
    const scraperDb = new ScraperDatabase();
    const stats = await scraperDb.getScrapingStats(days);
    
    // 古い案件の非アクティブ化も実行
    const deactivatedCount = await scraperDb.deactivateOldCampaigns();
    
    return NextResponse.json({
      success: true,
      stats,
      deactivatedCampaigns: deactivatedCount,
      reportPeriodDays: days,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('スクレイピング統計取得エラー:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '不明なエラー'
    }, { status: 500 });
  }
}

// スクレイピング結果から推奨事項を生成
function generateRecommendations(results: any[]): any {
  const recommendations = {
    totalSitesScraped: results.length,
    successfulSites: results.filter(r => r.success).length,
    totalCampaignsFound: results.reduce((sum, r) => sum + r.data.length, 0),
    sitesWithData: results.filter(r => r.data.length > 0).map(r => r.siteName),
    sitesWithErrors: results.filter(r => r.errors.length > 0).map(r => ({
      siteName: r.siteName,
      errorCount: r.errors.length,
      mainError: r.errors[0]
    })),
    nextSteps: []
  };

  if (recommendations.successfulSites === 0) {
    recommendations.nextSteps.push('すべてのサイトでスクレイピングに失敗しました。サイト構造の変更やアクセス制限が考えられます。');
  } else if (recommendations.successfulSites < recommendations.totalSitesScraped) {
    recommendations.nextSteps.push('一部のサイトでスクレイピングに失敗しました。セレクタの調整が必要な可能性があります。');
  }

  if (recommendations.totalCampaignsFound === 0) {
    recommendations.nextSteps.push('案件が見つかりませんでした。検索キーワードを変更するか、セレクタを調整してください。');
  } else if (recommendations.totalCampaignsFound < 5) {
    recommendations.nextSteps.push('取得できた案件数が少ないです。より包括的なセレクタが必要な可能性があります。');
  }

  return recommendations;
}