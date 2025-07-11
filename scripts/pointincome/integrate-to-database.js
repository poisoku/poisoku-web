const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

// 環境変数を.env.localから読み込み
const envPath = path.join(__dirname, '../../.env.local');
let supabaseUrl, supabaseServiceKey;

try {
  const envContent = require('fs').readFileSync(envPath, 'utf8');
  const envVars = {};
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      envVars[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
    }
  });
  supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
  supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;
} catch (error) {
  console.error('❌ .env.localファイルの読み込みエラー:', error.message);
  process.exit(1);
}

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 環境変数が設定されていません');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function integrateData() {
  console.log('🔄 ポイントインカムデータのデータベース統合開始');
  
  try {
    // データファイル読み込み
    console.log('\n📂 データファイル読み込み中...');
    const mainData = JSON.parse(await fs.readFile('pointincome_batch_final.json', 'utf8'));
    const mobileData = JSON.parse(await fs.readFile('pointincome_mobile_batch_final.json', 'utf8'));
    
    console.log(`📊 メインカテゴリ: ${mainData.campaigns.length}件`);
    console.log(`📱 モバイルアプリ: ${mobileData.campaigns.length}件`);
    
    // データ結合
    const allCampaigns = [...mainData.campaigns, ...mobileData.campaigns];
    console.log(`📋 合計案件数: ${allCampaigns.length}件`);
    
    // ポイントサイトIDを取得または作成
    console.log('\n🔍 ポイントサイト情報を確認中...');
    let { data: pointSite } = await supabase
      .from('point_sites')
      .select('id')
      .eq('name', 'ポイントインカム')
      .single();

    if (!pointSite) {
      console.log('📝 ポイントインカムをpoint_sitesテーブルに追加中...');
      const { data: newSite, error: createError } = await supabase
        .from('point_sites')
        .insert({
          name: 'ポイントインカム',
          url: 'https://pointi.jp',
          description: 'ポイントインカムは、ショッピングやサービス利用でポイントが貯まるポイントサイトです。',
          category: 'major',
          is_active: true
        })
        .select('id')
        .single();
      
      if (createError || !newSite) {
        throw new Error(`ポイントサイトの作成に失敗: ${createError?.message}`);
      }
      
      pointSite = newSite;
    }
    
    const pointSiteId = pointSite.id;
    console.log(`✅ ポイントサイトID: ${pointSiteId}`);

    // データ変換（データベース形式に合わせる）
    console.log('\n🔧 データ変換中...');
    const transformedCampaigns = allCampaigns.map(campaign => {
      // デバイス名の変換
      let device = campaign.device || 'All';
      if (device === 'すべて') device = 'All';
      else if (device === 'PC') device = 'PC';
      else if (device === 'iOS') device = 'iOS';
      else if (device === 'Android') device = 'Android';
      
      // 文字数制限対応（仮定値）
      const name = campaign.title ? campaign.title.substring(0, 100) : '不明';
      const cashbackRate = (campaign.cashback || campaign.cashbackYen || '不明').substring(0, 50);
      const description = (campaign.description || campaign.title || '').substring(0, 500);
      
      return {
        name: name,
        point_site_id: pointSiteId,
        cashback_rate: cashbackRate,
        device: device,
        campaign_url: campaign.campaignUrl,
        description: description,
        is_active: true
      };
    });

    // 重複を除去（name + point_site_id + device の組み合わせでユニーク化）
    console.log('\n🔄 重複データを除去中...');
    const uniqueCampaigns = [];
    const seen = new Set();
    
    for (const campaign of transformedCampaigns) {
      const key = `${campaign.name}_${campaign.point_site_id}_${campaign.device}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueCampaigns.push(campaign);
      }
    }
    
    console.log(`📊 重複除去: ${transformedCampaigns.length}件 → ${uniqueCampaigns.length}件`);
    
    // 既存データ削除
    console.log('\n🗑️ 既存のポイントインカムデータを削除中...');
    const { error: deleteError } = await supabase
      .from('campaigns')
      .delete()
      .eq('point_site_id', pointSiteId);
    
    if (deleteError) {
      console.error('❌ 削除エラー:', deleteError);
      throw deleteError;
    }
    
    // バッチ挿入（500件ずつ）
    console.log('\n📤 データベースへ挿入中...');
    const batchSize = 500;
    let insertedCount = 0;
    
    for (let i = 0; i < uniqueCampaigns.length; i += batchSize) {
      const batch = uniqueCampaigns.slice(i, i + batchSize);
      
      const { error: insertError } = await supabase
        .from('campaigns')
        .insert(batch);
      
      if (insertError) {
        console.error(`❌ 挿入エラー (バッチ ${Math.floor(i / batchSize) + 1}):`, insertError);
        throw insertError;
      }
      
      insertedCount += batch.length;
      console.log(`  ✅ ${insertedCount}/${uniqueCampaigns.length}件挿入完了`);
    }
    
    // 統計情報取得
    console.log('\n📊 統合結果を確認中...');
    const { data: stats, error: statsError } = await supabase
      .from('campaigns')
      .select('device, cashback_rate')
      .eq('point_site_id', pointSiteId);
    
    if (statsError) {
      console.error('❌ 統計取得エラー:', statsError);
    } else {
      // デバイス別集計
      const deviceStats = {};
      const cashbackStats = {};
      
      stats.forEach(row => {
        deviceStats[row.device] = (deviceStats[row.device] || 0) + 1;
        if (row.cashback_rate) {
          cashbackStats[row.cashback_rate] = (cashbackStats[row.cashback_rate] || 0) + 1;
        }
      });
      
      console.log('\n📱 デバイス別内訳:');
      Object.entries(deviceStats).forEach(([device, count]) => {
        console.log(`  ${device}: ${count}件`);
      });
      
      console.log('\n💰 還元率別内訳（上位10）:');
      Object.entries(cashbackStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([rate, count]) => {
          console.log(`  ${rate}: ${count}件`);
        });
    }
    
    // 統合完了レポート保存
    const report = {
      integratedAt: new Date().toISOString(),
      summary: {
        total_campaigns: allCampaigns.length,
        main_categories: mainData.campaigns.length,
        mobile_apps: mobileData.campaigns.length,
        integration_status: 'success'
      },
      details: {
        main_scraping: mainData.summary,
        mobile_scraping: mobileData.summary
      }
    };
    
    await fs.writeFile(
      'integration_report.json',
      JSON.stringify(report, null, 2),
      'utf8'
    );
    
    console.log('\n🎉 データベース統合完了！');
    console.log(`📊 合計 ${allCampaigns.length}件の案件を統合しました`);
    console.log('💾 統合レポート: integration_report.json');
    
  } catch (error) {
    console.error('❌ 統合エラー:', error);
    process.exit(1);
  }
}

// 実行
integrateData();