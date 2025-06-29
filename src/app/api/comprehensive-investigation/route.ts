import { NextRequest, NextResponse } from 'next/server';
import { ComprehensiveInvestigator } from '@/lib/comprehensiveInvestigator';

// 包括的サイト構造調査API
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

    console.log(`🔍 ${site}の包括的構造調査開始...`);
    console.log('   実ブラウザとスクレイピング結果の差異を詳細分析中');

    const investigator = new ComprehensiveInvestigator();
    
    let result;
    
    try {
      await investigator.initialize();
      
      if (site === 'モッピー') {
        result = await investigator.investigateMoppyComprehensive();
      } else {
        throw new Error(`サイト ${site} の包括的調査はまだサポートされていません`);
      }
      
    } finally {
      await investigator.cleanup();
    }

    const processingTime = Date.now() - startTime;
    
    // レスポンス
    const response = {
      success: true,
      site: site,
      investigation: {
        totalSitesAnalyzed: result.totalSitesAnalyzed,
        realBrowserCount: result.realBrowserCount,
        scrapingCount: result.scrapingCount,
        difference: result.difference,
        discrepancyPercentage: result.realBrowserCount > 0 ? 
          ((result.difference / result.realBrowserCount) * 100).toFixed(1) + '%' : '0%'
      },
      analysisResults: result.analysisResults,
      insights: {
        possibleCauses: result.possibleCauses,
        recommendations: result.recommendations
      },
      performance: {
        processingTimeMs: processingTime,
        averageTimePerUrl: result.totalSitesAnalyzed > 0 ? 
          (processingTime / result.totalSitesAnalyzed / 1000).toFixed(1) + '秒' : '0秒'
      },
      scrapedAt: new Date().toISOString()
    };

    console.log('✅ 包括的構造調査完了:', {
      totalSitesAnalyzed: response.investigation.totalSitesAnalyzed,
      realBrowserCount: response.investigation.realBrowserCount,
      scrapingCount: response.investigation.scrapingCount,
      difference: response.investigation.difference,
      discrepancyPercentage: response.investigation.discrepancyPercentage
    });
    
    return NextResponse.json(response);

  } catch (error) {
    console.error('包括的構造調査エラー:', error);
    
    const processingTime = Date.now() - startTime;
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '不明なエラー',
      processingTimeMs: processingTime,
      scrapedAt: new Date().toISOString()
    }, { status: 500 });
  }
}