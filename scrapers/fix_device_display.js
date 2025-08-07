#!/usr/bin/env node

/**
 * デバイス表記修正
 * 「PC」→「すべて」に変更
 */

const fs = require('fs').promises;
const path = require('path');

async function fixDeviceDisplay() {
  console.log('🔧 デバイス表記修正（PC → すべて）');
  console.log('='.repeat(60));

  const searchDataFile = path.join(__dirname, '..', 'public', 'search-data.json');

  try {
    // Step 1: 検索データ読み込み
    console.log('\n📂 検索データ読み込み中...');
    const searchData = JSON.parse(await fs.readFile(searchDataFile, 'utf8'));
    
    // Step 2: PC表記の件数確認
    let pcCount = 0;
    searchData.campaigns.forEach(campaign => {
      if (campaign.device === 'PC') {
        pcCount++;
      }
    });
    
    console.log(`\n📊 現在のデバイス分布:`)
    const deviceStats = {};
    searchData.campaigns.forEach(campaign => {
      deviceStats[campaign.device] = (deviceStats[campaign.device] || 0) + 1;
    });
    Object.entries(deviceStats).forEach(([device, count]) => {
      console.log(`   ${device}: ${count}件`);
    });

    // Step 3: PC → All に変更
    console.log(`\n🔄 「PC」を「All」に変更中...`);
    let fixedCount = 0;
    
    searchData.campaigns.forEach(campaign => {
      if (campaign.device === 'PC') {
        campaign.device = 'All';
        fixedCount++;
      }
    });

    console.log(`   ✅ ${fixedCount}件を修正`);

    // Step 4: ファイル保存
    if (fixedCount > 0) {
      await fs.writeFile(searchDataFile, JSON.stringify(searchData, null, 2));
      console.log('\n💾 検索データ更新完了');
    }

    // Step 5: 更新後の確認
    console.log('\n📊 更新後のデバイス分布:');
    const newDeviceStats = {};
    searchData.campaigns.forEach(campaign => {
      newDeviceStats[campaign.device] = (newDeviceStats[campaign.device] || 0) + 1;
    });
    Object.entries(newDeviceStats).forEach(([device, count]) => {
      console.log(`   ${device}: ${count}件`);
    });

    // Step 6: 表示テスト
    console.log('\n🔍 修正サンプル（最初の5件）:');
    searchData.campaigns
      .filter(c => c.device === 'All')
      .slice(0, 5)
      .forEach((campaign, i) => {
        console.log(`   ${i+1}. ${campaign.description}`);
        console.log(`      デバイス: ${campaign.device} → 「すべて」と表示されます`);
      });

    console.log('\n✅ 修正完了！');
    console.log('次の手順でVercelに反映してください:');
    console.log('  1. git add public/search-data.json');
    console.log('  2. git commit -m "fix: デバイス表記をPC→すべてに修正"');
    console.log('  3. git push origin main');
    
    console.log('\n📝 表示確認:');
    console.log('  ポイ速のUIでは以下のように表示されます:');
    console.log('  - "All" → "すべて"');
    console.log('  - "iOS" → "iOS"');
    console.log('  - "Android" → "Android"');
    console.log('  - "iOS/Android" → "スマホ"');

  } catch (error) {
    console.error('❌ 修正エラー:', error);
    throw error;
  }
}

fixDeviceDisplay().catch(console.error);