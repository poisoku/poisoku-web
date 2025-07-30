const fs = require('fs');

// 完全なAndroid案件データを作成
function createCompleteAndroidData() {
  const androidData = JSON.parse(fs.readFileSync('chobirich_quick_android_campaigns.json', 'utf8'));
  
  console.log('元のAndroid案件数:', androidData.campaigns.length);
  
  // クリーンアップされたデータに変換
  const cleanedCampaigns = androidData.campaigns.map(campaign => {
    // 案件名をクリーンアップ
    const cleanName = campaign.name
      .replace(/\n/g, ' ')
      .replace(/\t/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // タイトル部分のみ抽出
    let title = cleanName;
    const androidMatch = cleanName.match(/^(.+?（Android）)/);
    if (androidMatch) {
      title = androidMatch[1];
    } else {
      // ポイント情報の前まで
      const pointMatch = cleanName.match(/^(.+?)(?:\s+\d+pt|\s+最大\d+pt)/);
      if (pointMatch) {
        title = pointMatch[1];
      }
    }
    
    return {
      id: campaign.id,
      name: title.trim(),
      url: campaign.url.replace(/\/$/, '') + '/',
      cashbackRate: "",
      cashbackAmount: campaign.cashback,
      category: "アプリ",
      subCategory: "アプリ",
      device: "android",
      timestamp: "2025-07-30T08:00:00.000Z"
    };
  });
  
  const completeAndroidData = {
    scrape_date: "2025-07-30T08:00:00.000Z",
    strategy: "android_complete",
    total_campaigns: cleanedCampaigns.length,
    unique_campaigns: cleanedCampaigns.length,
    duplicates_removed: 0,
    category_breakdown: {
      "アプリ": cleanedCampaigns.length
    },
    errors: [],
    campaigns: cleanedCampaigns
  };
  
  fs.writeFileSync('chobirich_android_complete.json', JSON.stringify(completeAndroidData, null, 2));
  console.log('完全なAndroid案件データを作成:', cleanedCampaigns.length, '件');
  
  // マフィア案件が含まれているか確認
  const mafiaCount = cleanedCampaigns.filter(c => c.name.includes('マフィア')).length;
  console.log('マフィア案件数:', mafiaCount);
  
  return completeAndroidData;
}

// 既存データに統合
function integrateCompleteAndroidData() {
  // 新しい完全データを作成
  const androidData = createCompleteAndroidData();
  
  // 既存の統合データを読み込み
  const existingData = JSON.parse(fs.readFileSync('chobirich_unified_medium_results.json', 'utf8'));
  
  console.log('既存案件数:', existingData.campaigns.length);
  
  // Android案件を除去（再統合のため）
  const nonAndroidCampaigns = existingData.campaigns.filter(c => c.device !== 'android');
  console.log('Android以外の案件数:', nonAndroidCampaigns.length);
  
  // 新しいAndroid案件を追加
  const allCampaigns = [...nonAndroidCampaigns, ...androidData.campaigns];
  
  // 重複除去（ID基準）
  const uniqueCampaigns = [];
  const seenIds = new Set();
  
  allCampaigns.forEach(campaign => {
    if (!seenIds.has(campaign.id)) {
      seenIds.add(campaign.id);
      uniqueCampaigns.push(campaign);
    }
  });
  
  // データ更新
  existingData.campaigns = uniqueCampaigns;
  existingData.unique_campaigns = uniqueCampaigns.length;
  existingData.total_campaigns = uniqueCampaigns.length;
  existingData.category_breakdown["アプリ"] = uniqueCampaigns.filter(c => c.category === "アプリ").length;
  
  // 保存
  fs.writeFileSync('chobirich_unified_medium_results.json', JSON.stringify(existingData, null, 2));
  
  console.log('\n✅ Android案件完全統合完了:');
  console.log('総案件数:', uniqueCampaigns.length);
  console.log('アプリ案件:', existingData.category_breakdown["アプリ"]);
  
  // Android案件統計
  const androidCampaigns = uniqueCampaigns.filter(c => c.device === 'android');
  console.log('Android案件:', androidCampaigns.length);
  
  // マフィア案件の確認
  const mafiaAndroid = androidCampaigns.filter(c => c.name.includes('マフィア'));
  console.log('Androidマフィア案件:', mafiaAndroid.length);
  
  if (mafiaAndroid.length > 0) {
    console.log('\n🎯 Androidマフィア案件:');
    mafiaAndroid.forEach(c => {
      console.log(`- [${c.id}] ${c.name} (${c.cashbackAmount})`);
    });
  }
}

// 実行
integrateCompleteAndroidData();