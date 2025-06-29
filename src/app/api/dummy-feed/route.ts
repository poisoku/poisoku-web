import { NextRequest, NextResponse } from 'next/server';

// ダミーAPI/フィードエンドポイント（テスト用）
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const format = searchParams.get('format') || 'json';
  const count = parseInt(searchParams.get('count') || '100');
  
  // 実際のポイントサイト案件のようなダミーデータ生成
  const dummyCampaigns = [];
  const categories = ['shopping', 'finance', 'travel', 'entertainment', 'other'];
  const sites = ['モッピー', 'ハピタス', 'ポイントインカム'];
  
  // 実際の案件名のパターン
  const realCampaignNames = [
    'Yahoo!ショッピング',
    '楽天市場',
    'Amazon',
    '楽天トラベル',
    'じゃらん',
    'dカード',
    '楽天カード',
    'U-NEXT',
    'Hulu',
    'DMM FX',
    'SBI証券',
    'PayPayカード',
    'イオンカード',
    'au PAYカード',
    'セゾンカード',
    'Netflix',
    'Spotify',
    'JCBカード',
    'エポスカード',
    'ビックカメラ',
    'ヨドバシカメラ',
    'ZOZOTOWN',
    'Booking.com',
    'Expedia',
    'アゴダ',
    'メルカリ',
    'BASE',
    'Shopify',
    'dTV',
    'Amazonプライム',
    'ドコモ',
    'au',
    'ソフトバンク',
    '楽天モバイル',
    'UQモバイル',
    'ワイモバイル',
    'LINEMO',
    'ahamo',
    'povo',
    'OCN モバイル ONE',
    'mineo',
    'IIJmio',
    'BIGLOBEモバイル',
    'nuroモバイル',
    'HISモバイル',
    'QTモバイル',
    'LINEモバイル',
    'TONEモバイル',
    'y.u mobile',
    'Links Mate'
  ];
  
  for (let i = 1; i <= count; i++) {
    const campaignName = realCampaignNames[Math.floor(Math.random() * realCampaignNames.length)];
    dummyCampaigns.push({
      id: `DEMO-${i}`,
      name: campaignName,
      cashback_rate: Math.random() < 0.6 ? 
        `${Math.floor(Math.random() * 10000 + 100)}円` : 
        `${Math.floor(Math.random() * 50 + 1)}%`,
      point_site: sites[Math.floor(Math.random() * sites.length)],
      campaign_url: `https://example.com/campaign/${i}`,
      description: `${campaignName}の案件です。高還元率でお得にポイントを貯められます。`,
      category: categories[Math.floor(Math.random() * categories.length)],
      device: 'All',
      created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString()
    });
  }
  
  // フォーマットに応じたレスポンス
  if (format === 'csv') {
    // CSV形式
    const csv = [
      'id,name,cashback_rate,point_site,campaign_url,description,category,device',
      ...dummyCampaigns.map(c => 
        `"${c.id}","${c.name}","${c.cashback_rate}","${c.point_site}","${c.campaign_url}","${c.description}","${c.category}","${c.device}"`
      )
    ].join('\n');
    
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="dummy_campaigns.csv"'
      }
    });
    
  } else if (format === 'tsv') {
    // TSV形式
    const tsv = [
      'id\tname\tcashback_rate\tpoint_site\tcampaign_url\tdescription\tcategory\tdevice',
      ...dummyCampaigns.map(c => 
        `${c.id}\t${c.name}\t${c.cashback_rate}\t${c.point_site}\t${c.campaign_url}\t${c.description}\t${c.category}\t${c.device}`
      )
    ].join('\n');
    
    return new Response(tsv, {
      headers: {
        'Content-Type': 'text/tab-separated-values',
        'Content-Disposition': 'attachment; filename="dummy_campaigns.tsv"'
      }
    });
    
  } else {
    // JSON形式（デフォルト）
    return NextResponse.json({
      status: 'success',
      source: 'dummy_api_feed',
      timestamp: new Date().toISOString(),
      total_count: dummyCampaigns.length,
      data: dummyCampaigns,
      metadata: {
        api_version: '1.0',
        feed_type: 'full',
        update_frequency: 'hourly'
      }
    });
  }
}