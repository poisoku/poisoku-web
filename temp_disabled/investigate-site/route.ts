import { NextRequest, NextResponse } from 'next/server';
import { MoppySiteInvestigator } from '@/lib/moppySiteInvestigator';

// サイト構造調査API
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
    const { site = 'モッピー', deepAnalysis = true } = body;

    console.log(`🔍 ${site}のサイト構造調査開始...`);

    const investigator = new MoppySiteInvestigator();
    
    let analysis;
    
    try {
      await investigator.initialize();
      
      if (site === 'モッピー') {
        analysis = await investigator.investigateMoppyStructure();
      } else {
        throw new Error(`サイト ${site} の調査はまだサポートされていません`);
      }
      
    } finally {
      await investigator.cleanup();
    }

    const processingTime = Date.now() - startTime;
    
    // レスポンス
    const response = {
      success: true,
      site,
      analysis,
      processingTimeMs: processingTime,
      investigatedAt: new Date().toISOString(),
      summary: {
        estimatedCampaigns: analysis.estimatedTotalCampaigns,
        categoriesFound: analysis.urlPatterns.categoryUrls.length,
        pagesEstimated: analysis.totalPagesFound,
        mainIssues: analysis.recommendations.slice(0, 3),
        nextActions: generateNextActions(analysis)
      }
    };

    console.log('✅ サイト構造調査完了:', {
      site,
      estimatedCampaigns: analysis.estimatedTotalCampaigns,
      categories: analysis.urlPatterns.categoryUrls.length,
      recommendations: analysis.recommendations.length
    });
    
    return NextResponse.json(response);

  } catch (error) {
    console.error('サイト構造調査エラー:', error);
    
    const processingTime = Date.now() - startTime;
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '不明なエラー',
      processingTimeMs: processingTime,
      investigatedAt: new Date().toISOString()
    }, { status: 500 });
  }
}

// 推奨アクション生成
function generateNextActions(analysis: any): string[] {
  const actions: string[] = [];

  if (analysis.estimatedTotalCampaigns > 1000) {
    actions.push('推定案件数が多いため、段階的なスクレイピング戦略を実装する');
  }

  if (analysis.navigationStructure.paginationInfo.maxPageFound > 0) {
    actions.push(`最大${analysis.navigationStructure.paginationInfo.maxPageFound}ページの処理に対応したページネーション機能を実装する`);
  }

  if (analysis.campaignStructure.itemSelectors.length > 0) {
    actions.push(`発見された${analysis.campaignStructure.itemSelectors.length}個のセレクタを使用してスクレイピング精度を向上させる`);
  }

  if (analysis.urlPatterns.categoryUrls.length > 5) {
    actions.push(`${analysis.urlPatterns.categoryUrls.length}個のカテゴリを並列処理で効率的にスクレイピングする`);
  }

  actions.push('調査結果を基にスクレイピング設定を最適化する');
  actions.push('バッチ処理システムを実装して定期的な全案件更新を自動化する');

  return actions;
}