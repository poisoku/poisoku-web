import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// 案件の一覧取得・作成・更新・削除API
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search') || '';
    const siteId = searchParams.get('site_id') || '';
    const isActive = searchParams.get('active');

    let query = supabase
      .from('campaigns')
      .select(`
        *,
        point_sites (
          id,
          name,
          url,
          description
        )
      `)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // フィルタ適用
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    if (siteId) {
      query = query.eq('point_site_id', siteId);
    }

    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true');
    }

    const { data: campaigns, error } = await query;

    if (error) {
      throw error;
    }

    // 総件数も取得
    let countQuery = supabase
      .from('campaigns')
      .select('id', { count: 'exact', head: true });

    if (search) {
      countQuery = countQuery.ilike('name', `%${search}%`);
    }

    if (siteId) {
      countQuery = countQuery.eq('point_site_id', siteId);
    }

    if (isActive !== null) {
      countQuery = countQuery.eq('is_active', isActive === 'true');
    }

    const { count } = await countQuery;

    return NextResponse.json({
      success: true,
      campaigns: campaigns || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit
      }
    });

  } catch (error) {
    console.error('案件取得エラー:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '案件取得に失敗しました'
    }, { status: 500 });
  }
}

// 新しい案件を作成
export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const authHeader = request.headers.get('authorization');
    const expectedAuth = process.env.SCRAPING_SECRET || 'default-scraping-secret';
    
    if (authHeader !== `Bearer ${expectedAuth}`) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const body = await request.json();
    const {
      point_site_id,
      name,
      cashback_rate,
      campaign_url,
      description,
      device = 'All',
      category,
      is_active = true
    } = body;

    // 必須フィールドチェック
    if (!point_site_id || !name || !cashback_rate) {
      return NextResponse.json({
        error: 'ポイントサイトID、案件名、還元率は必須です'
      }, { status: 400 });
    }

    // 案件を作成
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .insert({
        point_site_id,
        name,
        cashback_rate,
        campaign_url,
        description,
        device,
        category,
        is_active,
        updated_at: new Date().toISOString()
      })
      .select(`
        *,
        point_sites (
          id,
          name,
          url
        )
      `)
      .single();

    if (error) {
      throw error;
    }

    // 還元率履歴に記録
    await supabase
      .from('cashback_history')
      .insert({
        campaign_id: campaign.id,
        cashback_rate,
        recorded_at: new Date().toISOString()
      });

    return NextResponse.json({
      success: true,
      campaign,
      message: '案件を作成しました'
    });

  } catch (error) {
    console.error('案件作成エラー:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '案件作成に失敗しました'
    }, { status: 500 });
  }
}

// 案件を更新
export async function PUT(request: NextRequest) {
  try {
    // 認証チェック
    const authHeader = request.headers.get('authorization');
    const expectedAuth = process.env.SCRAPING_SECRET || 'default-scraping-secret';
    
    if (authHeader !== `Bearer ${expectedAuth}`) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const body = await request.json();
    const {
      id,
      name,
      cashback_rate,
      campaign_url,
      description,
      device,
      category,
      is_active
    } = body;

    if (!id) {
      return NextResponse.json({
        error: '案件IDは必須です'
      }, { status: 400 });
    }

    // 既存案件を取得
    const { data: existingCampaign } = await supabase
      .from('campaigns')
      .select('cashback_rate')
      .eq('id', id)
      .single();

    // 案件を更新
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .update({
        name,
        cashback_rate,
        campaign_url,
        description,
        device,
        category,
        is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        point_sites (
          id,
          name,
          url
        )
      `)
      .single();

    if (error) {
      throw error;
    }

    // 還元率が変更された場合は履歴に記録
    if (existingCampaign && existingCampaign.cashback_rate !== cashback_rate) {
      await supabase
        .from('cashback_history')
        .insert({
          campaign_id: id,
          cashback_rate,
          recorded_at: new Date().toISOString()
        });
    }

    return NextResponse.json({
      success: true,
      campaign,
      message: '案件を更新しました'
    });

  } catch (error) {
    console.error('案件更新エラー:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '案件更新に失敗しました'
    }, { status: 500 });
  }
}

// 案件を削除
export async function DELETE(request: NextRequest) {
  try {
    // 認証チェック
    const authHeader = request.headers.get('authorization');
    const expectedAuth = process.env.SCRAPING_SECRET || 'default-scraping-secret';
    
    if (authHeader !== `Bearer ${expectedAuth}`) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({
        error: '案件IDは必須です'
      }, { status: 400 });
    }

    // 案件を削除（実際は非アクティブ化）
    const { error } = await supabase
      .from('campaigns')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: '案件を削除しました'
    });

  } catch (error) {
    console.error('案件削除エラー:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '案件削除に失敗しました'
    }, { status: 500 });
  }
}