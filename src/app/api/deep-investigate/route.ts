import { NextRequest, NextResponse } from 'next/server';
import { DeepInvestigator } from '@/lib/deepInvestigator';

// 深層調査API
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

    console.log(`🔍 ${site}の深層構造調査開始...`);
    console.log('   モッピーサイトを詳細に調査し、全案件の在り処を突き止めます');

    const investigator = new DeepInvestigator();
    
    let result;
    
    try {
      await investigator.initialize();
      
      if (site === 'モッピー') {
        result = await investigator.investigateMoppyDeep();
      } else {
        throw new Error(`サイト ${site} の深層調査はまだサポートされていません`);
      }
      
    } finally {
      await investigator.cleanup();
    }

    const processingTime = Date.now() - startTime;
    
    // レスポンス
    const response = {
      success: true,
      site,
      investigation: result,
      processingTimeMs: processingTime,
      investigatedAt: new Date().toISOString(),
      summary: {
        totalPagesInvestigated: result.findings.actualCampaignPages.length,
        totalCampaignsFound: result.findings.actualCampaignPages.reduce(
          (sum, page) => sum + page.campaignCount, 0
        ),
        bestPage: result.findings.actualCampaignPages.reduce((best, current) => 
          current.campaignCount > best.campaignCount ? current : best,
          result.findings.actualCampaignPages[0]
        ),
        effectiveSelectors: result.findings.realStructure.mostEffectiveSelectors,
        paginationFound: result.findings.paginationAnalysis.hasNextPage,
        maxPages: result.findings.paginationAnalysis.maxPageFound,
        criticalFindings: generateCriticalFindings(result)
      }
    };

    console.log('✅ 深層構造調査完了:', {
      site,
      pagesInvestigated: response.summary.totalPagesInvestigated,
      campaignsFound: response.summary.totalCampaignsFound,
      recommendations: result.recommendations.length
    });
    
    return NextResponse.json(response);

  } catch (error) {
    console.error('深層構造調査エラー:', error);
    
    const processingTime = Date.now() - startTime;
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '不明なエラー',
      processingTimeMs: processingTime,
      investigatedAt: new Date().toISOString()
    }, { status: 500 });
  }
}

// 重要な発見事項を生成
function generateCriticalFindings(result: any): string[] {
  const findings: string[] = [];

  const totalCampaigns = result.findings.actualCampaignPages.reduce(
    (sum: number, page: any) => sum + page.campaignCount, 0
  );

  if (totalCampaigns > 1000) {
    findings.push(`大量の案件を発見！ 総計${totalCampaigns}件の案件が存在しています`);
  } else if (totalCampaigns > 100) {
    findings.push(`中程度の案件を発見。総計${totalCampaigns}件の案件が確認されました`);
  } else {
    findings.push(`限定的な案件のみ発見。総計${totalCampaigns}件に留まっています`);
  }

  if (result.findings.paginationAnalysis.hasNextPage) {
    findings.push(`ページネーションを発見！最大${result.findings.paginationAnalysis.maxPageFound}ページまで確認`);
  } else {
    findings.push('ページネーションが見つかりません。単一ページ構造の可能性');
  }

  if (result.findings.realStructure.mostEffectiveSelectors.length > 0) {
    findings.push(`効果的なセレクタを特定: ${result.findings.realStructure.mostEffectiveSelectors[0]}`);
  }

  const bestPage = result.findings.actualCampaignPages.reduce((best: any, current: any) => 
    current.campaignCount > best.campaignCount ? current : best,
    result.findings.actualCampaignPages[0]
  );

  if (bestPage && bestPage.campaignCount > 50) {
    findings.push(`最も案件が多いページを特定: ${bestPage.url} (${bestPage.campaignCount}件)`);
  }

  return findings;
}