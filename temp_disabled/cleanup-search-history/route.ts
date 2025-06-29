import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function DELETE() {
  try {
    console.log('🧹 検索履歴のクリーンアップ開始...');

    // API/テスト関連のキーワードを削除
    const keywordsToDelete = [
      'API',
      'APIフィード',
      'テスト案件',
      'ダミー',
      'テスト',
      'ポイントインカム', // サイト名は検索キーワードとしては不自然
      'finance',
      'shopping',
      'travel',
      'entertainment',
      'other'
    ];

    for (const keyword of keywordsToDelete) {
      const { error } = await supabase
        .from('search_history')
        .delete()
        .eq('keyword', keyword);

      if (error) {
        console.error(`${keyword}の削除エラー:`, error);
      } else {
        console.log(`✅ ${keyword}を削除`);
      }
    }

    // ranking_snapshotsからも削除
    for (const keyword of keywordsToDelete) {
      const { error } = await supabase
        .from('ranking_snapshots')
        .delete()
        .eq('keyword', keyword);

      if (error) {
        console.error(`ランキングスナップショット${keyword}の削除エラー:`, error);
      }
    }

    console.log('🎯 新しい現実的な検索履歴データを作成中...');

    // 現実的な検索履歴データを作成
    const realisticSearchHistory = [
      { keyword: 'Yahoo!ショッピング', search_count: 450, last_searched_at: new Date().toISOString() },
      { keyword: '楽天市場', search_count: 389, last_searched_at: new Date().toISOString() },
      { keyword: 'Amazon', search_count: 356, last_searched_at: new Date().toISOString() },
      { keyword: '楽天トラベル', search_count: 334, last_searched_at: new Date().toISOString() },
      { keyword: 'じゃらん', search_count: 322, last_searched_at: new Date().toISOString() },
      { keyword: 'dカード', search_count: 308, last_searched_at: new Date().toISOString() },
      { keyword: '楽天カード', search_count: 295, last_searched_at: new Date().toISOString() },
      { keyword: 'U-NEXT', search_count: 287, last_searched_at: new Date().toISOString() },
      { keyword: 'Hulu', search_count: 276, last_searched_at: new Date().toISOString() },
      { keyword: 'DMM FX', search_count: 265, last_searched_at: new Date().toISOString() },
      { keyword: 'Netflix', search_count: 254, last_searched_at: new Date().toISOString() },
      { keyword: 'Spotify', search_count: 243, last_searched_at: new Date().toISOString() },
      { keyword: 'JCBカード', search_count: 232, last_searched_at: new Date().toISOString() },
      { keyword: 'エポスカード', search_count: 221, last_searched_at: new Date().toISOString() },
      { keyword: 'ビックカメラ', search_count: 210, last_searched_at: new Date().toISOString() }
    ];

    // 検索履歴データを更新
    const { error: historyError } = await supabase
      .from('search_history')
      .upsert(realisticSearchHistory, { 
        onConflict: 'keyword',
        ignoreDuplicates: false 
      });

    if (historyError) {
      console.error('検索履歴更新エラー:', historyError);
      throw historyError;
    }

    console.log(`✅ ${realisticSearchHistory.length}件の現実的な検索履歴データを作成`);

    // ランキングスナップショットも更新
    const currentTime = new Date().toISOString();
    const rankingSnapshot = realisticSearchHistory.slice(0, 10).map((item, index) => ({
      rank: index + 1,
      keyword: item.keyword,
      search_count: item.search_count,
      snapshot_date: currentTime.split('T')[0],
      created_at: currentTime
    }));

    const { error: snapshotError } = await supabase
      .from('ranking_snapshots')
      .upsert(rankingSnapshot, {
        onConflict: 'rank,snapshot_date',
        ignoreDuplicates: false
      });

    if (snapshotError) {
      console.error('ランキングスナップショット更新エラー:', snapshotError);
    } else {
      console.log(`✅ ${rankingSnapshot.length}件のランキングスナップショットを更新`);
    }

    return NextResponse.json({
      success: true,
      deletedKeywords: keywordsToDelete.length,
      createdHistory: realisticSearchHistory.length,
      createdSnapshots: rankingSnapshot.length,
      message: '検索履歴をクリーンアップして現実的なデータに更新しました'
    });

  } catch (error) {
    console.error('検索履歴クリーンアップエラー:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '検索履歴クリーンアップエラー' },
      { status: 500 }
    );
  }
}