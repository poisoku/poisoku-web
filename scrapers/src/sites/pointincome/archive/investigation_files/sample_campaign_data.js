#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * 取得したデータから案件をランダムサンプリングして表示
 */
function sampleCampaignData() {
  console.log('📋 取得案件データのランダムサンプリング');
  console.log('='.repeat(70));
  
  try {
    // 最新のデータファイルを読み込み
    const dataPath = '/Users/kn/poisoku-web/scrapers/src/data/pointincome/pointincome_app_full_combined_2025-08-12T05-53-40.json';
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const campaigns = JSON.parse(rawData);
    
    console.log(`総データ数: ${campaigns.length}件\n`);
    
    // ランダムに10件選択
    const sampleSize = 10;
    const samples = [];
    const usedIndexes = new Set();
    
    while (samples.length < Math.min(sampleSize, campaigns.length)) {
      const randomIndex = Math.floor(Math.random() * campaigns.length);
      if (!usedIndexes.has(randomIndex)) {
        usedIndexes.add(randomIndex);
        
        const campaign = campaigns[randomIndex];
        
        // データをクリーンアップ
        const cleanedCampaign = {
          title: extractCleanTitle(campaign.title),
          url: campaign.url,
          points: extractCleanPoints(campaign),
          device: campaign.device,
          category: campaign.category,
          os: campaign.os
        };
        
        samples.push(cleanedCampaign);
      }
    }
    
    // サンプルデータを表示
    samples.forEach((campaign, index) => {
      console.log(`【案件 ${index + 1}】`);
      console.log(`案件タイトル: ${campaign.title}`);
      console.log(`案件URL: ${campaign.url}`);
      console.log(`還元率: ${campaign.points}`);
      console.log(`対応デバイス: ${campaign.device}`);
      console.log(`カテゴリ: ${campaign.category}`);
      console.log('---');
    });
    
    // 統計情報
    console.log('\n📊 統計情報:');
    const iosCount = campaigns.filter(c => c.device === 'iOS').length;
    const androidCount = campaigns.filter(c => c.device === 'Android').length;
    console.log(`iOS案件: ${iosCount}件`);
    console.log(`Android案件: ${androidCount}件`);
    
    // カテゴリ別集計
    const categoryStats = {};
    campaigns.forEach(campaign => {
      const key = `${campaign.category} (${campaign.device})`;
      categoryStats[key] = (categoryStats[key] || 0) + 1;
    });
    
    console.log('\n📋 カテゴリ別内訳:');
    Object.entries(categoryStats).forEach(([category, count]) => {
      console.log(`  ${category}: ${count}件`);
    });
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
  }
}

/**
 * タイトルをクリーンアップ
 */
function extractCleanTitle(title) {
  if (!title) return 'タイトル不明';
  
  // 改行やタブを除去
  let cleaned = title.replace(/[\n\t\r]/g, ' ').trim();
  
  // 複数スペースを単一スペースに
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  // ポイント情報や説明文を除去してタイトル部分のみ抽出
  const titleMatch = cleaned.match(/^([^0-9]*?)(?:\s*\d+pt|[\n\r]|$)/);
  if (titleMatch && titleMatch[1].trim()) {
    cleaned = titleMatch[1].trim();
  }
  
  // 長すぎる場合は切り詰め
  if (cleaned.length > 100) {
    cleaned = cleaned.substring(0, 100) + '...';
  }
  
  return cleaned;
}

/**
 * ポイント情報をクリーンアップ
 */
function extractCleanPoints(campaign) {
  // titleやpoints フィールドからポイント情報を抽出
  const text = (campaign.title + ' ' + campaign.points).toLowerCase();
  
  // ポイント抽出パターン
  const patterns = [
    /(\d{1,3},\d{3}pt)/gi,    // 12,345pt
    /(\d{4,5}pt)/gi,          // 12345pt  
    /(\d{1,3}pt)/gi,          // 123pt
    /(\d+)pt/gi,              // 数字pt
    /(\d+)ポイント/gi         // 数字ポイント
  ];
  
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      // 最も大きな値を返す
      const points = matches.map(m => parseInt(m.replace(/[^\d]/g, '')))
                           .filter(p => p > 0)
                           .sort((a, b) => b - a);
      if (points.length > 0) {
        return `${points[0]}pt`;
      }
    }
  }
  
  return 'ポイント不明';
}

// 実行
sampleCampaignData();