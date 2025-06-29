import { NextRequest, NextResponse } from 'next/server';
import { ComprehensiveMoppyScraper } from '@/lib/comprehensiveMoppyScraper';
import { ScraperDatabase } from '@/lib/scraperDb';

// 全案件自動取得API
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
    const { site = 'モッピー', fullScrape = true, testMode = false } = body;

    console.log(`🎯 ${site}の包括的スクレイピング開始...`);
    console.log('   どこ得方式: 階層的アプローチによる全案件取得');
    console.log('   目標: 6,000件以上の案件取得');

    const scraper = new ComprehensiveMoppyScraper();
    const scraperDb = new ScraperDatabase();
    
    let result;
    
    try {
      await scraper.initialize();
      
      if (site === 'モッピー') {
        result = await scraper.scrapeAllMoppyComprehensive();
      } else {
        throw new Error(`サイト ${site} の包括的スクレイピングはまだサポートされていません`);
      }
      
    } finally {
      await scraper.cleanup();
    }

    if (!result.success) {
      const errorMessage = result.errors.length > 0 ? result.errors.join(', ') : '不明なエラー';
      console.error('包括的スクレイピング失敗詳細:', result);
      throw new Error(`包括的スクレイピングに失敗しました: ${errorMessage}`);
    }

    console.log(`📊 包括的スクレイピング結果: ${result.campaigns.length.toLocaleString()}件の案件を取得`);

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

        const saveResult = await scraperDb.saveCampaigns(saveResults, 'comprehensive-scrape');
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
        totalCategories: result.stats.totalCategories,
        totalPagesProcessed: result.stats.totalPagesProcessed,
        averageCampaignsPerCategory: result.stats.averageCampaignsPerCategory,
        targetAchieved: result.stats.targetAchieved,
        scrapingTimeMs: result.stats.processingTimeMs,
        totalTimeMs: processingTime,
        duplicatesRemoved: result.stats.duplicatesRemoved,
        categoriesScraped: result.stats.categoriesScraped
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
        categoryResults: result.debug.categoryResults,
        pageResults: result.debug.pageResults,
        effectiveSelectors: result.debug.effectiveSelectors,
        processingLog: result.debug.processingLog,
        bestCategory: getBestCategory(result.debug.categoryResults)
      },
      scrapedAt: new Date().toISOString(),
      performance: {
        campaignsPerSecond: (result.stats.totalCampaigns / (result.stats.processingTimeMs / 1000)).toFixed(1),
        categoriesPerMinute: ((result.stats.totalCategories / (result.stats.processingTimeMs / 1000)) * 60).toFixed(1),
        efficiency: calculateEfficiency(result.stats.totalCampaigns),
        deduplicationRate: result.stats.duplicatesRemoved > 0 ? 
          (result.stats.duplicatesRemoved / (result.stats.totalCampaigns + result.stats.duplicatesRemoved) * 100).toFixed(1) + '%' : '0%'
      },
      breakthrough: {
        previousCount: 233,
        currentCount: result.stats.totalCampaigns,
        improvement: result.stats.totalCampaigns > 0 ? 
          (((result.stats.totalCampaigns - 233) / 233) * 100).toFixed(0) + '%' : '0%',
        targetReached: result.stats.totalCampaigns >= 6000,
        message: generateBreakthroughMessage(result.stats.totalCampaigns)
      }
    };

    console.log('✅ 包括的スクレイピング完了:', {
      totalCampaigns: response.stats.totalCampaigns,
      totalCategories: response.stats.totalCategories,
      savedCount: response.database.savedCount,
      updatedCount: response.database.updatedCount,
      targetAchieved: response.stats.targetAchieved,
      improvement: response.breakthrough.improvement
    });
    
    return NextResponse.json(response);

  } catch (error) {
    console.error('包括的スクレイピングエラー:', error);
    
    const processingTime = Date.now() - startTime;
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '不明なエラー',
      processingTimeMs: processingTime,
      scrapedAt: new Date().toISOString()
    }, { status: 500 });
  }
}

