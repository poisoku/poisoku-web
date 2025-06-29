import { NextRequest, NextResponse } from 'next/server';
import { DynamicScraper } from '@/lib/dynamicScraper';
import { ScraperDatabase } from '@/lib/scraperDb';

// 動的コンテンツ対応スクレイピングAPI
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

    console.log(`🎯 ${site}の動的コンテンツ対応スクレイピング開始...`);
    console.log('   Ajax読み込み完了検知、ページネーション自動処理、特定要素表示待機を実行');

    const scraper = new DynamicScraper();
    const scraperDb = new ScraperDatabase();
    
    let result;
    
    try {
      await scraper.initialize();
      
      if (site === 'モッピー') {
        result = await scraper.scrapeAllMoppyDynamic();
      } else {
        throw new Error(`サイト ${site} の動的コンテンツ対応スクレイピングはまだサポートされていません`);
      }
      
    } finally {
      await scraper.cleanup();
    }

    if (!result.success) {
      const errorMessage = result.errors.length > 0 ? result.errors.join(', ') : '不明なエラー';
      console.error('動的コンテンツ対応スクレイピング失敗詳細:', result);
      throw new Error(`動的コンテンツ対応スクレイピングに失敗しました: ${errorMessage}`);
    }

    console.log(`📊 動的コンテンツ対応スクレイピング結果: ${result.campaigns.length.toLocaleString()}件の案件を取得`);

    // データベースに効率的に保存
    const campaignData = result.campaigns.map(campaign => ({
      name: campaign.name,
      cashbackRate: campaign.normalizedCashback,
      pointSiteName: campaign.siteName,
      campaignUrl: campaign.url,
      description: campaign.description,
      device: 'All',
      category: campaign.category
    }));

    // バッチ保存で効率化
    const batchSize = 500;
    let savedCount = 0;
    let updatedCount = 0;
    const saveErrors: string[] = [];

    console.log(`💾 データベース保存開始: ${campaignData.length}件を${Math.ceil(campaignData.length / batchSize)}バッチで処理`);

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

        const saveResult = await scraperDb.saveCampaigns(saveResults, 'dynamic-scrape');
        savedCount += saveResult.savedCount;
        updatedCount += saveResult.updatedCount;
        saveErrors.push(...saveResult.errors);
        
        console.log(`   バッチ ${batchNum}: ${saveResult.savedCount}件保存, ${saveResult.updatedCount}件更新`);
        
        // バッチ間で少し待機
        if (i + batchSize < campaignData.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
      } catch (error) {
        console.error(`バッチ ${batchNum} 保存エラー:`, error);
        saveErrors.push(`バッチ${batchNum}保存エラー: ${error}`);
      }
    }
    
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
        averageCampaignsPerPage: result.stats.averageCampaignsPerPage,
        targetAchieved: result.stats.targetAchieved,
        scrapingTimeMs: result.stats.processingTimeMs,
        totalTimeMs: processingTime,
        paginationPagesFound: result.stats.paginationPagesFound,
        ajaxRequestsDetected: result.stats.ajaxRequestsDetected
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
        urlsProcessed: result.debug.urlsProcessed.length,
        effectiveSelectors: result.debug.effectiveSelectors,
        campaignCounts: result.debug.campaignCounts,
        paginationData: result.debug.paginationData,
        ajaxDetection: result.debug.ajaxDetection,
        dynamicLoadEvents: result.debug.dynamicLoadEvents,
        bestUrl: getBestUrl(result.debug.campaignCounts)
      },
      scrapedAt: new Date().toISOString(),
      performance: {
        campaignsPerSecond: (result.stats.totalCampaigns / (result.stats.processingTimeMs / 1000)).toFixed(1),
        urlsPerMinute: ((result.stats.totalUrls / (result.stats.processingTimeMs / 1000)) * 60).toFixed(1),
        efficiency: calculateEfficiency(result.stats.totalCampaigns)
      },
      breakthrough: {
        previousCount: 233,
        currentCount: result.stats.totalCampaigns,
        improvement: result.stats.totalCampaigns > 0 ? 
          (((result.stats.totalCampaigns - 233) / 233) * 100).toFixed(0) + '%' : '0%',
        targetReached: result.stats.totalCampaigns >= 1000,
        message: generateBreakthroughMessage(result.stats.totalCampaigns)
      }
    };

    console.log('✅ 動的コンテンツ対応スクレイピング完了:', {
      totalCampaigns: response.stats.totalCampaigns,
      savedCount: response.database.savedCount,
      updatedCount: response.database.updatedCount,
      targetAchieved: response.stats.targetAchieved,
      improvement: response.breakthrough.improvement,
      paginationPages: response.stats.paginationPagesFound,
      ajaxDetected: response.stats.ajaxRequestsDetected
    });
    
    return NextResponse.json(response);

  } catch (error) {
    console.error('動的コンテンツ対応スクレイピングエラー:', error);
    
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
function getBestUrl(campaignCounts: Record<string, number>): {url: string, count: number} | null {
  let bestUrl = '';
  let maxCount = 0;
  
  for (const [url, count] of Object.entries(campaignCounts)) {
    if (count > maxCount) {
      maxCount = count;
      bestUrl = url;
    }
  }
  
  return bestUrl ? {url: bestUrl, count: maxCount} : null;
}

// 効率性計算
function calculateEfficiency(actualCampaigns: number): number {
  const targetCampaigns = 2000; // 動的コンテンツ対応の目標
  return Math.min((actualCampaigns / targetCampaigns) * 100, 100);
}

// 突破成功メッセージ生成
function generateBreakthroughMessage(campaignCount: number): string {
  if (campaignCount >= 2000) {
    return '🎉 大成功！動的コンテンツ対応で2000件以上の案件取得を達成しました！';
  } else if (campaignCount >= 1500) {
    return '✅ 成功！1500件以上の案件を取得しました！';
  } else if (campaignCount >= 1000) {
    return '📈 良好！1000件以上の案件を取得しました。';
  } else if (campaignCount >= 800) {
    return '📊 改善成功。800件以上の案件を取得しました。';
  } else {
    return '⚠️ 更なる動的コンテンツ対応の改善が必要です。';
  }
}