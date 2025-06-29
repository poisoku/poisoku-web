import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function DELETE() {
  try {
    console.log('🗑️ 全履歴データクリーンアップ開始...');

    // キャッシュバック履歴を全削除
    const { error: historyError, count: historyCount } = await supabase
      .from('cashback_history')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // 全件削除

    if (historyError) {
      console.error('キャッシュバック履歴削除エラー:', historyError);
    } else {
      console.log(`✅ ${historyCount || 0}件のキャッシュバック履歴を削除`);
    }

    // 検索履歴も削除
    const { error: searchError, count: searchCount } = await supabase
      .from('search_history')
      .delete()
      .neq('keyword', 'dummy'); // 全件削除

    if (searchError) {
      console.error('検索履歴削除エラー:', searchError);
    } else {
      console.log(`✅ ${searchCount || 0}件の検索履歴を削除`);
    }

    // ランキングスナップショットも削除
    const { error: rankingError, count: rankingCount } = await supabase
      .from('ranking_snapshots')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // 全件削除

    if (rankingError) {
      console.error('ランキング履歴削除エラー:', rankingError);
    } else {
      console.log(`✅ ${rankingCount || 0}件のランキング履歴を削除`);
    }

    return NextResponse.json({
      success: true,
      deletedCashbackHistory: historyCount || 0,
      deletedSearchHistory: searchCount || 0,
      deletedRankingSnapshots: rankingCount || 0,
      message: '全履歴データをクリーンアップしました'
    });

  } catch (error) {
    console.error('履歴データクリーンアップエラー:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'クリーンアップエラー' },
      { status: 500 }
    );
  }
}