// 最も効果的なカテゴリを特定
function getBestCategory(categoryResults: Record<string, number>): {category: string, count: number} | null {
  let bestCategory = '';
  let maxCount = 0;
  
  for (const [category, count] of Object.entries(categoryResults)) {
    if (count > maxCount) {
      maxCount = count;
      bestCategory = category;
    }
  }
  
  return bestCategory ? {category: bestCategory, count: maxCount} : null;
}

// 効率性計算
function calculateEfficiency(actualCampaigns: number): number {
  const targetCampaigns = 6000; // 包括的スクレイピングの目標
  return Math.min((actualCampaigns / targetCampaigns) * 100, 100);
}

// 突破成功メッセージ生成
function generateBreakthroughMessage(campaignCount: number): string {
  if (campaignCount >= 6000) {
    return '🎉 大成功！包括的スクレイピングで6,000件以上の案件取得を達成しました！';
  } else if (campaignCount >= 4000) {
    return '✅ 成功！4,000件以上の案件を取得しました！';
  } else if (campaignCount >= 2000) {
    return '📈 良好！2,000件以上の案件を取得しました。';
  } else if (campaignCount >= 1000) {
    return '📊 改善成功。1,000件以上の案件を取得しました。';
  } else {
    return '⚠️ 更なる包括的手法の改善が必要です。';
  }
}

// 統計取得 (既存のGETエンドポイント拡張)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '7');
    const detailed = searchParams.get('detailed') === 'true';
    
    const scraperDb = new ScraperDatabase();
    const stats = await scraperDb.getScrapingStats(days);
    
    // 古い案件の非アクティブ化
    const deactivatedCount = await scraperDb.deactivateOldCampaigns();
    
    let response: any = {
      success: true,
      stats,
      deactivatedCampaigns: deactivatedCount,
      reportPeriodDays: days,
      generatedAt: new Date().toISOString()
    };

    if (detailed) {
      // より詳細な統計情報
      response.detailed = {
        campaignsByCategory: await getCampaignsByCategory(),
        topCampaignsByCashback: await getTopCampaignsByCashback(),
        recentlyUpdatedCampaigns: await getRecentlyUpdatedCampaigns()
      };
    }
    
    return NextResponse.json(response);

  } catch (error) {
    console.error('統計取得エラー:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '不明なエラー'
    }, { status: 500 });
  }
}

// 推奨事項生成
function generateComprehensiveRecommendations(result: any): any {
  const recommendations = {
    totalCampaignsFound: result.stats.totalCampaigns,
    pagesProcessed: result.stats.totalPages,
    successRate: result.success ? 100 : 0,
    categoryDistribution: {} as Record<string, number>,
    cashbackTypes: {
      percentage: 0,
      fixed: 0
    },
    nextSteps: [] as string[]
  };

  // カテゴリ分布
  result.campaigns.forEach((campaign: any) => {
    recommendations.categoryDistribution[campaign.category] = 
      (recommendations.categoryDistribution[campaign.category] || 0) + 1;
    
    if (campaign.isPercentage) {
      recommendations.cashbackTypes.percentage++;
    } else {
      recommendations.cashbackTypes.fixed++;
    }
  });

  // 推奨事項
  if (result.stats.totalCampaigns === 0) {
    recommendations.nextSteps.push('案件が見つかりませんでした。サイト構造の変更やアクセス制限が考えられます。');
  } else if (result.stats.totalCampaigns < 50) {
    recommendations.nextSteps.push('取得できた案件数が少ないです。より多くのカテゴリページを対象にすることを検討してください。');
  } else if (result.stats.totalCampaigns > 1000) {
    recommendations.nextSteps.push('大量の案件を取得できました。定期的な更新スケジュールの設定を推奨します。');
  }

  if (result.errors.length > 0) {
    recommendations.nextSteps.push(`${result.errors.length}件のエラーが発生しました。ログを確認してセレクタの調整を検討してください。`);
  }

  return recommendations;
}

// データベースヘルパー関数
async function getCampaignsByCategory(): Promise<Record<string, number>> {
  // 実装：カテゴリ別案件数を取得
  return {};
}

async function getTopCampaignsByCashback(): Promise<any[]> {
  // 実装：還元率トップ案件を取得
  return [];
}

async function getRecentlyUpdatedCampaigns(): Promise<any[]> {
  // 実装：最近更新された案件を取得
  return [];
}