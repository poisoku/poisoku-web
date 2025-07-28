const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;

// 環境変数を読み込み
const supabaseUrl = 'https://pjjhyzbnnslaauwzknrr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqamh5emJubnNsYWF1d3prbnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5ODg4MzksImV4cCI6MjA2NjU2NDgzOX0.qcrcwNpwX83dCNbhxFaks2E68K_wp2W8urdYwfenDtM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function quickIntegration() {
  console.log('🚀 獅子の如く案件 緊急統合プロセス');
  console.log('='.repeat(50));
  
  try {
    // 1. モバイルデータを読み込み
    console.log('\n📱 モバイルアプリデータを読み込み中...');
    const mobileDataRaw = await fs.readFile('scripts/pointincome/pointincome_mobile_batch_final.json', 'utf8');
    const mobileData = JSON.parse(mobileDataRaw);
    
    console.log(`📊 モバイルアプリ案件: ${mobileData.campaigns.length}件`);
    
    // 2. 獅子の如くの案件を特定
    const shishiCampaigns = mobileData.campaigns.filter(campaign => 
      campaign.title && campaign.title.includes('獅子の如く')
    );
    
    console.log(`🎯 獅子の如く案件: ${shishiCampaigns.length}件発見`);
    shishiCampaigns.forEach(campaign => {
      console.log(`  - ${campaign.title} (${campaign.device}) - ${campaign.cashbackYen}`);
    });
    
    // 3. ポイントサイトIDを取得
    const { data: pointSites } = await supabase
      .from('point_sites')
      .select('id, name')
      .eq('name', 'ポイントインカム');
    
    if (!pointSites || pointSites.length === 0) {
      throw new Error('ポイントインカムサイトが見つかりません');
    }
    
    const pointSiteId = pointSites[0].id;
    console.log(`✅ ポイントサイトID: ${pointSiteId}`);
    
    // 4. 獅子の如く案件をデータベース形式に変換
    const campaignsToInsert = shishiCampaigns.map(campaign => ({
      name: campaign.title.substring(0, 100),
      point_site_id: pointSiteId,
      cashback_rate: campaign.cashbackYen || '2000円',
      device: campaign.device,
      campaign_url: campaign.campaignUrl,
      description: campaign.description.substring(0, 500),
      is_active: true
    }));
    
    console.log('\n📤 獅子の如く案件をデータベースに挿入中...');
    
    // 5. 既存の獅子の如く案件を削除
    const { error: deleteError } = await supabase
      .from('campaigns')
      .delete()
      .eq('point_site_id', pointSiteId)
      .ilike('name', '%獅子の如く%');
    
    if (deleteError) {
      console.log('⚠️ 既存データ削除時の警告:', deleteError.message);
    }
    
    // 6. 新しい獅子の如く案件を挿入
    const { data: insertResult, error: insertError } = await supabase
      .from('campaigns')
      .insert(campaignsToInsert)
      .select();
    
    if (insertError) {
      console.error('❌ 挿入エラー:', insertError);
      
      // categoryカラムが原因の場合、categoryなしで再試行
      if (insertError.message.includes('column "category" does not exist')) {
        console.log('🔧 categoryなしで再試行...');
        const campaignsWithoutCategory = campaignsToInsert.map(campaign => {
          const { category, ...rest } = campaign;
          return rest;
        });
        
        const { data: retryResult, error: retryError } = await supabase
          .from('campaigns')
          .insert(campaignsWithoutCategory)
          .select();
          
        if (retryError) {
          throw retryError;
        }
        
        console.log(`✅ ${retryResult.length}件の獅子の如く案件を挿入しました（categoryなし）`);
      } else {
        throw insertError;
      }
    } else {
      console.log(`✅ ${insertResult.length}件の獅子の如く案件を挿入しました`);
    }
    
    // 7. 検索データを再生成
    console.log('\n🔍 検索データを再生成中...');
    
    // generate-search-data.jsの主要ロジックを実行
    const { generateSearchData } = require('./scripts/generate-search-data.js');
    if (typeof generateSearchData === 'function') {
      await generateSearchData();
    } else {
      console.log('⚠️ 検索データ生成は手動で実行してください: node scripts/generate-search-data.js');
    }
    
    console.log('\n🎉 緊急統合完了！');
    console.log('\n🔍 確認コマンド:');
    console.log('grep "獅子の如く" public/search-data.json');
    
  } catch (error) {
    console.error('❌ 緊急統合エラー:', error);
  }
}

// 実行
quickIntegration();