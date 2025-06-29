import { NextRequest, NextResponse } from 'next/server';

// 定期スクレイピング実行Cron - 主要キーワードを自動で巡回
export async function GET(request: NextRequest) {
  try {
    // Vercel Cronの認証ヘッダーをチェック
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('定期スクレイピング開始:', new Date().toISOString());

    // 主要キーワードリスト
    const majorKeywords = [
      'Yahoo!ショッピング',
      '楽天市場', 
      'Amazon',
      'じゃらん',
      'ZOZOTOWN',
      'ふるさと納税',
      'セブンネット',
      'イオンネットスーパー',
      'ヨドバシカメラ',
      'ビックカメラ'
    ];

    const results = [];
    const scrapingSecret = process.env.SCRAPING_SECRET || 'default-scraping-secret';
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

    // 各キーワードを順番にスクレイピング
    for (const keyword of majorKeywords) {
      try {
        console.log(`キーワードスクレイピング: ${keyword}`);
        
        const response = await fetch(`${baseUrl}/api/scrape`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${scrapingSecret}`
          },
          body: JSON.stringify({
            keyword: keyword,
            sites: ['ハピタス', 'モッピー'] // 主要サイトのみ
          })
        });

        const result = await response.json();
        results.push({
          keyword,
          success: result.success,
          totalCampaigns: result.totalCampaigns || 0,
          processingTime: result.processingTimeMs || 0,
          errors: result.success ? [] : [result.error]
        });

        // キーワード間でのレート制限（5秒間隔）
        if (majorKeywords.indexOf(keyword) < majorKeywords.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }

      } catch (error) {
        console.error(`キーワード ${keyword} のスクレイピングエラー:`, error);
        results.push({
          keyword,
          success: false,
          totalCampaigns: 0,
          processingTime: 0,
          errors: [error instanceof Error ? error.message : '不明なエラー']
        });
      }
    }

    // 統計情報を計算
    const totalSuccess = results.filter(r => r.success).length;
    const totalCampaigns = results.reduce((sum, r) => sum + r.totalCampaigns, 0);
    const totalProcessingTime = results.reduce((sum, r) => sum + r.processingTime, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

    console.log('定期スクレイピング完了:', {
      keywordsProcessed: majorKeywords.length,
      successCount: totalSuccess,
      totalCampaigns,
      totalProcessingTime,
      totalErrors
    });

    return NextResponse.json({
      success: true,
      summary: {
        keywordsProcessed: majorKeywords.length,
        successCount: totalSuccess,
        successRate: (totalSuccess / majorKeywords.length) * 100,
        totalCampaigns,
        totalProcessingTimeMs: totalProcessingTime,
        totalErrors
      },
      details: results,
      executedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('定期スクレイピングCronエラー:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '不明なエラー',
      executedAt: new Date().toISOString()
    }, { status: 500 });
  }
}

// POST method for manual execution
export async function POST(request: NextRequest) {
  return GET(request);
}