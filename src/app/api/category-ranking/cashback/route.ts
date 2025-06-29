import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// カテゴリー別のキーワードマッピング
const categoryKeywords: Record<string, string[]> = {
  shopping: ['ショッピング', '楽天市場', 'Yahoo', 'Amazon', 'メルカリ', 'ZOZOTOWN', 'ビックカメラ', 'ヨドバシ'],
  travel: ['旅行', 'トラベル', 'ホテル', 'じゃらん', 'Booking', 'Expedia', 'アゴダ', 'エアトリ', 'ANA', 'JAL'],
  app: ['アプリ', 'ゲーム', 'マンガ', 'コミック', '読書', 'ニュース', 'SNS', 'マッチング'],
  creditcard: ['カード', 'クレジット', 'JCB', 'VISA', 'Master', 'AMEX', 'PayPay', 'イオン', 'エポス', 'セゾン'],
  money: ['証券', 'FX', '仮想通貨', 'ビットコイン', '投資', 'NISA', 'iDeCo', 'SBI', 'マネックス', 'DMM'],
  entertainment: ['動画', '音楽', 'Netflix', 'Hulu', 'U-NEXT', 'Disney', 'Spotify', 'Apple Music', 'Kindle', 'Audible']
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const category = searchParams.get('category');
  
  if (!category || !categoryKeywords[category]) {
    return NextResponse.json({ error: '無効なカテゴリーです' }, { status: 400 });
  }

  try {
    const keywords = categoryKeywords[category];
    
    // カテゴリーに関連する案件を取得（最高還元率順）
    let query = supabase
      .from('campaigns')
      .select(`
        id,
        name,
        cashback_rate,
        campaign_url,
        point_sites (
          name
        )
      `)
      .eq('is_active', true);

    // OR条件でキーワードを検索
    const orConditions = keywords.map(keyword => `name.ilike.%${keyword}%`).join(',');
    query = query.or(orConditions);

    const { data: campaigns, error } = await query
      .order('cashback_rate', { ascending: false })
      .limit(20);

    if (error) {
      throw error;
    }

    // 還元率を数値に変換してソート
    const parseRate = (rate: string) => {
      if (rate.includes('%')) {
        return parseFloat(rate.replace('%', ''));
      }
      if (rate.includes('円')) {
        return parseFloat(rate.replace('円', ''));
      }
      return parseFloat(rate) || 0;
    };

    // 重複を除去（同じ案件名は最高還元率のもののみ残す）
    const uniqueCampaigns = campaigns?.reduce((acc: any[], current: any) => {
      const existing = acc.find(item => item.name === current.name);
      if (!existing || parseRate(current.cashback_rate) > parseRate(existing.cashback_rate)) {
        return [...acc.filter(item => item.name !== current.name), {
          id: current.id,
          name: current.name,
          cashback_rate: current.cashback_rate,
          point_site: current.point_sites?.name || '',
          campaign_url: current.campaign_url
        }];
      }
      return acc;
    }, []) || [];

    // 還元率でソートしてトップ10を取得
    const sortedCampaigns = uniqueCampaigns
      .sort((a, b) => parseRate(b.cashback_rate) - parseRate(a.cashback_rate))
      .slice(0, 10);

    return NextResponse.json({
      category,
      campaigns: sortedCampaigns
    });

  } catch (error) {
    console.error('カテゴリー別最高還元率ランキング取得エラー:', error);
    return NextResponse.json({ error: 'ランキングの取得に失敗しました' }, { status: 500 });
  }
}