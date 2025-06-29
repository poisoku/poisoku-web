import { NextRequest, NextResponse } from 'next/server';

// Vercel Cronまたは外部cronサービスから呼び出されるエンドポイント
// 1日4回（0:01/6:01/12:01/18:01）に実行される
export async function GET(request: NextRequest) {
  try {
    // Vercel Cronの認証ヘッダーをチェック
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Cron実行開始:', new Date().toISOString());

    // ランキング更新APIを内部的に呼び出し
    const updateResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/ranking-update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RANKING_UPDATE_SECRET || 'default-secret'}`
      }
    });

    const updateResult = await updateResponse.json();

    if (!updateResponse.ok) {
      throw new Error(`ランキング更新エラー: ${updateResult.error}`);
    }

    console.log('Cron実行完了:', updateResult);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result: updateResult
    });

  } catch (error) {
    console.error('Cron実行エラー:', error);
    return NextResponse.json(
      { 
        error: 'Cron実行エラー', 
        message: error instanceof Error ? error.message : '不明なエラー',
        timestamp: new Date().toISOString()
      }, 
      { status: 500 }
    );
  }
}

// POST method for manual execution
export async function POST(request: NextRequest) {
  return GET(request);
}