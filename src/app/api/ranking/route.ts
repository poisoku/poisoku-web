import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data: rankings, error } = await supabase
      .from('search_history')
      .select('*')
      .order('search_count', { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    // 各キーワードのトップ案件を取得
    const rankingsWithTopCampaigns = await Promise.all(
      (rankings || []).slice(0, 10).map(async (ranking) => {
        const { data: topCampaign } = await supabase
          .from('campaigns')
          .select(`
            cashback_rate,
            point_sites (
              name
            )
          `)
          .ilike('name', `%${ranking.keyword}%`)
          .eq('is_active', true)
          .order('cashback_rate', { ascending: false })
          .limit(1);

        return {
          ...ranking,
          topCampaign: topCampaign?.[0] || null
        };
      })
    );

    return NextResponse.json({
      top10: rankingsWithTopCampaigns,
      top50: rankings || []
    });
  } catch (error) {
    console.error('ランキング取得エラー:', error);
    return NextResponse.json({ error: 'ランキングの取得に失敗しました' }, { status: 500 });
  }
}