import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// ランキング更新API - 1日4回（0:01/6:01/12:01/18:01）に実行される
export async function POST(request: NextRequest) {
  try {
    // 認証チェック（実際の本番環境では適切な認証を実装）
    const authHeader = request.headers.get('authorization');
    const expectedAuth = process.env.RANKING_UPDATE_SECRET || 'default-secret';
    
    if (authHeader !== `Bearer ${expectedAuth}`) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    console.log('ランキング更新開始:', new Date().toISOString());

    // 現在時刻の情報を取得
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    
    console.log(`更新時刻: ${hour}:${minute.toString().padStart(2, '0')}`);

    // 過去24時間の検索履歴を集計してランキングを更新
    const { data: recentSearches, error: searchError } = await supabase
      .from('search_history')
      .select('keyword, search_count, last_searched_at')
      .gte('last_searched_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('search_count', { ascending: false });

    if (searchError) {
      throw searchError;
    }

    // 各検索キーワードのトップ案件情報も取得して更新
    const updatedRankings = await Promise.all(
      (recentSearches || []).slice(0, 50).map(async (search) => {
        const { data: topCampaign } = await supabase
          .from('campaigns')
          .select(`
            id,
            name,
            cashback_rate,
            point_sites (
              id,
              name
            )
          `)
          .ilike('name', `%${search.keyword}%`)
          .eq('is_active', true)
          .order('cashback_rate', { ascending: false })
          .limit(1);

        return {
          keyword: search.keyword,
          search_count: search.search_count,
          last_searched_at: search.last_searched_at,
          top_campaign_id: topCampaign?.[0]?.id || null,
          top_cashback_rate: topCampaign?.[0]?.cashback_rate || null,
          top_site_name: topCampaign?.[0]?.point_sites?.name || null,
          updated_at: now.toISOString()
        };
      })
    );

    // ranking_snapshotテーブルに今回の集計結果を保存
    if (updatedRankings.length > 0) {
      const { error: insertError } = await supabase
        .from('ranking_snapshots')
        .insert(
          updatedRankings.map((ranking, index) => ({
            rank: index + 1,
            keyword: ranking.keyword,
            search_count: ranking.search_count,
            top_campaign_id: ranking.top_campaign_id,
            top_cashback_rate: ranking.top_cashback_rate,
            top_site_name: ranking.top_site_name,
            snapshot_at: now.toISOString()
          }))
        );

      if (insertError) {
        console.error('ランキングスナップショット保存エラー:', insertError);
      } else {
        console.log(`ランキングスナップショット保存完了: ${updatedRankings.length}件`);
      }
    }

    console.log('ランキング更新完了:', new Date().toISOString());

    return NextResponse.json({
      success: true,
      updatedAt: now.toISOString(),
      rankingsCount: updatedRankings.length,
      message: `ランキングを更新しました（${updatedRankings.length}件）`
    });

  } catch (error) {
    console.error('ランキング更新エラー:', error);
    return NextResponse.json(
      { error: 'ランキング更新中にエラーが発生しました' }, 
      { status: 500 }
    );
  }
}

// 手動テスト用のGETエンドポイント
export async function GET() {
  return NextResponse.json({
    message: 'ランキング更新API',
    schedule: '1日4回（0:01/6:01/12:01/18:01）に自動実行',
    lastUpdate: new Date().toISOString()
  });
}