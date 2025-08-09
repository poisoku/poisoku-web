#!/usr/bin/env node

/**
 * ポイントインカム統合後の検索機能テスト
 */

const fs = require('fs');
const path = require('path');

async function testSearchIntegration() {
  console.log('🔍 ポイントインカム統合後の検索機能テスト');
  
  // 検索データを読み込み
  const searchDataPath = '/Users/kn/poisoku-web/public/search-data.json';
  const searchData = JSON.parse(fs.readFileSync(searchDataPath, 'utf-8'));
  
  console.log(`📊 総案件数: ${searchData.campaigns.length}件`);
  
  // サイト別統計
  const siteStats = {};
  searchData.campaigns.forEach(campaign => {
    siteStats[campaign.siteName] = (siteStats[campaign.siteName] || 0) + 1;
  });
  
  console.log('\n📊 サイト別案件数:');
  Object.entries(siteStats).forEach(([site, count]) => {
    console.log(`   ${site}: ${count}件`);
  });
  
  // ポイントインカム案件のサンプル表示
  const pointIncomeCampaigns = searchData.campaigns.filter(c => c.siteName === 'ポイントインカム');
  console.log('\n🎯 ポイントインカム案件サンプル (最初5件):');
  pointIncomeCampaigns.slice(0, 5).forEach((campaign, i) => {
    console.log(`   ${i+1}. ${campaign.displayName} (${campaign.cashback})`);
    console.log(`      URL: ${campaign.url}`);
    console.log(`      カテゴリ: ${campaign.category}`);
  });
  
  // 検索テスト: 「Amazon」で検索
  console.log('\n🔍 検索テスト: "Amazon"');
  const amazonResults = searchData.campaigns.filter(campaign => 
    campaign.searchKeywords.toLowerCase().includes('amazon') ||
    campaign.displayName.toLowerCase().includes('amazon')
  );
  
  console.log(`   検索結果: ${amazonResults.length}件`);
  amazonResults.slice(0, 3).forEach((campaign, i) => {
    console.log(`   ${i+1}. [${campaign.siteName}] ${campaign.displayName} (${campaign.cashback})`);
  });
  
  // 検索テスト: 「Yahoo」で検索
  console.log('\n🔍 検索テスト: "Yahoo"');
  const yahooResults = searchData.campaigns.filter(campaign => 
    campaign.searchKeywords.toLowerCase().includes('yahoo') ||
    campaign.displayName.toLowerCase().includes('yahoo')
  );
  
  console.log(`   検索結果: ${yahooResults.length}件`);
  yahooResults.slice(0, 3).forEach((campaign, i) => {
    console.log(`   ${i+1}. [${campaign.siteName}] ${campaign.displayName} (${campaign.cashback})`);
  });
  
  // カテゴリ別統計
  const categoryStats = {};
  searchData.campaigns.forEach(campaign => {
    categoryStats[campaign.category] = (categoryStats[campaign.category] || 0) + 1;
  });
  
  console.log('\n📊 カテゴリ別案件数:');
  Object.entries(categoryStats).forEach(([category, count]) => {
    console.log(`   ${category}: ${count}件`);
  });
  
  console.log('\n✅ 検索機能テスト完了');
}

testSearchIntegration().catch(console.error);