import { NextRequest, NextResponse } from 'next/server';
import { MassiveScraper } from '@/lib/massiveScraper';
import { ScraperDatabase } from '@/lib/scraperDb';

// 大規模全案件取得API
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
    const { site = 'モッピー', maxCampaigns = 10000 } = body;

    console.log(`🚀 ${site}の大規模全案件スクレイピング開始...`);
    console.log(`   目標: 数千件の案件を取得してデータベースに登録`);

    const scraper = new MassiveScraper();
    const scraperDb = new ScraperDatabase();
    
    let result;
    
    try {
      await scraper.initialize();
      
      if (site === 'モッピー') {
        result = await scraper.scrapeAllMoppyMassive();
      } else {
        throw new Error(`サイト ${site} の大規模スクレイピングはまだサポートされていません`);
      }
      
    } finally {
      await scraper.cleanup();
    }

    if (!result.success) {
      const errorMessage = result.errors.length > 0 ? result.errors.join(', ') : '不明なエラー';
      console.error('大規模スクレイピング失敗詳細:', result);
      throw new Error(`大規模スクレイピングに失敗しました: ${errorMessage}`);
    }

    console.log(`📊 大規模スクレイピング結果: ${result.campaigns.length.toLocaleString()}件の案件を取得`);

    // データベースに保存
    const campaignData = result.campaigns.map(campaign => ({
      name: campaign.name,
      cashbackRate: campaign.normalizedCashback,
      pointSiteName: campaign.siteName,
      campaignUrl: campaign.url,
      description: campaign.description,
      device: 'All',
      category: campaign.category
    }));

    // バッチサイズを制限してデータベース負荷を軽減
    const batchSize = 500;
    let savedCount = 0;
    let updatedCount = 0;
    const saveErrors: string[] = [];

    for (let i = 0; i < campaignData.length; i += batchSize) {
      const batch = campaignData.slice(i, i + batchSize);
      
      const saveResults = [{
        siteName: result.siteName,
        success: result.success,
        data: batch,
        errors: result.errors,
        scrapedAt: new Date()
      }];

      try {
        const saveResult = await scraperDb.saveCampaigns(saveResults, 'massive-scrape');
        savedCount += saveResult.savedCount;
        updatedCount += saveResult.updatedCount;
        saveErrors.push(...saveResult.errors);
        
        console.log(`💾 バッチ ${Math.floor(i / batchSize) + 1}: ${saveResult.savedCount}件保存, ${saveResult.updatedCount}件更新`);
        
        // バッチ間で少し待機
        if (i + batchSize < campaignData.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        console.error(`バッチ ${Math.floor(i / batchSize) + 1} 保存エラー:`, error);
        saveErrors.push(`バッチ保存エラー: ${error}`);
      }
    }
    
    const processingTime = Date.now() - startTime;
    
    // レスポンス
    const response = {
      success: true,
      site: result.siteName,
      massive: true,
      stats: {
        totalCampaigns: result.stats.totalCampaigns,
        totalCategories: result.stats.totalCategories,
        totalPagesProcessed: result.stats.totalPagesProcessed,
        averageCampaignsPerPage: result.stats.averageCampaignsPerPage,
        scrapingTimeMs: result.stats.processingTimeMs,
        totalTimeMs: processingTime
      },
      database: {
        savedCount,
        updatedCount,
        errors: saveErrors,
        batchesProcessed: Math.ceil(campaignData.length / batchSize)
      },
      campaigns: result.campaigns.slice(0, 100), // 最初の100件のサンプルを表示
      errors: result.errors,
      debug: {
        categoriesProcessed: result.debug.categoriesProcessed.length,
        pagesProcessed: result.debug.pagesUrls.length,
        errorCount: result.debug.errors.length
      },
      scrapedAt: new Date().toISOString(),
      performance: {
        campaignsPerSecond: (result.stats.totalCampaigns / (result.stats.processingTimeMs / 1000)).toFixed(1),
        pagesPerMinute: ((result.stats.totalPagesProcessed / (result.stats.processingTimeMs / 1000)) * 60).toFixed(1),
        efficiency: calculateEfficiency(result)
      },
      recommendations: generateMassiveRecommendations(result, savedCount, updatedCount)
    };

    console.log('✅ 大規模全案件スクレイピング完了:', {
      totalCampaigns: response.stats.totalCampaigns,
      savedCount: response.database.savedCount,
      updatedCount: response.database.updatedCount,
      processingTimeMinutes: (processingTime / 1000 / 60).toFixed(1)
    });
    
    return NextResponse.json(response);

  } catch (error) {
    console.error('大規模全案件スクレイピングエラー:', error);
    
    const processingTime = Date.now() - startTime;
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '不明なエラー',
      processingTimeMs: processingTime,
      scrapedAt: new Date().toISOString()
    }, { status: 500 });
  }
}

// 効率性計算
function calculateEfficiency(result: any): number {
  const expectedCampaigns = 24830; // 調査で推定された総案件数
  const actualCampaigns = result.stats.totalCampaigns;
  return Math.min((actualCampaigns / expectedCampaigns) * 100, 100);
}

// 大規模スクレイピング推奨事項生成
function generateMassiveRecommendations(result: any, savedCount: number, updatedCount: number): any {
  const recommendations = {
    efficiency: calculateEfficiency(result),
    dataQuality: {
      campaignsFound: result.stats.totalCampaigns,
      expectedRange: [20000, 30000],
      quality: result.stats.totalCampaigns > 1000 ? 'Good' : 'Poor'
    },
    performance: {
      avgCampaignsPerPage: result.stats.averageCampaignsPerPage,
      totalPages: result.stats.totalPagesProcessed,
      efficiency: result.stats.averageCampaignsPerPage > 50 ? 'High' : 'Low'
    },
    database: {
      savedCount,
      updatedCount,
      successRate: savedCount + updatedCount > 0 ? 
        ((savedCount + updatedCount) / result.stats.totalCampaigns * 100).toFixed(1) + '%' : '0%'
    },
    nextSteps: [] as string[]
  };

  // 推奨事項
  if (result.stats.totalCampaigns < 1000) {
    recommendations.nextSteps.push('取得案件数が少ないです。セレクタやページネーション処理を見直してください。');
  } else if (result.stats.totalCampaigns < 5000) {
    recommendations.nextSteps.push('案件数は良好ですが、さらなる最適化で増加の余地があります。');
  } else {
    recommendations.nextSteps.push('優秀な取得数です。定期実行システムの構築を推奨します。');
  }

  if (recommendations.database.successRate < '90%') {
    recommendations.nextSteps.push('データベース保存の成功率を改善してください。');
  }

  if (result.stats.averageCampaignsPerPage < 20) {
    recommendations.nextSteps.push('ページあたりの取得効率を向上させるため、セレクタを最適化してください。');
  }

  return recommendations;
}