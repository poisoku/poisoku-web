#!/usr/bin/env node

/**
 * 重複除去の詳細分析
 * 18件のAndroid案件がどこで除外されているかを調査
 */

const fs = require('fs');
const path = require('path');

// 最新のデータファイルを確認
const dataDir = '/Users/kn/poisoku-web/scrapers/data/moppy';
const combinedFile = path.join(dataDir, 'moppy_app_v3_combined_2025-08-16T00-50-15-865Z.json');

console.log('🔍 重複除去の詳細分析開始...');

try {
  const data = JSON.parse(fs.readFileSync(combinedFile, 'utf8'));
  const campaigns = data.campaigns;
  
  console.log(`📊 統合データ分析:`);
  console.log(`総案件数: ${campaigns.length}件`);
  
  // OS別集計
  const iosCount = campaigns.filter(c => c.osType === 'ios').length;
  const androidCount = campaigns.filter(c => c.osType === 'android').length;
  
  console.log(`iOS案件: ${iosCount}件`);
  console.log(`Android案件: ${androidCount}件`);
  
  // device分類別集計
  const deviceStats = {
    iOS: campaigns.filter(c => c.device === 'iOS').length,
    Android: campaigns.filter(c => c.device === 'Android').length,
    both: campaigns.filter(c => c.device === 'iOS/Android').length
  };
  
  console.log(`\n📱 device分類別:`);
  console.log(`iOS専用: ${deviceStats.iOS}件`);
  console.log(`Android専用: ${deviceStats.Android}件`);
  console.log(`両対応: ${deviceStats.both}件`);
  
  // 重複候補の分析
  console.log(`\n🔍 重複パターン分析:`);
  
  const titleMap = new Map();
  const duplicatePatterns = [];
  
  campaigns.forEach(campaign => {
    const cleanTitle = campaign.title.replace(/[_（\(](iOS|Android|iPhone)[）\)]*$/i, '').trim();
    
    if (titleMap.has(cleanTitle)) {
      const existing = titleMap.get(cleanTitle);
      duplicatePatterns.push({
        title: cleanTitle,
        existing: { osType: existing.osType, device: existing.device },
        current: { osType: campaign.osType, device: campaign.device }
      });
    } else {
      titleMap.set(cleanTitle, campaign);
    }
  });
  
  console.log(`重複候補パターン: ${duplicatePatterns.length}件`);
  
  if (duplicatePatterns.length > 0) {
    console.log(`\n📋 重複パターンの詳細（最初の10件）:`);
    duplicatePatterns.slice(0, 10).forEach((pattern, index) => {
      console.log(`${index + 1}. ${pattern.title}`);
      console.log(`   既存: ${pattern.existing.osType} → ${pattern.existing.device}`);
      console.log(`   現在: ${pattern.current.osType} → ${pattern.current.device}`);
    });
  }
  
  // URL重複の確認
  const urlMap = new Map();
  const urlDuplicates = [];
  
  campaigns.forEach(campaign => {
    if (urlMap.has(campaign.url)) {
      urlDuplicates.push({
        url: campaign.url,
        existing: urlMap.get(campaign.url),
        current: campaign
      });
    } else {
      urlMap.set(campaign.url, campaign);
    }
  });
  
  console.log(`\n🔗 URL重複: ${urlDuplicates.length}件`);
  
  if (urlDuplicates.length > 0) {
    console.log(`\n📋 URL重複の詳細（最初の5件）:`);
    urlDuplicates.slice(0, 5).forEach((dup, index) => {
      console.log(`${index + 1}. ${dup.url}`);
      console.log(`   既存: ${dup.existing.title} [${dup.existing.osType}]`);
      console.log(`   現在: ${dup.current.title} [${dup.current.osType}]`);
    });
  }
  
  // 18件の差分の説明
  console.log(`\n💡 18件差分の説明:`);
  console.log(`取得: iOS 263件 + Android 262件 = 525件`);
  console.log(`保存: iOS 262件 + Android 244件 = 506件`);
  console.log(`差分: 525 - 506 = 19件 (重複除去)`);
  console.log(`うちAndroid除外: 262 - 244 = 18件`);
  console.log(`うちiOS除外: 263 - 262 = 1件`);
  
} catch (error) {
  console.error('💥 分析エラー:', error);
}