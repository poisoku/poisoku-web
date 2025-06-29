import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // モッピー関連データの確認
    const { data: moppySite } = await supabase
      .from('point_sites')
      .select('id, name')
      .eq('name', 'モッピー')
      .single();

    if (!moppySite) {
      return NextResponse.json({ 
        message: 'モッピーのポイントサイト情報が見つかりません',
        moppyCampaigns: 0
      });
    }

    const { data: campaigns, count } = await supabase
      .from('campaigns')
      .select('*', { count: 'exact' })
      .eq('point_site_id', moppySite.id);

    return NextResponse.json({
      moppySiteId: moppySite.id,
      moppyCampaigns: count || 0,
      message: `モッピーの案件数: ${count || 0}件`
    });

  } catch (error) {
    console.error('モッピーデータ確認エラー:', error);
    return NextResponse.json(
      { error: 'データ確認エラー' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    console.log('🗑️ モッピーデータ削除開始...');

    // モッピーのポイントサイトIDを取得
    const { data: moppySite } = await supabase
      .from('point_sites')
      .select('id, name')
      .eq('name', 'モッピー')
      .single();

    if (!moppySite) {
      return NextResponse.json({ 
        message: 'モッピーのポイントサイトが見つかりません',
        deletedCampaigns: 0
      });
    }

    console.log(`モッピーサイトID: ${moppySite.id}`);

    // まず、関連するキャッシュバック履歴を削除
    const { data: campaignIds } = await supabase
      .from('campaigns')
      .select('id')
      .eq('point_site_id', moppySite.id);

    if (campaignIds && campaignIds.length > 0) {
      const ids = campaignIds.map(c => c.id);
      
      // バッチでキャッシュバック履歴を削除
      const { error: historyError } = await supabase
        .from('cashback_history')
        .delete()
        .in('campaign_id', ids);

      if (historyError) {
        console.error('キャッシュバック履歴削除エラー:', historyError);
      } else {
        console.log('✅ キャッシュバック履歴削除完了');
      }
    }

    // モッピーのキャンペーンを削除
    const { data: deletedCampaigns, error: campaignError } = await supabase
      .from('campaigns')
      .delete()
      .eq('point_site_id', moppySite.id)
      .select();

    if (campaignError) {
      console.error('キャンペーン削除エラー:', campaignError);
      return NextResponse.json(
        { error: 'キャンペーン削除に失敗しました' },
        { status: 500 }
      );
    }

    const deletedCount = deletedCampaigns?.length || 0;
    console.log(`✅ ${deletedCount}件のモッピーキャンペーンを削除しました`);

    return NextResponse.json({
      success: true,
      deletedCampaigns: deletedCount,
      message: `${deletedCount}件のモッピーデータを削除しました`
    });

  } catch (error) {
    console.error('モッピーデータ削除エラー:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '削除エラー' },
      { status: 500 }
    );
  }
}