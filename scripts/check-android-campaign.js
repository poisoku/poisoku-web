const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;

const supabaseUrl = 'https://pjjhyzbnnslaauwzknrr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqamh5emJubnNsYWF1d3prbnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5ODg4MzksImV4cCI6MjA2NjU2NDgzOX0.qcrcwNpwX83dCNbhxFaks2E68K_wp2W8urdYwfenDtM';

async function checkAndroidCampaign() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('🤖 Android案件調査開始\n');
  console.log('🎯 対象案件: https://www.chobirich.com/ad_details/1840652/\n');
  
  // 1. ちょびリッチサイトIDを取得
  const { data: chobirichSite } = await supabase
    .from('point_sites')
    .select('id, name')
    .eq('name', 'ちょびリッチ')
    .single();
  
  console.log(`🏠 ちょびリッチサイトID: ${chobirichSite.id}`);
  
  // 2. 指定案件をデータベースで検索
  console.log('\n🔍 データベース内での指定案件検索:');
  
  const { data: targetCampaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('point_site_id', chobirichSite.id)
    .or('name.ilike.%1840652%,campaign_url.ilike.%1840652%');
    
  if (targetCampaigns && targetCampaigns.length > 0) {
    console.log(`✅ データベースで発見: ${targetCampaigns.length}件`);
    targetCampaigns.forEach((campaign, i) => {
      console.log(`${i + 1}. 名前: ${campaign.name.substring(0, 80)}...`);
      console.log(`   デバイス: ${campaign.device}`);
      console.log(`   カテゴリ: ${campaign.category}`);
      console.log(`   還元: ${campaign.cashback_rate}`);
      console.log(`   URL: ${campaign.campaign_url}`);
      console.log(`   有効: ${campaign.is_active}`);
      console.log('');
    });
  } else {
    console.log('❌ データベースで見つかりません');
  }
  
  // 3. 中規模版スクレイピング結果で確認
  console.log('\n📂 中規模版スクレイピング結果での確認:');
  
  try {
    const scrapingData = await fs.readFile('/Users/kn/poisoku-web/chobirich_unified_medium_results.json', 'utf8');
    const results = JSON.parse(scrapingData);
    
    const targetInScraping = results.campaigns.find(campaign => 
      campaign.id === '1840652' || (campaign.url && campaign.url.includes('1840652'))
    );
    
    if (targetInScraping) {
      console.log('✅ スクレイピング結果で発見:');
      console.log(`   ID: ${targetInScraping.id}`);
      console.log(`   名前: ${targetInScraping.name}`);
      console.log(`   デバイス: ${targetInScraping.device}`);
      console.log(`   カテゴリ: ${targetInScraping.category}`);
      console.log(`   還元: ${targetInScraping.cashback}`);
      console.log(`   URL: ${targetInScraping.url}`);
    } else {
      console.log('❌ スクレイピング結果で見つかりません');
    }
  } catch (error) {
    console.log(`⚠️ スクレイピングファイル読み込みエラー: ${error.message}`);
  }
  
  // 4. 検索データで確認
  console.log('\n🔍 検索データでの確認:');
  
  try {
    const searchDataContent = await fs.readFile('/Users/kn/poisoku-web/public/search-data.json', 'utf8');
    const searchData = JSON.parse(searchDataContent);
    
    const targetInSearch = searchData.campaigns.find(campaign => 
      (campaign.campaignUrl && campaign.campaignUrl.includes('1840652')) ||
      (campaign.description && campaign.description.includes('1840652'))
    );
    
    if (targetInSearch) {
      console.log('✅ 検索データで発見:');
      console.log(`   ID: ${targetInSearch.id}`);
      console.log(`   説明: ${targetInSearch.description}`);
      console.log(`   デバイス: ${targetInSearch.device}`);
      console.log(`   還元: ${targetInSearch.cashback}`);
      console.log(`   URL: ${targetInSearch.campaignUrl}`);
    } else {
      console.log('❌ 検索データで見つかりません');
    }
  } catch (error) {
    console.log(`⚠️ 検索データ読み込みエラー: ${error.message}`);
  }
  
  // 5. Android案件の全般的な状況確認
  console.log('\n📊 Android案件の全般状況:');
  
  // データベース内のAndroid案件
  const { data: androidCampaignsDB } = await supabase
    .from('campaigns')
    .select('device, name')
    .eq('point_site_id', chobirichSite.id)
    .eq('device', 'Android');
    
  console.log(`データベース内Android案件: ${androidCampaignsDB?.length || 0}件`);
  
  // 検索データ内のAndroid案件
  try {
    const searchDataContent = await fs.readFile('/Users/kn/poisoku-web/public/search-data.json', 'utf8');
    const searchData = JSON.parse(searchDataContent);
    
    const androidInSearch = searchData.campaigns.filter(campaign => 
      campaign.device === 'Android' && campaign.siteName === 'ちょびリッチ'
    );
    
    console.log(`検索データ内Android案件: ${androidInSearch.length}件`);
    
    // Android案件サンプル表示
    console.log('\n📱 Android案件サンプル (5件):');
    androidInSearch.slice(0, 5).forEach((campaign, i) => {
      console.log(`${i + 1}. ${campaign.description.substring(0, 60)}...`);
      console.log(`   還元: ${campaign.cashback}`);
      console.log(`   URL: ${campaign.campaignUrl}`);
      console.log('');
    });
    
  } catch (error) {
    console.log(`⚠️ 検索データ処理エラー: ${error.message}`);
  }
  
  // 6. 最近のスクレイピング実行ログ確認
  console.log('\n📋 スクレイピング実行状況の確認:');
  console.log('中規模版スクレイピングは16分で1,803件取得済み');
  console.log('- ショッピング: 2,612件');
  console.log('- アプリ: 855件');
  console.log('- サービス・クレジットカード: 0件（有効URLなし）');
  console.log('\n⚠️ 案件ID 1840652が取得されていない可能性:');
  console.log('1. スクレイピング対象範囲外（ページ15以降）');
  console.log('2. 案件が非アクティブ・削除済み');
  console.log('3. URL形式が特殊でマッチしない');
  console.log('4. 公開日が最近でスクレイピング後に追加');
}

checkAndroidCampaign().catch(console.error);