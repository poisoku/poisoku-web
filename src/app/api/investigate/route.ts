import { NextRequest, NextResponse } from 'next/server';
import { SiteInvestigator } from '@/lib/siteInvestigator';

export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const authHeader = request.headers.get('authorization');
    const expectedAuth = process.env.SCRAPING_SECRET || 'default-scraping-secret';
    
    if (authHeader !== `Bearer ${expectedAuth}`) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const body = await request.json();
    const { keyword = 'Yahoo' } = body;

    console.log(`サイト調査開始: キーワード=${keyword}`);

    const investigator = new SiteInvestigator();
    const analyses = await investigator.investigateAllSites(keyword);

    // 調査結果の要約を作成
    const summary = {
      totalSites: analyses.length,
      sitesAnalyzed: analyses.map(a => ({
        siteName: a.siteName,
        pageTitle: a.pageTitle,
        containerCandidates: a.possibleSelectors.containers.length,
        sampleElements: a.sampleElements.length,
        hasRobotsTxt: !!a.robotsTxt
      })),
      recommendations: generateRecommendations(analyses)
    };

    return NextResponse.json({
      success: true,
      keyword,
      summary,
      detailedAnalyses: analyses,
      investigatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('サイト調査エラー:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '不明なエラー',
      investigatedAt: new Date().toISOString()
    }, { status: 500 });
  }
}

// 調査結果から推奨セレクタを生成
function generateRecommendations(analyses: any[]): any {
  const recommendations: any = {};

  analyses.forEach(analysis => {
    const siteName = analysis.siteName;
    const recs: any = {
      containerSelector: null,
      titleSelector: null,
      cashbackSelector: null,
      confidence: 'low'
    };

    // 最も有望なコンテナセレクタを選択
    if (analysis.sampleElements.length > 0) {
      // 要素数が2-20の範囲で最も多いものを選択
      const viableContainers = analysis.sampleElements.filter((el: any) => 
        el.count >= 2 && el.count <= 20
      );
      
      if (viableContainers.length > 0) {
        const bestContainer = viableContainers.reduce((best: any, current: any) => 
          current.count > best.count ? current : best
        );
        recs.containerSelector = bestContainer.selector;
        recs.confidence = 'medium';
      }
    }

    // タイトルセレクタの推奨
    const titleCandidates = analysis.possibleSelectors.titles;
    if (titleCandidates.includes('.title')) {
      recs.titleSelector = '.title';
    } else if (titleCandidates.includes('.name')) {
      recs.titleSelector = '.name';
    } else if (titleCandidates.includes('h3')) {
      recs.titleSelector = 'h3';
    } else if (titleCandidates.length > 0) {
      recs.titleSelector = titleCandidates[0];
    }

    // 還元率セレクタの推奨
    const cashbackCandidates = analysis.possibleSelectors.cashback;
    if (cashbackCandidates.includes('.point')) {
      recs.cashbackSelector = '.point';
    } else if (cashbackCandidates.includes('.rate')) {
      recs.cashbackSelector = '.rate';
    } else if (cashbackCandidates.includes('.cashback')) {
      recs.cashbackSelector = '.cashback';
    } else if (cashbackCandidates.length > 0) {
      recs.cashbackSelector = cashbackCandidates[0];
    }

    // 信頼度を調整
    if (recs.containerSelector && recs.titleSelector && recs.cashbackSelector) {
      recs.confidence = 'high';
    } else if (recs.containerSelector && (recs.titleSelector || recs.cashbackSelector)) {
      recs.confidence = 'medium';
    }

    recommendations[siteName] = recs;
  });

  return recommendations;
}

// GET method for basic info
export async function GET() {
  return NextResponse.json({
    message: 'サイト調査API',
    description: 'ポイントサイトのHTML構造を調査します',
    usage: 'POST /api/investigate with keyword parameter',
    lastUpdate: new Date().toISOString()
  });
}