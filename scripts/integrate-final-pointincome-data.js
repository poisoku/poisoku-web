#!/usr/bin/env node

/**
 * ポイントインカム最終版データ（1,626件）をポイ速に統合
 */

const fs = require('fs').promises;
const path = require('path');

async function integrateFinalPointIncomeData() {
  console.log('🔄 ポイントインカム最終版データ統合開始');
  
  // 最新のポイントインカムデータを読み込み（1,626件）
  const pointIncomeDataPath = '/Users/kn/poisoku-web/scrapers/data/pointincome/pointincome_final_2025-08-10T03-10-01-143Z.json';
  const pointIncomeRaw = await fs.readFile(pointIncomeDataPath, 'utf-8');
  const pointIncomeData = JSON.parse(pointIncomeRaw);
  
  console.log(`📊 ポイントインカム案件数: ${pointIncomeData.total_campaigns}件`);
  
  // 現在のポイ速データを読み込み
  const searchDataPath = '/Users/kn/poisoku-web/public/search-data.json';
  const searchDataRaw = await fs.readFile(searchDataPath, 'utf-8');
  const searchData = JSON.parse(searchDataRaw);
  
  console.log(`📊 現在のポイ速案件数: ${searchData.campaigns.length}件`);
  
  // ポイントインカムのデータを削除（既存データをクリーン）
  const nonPointIncomeCampaigns = searchData.campaigns.filter(c => 
    c.siteName !== 'ポイントインカム' && c.site !== 'pointincome'
  );
  console.log(`📊 ポイントインカム以外の案件: ${nonPointIncomeCampaigns.length}件`);
  
  // ポイントインカム案件を変換
  const convertedCampaigns = pointIncomeData.campaigns.map(campaign => {
    // デバイス設定（Web案件なのでAll）
    const device = 'All';
    
    // キャッシュバック金額の正規化
    const normalizeCashback = (points) => {
      if (!points) return '0%';
      
      // 既に%形式または円形式の場合はそのまま
      if (points.includes('%') || points.includes('円')) {
        return points;
      }
      
      return points;
    };
    
    return {
      id: `pointincome_${campaign.id}`,
      siteName: 'ポイントインカム',
      displayName: campaign.title,
      description: campaign.title,
      cashback: normalizeCashback(campaign.points),
      cashbackYen: normalizeCashback(campaign.points),
      url: campaign.url,
      campaignUrl: campaign.url,
      pointSiteUrl: 'https://pointi.jp',
      device: device,
      category: campaign.category_type === 'shopping' ? 'shopping' : 'service',
      searchKeywords: campaign.title,
      searchWeight: 1,
      lastUpdated: new Date().toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    };
  });
  
  console.log(`📊 変換後のポイントインカム案件: ${convertedCampaigns.length}件`);
  
  // データを統合
  const updatedCampaigns = [...nonPointIncomeCampaigns, ...convertedCampaigns];
  
  const updatedSearchData = {
    ...searchData,
    campaigns: updatedCampaigns,
    last_updated: new Date().toISOString(),
    stats: {
      total_campaigns: updatedCampaigns.length,
      by_site: {
        chobirich: nonPointIncomeCampaigns.filter(c => c.siteName === 'ちょびリッチ').length,
        pointincome: convertedCampaigns.length
      },
      by_device: {
        all: updatedCampaigns.filter(c => c.device === 'All').length,
        ios: updatedCampaigns.filter(c => c.device === 'iOS').length,
        android: updatedCampaigns.filter(c => c.device === 'Android').length
      },
      by_category: {
        shopping: updatedCampaigns.filter(c => c.category === 'shopping').length,
        service: updatedCampaigns.filter(c => c.category === 'service').length
      }
    }
  };
  
  console.log('📊 統合結果:');
  console.log(`   合計案件数: ${updatedSearchData.stats.total_campaigns}件`);
  console.log(`   ちょびリッチ: ${updatedSearchData.stats.by_site.chobirich}件`);
  console.log(`   ポイントインカム: ${updatedSearchData.stats.by_site.pointincome}件`);
  console.log(`   ショッピング: ${updatedSearchData.stats.by_category.shopping}件`);
  console.log(`   サービス: ${updatedSearchData.stats.by_category.service}件`);
  
  // バックアップ作成
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `/Users/kn/poisoku-web/public/search-data-backup-${timestamp}.json`;
  await fs.writeFile(backupPath, JSON.stringify(searchData, null, 2));
  console.log(`💾 バックアップ作成: ${backupPath}`);
  
  // 新しいデータを書き込み
  await fs.writeFile(searchDataPath, JSON.stringify(updatedSearchData, null, 2));
  console.log(`💾 search-data.json更新完了`);
  
  // 「いぬのきもち・ねこのきもち」案件の検索
  const inuNekoCampaign = convertedCampaigns.find(c => 
    c.displayName.includes('いぬのきもち') || c.displayName.includes('ねこのきもち')
  );
  
  if (inuNekoCampaign) {
    console.log(`\n🎉 「いぬのきもち・ねこのきもち」案件発見！`);
    console.log(`   名前: ${inuNekoCampaign.displayName}`);
    console.log(`   キャッシュバック: ${inuNekoCampaign.cashback}`);
    console.log(`   URL: ${inuNekoCampaign.url}`);
  } else {
    console.log(`\n❌ 「いぬのきもち・ねこのきもち」案件は1ページ目データには含まれていませんでした`);
    console.log('   → 2ページ目以降の可能性が高い（既知のページネーション問題）');
  }
  
  console.log('\n✅ ポイントインカムデータ統合完了');
}

integrateFinalPointIncomeData().catch(console.error);