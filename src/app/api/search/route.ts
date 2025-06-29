import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const settings = searchParams.get('settings');
  
  if (!query) {
    return NextResponse.json({ error: '検索キーワードが必要です' }, { status: 400 });
  }

  try {
    // 検索履歴を更新
    const { error: historyError } = await supabase.rpc('increment_search_count', {
      search_keyword: query
    });

    // AND検索のためにキーワードを分割（正規化は行わない）
    const keywords = query.trim().split(/\s+/).filter(k => k.length > 0);
    
    // デバッグ用ログ
    console.log('検索キーワード:', query);
    console.log('分割キーワード:', keywords);

    // 設定から有効なポイントサイトIDを取得
    let enabledSiteIds: string[] = [];
    if (settings) {
      try {
        const settingsObj = JSON.parse(settings);
        enabledSiteIds = Object.entries(settingsObj)
          .filter(([_, enabled]) => enabled === true)
          .map(([id, _]) => id);
        console.log('有効なサイト数:', enabledSiteIds.length);
      } catch (error) {
        console.error('設定のパースエラー:', error);
      }
    }

    // 案件を検索
    let campaignsQuery = supabase
      .from('campaigns')
      .select(`
        *,
        point_sites (
          id,
          name,
          url,
          category,
          description
        )
      `)
      .eq('is_active', true);

    // 有効なサイトのみフィルタリング
    if (enabledSiteIds.length > 0) {
      campaignsQuery = campaignsQuery.in('point_site_id', enabledSiteIds);
    }

    // 各キーワードでAND検索
    keywords.forEach(keyword => {
      campaignsQuery = campaignsQuery.ilike('name', `%${keyword}%`);
    });

    const { data: campaigns, error: campaignsError } = await campaignsQuery
      .order('cashback_rate', { ascending: false });
    
    console.log('検索結果:', campaigns?.length || 0, '件');

    if (campaignsError) {
      throw campaignsError;
    }

    // 過去7日間の最高額を取得（検索結果に関連する案件のみ）
    let maxCashback = null;
    if (campaigns && campaigns.length > 0) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const campaignIds = campaigns.map(c => c.id);
      
      // まず過去7日間の履歴から最高額を取得
      const { data: maxCashbackHistory } = await supabase
        .from('cashback_history')
        .select(`
          cashback_rate,
          recorded_at,
          campaigns (
            name,
            point_sites (
              name
            )
          )
        `)
        .in('campaign_id', campaignIds)
        .gte('recorded_at', sevenDaysAgo.toISOString())
        .order('cashback_rate', { ascending: false })
        .limit(1);
      
      // 履歴データがない場合は、現在の検索結果から最高額を取得
      if (!maxCashbackHistory || maxCashbackHistory.length === 0) {
        // 還元率を数値に変換して比較
        const parseRate = (rate: string) => {
          if (rate.includes('%')) {
            return parseFloat(rate.replace('%', ''));
          }
          if (rate.includes('円')) {
            return parseFloat(rate.replace('円', ''));
          }
          return parseFloat(rate) || 0;
        };

        // 最高還元率の案件を取得
        const maxCampaign = campaigns.reduce((max, current) => {
          const maxRate = parseRate(max.cashback_rate);
          const currentRate = parseRate(current.cashback_rate);
          return currentRate > maxRate ? current : max;
        });

        if (maxCampaign) {
          maxCashback = [{
            cashback_rate: maxCampaign.cashback_rate,
            recorded_at: maxCampaign.updated_at,
            campaigns: {
              name: maxCampaign.name,
              point_sites: {
                name: maxCampaign.point_sites?.name
              }
            }
          }];
        }
      } else {
        maxCashback = maxCashbackHistory;
      }
    }

    return NextResponse.json({
      campaigns: campaigns || [],
      maxCashback7Days: maxCashback?.[0] || null,
      searchKeyword: query
    });

  } catch (error) {
    console.error('検索エラー:', error);
    return NextResponse.json({ error: '検索中にエラーが発生しました' }, { status: 500 });
  }
}

