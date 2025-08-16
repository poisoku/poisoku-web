#!/usr/bin/env node

/**
 * OS独立保持版の動作確認テスト
 */

const MoppyAppScraperV3 = require('./src/sites/moppy/MoppyAppScraperV3');

async function testOSIndependent() {
  console.log('🧪 OS独立保持版のテスト開始...');
  
  // 重複除去ロジックをテスト
  const scraper = new MoppyAppScraperV3();
  
  const testCampaigns = [
    // iOS環境で取得した案件
    { title: 'アプリA', device: 'iOS', osType: 'ios', url: 'https://pc.moppy.jp/ad/123' },
    { title: 'アプリB', device: 'iOS', osType: 'ios', url: 'https://pc.moppy.jp/ad/456' },
    { title: 'アプリC', device: 'iOS', osType: 'ios', url: 'https://pc.moppy.jp/ad/789' },
    
    // Android環境で取得した案件（一部同じURL）
    { title: 'アプリA', device: 'Android', osType: 'android', url: 'https://pc.moppy.jp/ad/123' }, // 同じURL
    { title: 'アプリB', device: 'Android', osType: 'android', url: 'https://pc.moppy.jp/ad/456' }, // 同じURL
    { title: 'アプリD', device: 'Android', osType: 'android', url: 'https://pc.moppy.jp/ad/999' }, // 異なるURL
  ];
  
  console.log('\n📋 入力データ:');
  testCampaigns.forEach((c, i) => {
    console.log(`${i+1}. ${c.title} [${c.device}] ${c.osType} ${c.url}`);
  });
  
  // 新しい重複除去ロジックをテスト
  const result = scraper.removeDuplicates(testCampaigns);
  
  console.log('\n📊 結果（OS独立保持）:');
  result.forEach((c, i) => {
    console.log(`${i+1}. ${c.title} [${c.device}] ${c.osType} ${c.url}`);
  });
  
  console.log(`\n✅ 入力: ${testCampaigns.length}件 → 出力: ${result.length}件`);
  
  // iOS/Android別集計
  const iosCount = result.filter(c => c.osType === 'ios').length;
  const androidCount = result.filter(c => c.osType === 'android').length;
  
  console.log(`📱 iOS案件: ${iosCount}件`);
  console.log(`🤖 Android案件: ${androidCount}件`);
  
  console.log('\n🎯 期待結果: iOS 3件、Android 3件、合計6件');
  console.log(`🎯 実際結果: iOS ${iosCount}件、Android ${androidCount}件、合計${result.length}件`);
  
  if (result.length === 6 && iosCount === 3 && androidCount === 3) {
    console.log('✅ テスト成功！OS独立保持が正しく動作しています');
  } else {
    console.log('❌ テスト失敗！期待結果と異なります');
  }
}

testOSIndependent().catch(console.error);