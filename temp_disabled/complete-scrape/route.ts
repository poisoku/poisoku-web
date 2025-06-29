import { NextRequest, NextResponse } from 'next/server';
import { CompleteScraper } from '@/lib/completeScraper';
import { ScraperDatabase } from '@/lib/scraperDb';

// 完全スクレイピングAPI
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

    console.log(`🎯 ${site}の完全スクレイピング開始...`);
    console.log('   調査結果に基づき、6,050件の全案件取得を目指します');

    const scraper = new CompleteScraper();
    const scraperDb = new ScraperDatabase();
    
    let result;
    
    try {
      await scraper.initialize();
      
      if (site === 'モッピー') {
        result = await scraper.scrapeAllMoppyComplete();
      } else {
        throw new Error(`サイト ${site} の完全スクレイピングはまだサポートされていません`);
      }
      
    } finally {
      await scraper.cleanup();
    }

    if (!result.success) {
      const errorMessage = result.errors.length > 0 ? result.errors.join(', ') : '不明なエラー';
      console.error('完全スクレイピング失敗詳細:', result);
      throw new Error(`完全スクレイピングに失敗しました: ${errorMessage}`);
    }

    console.log(`📊 完全スクレイピング結果: ${result.campaigns.length.toLocaleString()}件の案件を取得`);

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
    const batchSize = 1000;
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

        const saveResult = await scraperDb.saveCampaigns(saveResults, 'complete-scrape');
        savedCount += saveResult.savedCount;
        updatedCount += saveResult.updatedCount;
        saveErrors.push(...saveResult.errors);
        
        console.log(`   バッチ ${batchNum}: ${saveResult.savedCount}件保存, ${saveResult.updatedCount}件更新`);
        
        // バッチ間で少し待機
        if (i + batchSize < campaignData.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
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
      breakthrough: true, // 完全突破成功フラグ
      stats: {
        totalCampaigns: result.stats.totalCampaigns,
        totalUrls: result.stats.totalUrls,
        totalPagesProcessed: result.stats.totalPagesProcessed,
        averageCampaignsPerPage: result.stats.averageCampaignsPerPage,
        targetAchieved: result.stats.targetAchieved,
        scrapingTimeMs: result.stats.processingTimeMs,
        totalTimeMs: processingTime
      },
      database: {
        savedCount,
        updatedCount,
        errors: saveErrors,
        batchesProcessed: Math.ceil(campaignData.length / batchSize),
        successRate: campaignData.length > 0 ? 
          ((savedCount + updatedCount) / campaignData.length * 100).toFixed(1) + '%' : '0%'
      },
      campaigns: result.campaigns.slice(0, 50), // 最初の50件のサンプルを表示
      errors: result.errors,
      debug: {
        urlsProcessed: result.debug.urlsProcessed.length,
        effectiveSelectors: result.debug.effectiveSelectors,
        campaignCounts: result.debug.campaignCounts,
        bestUrl: getBestUrl(result.debug.campaignCounts)
      },
      scrapedAt: new Date().toISOString(),
      performance: {
        campaignsPerSecond: (result.stats.totalCampaigns / (result.stats.processingTimeMs / 1000)).toFixed(1),
        urlsPerMinute: ((result.stats.totalUrls / (result.stats.processingTimeMs / 1000)) * 60).toFixed(1),
        efficiency: calculateCompleteEfficiency(result.stats.totalCampaigns)
      },
      breakthrough: {
        previousCount: 233, // 以前の取得数
        currentCount: result.stats.totalCampaigns,
        improvement: result.stats.totalCampaigns > 0 ? 
          (((result.stats.totalCampaigns - 233) / 233) * 100).toFixed(0) + '%' : '0%',
        targetReached: result.stats.totalCampaigns >= 3000,
        message: generateCompleteBreakthroughMessage(result.stats.totalCampaigns)
      }
    };

    console.log('✅ 完全スクレイピング完了:', {
      totalCampaigns: response.stats.totalCampaigns,
      savedCount: response.database.savedCount,
      updatedCount: response.database.updatedCount,
      targetAchieved: response.stats.targetAchieved,
      improvement: response.breakthrough.improvement
    });
    
    return NextResponse.json(response);

  } catch (error) {
    console.error('完全スクレイピングエラー:', error);
    
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

// 完全な効率性計算
function calculateCompleteEfficiency(actualCampaigns: number): number {
  const targetCampaigns = 6050; // 調査で発見された総案件数
  return Math.min((actualCampaigns / targetCampaigns) * 100, 100);
}

// 完全突破成功メッセージ生成
function generateCompleteBreakthroughMessage(campaignCount: number): string {
  if (campaignCount >= 5000) {
    return '🎉 完全突破成功！数千件の案件取得を達成しました！';
  } else if (campaignCount >= 3000) {
    return '✅ 大幅突破成功！3000件以上の案件を取得しました！';
  } else if (campaignCount >= 1000) {
    return '📈 中程度突破！1000件以上の案件を取得しました。';
  } else if (campaignCount >= 500) {
    return '📊 小幅突破。500件以上の案件を取得しました。';
  } else {
    return '⚠️ 突破未達成。さらなる改善が必要です。';
  }
}