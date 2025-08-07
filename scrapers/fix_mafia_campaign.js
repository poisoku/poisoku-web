#!/usr/bin/env node

/**
 * マフィア・シティ案件の還元率修正
 * 09342pt → 109342pt (4671円 → 54671円)
 */

const fs = require('fs').promises;
const path = require('path');

async function fixMafiaCampaign() {
  console.log('🔧 マフィア・シティ案件の還元率修正');
  console.log('='.repeat(60));

  const searchDataFile = path.join(__dirname, '..', 'public', 'search-data.json');
  const v3DataFile = path.join(__dirname, 'data', 'chobirich_production_complete_v3.json');

  try {
    // Step 1: 検索データ修正
    console.log('\n📂 Step 1: 検索データ修正');
    const searchData = JSON.parse(await fs.readFile(searchDataFile, 'utf8'));
    
    let searchFixed = 0;
    searchData.campaigns.forEach(campaign => {
      if (campaign.description && 
          campaign.description.includes('マフィア・シティ-極道風雲（アプリランド）') &&
          campaign.cashback === '09342pt') {
        
        console.log(`  🎯 修正対象: ${campaign.description}`);
        console.log(`     修正前: ${campaign.cashback} / ${campaign.cashbackYen}`);
        
        campaign.cashback = '109342pt';
        campaign.cashbackYen = '54671円';
        
        console.log(`     修正後: ${campaign.cashback} / ${campaign.cashbackYen}`);
        searchFixed++;
      }
    });

    // Step 2: v3データ修正
    console.log('\n📂 Step 2: v3データ修正');
    const v3Data = JSON.parse(await fs.readFile(v3DataFile, 'utf8'));
    
    let v3Fixed = 0;
    v3Data.campaigns.forEach(campaign => {
      if (campaign.id === '1840652' && campaign.points === '09342pt') {
        console.log(`  🎯 修正対象: ${campaign.title}`);
        console.log(`     修正前: ${campaign.points}`);
        
        campaign.points = '109342pt';
        
        console.log(`     修正後: ${campaign.points}`);
        v3Fixed++;
      }
    });

    // Step 3: ファイル保存
    if (searchFixed > 0) {
      await fs.writeFile(searchDataFile, JSON.stringify(searchData, null, 2));
      console.log(`\n✅ 検索データ修正完了: ${searchFixed}件`);
    }

    if (v3Fixed > 0) {
      await fs.writeFile(v3DataFile, JSON.stringify(v3Data, null, 2));
      console.log(`✅ v3データ修正完了: ${v3Fixed}件`);
    }

    // Step 4: 検証
    console.log('\n🔍 Step 4: 修正結果検証');
    
    const updatedSearchData = JSON.parse(await fs.readFile(searchDataFile, 'utf8'));
    const mafiaResults = updatedSearchData.campaigns.filter(c => 
      c.description && c.description.includes('マフィア・シティ-極道風雲（アプリランド）')
    );
    
    console.log('修正されたマフィア・シティ案件:');
    mafiaResults.forEach((campaign, i) => {
      console.log(`  ${i+1}. ${campaign.device} - ${campaign.cashback} (${campaign.cashbackYen})`);
    });

    console.log('\n✅ 修正完了！');
    console.log('次の手順でVercelに反映してください:');
    console.log('  1. git add public/search-data.json');
    console.log('  2. git commit -m "fix: マフィア・シティ案件の還元率修正 (54,671円)"');
    console.log('  3. git push origin main');

  } catch (error) {
    console.error('❌ 修正エラー:', error);
    throw error;
  }
}

fixMafiaCampaign().catch(console.error);