import { NextRequest, NextResponse } from 'next/server';
import { EfficientMoppyScraper } from '@/lib/efficientMoppyScraper';
import { ScraperDatabase } from '@/lib/scraperDb';

// 効率的モッピースクレイピングAPI（並列処理）
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

    console.log(`🎯 ${site}の効率的スクレイピング開始...`);
    console.log('   並列処理: 3ワーカー同時実行');
    console.log('   フェーズ別処理: 高→中→低優先度');
    console.log('   目標: 6,000件以上の案件取得（タイムアウトなし）');

    const scraper = new EfficientMoppyScraper();
    const scraperDb = new ScraperDatabase();
    
    let result;
    
    try {
      await scraper.initialize();
      
      if (site === 'モッピー') {
        result = await scraper.scrapeAllMoppyEfficient();
      } else {
        throw new Error(`サイト ${site} の効率的スクレイピングはまだサポートされていません`);
      }
      
    } finally {
      await scraper.cleanup();
    }

    if (!result.success) {
      const errorMessage = result.errors.length > 0 ? result.errors.join(', ') : '不明なエラー';
      console.error('効率的スクレイピング失敗詳細:', result);
      throw new Error(`効率的スクレイピングに失敗しました: ${errorMessage}`);
    }

    console.log(`📊 効率的スクレイピング結果: ${result.campaigns.length.toLocaleString()}件の案件を取得`);

    // ストリーミング保存（バッチサイズを小さく）
    const campaignData = result.campaigns.map(campaign => ({
      name: campaign.name,
      cashbackRate: campaign.normalizedCashback,
      pointSiteName: campaign.siteName,
      campaignUrl: campaign.url,
      description: campaign.description,
      device: 'All',
      category: campaign.category
    }));

    // 高速バッチ保存
    const batchSize = 200; // 小さなバッチで高速処理
    let savedCount = 0;
    let updatedCount = 0;
    const saveErrors: string[] = [];

    console.log(`💾 高速データベース保存開始: ${campaignData.length}件を${Math.ceil(campaignData.length / batchSize)}バッチで処理`);

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

        const saveResult = await scraperDb.saveCampaigns(saveResults, 'efficient-scrape');
        savedCount += saveResult.savedCount;
        updatedCount += saveResult.updatedCount;
        saveErrors.push(...saveResult.errors);
        
        // バッチ間の待機なし（高速処理）
        
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
        totalUrls: result.stats.totalUrls,
        totalPagesProcessed: result.stats.totalPagesProcessed,
        parallelWorkers: result.stats.parallelWorkers,
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
        urlResults: result.debug.urlResults,
        workerStats: result.debug.workerStats,
        progressLog: result.debug.progressLog,
        bestUrl: getBestUrl(result.debug.urlResults)
      },
      scrapedAt: new Date().toISOString(),
      performance: {
        campaignsPerSecond: (result.stats.totalCampaigns / (result.stats.processingTimeMs / 1000)).toFixed(1),
        pagesPerMinute: ((result.stats.totalPagesProcessed / (result.stats.processingTimeMs / 1000)) * 60).toFixed(1),
        efficiency: calculateEfficiency(result.stats.totalCampaigns),
        parallelEffectiveness: (result.stats.parallelWorkers * 100).toFixed(0) + '%',
        timeOptimization: result.stats.averagePageTime > 0 ? 
          (5000 / result.stats.averagePageTime * 100).toFixed(0) + '%' : '100%'
      },
      breakthrough: {
        previousCount: 233,
        currentCount: result.stats.totalCampaigns,
        improvement: result.stats.totalCampaigns > 0 ? 
          (((result.stats.totalCampaigns - 233) / 233) * 100).toFixed(0) + '%' : '0%',
        targetReached: result.stats.totalCampaigns >= 6000,
        message: generateBreakthroughMessage(result.stats.totalCampaigns),
        timeEfficiency: `${(result.stats.processingTimeMs / 1000 / 60).toFixed(1)}分で完了`
      }
    };

    console.log('✅ 効率的スクレイピング完了:', {
      totalCampaigns: response.stats.totalCampaigns,
      totalPages: response.stats.totalPagesProcessed,
      parallelWorkers: response.stats.parallelWorkers,
      savedCount: response.database.savedCount,
      updatedCount: response.database.updatedCount,
      targetAchieved: response.stats.targetAchieved,
      processingTime: `${(response.stats.scrapingTimeMs / 1000 / 60).toFixed(1)}分`
    });
    
    return NextResponse.json(response);

  } catch (error) {
    console.error('効率的スクレイピングエラー:', error);
    
    const processingTime = Date.now() - startTime;
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '不明なエラー',
      processingTimeMs: processingTime,
      scrapedAt: new Date().toISOString()
    }, { status: 500 });
  }
}

// 最も効果的なURLを特定
function getBestUrl(urlResults: Record<string, number>): {url: string, count: number} | null {
  let bestUrl = '';
  let maxCount = 0;
  
  for (const [url, count] of Object.entries(urlResults)) {
    if (count > maxCount) {
      maxCount = count;
      bestUrl = url;
    }
  }
  
  return bestUrl ? {url: bestUrl, count: maxCount} : null;
}

// 効率性計算
function calculateEfficiency(actualCampaigns: number): number {
  const targetCampaigns = 6000; // 効率的スクレイピングの目標
  return Math.min((actualCampaigns / targetCampaigns) * 100, 100);
}

// 突破成功メッセージ生成
function generateBreakthroughMessage(campaignCount: number): string {
  if (campaignCount >= 6000) {
    return '🎉 大成功！効率的スクレイピングで6,000件以上の案件取得を達成しました！';
  } else if (campaignCount >= 4000) {
    return '✅ 成功！4,000件以上の案件を取得しました！';
  } else if (campaignCount >= 2000) {
    return '📈 良好！2,000件以上の案件を取得しました。';
  } else if (campaignCount >= 1000) {
    return '📊 改善成功。1,000件以上の案件を取得しました。';
  } else {
    return '⚠️ 更なる効率化手法の改善が必要です。';
  }
}