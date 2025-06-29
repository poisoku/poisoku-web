import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// カテゴリー別のキーワードマッピング（cashback/route.tsと同じ）
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
    
    // 検索履歴からカテゴリーに関連するキーワードの検索回数を集計
    const orConditions = keywords.map(keyword => `keyword.ilike.%${keyword}%`).join(',');
    
    const { data: searchHistory, error: historyError } = await supabase
      .from('search_history')
      .select('keyword, search_count')
      .or(orConditions)
      .order('search_count', { ascending: false });

    if (historyError) {
      throw historyError;
    }

    // 検索されたキーワードから実際の案件を取得
    const popularCampaigns: any[] = [];
    const processedNames = new Set<string>();

    for (const history of searchHistory || []) {
      if (popularCampaigns.length >= 10) break;

      // キーワードに関連する案件を取得
      const { data: campaigns } = await supabase
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
        .ilike('name', `%${history.keyword}%`)
        .eq('is_active', true)
        .order('cashback_rate', { ascending: false })
        .limit(1);

      if (campaigns && campaigns.length > 0) {
        const campaign = campaigns[0];
        // 重複チェック
        if (!processedNames.has(campaign.name)) {
          processedNames.add(campaign.name);
          popularCampaigns.push({
            id: campaign.id,
            name: campaign.name,
            cashback_rate: campaign.cashback_rate,
            point_site: campaign.point_sites?.name || '',
            campaign_url: campaign.campaign_url,
            search_count: history.search_count
          });
        }
      }
    }

    // 検索回数が少ない場合は、カテゴリーに関連する案件で補完
    if (popularCampaigns.length < 10) {
      const remainingCount = 10 - popularCampaigns.length;
      
      // カテゴリーに関連する案件を追加で取得
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
      const campaignOrConditions = keywords.map(keyword => `name.ilike.%${keyword}%`).join(',');
      query = query.or(campaignOrConditions);

      const { data: additionalCampaigns } = await query
        .order('cashback_rate', { ascending: false })
        .limit(remainingCount + 5); // 重複考慮して多めに取得

      if (additionalCampaigns) {
        for (const campaign of additionalCampaigns) {
          if (popularCampaigns.length >= 10) break;
          if (!processedNames.has(campaign.name)) {
            processedNames.add(campaign.name);
            popularCampaigns.push({
              id: campaign.id,
              name: campaign.name,
              cashback_rate: campaign.cashback_rate,
              point_site: campaign.point_sites?.name || '',
              campaign_url: campaign.campaign_url,
              search_count: 0 // 検索履歴がない場合は0
            });
          }
        }
      }
    }

    return NextResponse.json({
      category,
      campaigns: popularCampaigns.slice(0, 10)
    });

  } catch (error) {
    console.error('カテゴリー別人気案件ランキング取得エラー:', error);
    return NextResponse.json({ error: 'ランキングの取得に失敗しました' }, { status: 500 });
  }
}