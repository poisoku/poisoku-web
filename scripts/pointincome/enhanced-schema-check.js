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
  supabaseServiceKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;
} catch (error) {
  console.error('❌ .env.localファイルの読み込みエラー:', error.message);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function enhancedSchemaCheck() {
  console.log('🔍 詳細なデータベーススキーマ分析開始');
  console.log('='.repeat(60));
  
  try {
    // 1. campaignsテーブルの基本情報
    console.log('\n📊 1. campaignsテーブルの基本分析');
    const { data: allCampaigns, error: allError } = await supabase
      .from('campaigns')
      .select('*')
      .limit(1);
    
    if (allError) {
      console.error('❌ テーブルアクセスエラー:', allError);
      return;
    }
    
    if (allCampaigns && allCampaigns.length > 0) {
      const columns = Object.keys(allCampaigns[0]);
      console.log(`✅ 利用可能なカラム (${columns.length}個):`);
      columns.forEach(col => console.log(`  - ${col}`));
      
      const hasCategoryColumn = columns.includes('category');
      console.log(`\n🔍 categoryカラム: ${hasCategoryColumn ? '✅ 存在' : '❌ 存在しません'}`);
      
      if (!hasCategoryColumn) {
        console.log('\n⚠️ categoryカラムが存在しないため、追加が必要です');
        console.log('📝 以下のSQLをSupabaseダッシュボードで実行してください:');
        console.log('   ALTER TABLE campaigns ADD COLUMN category text DEFAULT \'other\';');
      }
    }
    
    // 2. 全体統計
    console.log('\n📊 2. 全体統計');
    const { count: totalCount } = await supabase
      .from('campaigns')
      .select('*', { count: 'exact', head: true });
    console.log(`総キャンペーン数: ${totalCount}件`);
    
    // 3. ポイントサイト別統計
    console.log('\n📊 3. ポイントサイト別統計');
    const { data: pointSites } = await supabase
      .from('point_sites')
      .select('id, name');
    
    if (pointSites) {
      for (const site of pointSites) {
        const { count } = await supabase
          .from('campaigns')
          .select('*', { count: 'exact', head: true })
          .eq('point_site_id', site.id);
        console.log(`  ${site.name}: ${count}件`);
      }
    }
    
    // 4. ポイントインカムの詳細分析
    console.log('\n🔍 4. ポイントインカム詳細分析');
    const pointIncomesite = pointSites?.find(site => site.name === 'ポイントインカム');
    
    if (pointIncomesite) {
      const pointSiteId = pointIncomesite.id;
      console.log(`ポイントインカムID: ${pointSiteId}`);
      
      // デバイス別統計
      const { data: piCampaigns } = await supabase
        .from('campaigns')
        .select('device, name, cashback_rate' + (allCampaigns[0].hasOwnProperty('category') ? ', category' : ''))
        .eq('point_site_id', pointSiteId);
        
      if (piCampaigns && piCampaigns.length > 0) {
        // デバイス別集計
        const deviceStats = {};
        const categoryStats = {};
        
        piCampaigns.forEach(campaign => {
          const device = campaign.device || 'null';
          deviceStats[device] = (deviceStats[device] || 0) + 1;
          
          if (campaign.category !== undefined) {
            const category = campaign.category || 'null';
            categoryStats[category] = (categoryStats[category] || 0) + 1;
          }
        });
        
        console.log('\n📱 デバイス別内訳:');
        Object.entries(deviceStats)
          .sort((a, b) => b[1] - a[1])
          .forEach(([device, count]) => {
            console.log(`  ${device}: ${count}件`);
          });
          
        if (Object.keys(categoryStats).length > 0) {
          console.log('\n📁 カテゴリ別内訳:');
          Object.entries(categoryStats)
            .sort((a, b) => b[1] - a[1])
            .forEach(([category, count]) => {
              console.log(`  ${category}: ${count}件`);
            });
        } else {
          console.log('\n⚠️ categoryカラムが存在しないため、カテゴリ分析はできません');
        }
        
        // モバイルアプリらしき案件を探す
        console.log('\n🔍 モバイルアプリらしき案件の検索:');
        const mobileKeywords = ['iOS', 'Android', 'アプリ', 'ゲーム', '獅子の如く'];
        let mobileAppCount = 0;
        let foundShishiNoGotoku = false;
        
        piCampaigns.forEach(campaign => {
          const isLikelyMobileApp = 
            campaign.device === 'iOS' || 
            campaign.device === 'Android' ||
            mobileKeywords.some(keyword => campaign.name.includes(keyword));
            
          if (isLikelyMobileApp) {
            mobileAppCount++;
            
            if (campaign.name.includes('獅子の如く')) {
              foundShishiNoGotoku = true;
              console.log(`  🎯 発見: ${campaign.name}`);
              console.log(`      デバイス: ${campaign.device}`);
              console.log(`      還元率: ${campaign.cashback_rate}`);
              if (campaign.category !== undefined) {
                console.log(`      カテゴリ: ${campaign.category}`);
              }
            }
          }
        });
        
        console.log(`\n📊 モバイルアプリらしき案件: ${mobileAppCount}件`);
        console.log(`🎯 獅子の如く発見: ${foundShishiNoGotoku ? '✅ あり' : '❌ なし'}`);
        
        // サンプルデータ表示
        console.log('\n📋 ポイントインカム案件サンプル (最新5件):');
        const sampleCampaigns = piCampaigns.slice(0, 5);
        sampleCampaigns.forEach((campaign, index) => {
          console.log(`  ${index + 1}. ${campaign.name.substring(0, 50)}${campaign.name.length > 50 ? '...' : ''}`);
          console.log(`     デバイス: ${campaign.device || 'null'}`);
          console.log(`     還元率: ${campaign.cashback_rate || 'null'}`);
          if (campaign.category !== undefined) {
            console.log(`     カテゴリ: ${campaign.category || 'null'}`);
          }
        });
      } else {
        console.log('❌ ポイントインカムのデータが見つかりません');
      }
    } else {
      console.log('❌ ポイントインカムが見つかりません');
    }
    
    // 5. 推奨アクション
    console.log('\n📝 5. 推奨アクション');
    console.log('='.repeat(40));
    
    if (!allCampaigns[0].hasOwnProperty('category')) {
      console.log('🔧 必要な作業:');
      console.log('  1. categoryカラムの追加');
      console.log('  2. データベース統合スクリプトの再実行');
      console.log('  3. search-data.jsonの再生成');
    } else {
      console.log('✅ categoryカラムは存在します');
      console.log('🔧 次のステップ:');
      console.log('  1. データベース統合スクリプトの実行');
      console.log('  2. search-data.jsonの再生成');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 詳細分析完了');
    
  } catch (error) {
    console.error('❌ 分析エラー:', error);
  }
}

// 実行
enhancedSchemaCheck();