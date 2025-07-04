const fs = require('fs');

// データ品質分析
function analyzeDataQuality() {
  const data = JSON.parse(fs.readFileSync('chobirich_android_ios_apps_data.json', 'utf8'));
  
  const issues = {
    emptyName: [],
    emptyCashback: [],
    noCashback: [],
    unknownOS: [],
    shortName: [],
    suspiciousData: []
  };
  
  console.log('=== データ品質分析 ===\n');
  
  data.campaigns.forEach(campaign => {
    // 案件名が空白または短すぎる
    if (!campaign.name || campaign.name.trim() === '') {
      issues.emptyName.push(campaign.id);
    } else if (campaign.name.length < 3) {
      issues.shortName.push({ id: campaign.id, name: campaign.name });
    }
    
    // 還元率が取得できていない
    if (!campaign.cashback || campaign.cashback === '') {
      issues.emptyCashback.push(campaign.id);
    } else if (campaign.cashback === 'なし') {
      issues.noCashback.push(campaign.id);
    }
    
    // OSが不明
    if (!campaign.os || campaign.os === 'unknown') {
      issues.unknownOS.push({ id: campaign.id, name: campaign.name });
    }
    
    // 疑わしいデータ（エラーやForbidden）
    if (campaign.error || campaign.name.includes('403') || campaign.name.includes('Forbidden')) {
      issues.suspiciousData.push({ id: campaign.id, name: campaign.name, error: campaign.error });
    }
  });
  
  console.log(`総案件数: ${data.campaigns.length}件\n`);
  
  console.log('=== 問題の詳細 ===');
  console.log(`1. 案件名が空白: ${issues.emptyName.length}件`);
  if (issues.emptyName.length > 0) {
    console.log(`   ID例: ${issues.emptyName.slice(0, 5).join(', ')}`);
  }
  
  console.log(`2. 案件名が短すぎる: ${issues.shortName.length}件`);
  if (issues.shortName.length > 0) {
    issues.shortName.slice(0, 3).forEach(item => {
      console.log(`   ID ${item.id}: "${item.name}"`);
    });
  }
  
  console.log(`3. 還元率が空白: ${issues.emptyCashback.length}件`);
  console.log(`4. 還元率が「なし」: ${issues.noCashback.length}件`);
  console.log(`5. OS不明: ${issues.unknownOS.length}件`);
  if (issues.unknownOS.length > 0) {
    issues.unknownOS.slice(0, 5).forEach(item => {
      console.log(`   ID ${item.id}: "${item.name}"`);
    });
  }
  
  console.log(`6. 疑わしいデータ: ${issues.suspiciousData.length}件`);
  if (issues.suspiciousData.length > 0) {
    issues.suspiciousData.slice(0, 3).forEach(item => {
      console.log(`   ID ${item.id}: "${item.name}" (${item.error || 'エラー'})`);
    });
  }
  
  // 改善が必要なIDリストを作成
  const needsImprovement = new Set();
  
  issues.emptyName.forEach(id => needsImprovement.add(id));
  issues.emptyCashback.forEach(id => needsImprovement.add(id));
  issues.unknownOS.forEach(item => needsImprovement.add(item.id));
  issues.suspiciousData.forEach(item => needsImprovement.add(item.id));
  
  console.log(`\n=== 改善対象 ===`);
  console.log(`改善が必要な案件: ${needsImprovement.size}件`);
  
  // 改善対象IDをファイルに保存
  const improvementData = {
    total_issues: needsImprovement.size,
    issue_breakdown: {
      empty_name: issues.emptyName.length,
      empty_cashback: issues.emptyCashback.length,
      unknown_os: issues.unknownOS.length,
      suspicious_data: issues.suspiciousData.length
    },
    ids_to_improve: Array.from(needsImprovement)
  };
  
  fs.writeFileSync('data_quality_issues.json', JSON.stringify(improvementData, null, 2));
  console.log(`\n改善対象IDリストを data_quality_issues.json に保存しました`);
  
  return improvementData;
}

analyzeDataQuality();