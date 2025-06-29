import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface CampaignImportData {
  siteName: string;
  campaignName: string;
  cashbackRate: string;
  campaignUrl?: string;
  description?: string;
  device?: string;
  category?: string;
}

// CSV一括インポート機能
export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const authHeader = request.headers.get('authorization');
    const expectedAuth = process.env.SCRAPING_SECRET || 'default-scraping-secret';
    
    if (authHeader !== `Bearer ${expectedAuth}`) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const body = await request.json();
    const { csvData, options = {} } = body;

    if (!csvData || !Array.isArray(csvData)) {
      return NextResponse.json({
        error: 'CSVデータが必要です'
      }, { status: 400 });
    }

    console.log(`CSV一括インポート開始: ${csvData.length}件`);

    const results = {
      imported: 0,
      updated: 0,
      errors: [] as string[],
      details: [] as any[]
    };

    // ポイントサイト一覧を取得（キャッシュ用）
    const { data: pointSites } = await supabase
      .from('point_sites')
      .select('id, name');

    const siteNameToId = new Map();
    pointSites?.forEach(site => {
      siteNameToId.set(site.name, site.id);
    });

    // 各行を処理
    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i] as CampaignImportData;
      
      try {
        // データ検証
        if (!row.siteName || !row.campaignName || !row.cashbackRate) {
          results.errors.push(`行${i + 1}: サイト名、案件名、還元率は必須です`);
          continue;
        }

        // ポイントサイトIDを取得
        const pointSiteId = siteNameToId.get(row.siteName);
        if (!pointSiteId) {
          results.errors.push(`行${i + 1}: ポイントサイト「${row.siteName}」が見つかりません`);
          continue;
        }

        // 既存案件をチェック
        const { data: existingCampaign } = await supabase
          .from('campaigns')
          .select('id, cashback_rate')
          .eq('point_site_id', pointSiteId)
          .eq('name', row.campaignName)
          .single();

        const campaignData = {
          point_site_id: pointSiteId,
          name: row.campaignName,
          cashback_rate: row.cashbackRate,
          campaign_url: row.campaignUrl || null,
          description: row.description || null,
          device: row.device || 'All',
          category: row.category || 'shopping',
          is_active: true,
          updated_at: new Date().toISOString()
        };

        if (existingCampaign) {
          // 既存案件を更新
          const { error } = await supabase
            .from('campaigns')
            .update(campaignData)
            .eq('id', existingCampaign.id);

          if (error) throw error;

          // 還元率が変更された場合は履歴に記録
          if (existingCampaign.cashback_rate !== row.cashbackRate) {
            await supabase
              .from('cashback_history')
              .insert({
                campaign_id: existingCampaign.id,
                cashback_rate: row.cashbackRate,
                recorded_at: new Date().toISOString()
              });
          }

          results.updated++;
          results.details.push({
            row: i + 1,
            action: 'updated',
            campaign: row.campaignName,
            site: row.siteName
          });

        } else {
          // 新規案件を作成
          const { data: newCampaign, error } = await supabase
            .from('campaigns')
            .insert(campaignData)
            .select('id')
            .single();

          if (error) throw error;

          // 初回還元率を履歴に記録
          await supabase
            .from('cashback_history')
            .insert({
              campaign_id: newCampaign.id,
              cashback_rate: row.cashbackRate,
              recorded_at: new Date().toISOString()
            });

          results.imported++;
          results.details.push({
            row: i + 1,
            action: 'imported',
            campaign: row.campaignName,
            site: row.siteName
          });
        }

        // 進行状況をログ出力
        if ((i + 1) % 10 === 0) {
          console.log(`処理中: ${i + 1}/${csvData.length}`);
        }

      } catch (error) {
        results.errors.push(`行${i + 1}: ${error instanceof Error ? error.message : '不明なエラー'}`);
      }
    }

    console.log('CSV一括インポート完了:', results);

    return NextResponse.json({
      success: true,
      results,
      message: `インポート完了: 新規${results.imported}件、更新${results.updated}件、エラー${results.errors.length}件`
    });

  } catch (error) {
    console.error('CSV一括インポートエラー:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'インポートに失敗しました'
    }, { status: 500 });
  }
}

// CSVテンプレートを生成
export async function GET() {
  try {
    const template = [
      {
        siteName: 'ハピタス',
        campaignName: 'Yahoo!ショッピング',
        cashbackRate: '1.0%',
        campaignUrl: 'https://example.com/campaign',
        description: 'Yahoo!ショッピングでのお買い物',
        device: 'All',
        category: 'shopping'
      },
      {
        siteName: 'モッピー',
        campaignName: '楽天市場',
        cashbackRate: '1.0%',
        campaignUrl: 'https://example.com/campaign2',
        description: '楽天市場でのお買い物',
        device: 'All',
        category: 'shopping'
      }
    ];

    return NextResponse.json({
      success: true,
      template,
      columns: [
        { key: 'siteName', label: 'サイト名', required: true, description: 'ポイントサイト名（例: ハピタス）' },
        { key: 'campaignName', label: '案件名', required: true, description: '案件の名前（例: Yahoo!ショッピング）' },
        { key: 'cashbackRate', label: '還元率', required: true, description: '還元率（例: 1.0%、100P）' },
        { key: 'campaignUrl', label: '案件URL', required: false, description: '案件ページのURL' },
        { key: 'description', label: '説明', required: false, description: '案件の説明文' },
        { key: 'device', label: 'デバイス', required: false, description: 'PC/iOS/Android/All（デフォルト: All）' },
        { key: 'category', label: 'カテゴリ', required: false, description: 'shopping/travel/finance等（デフォルト: shopping）' }
      ],
      availableSites: await getAvailableSites()
    });

  } catch (error) {
    console.error('CSVテンプレート取得エラー:', error);
    return NextResponse.json({
      success: false,
      error: 'テンプレート取得に失敗しました'
    }, { status: 500 });
  }
}

// 利用可能なポイントサイト一覧を取得
async function getAvailableSites() {
  try {
    const { data: sites } = await supabase
      .from('point_sites')
      .select('name')
      .order('name');
    
    return sites?.map(site => site.name) || [];
  } catch (error) {
    console.error('ポイントサイト一覧取得エラー:', error);
    return [];
  }
}