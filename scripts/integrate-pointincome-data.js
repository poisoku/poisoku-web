#!/usr/bin/env node

/**
 * ポイントインカム全案件データをポイ速の検索システムに統合
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

async function integratePointIncomeData() {
  console.log('🔄 ポイントインカムデータ統合開始');
  
  // 最新のポイントインカムデータを読み込み
  const pointIncomeDataPath = '/Users/kn/poisoku-web/scrapers/data/pointincome/pointincome_web_2025-08-09T03-31-02-201Z.json';
  const pointIncomeRaw = await fs.readFile(pointIncomeDataPath, 'utf-8');
  const pointIncomeData = JSON.parse(pointIncomeRaw);
  
  console.log(`📊 ポイントインカム案件数: ${pointIncomeData.total_campaigns}件`);
  
  // 現在のポイ速データを読み込み
  const searchDataPath = '/Users/kn/poisoku-web/public/search-data.json';
  const searchDataRaw = await fs.readFile(searchDataPath, 'utf-8');
  const searchData = JSON.parse(searchDataRaw);
  
  console.log(`📊 現在のポイ速案件数: ${searchData.campaigns.length}件`);
  
  // ポイントインカム案件を変換
  const convertedCampaigns = pointIncomeData.campaigns.map(campaign => {
    // カテゴリマッピング
    const getCategoryFromType = (type) => {
      return type === 'shopping' ? 'shopping' : 'service';
    };
    
    // デバイス設定（Webなのでallに設定）
    const device = 'All';
    
    // キャッシュバック金額の正規化
    const normalizeCashback = (points) => {
      if (!points) return '0%';
      
      // 既に%形式の場合はそのまま
      if (points.includes('%')) {
        return points;
      }
      
      // 円形式の場合はそのまま
      if (points.includes('円')) {
        return points;
      }
      
      return points;
    };
    
    // 一意IDの生成
    const uniqueId = crypto.randomUUID();
    
    // 検索キーワード生成
    const generateSearchKeywords = (title) => {
      return title
        .replace(/[（）()【】\[\]「」]/g, ' ')
        .replace(/[・]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 1)
        .join(' ');
    };
    
    const currentDate = new Date();
    const formattedDate = `${currentDate.getFullYear()}/${(currentDate.getMonth() + 1).toString().padStart(2, '0')}/${currentDate.getDate().toString().padStart(2, '0')} ${currentDate.getHours().toString().padStart(2, '0')}:${currentDate.getMinutes().toString().padStart(2, '0')}:${currentDate.getSeconds().toString().padStart(2, '0')}`;
    
    return {
      id: uniqueId,
      siteName: 'ポイントインカム',
      cashback: normalizeCashback(campaign.points),
      cashbackYen: normalizeCashback(campaign.points),
      device: device,
      url: campaign.url,
      lastUpdated: formattedDate,
      description: campaign.title,
      displayName: campaign.title,
      campaignUrl: campaign.url,
      pointSiteUrl: 'https://pointi.jp',
      category: getCategoryFromType(campaign.category_type),
      searchKeywords: generateSearchKeywords(campaign.title),
      searchWeight: 1
    };
  });
  
  console.log(`🔄 変換済みポイントインカム案件: ${convertedCampaigns.length}件`);
  
  // 既存のポイントインカム案件を除去（重複防止）
  const existingNonPointIncome = searchData.campaigns.filter(
    campaign => campaign.siteName !== 'ポイントインカム'
  );
  
  console.log(`📊 既存の他サイト案件: ${existingNonPointIncome.length}件`);
  
  // 新しいデータセットを作成
  const newSearchData = {
    campaigns: [...existingNonPointIncome, ...convertedCampaigns],
    metadata: {
      ...searchData.metadata,
      totalCampaigns: existingNonPointIncome.length + convertedCampaigns.length,
      lastUpdated: new Date().toISOString(),
      sites: {
        ...searchData.metadata?.sites || {},
        'ポイントインカム': convertedCampaigns.length
      }
    }
  };
  
  console.log(`📊 統合後の総案件数: ${newSearchData.campaigns.length}件`);
  console.log('📊 サイト別内訳:');
  const siteBreakdown = {};
  newSearchData.campaigns.forEach(campaign => {
    siteBreakdown[campaign.siteName] = (siteBreakdown[campaign.siteName] || 0) + 1;
  });
  Object.entries(siteBreakdown).forEach(([site, count]) => {
    console.log(`   ${site}: ${count}件`);
  });
  
  // バックアップ作成
  const backupPath = `/Users/kn/poisoku-web/public/search-data-backup-${Date.now()}.json`;
  await fs.writeFile(backupPath, searchDataRaw);
  console.log(`💾 バックアップ作成: ${backupPath}`);
  
  // 新しいデータを保存
  await fs.writeFile(searchDataPath, JSON.stringify(newSearchData, null, 2));
  console.log(`💾 統合データ保存完了: ${searchDataPath}`);
  
  // out/にもコピー
  const outPath = '/Users/kn/poisoku-web/out/search-data.json';
  await fs.writeFile(outPath, JSON.stringify(newSearchData, null, 2));
  console.log(`💾 out/にも保存: ${outPath}`);
  
  console.log('✅ ポイントインカムデータ統合完了');
  
  return {
    totalCampaigns: newSearchData.campaigns.length,
    pointIncomeCampaigns: convertedCampaigns.length,
    otherSiteCampaigns: existingNonPointIncome.length
  };
}

if (require.main === module) {
  integratePointIncomeData()
    .then(result => {
      console.log('\n🎉 統合完了サマリー:');
      console.log(`   総案件数: ${result.totalCampaigns}件`);
      console.log(`   ポイントインカム: ${result.pointIncomeCampaigns}件`);
      console.log(`   他サイト: ${result.otherSiteCampaigns}件`);
    })
    .catch(error => {
      console.error('❌ 統合エラー:', error);
      process.exit(1);
    });
}

module.exports = integratePointIncomeData;