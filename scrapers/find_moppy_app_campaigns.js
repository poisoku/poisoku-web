#!/usr/bin/env node

/**
 * 既存のモッピーデータからスマホアプリ案件を抽出
 */

const fs = require('fs').promises;
const path = require('path');

async function findMoppyAppCampaigns() {
  console.log('🔍 既存モッピーデータからアプリ案件を抽出中...');
  
  try {
    // 最新のモッピー本番データを読み込み
    const dataDir = path.join(__dirname, 'data', 'moppy');
    const files = await fs.readdir(dataDir);
    
    const moppyFiles = files
      .filter(f => f.includes('moppy_production_optimized_') && f.endsWith('.json'))
      .sort((a, b) => b.localeCompare(a));
    
    if (moppyFiles.length === 0) {
      console.error('❌ モッピー本番データが見つかりません');
      return;
    }
    
    const latestFile = path.join(dataDir, moppyFiles[0]);
    console.log(`📄 分析対象ファイル: ${moppyFiles[0]}`);
    
    const content = await fs.readFile(latestFile, 'utf8');
    const data = JSON.parse(content);
    
    console.log(`📊 総案件数: ${data.campaigns.length}件`);
    
    // アプリ関連キーワードで案件をフィルタリング
    const appKeywords = [
      'アプリ', 'app', 'ダウンロード', 'インストール',
      'iOS', 'Android', 'iPhone', 'Google Play', 'App Store',
      'プレイ', 'ストア', '初回起動', 'DL', 'インストール',
      '起動', 'アプリ版', 'モバイルアプリ'
    ];
    
    const potentialAppCampaigns = data.campaigns.filter(campaign => {
      const title = (campaign.title || '').toLowerCase();
      return appKeywords.some(keyword => title.includes(keyword.toLowerCase()));
    });
    
    console.log(`🎯 アプリ関連案件候補: ${potentialAppCampaigns.length}件`);
    
    // カテゴリ別統計
    const categoryStats = {};
    potentialAppCampaigns.forEach(campaign => {
      const category = campaign.urlId || 'unknown';
      categoryStats[category] = (categoryStats[category] || 0) + 1;
    });
    
    console.log('\n📊 カテゴリ別アプリ案件数:');
    Object.entries(categoryStats)
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, count]) => {
        console.log(`${category}: ${count}件`);
      });
    
    // サンプル表示（各カテゴリから5件ずつ）
    console.log('\n📋 アプリ案件サンプル:');
    Object.keys(categoryStats).forEach(category => {
      const categoryCampaigns = potentialAppCampaigns.filter(c => c.urlId === category);
      console.log(`\n🏷️ ${category} (${categoryCampaigns.length}件):`);
      
      categoryCampaigns.slice(0, 5).forEach((campaign, index) => {
        console.log(`${index + 1}. ${campaign.title} [${campaign.points || 'ポイント不明'}]`);
      });
      
      if (categoryCampaigns.length > 5) {
        console.log(`   ... 他${categoryCampaigns.length - 5}件`);
      }
    });
    
    // iOS/Android判定統計
    const iosKeywords = ['ios', 'iphone', 'app store'];
    const androidKeywords = ['android', 'google play', 'プレイストア'];
    
    const iosCampaigns = potentialAppCampaigns.filter(campaign => {
      const title = campaign.title.toLowerCase();
      return iosKeywords.some(keyword => title.includes(keyword));
    });
    
    const androidCampaigns = potentialAppCampaigns.filter(campaign => {
      const title = campaign.title.toLowerCase();
      return androidKeywords.some(keyword => title.includes(keyword));
    });
    
    const bothCampaigns = potentialAppCampaigns.filter(campaign => {
      const title = campaign.title.toLowerCase();
      const hasIos = iosKeywords.some(keyword => title.includes(keyword));
      const hasAndroid = androidKeywords.some(keyword => title.includes(keyword));
      return hasIos && hasAndroid;
    });
    
    console.log('\n📱 OS別統計:');
    console.log(`iOS専用: ${iosCampaigns.length}件`);
    console.log(`Android専用: ${androidCampaigns.length}件`);
    console.log(`両対応: ${bothCampaigns.length}件`);
    console.log(`OS不明: ${potentialAppCampaigns.length - iosCampaigns.length - androidCampaigns.length + bothCampaigns.length}件`);
    
    // 結果保存
    const analysisResult = {
      totalCampaigns: data.campaigns.length,
      appCampaignCandidates: potentialAppCampaigns.length,
      categoryStats,
      iosCount: iosCampaigns.length,
      androidCount: androidCampaigns.length,
      bothCount: bothCampaigns.length,
      campaigns: potentialAppCampaigns,
      analyzedAt: new Date().toISOString()
    };
    
    const outputFile = path.join(__dirname, 'moppy_app_analysis.json');
    await fs.writeFile(outputFile, JSON.stringify(analysisResult, null, 2));
    console.log(`\n💾 分析結果保存: ${outputFile}`);
    
    console.log('\n✅ アプリ案件分析完了！');
    
  } catch (error) {
    console.error('💥 分析エラー:', error);
  }
}

// 実行
findMoppyAppCampaigns().catch(console.error);