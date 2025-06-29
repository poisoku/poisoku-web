import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST() {
  try {
    console.log('🎯 ダミー検索履歴・ランキングデータ作成開始...');

    // プレビュー用のダミー検索履歴データ（実際のポイントサイト案件のようなキーワード）
    const dummySearchHistory = [
      { keyword: 'Yahoo!ショッピング', search_count: 245, last_searched_at: new Date().toISOString() },
      { keyword: '楽天市場', search_count: 189, last_searched_at: new Date().toISOString() },
      { keyword: 'Amazon', search_count: 156, last_searched_at: new Date().toISOString() },
      { keyword: '楽天トラベル', search_count: 134, last_searched_at: new Date().toISOString() },
      { keyword: 'じゃらん', search_count: 122, last_searched_at: new Date().toISOString() },
      { keyword: 'dカード', search_count: 108, last_searched_at: new Date().toISOString() },
      { keyword: '楽天カード', search_count: 95, last_searched_at: new Date().toISOString() },
      { keyword: 'U-NEXT', search_count: 87, last_searched_at: new Date().toISOString() },
      { keyword: 'Hulu', search_count: 76, last_searched_at: new Date().toISOString() },
      { keyword: 'DMM FX', search_count: 65, last_searched_at: new Date().toISOString() },
    ];

    // 検索履歴データを挿入
    const { error: historyError } = await supabase
      .from('search_history')
      .upsert(dummySearchHistory, { 
        onConflict: 'keyword',
        ignoreDuplicates: false 
      });

    if (historyError) {
      console.error('検索履歴挿入エラー:', historyError);
      throw historyError;
    }

    console.log(`✅ ${dummySearchHistory.length}件の検索履歴データを作成`);

    // ランキングスナップショットデータも作成
    const currentTime = new Date().toISOString();
    const dummyRankingSnapshot = dummySearchHistory.map((item, index) => ({
      rank: index + 1,
      keyword: item.keyword,
      search_count: item.search_count,
      snapshot_date: currentTime.split('T')[0], // YYYY-MM-DD形式
      created_at: currentTime
    }));

    const { error: snapshotError } = await supabase
      .from('ranking_snapshots')
      .upsert(dummyRankingSnapshot, {
        onConflict: 'rank,snapshot_date',
        ignoreDuplicates: false
      });

    if (snapshotError) {
      console.error('ランキングスナップショット挿入エラー:', snapshotError);
      // スナップショットエラーは継続
    } else {
      console.log(`✅ ${dummyRankingSnapshot.length}件のランキングスナップショットを作成`);
    }

    return NextResponse.json({
      success: true,
      createdHistory: dummySearchHistory.length,
      createdSnapshots: dummyRankingSnapshot.length,
      message: 'ダミー検索履歴・ランキングデータを作成しました'
    });

  } catch (error) {
    console.error('ダミーランキング作成エラー:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'ダミーランキング作成エラー' },
      { status: 500 }
    );
  }
}