import { NextRequest, NextResponse } from 'next/server';
import { UltraEfficientMoppyScraper } from '@/lib/ultraEfficientMoppyScraper';
import { ScraperDatabase } from '@/lib/scraperDb';

// 超効率的モッピースクレイピングAPI
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
    const { site = 'モッピー' } = body;

    console.log(`🎯 ${site}の超効率的スクレイピング開始...`);
    console.log('   戦略: 最高効率クエリのみ + 深度ページネーション');
    console.log('   目標: 短時間で最大数の案件取得（2,000件以上）');

    const scraper = new UltraEfficientMoppyScraper();
    const scraperDb = new ScraperDatabase();
    
    let result;
    
    try {
      await scraper.initialize();
      
      if (site === 'モッピー') {
        result = await scraper.scrapeAllMoppyUltraEfficient();
      } else {
        throw new Error(`サイト ${site} の超効率的スクレイピングはまだサポートされていません`);
      }
      
    } finally {
      await scraper.cleanup();
    }

    if (!result.success) {
      const errorMessage = result.errors.length > 0 ? result.errors.join(', ') : '不明なエラー';
      console.error('超効率的スクレイピング失敗詳細:', result);
      throw new Error(`超効率的スクレイピングに失敗しました: ${errorMessage}`);
    }

    console.log(`📊 超効率的スクレイピング結果: ${result.campaigns.length.toLocaleString()}件の案件を取得`);

    // 超高速バッチ保存
    const campaignData = result.campaigns.map(campaign => ({
      name: campaign.name,
      cashbackRate: campaign.normalizedCashback,
      pointSiteName: campaign.siteName,
      campaignUrl: campaign.url,
      description: campaign.description,
      device: 'All',
      category: campaign.category
    }));

    // 最適化された保存処理
    const batchSize = 200; // 高速バッチサイズ
    let savedCount = 0;
    let updatedCount = 0;
    const saveErrors: string[] = [];

    console.log(`💾 超高速データベース保存開始: ${campaignData.length}件を${Math.ceil(campaignData.length / batchSize)}バッチで処理`);

    for (let i = 0; i < campaignData.length; i += batchSize) {
      const batch = campaignData.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      
      try {
        const saveResults = [{
          siteName: result.siteName,
          success: result.success,
          data: batch,
          errors: result.errors,
          scrapedAt: new Date()
        }];

        const saveResult = await scraperDb.saveCampaigns(saveResults, 'ultra-scrape');
        savedCount += saveResult.savedCount;
        updatedCount += saveResult.updatedCount;
        saveErrors.push(...saveResult.errors);
        
      } catch (error) {
        console.error(`バッチ ${batchNum} 保存エラー:`, error);
        saveErrors.push(`バッチ${batchNum}保存エラー: ${error}`);
      }
    }
    
    result.stats.batchesSaved = Math.ceil(campaignData.length / batchSize);
    
    const processingTime = Date.now() - startTime;
    
    // レスポンス
    const response = {
      success: true,
      site: result.siteName,
      breakthrough: true,
      stats: {
        totalCampaigns: result.stats.totalCampaigns,
        totalQueries: result.stats.totalQueries,
        totalPagesProcessed: result.stats.totalPagesProcessed,
        averagePageTime: result.stats.averagePageTime,
        targetAchieved: result.stats.targetAchieved,
        scrapingTimeMs: result.stats.processingTimeMs,
        totalTimeMs: processingTime,
        duplicatesRemoved: result.stats.duplicatesRemoved,
        batchesSaved: result.stats.batchesSaved
      },
      database: {
        savedCount,
        updatedCount,
        errors: saveErrors,
        batchesProcessed: Math.ceil(campaignData.length / batchSize),
        successRate: campaignData.length > 0 ? 
          ((savedCount + updatedCount) / campaignData.length * 100).toFixed(1) + '%' : '0%'
      },
      campaigns: result.campaigns.slice(0, 50),
      errors: result.errors,
      debug: {
        queryResults: result.debug.queryResults,
        progressLog: result.debug.progressLog,
        totalRawCampaigns: result.debug.totalRawCampaigns,
        bestQuery: getBestQuery(result.debug.queryResults)
      },
      scrapedAt: new Date().toISOString(),
      performance: {
        campaignsPerSecond: (result.stats.totalCampaigns / (result.stats.processingTimeMs / 1000)).toFixed(1),
        queriesPerMinute: ((result.stats.totalQueries / (result.stats.processingTimeMs / 1000)) * 60).toFixed(1),
        efficiency: calculateEfficiency(result.stats.totalCampaigns),
        deduplicationRate: result.debug.totalRawCampaigns > 0 ? 
          (result.stats.duplicatesRemoved / result.debug.totalRawCampaigns * 100).toFixed(1) + '%' : '0%'
      },
      breakthrough: {
        previousCount: 989,
        currentCount: result.stats.totalCampaigns,
        improvement: result.stats.totalCampaigns > 989 ? 
          (((result.stats.totalCampaigns - 989) / 989) * 100).toFixed(0) + '%' : '0%',
        targetReached: result.stats.targetAchieved,
        message: generateBreakthroughMessage(result.stats.totalCampaigns),
        timeEfficiency: `${(result.stats.processingTimeMs / 1000 / 60).toFixed(1)}分で完了`
      }
    };

    console.log('✅ 超効率的スクレイピング完了:', {
      totalCampaigns: response.stats.totalCampaigns,
      totalQueries: response.stats.totalQueries,
      savedCount: response.database.savedCount,
      updatedCount: response.database.updatedCount,
      targetAchieved: response.stats.targetAchieved,
      processingTime: `${(response.stats.scrapingTimeMs / 1000 / 60).toFixed(1)}分`
    });
    
    return NextResponse.json(response);

  } catch (error) {
    console.error('超効率的スクレイピングエラー:', error);
    
    const processingTime = Date.now() - startTime;
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '不明なエラー',
      processingTimeMs: processingTime,
      scrapedAt: new Date().toISOString()
    }, { status: 500 });
  }
}

// 最も効果的なクエリを特定
function getBestQuery(queryResults: Record<string, number>): {query: string, count: number} | null {
  let bestQuery = '';
  let maxCount = 0;
  
  for (const [query, count] of Object.entries(queryResults)) {
    if (count > maxCount) {
      maxCount = count;
      bestQuery = query;
    }
  }
  
  return bestQuery ? {query: bestQuery, count: maxCount} : null;
}

// 効率性計算
function calculateEfficiency(actualCampaigns: number): number {
  const targetCampaigns = 2000; // 超効率的スクレイピングの目標
  return Math.min((actualCampaigns / targetCampaigns) * 100, 100);
}

// 突破成功メッセージ生成
function generateBreakthroughMessage(campaignCount: number): string {
  if (campaignCount >= 3000) {
    return '🎉 大成功！超効率的スクレイピングで3,000件以上の案件取得を達成しました！';
  } else if (campaignCount >= 2000) {
    return '✅ 成功！2,000件以上の案件を取得しました！';
  } else if (campaignCount >= 1500) {
    return '📈 良好！1,500件以上の案件を取得しました。';
  } else if (campaignCount >= 1000) {
    return '📊 改善成功。1,000件以上の案件を取得しました。';
  } else {
    return '⚠️ 更なる超効率化手法の改善が必要です。';
  }
}