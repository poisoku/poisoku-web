const fs = require('fs').promises;

/**
 * 現在のシステムのデバイス検出ロジックを詳細分析
 */
async function analyzeDeviceDetection() {
  console.log('📱 デバイス検出システム分析開始\n');
  console.log('='.repeat(80));
  
  try {
    // 1. 中規模版スクレイピング結果を読み込み
    const scrapingData = await fs.readFile('/Users/kn/poisoku-web/chobirich_unified_medium_results.json', 'utf8');
    const results = JSON.parse(scrapingData);
    
    console.log('📊 中規模版スクレイピング結果分析:');
    console.log(`実行日時: ${results.scrape_date}`);
    console.log(`総案件数: ${results.total_campaigns}件`);
    console.log(`ユニーク案件数: ${results.unique_campaigns}件`);
    
    const campaigns = results.campaigns;
    
    // 2. アプリ案件のデバイス分析
    const appCampaigns = campaigns.filter(c => c.category === 'アプリ');
    console.log(`\n📱 アプリ案件分析: ${appCampaigns.length}件`);
    
    const deviceCounts = {};
    const deviceSamples = {};
    
    appCampaigns.forEach(campaign => {
      const device = campaign.device || 'unknown';
      deviceCounts[device] = (deviceCounts[device] || 0) + 1;
      
      if (!deviceSamples[device]) {
        deviceSamples[device] = [];
      }
      if (deviceSamples[device].length < 3) {
        deviceSamples[device].push({
          id: campaign.id,
          name: campaign.name,
          url: campaign.url
        });
      }
    });
    
    console.log('\n📊 デバイス別集計:');
    Object.entries(deviceCounts).forEach(([device, count]) => {
      console.log(`  ${device}: ${count}件`);
    });
    
    // 3. デバイス別サンプル表示
    console.log('\n📋 デバイス別サンプル:');
    Object.entries(deviceSamples).forEach(([device, samples]) => {
      console.log(`\n【${device}デバイス】`);
      samples.forEach((sample, i) => {
        console.log(`${i + 1}. ID: ${sample.id}`);
        console.log(`   名前: ${sample.name.substring(0, 80)}...`);
        console.log(`   URL: ${sample.url}`);
        console.log('');
      });
    });
    
    // 4. デバイス判定ロジックの検証
    console.log('\n🔍 デバイス判定ロジック検証:');
    
    const iosKeywords = ['iOS', 'iPhone', 'App Store'];
    const androidKeywords = ['Android', 'Google Play'];
    
    let correctIOS = 0;
    let correctAndroid = 0;
    let correctAll = 0;
    let misclassified = 0;
    
    appCampaigns.forEach(campaign => {
      const name = campaign.name.toLowerCase();
      const hasIOSKeyword = iosKeywords.some(keyword => name.includes(keyword.toLowerCase()));
      const hasAndroidKeyword = androidKeywords.some(keyword => name.includes(keyword.toLowerCase()));
      
      if (hasIOSKeyword && campaign.device === 'ios') {
        correctIOS++;
      } else if (hasAndroidKeyword && campaign.device === 'android') {
        correctAndroid++;
      } else if (!hasIOSKeyword && !hasAndroidKeyword && campaign.device === 'all') {
        correctAll++;
      } else {
        misclassified++;
        if (misclassified <= 5) { // 最初の5件を表示
          console.log(`❌ 誤判定例 ${misclassified}:`);
          console.log(`   名前: ${campaign.name.substring(0, 60)}...`);
          console.log(`   予想デバイス: ${hasIOSKeyword ? 'iOS' : hasAndroidKeyword ? 'Android' : 'All'}`);
          console.log(`   実際判定: ${campaign.device}`);
          console.log('');
        }
      }
    });
    
    console.log('\n📈 判定精度:');
    console.log(`✅ iOS正判定: ${correctIOS}件`);
    console.log(`✅ Android正判定: ${correctAndroid}件`);
    console.log(`✅ 全デバイス正判定: ${correctAll}件`);
    console.log(`❌ 誤判定: ${misclassified}件`);
    console.log(`📊 全体精度: ${((correctIOS + correctAndroid + correctAll) / appCampaigns.length * 100).toFixed(1)}%`);
    
    // 5. システムの動作方式を確認
    console.log('\n🔧 現在のシステム動作方式:');
    console.log('━'.repeat(60));
    console.log('【取得URL】');
    console.log('  - https://www.chobirich.com/smartphone?sort=point');
    console.log('  - 1～25ページを取得');
    console.log('');
    console.log('【User Agent】');
    console.log('  - iOS User Agent使用（Android UAは403エラーのため）');
    console.log('  - 全ての案件を同一環境で取得');
    console.log('');
    console.log('【デバイス判定】');
    console.log('  - 案件名に「iOS」「iPhone」が含まれる → iOS');
    console.log('  - 案件名に「Android」が含まれる → Android');
    console.log('  - 上記以外 → All（全デバイス対応）');
    console.log('');
    console.log('【問題点】');
    console.log('  ❌ Android User Agentでの取得なし');
    console.log('  ❌ Android専用案件の見落とし可能性');
    console.log('  ❌ スクレイピング範囲制限（25ページまで）');
    
    // 6. Android案件が見つからない理由の分析
    console.log('\n🤖 Android案件不足の原因分析:');
    console.log('━'.repeat(60));
    
    const androidLikeCampaigns = appCampaigns.filter(campaign => 
      campaign.name.toLowerCase().includes('android') ||
      campaign.device === 'android'
    );
    
    console.log(`Android関連案件: ${androidLikeCampaigns.length}件`);
    
    if (androidLikeCampaigns.length > 0) {
      console.log('\n🔍 Android関連案件の例:');
      androidLikeCampaigns.slice(0, 5).forEach((campaign, i) => {
        console.log(`${i + 1}. ${campaign.name.substring(0, 70)}...`);
        console.log(`   デバイス: ${campaign.device}`);
        console.log(`   ID: ${campaign.id}`);
        console.log('');
      });
    }
    
    // 7. 改善提案
    console.log('\n💡 改善提案:');
    console.log('━'.repeat(60));
    console.log('1. **デュアル環境スクレイピング**');
    console.log('   - iOS User Agentで取得 → iOS・全デバイス案件');
    console.log('   - Android User Agentで取得 → Android・全デバイス案件');
    console.log('   - 重複除去して統合');
    console.log('');
    console.log('2. **スクレイピング範囲拡張**');
    console.log('   - 25ページ → 50ページ以上');
    console.log('   - より多くの案件をカバー');
    console.log('');
    console.log('3. **403エラー対策**');
    console.log('   - セッション管理の改善');
    console.log('   - リクエスト間隔の調整');
    console.log('   - プロキシローテーション');
    
  } catch (error) {
    console.error('❌ 分析エラー:', error.message);
  }
}

analyzeDeviceDetection().catch(console.error);