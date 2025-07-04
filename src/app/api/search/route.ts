import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabaseクライアント設定
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface CampaignData {
  id: string;
  name: string;
  cashback_rate: string;
  device: 'PC' | 'iOS' | 'Android' | 'All' | 'iOS/Android';
  campaign_url?: string;
  description?: string;
  created_at: string;
  updated_at: string;
  point_sites: {
    id: string;
    name: string;
    url: string;
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const osFilter = searchParams.get('os') || 'all';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!query || query.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: '検索キーワードを入力してください'
      }, { status: 400 });
    }

    // ベースクエリ構築
    let dbQuery = supabase
      .from('campaigns')
      .select(`
        id,
        name,
        cashback_rate,
        device,
        campaign_url,
        description,
        created_at,
        updated_at,
        point_sites (
          id,
          name,
          url
        )
      `)
      .eq('is_active', true);

    // キーワード検索
    const keywords = query.split(/\s+/).filter(word => word.length > 0);
    
    if (keywords.length === 1) {
      // 単一キーワード検索
      dbQuery = dbQuery.ilike('name', `%${keywords[0]}%`);
    } else {
      // 複数キーワード（AND検索）
      keywords.forEach(keyword => {
        dbQuery = dbQuery.ilike('name', `%${keyword}%`);
      });
    }

    // OSフィルタリング
    if (osFilter !== 'all') {
      switch (osFilter) {
        case 'ios':
          dbQuery = dbQuery.or('device.eq.iOS,device.eq.iOS/Android,device.eq.All');
          break;
        case 'android':
          dbQuery = dbQuery.or('device.eq.Android,device.eq.iOS/Android,device.eq.All');
          break;
        case 'pc':
          dbQuery = dbQuery.or('device.eq.PC,device.eq.All');
          break;
        default:
          // 無効なOSフィルターは無視
          break;
      }
    }

    // ソート・ページング
    dbQuery = dbQuery
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: campaigns, error } = await dbQuery;

    if (error) {
      console.error('Database query error:', error);
      return NextResponse.json({
        success: false,
        error: 'データベース検索エラー'
      }, { status: 500 });
    }

    // データ変換
    const results = campaigns?.map((campaign: any) => ({
      id: campaign.id,
      siteName: campaign.point_sites?.name || 'Unknown',
      cashback: campaign.cashback_rate,
      device: campaign.device,
      url: campaign.campaign_url || campaign.point_sites?.url || '#',
      lastUpdated: new Date(campaign.updated_at).toLocaleString('ja-JP'),
      description: campaign.name,
      campaignUrl: campaign.campaign_url,
      pointSiteUrl: campaign.point_sites?.url,
    })) || [];

    // 過去7日間の最高額を取得
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: maxCashbackData } = await supabase
      .from('campaigns')
      .select(`
        cashback_rate,
        point_sites (name),
        updated_at
      `)
      .eq('is_active', true)
      .ilike('name', `%${keywords[0]}%`)
      .gte('updated_at', sevenDaysAgo.toISOString())
      .order('cashback_rate', { ascending: false })
      .limit(1);

    let maxCashback7Days = null;
    if (maxCashbackData && maxCashbackData.length > 0) {
      const max = maxCashbackData[0];
      maxCashback7Days = {
        amount: max.cashback_rate,
        site: max.point_sites?.name || 'Unknown',
        date: new Date(max.updated_at).toLocaleDateString('ja-JP')
      };
    }

    // 検索履歴を記録
    await supabase
      .from('search_history')
      .upsert({
        keyword: query,
        search_count: 1
      }, {
        onConflict: 'keyword',
        ignoreDuplicates: false
      })
      .select()
      .then(({ data: existing }) => {
        if (existing && existing.length > 0) {
          // 既存の場合はカウントを増加
          return supabase
            .from('search_history')
            .update({
              search_count: existing[0].search_count + 1,
              last_searched_at: new Date().toISOString()
            })
            .eq('keyword', query);
        }
      });

    return NextResponse.json({
      success: true,
      data: {
        results,
        maxCashback7Days,
        totalCount: results.length,
        hasMore: results.length === limit,
        filters: {
          query,
          osFilter,
          limit,
          offset
        }
      }
    });

  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json({
      success: false,
      error: '検索処理中にエラーが発生しました'
    }, { status: 500 });
  }
}