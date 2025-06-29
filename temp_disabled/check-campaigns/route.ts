import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// データベース内の案件数とサンプルデータを確認
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const siteName = searchParams.get('site') || 'モッピー';
    const limit = parseInt(searchParams.get('limit') || '50');
    const category = searchParams.get('category');
    
    // 基本統計を取得
    const { data: totalCount, error: countError } = await supabase
      .from('campaigns')
      .select('count', { count: 'exact' })
      .eq('is_active', true);
    
    if (countError) {
      throw countError;
    }

    // サイト別統計は複雑なので後で実装

    // 指定サイトのサンプル案件を取得（JOINなし）
    let query = supabase
      .from('campaigns')
      .select(`
        id,
        name,
        cashback_rate,
        category,
        device,
        updated_at,
        point_site_id
      `)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (category) {
      query = query.eq('category', category);
    }

    const { data: campaigns, error: campaignsError } = await query;

    if (campaignsError) {
      throw campaignsError;
    }

    // カテゴリ別統計をシンプルな方法で取得
    const { data: allCampaigns, error: allCampaignsError } = await supabase
      .from('campaigns')
      .select('category')
      .eq('is_active', true);

    if (allCampaignsError) {
      throw allCampaignsError;
    }

    // カテゴリ別集計をJavaScriptで行う
    const categoryStats = allCampaigns?.reduce((acc, campaign) => {
      acc[campaign.category] = (acc[campaign.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    // 最近更新された案件（JOINなし）
    const { data: recentCampaigns, error: recentError } = await supabase
      .from('campaigns')
      .select(`
        name,
        cashback_rate,
        updated_at,
        point_site_id
      `)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(10);

    if (recentError) {
      throw recentError;
    }

    // 高還元案件トップ10（JOINなし）
    const { data: highValueCampaigns, error: highValueError } = await supabase
      .from('campaigns')
      .select(`
        name,
        cashback_rate,
        category,
        point_site_id
      `)
      .eq('is_active', true)
      .like('cashback_rate', '%円')
      .order('cashback_rate', { ascending: false })
      .limit(10);

    const response = {
      success: true,
      statistics: {
        totalActiveCampaigns: totalCount?.[0]?.count || 0,
        requestedSite: siteName,
        sampleCampaignsReturned: campaigns?.length || 0
      },
      categoryDistribution: categoryStats,
      siteDistribution: {}, // サイト別統計は複雑なので省略
      sampleCampaigns: campaigns?.map(campaign => ({
        id: campaign.id,
        name: campaign.name,
        cashbackRate: campaign.cashback_rate,
        category: campaign.category,
        device: campaign.device,
        siteName: 'ポイントサイト', // 後でサイト名を取得する実装
        lastUpdated: campaign.updated_at
      })) || [],
      recentUpdates: recentCampaigns?.map(campaign => ({
        name: campaign.name,
        cashbackRate: campaign.cashback_rate,
        siteName: 'ポイントサイト', // 後でサイト名を取得する実装
        updatedAt: campaign.updated_at
      })) || [],
      highValueSample: highValueCampaigns?.map(campaign => ({
        name: campaign.name,
        cashbackRate: campaign.cashback_rate,
        category: campaign.category,
        siteName: 'ポイントサイト' // 後でサイト名を取得する実装
      })) || [],
      generatedAt: new Date().toISOString()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('案件データ確認エラー:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '不明なエラー'
    }, { status: 500 });
  }
}

// データベースクリーンアップ（古いデータの削除）
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedAuth = process.env.SCRAPING_SECRET || 'default-scraping-secret';
    
    if (authHeader !== `Bearer ${expectedAuth}`) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const daysOld = parseInt(searchParams.get('days') || '7');
    
    // 指定日数より古い案件を非アクティブ化
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const { data, error } = await supabase
      .from('campaigns')
      .update({ is_active: false })
      .lt('updated_at', cutoffDate.toISOString())
      .eq('is_active', true)
      .select('id');

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      deactivatedCount: data?.length || 0,
      cutoffDate: cutoffDate.toISOString(),
      message: `${daysOld}日以上古い案件を非アクティブ化しました`
    });

  } catch (error) {
    console.error('データベースクリーンアップエラー:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '不明なエラー'
    }, { status: 500 });
  }
}