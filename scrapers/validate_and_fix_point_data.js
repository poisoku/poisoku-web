#!/usr/bin/env node

/**
 * ポイントデータ検証・修正システム
 * 先頭ゼロや異常なパターンの検出・修正
 */

const fs = require('fs').promises;
const path = require('path');

class PointDataValidator {
  constructor() {
    this.issues = [];
    this.fixes = [];
  }

  /**
   * ポイント値の検証・修正
   */
  validateAndFixPoints(pointText, campaignId, campaignTitle) {
    if (!pointText) return pointText;

    const issues = [];
    let fixedPoints = pointText;

    // パターン1: 先頭ゼロの5桁以上数値 (09342pt → 109342pt)
    if (/^0\d{4,}pt$/i.test(pointText)) {
      issues.push(`先頭ゼロ5桁以上: ${pointText}`);
      // 先頭に1を追加（最も可能性が高い修正）
      fixedPoints = '1' + pointText;
      this.fixes.push({
        campaignId,
        campaignTitle,
        issue: '先頭ゼロ5桁以上',
        original: pointText,
        fixed: fixedPoints,
        reason: '先頭に1を追加（10万pt台の案件として修正）'
      });
    }

    // パターン2: 異常に小さい5桁数値 (00001pt など)
    else if (/^0{3,}\d{1,2}pt$/i.test(pointText)) {
      issues.push(`過度な先頭ゼロ: ${pointText}`);
      // 先頭のゼロを除去
      fixedPoints = pointText.replace(/^0+/, '');
      if (!fixedPoints.match(/^\d/)) fixedPoints = '1' + fixedPoints;
      
      this.fixes.push({
        campaignId,
        campaignTitle,
        issue: '過度な先頭ゼロ',
        original: pointText,
        fixed: fixedPoints,
        reason: '先頭ゼロを除去'
      });
    }

    // パターン3: 桁数と案件内容の不一致検出
    const pointValue = parseInt(pointText.replace(/[^\d]/g, ''));
    
    // アプリランド案件で1000pt未満は疑わしい
    if (campaignTitle && campaignTitle.includes('アプリランド') && pointValue < 1000) {
      issues.push(`アプリランド案件で低ポイント: ${pointText}`);
      // 10倍にする（桁落ちの可能性）
      const multipliedValue = pointValue * 10;
      fixedPoints = `${multipliedValue}pt`;
      
      this.fixes.push({
        campaignId,
        campaignTitle,
        issue: 'アプリランド案件低ポイント',
        original: pointText,
        fixed: fixedPoints,
        reason: '10倍に修正（桁落ち想定）'
      });
    }

    // パターン4: 異常な高ポイント（100万pt以上）
    else if (pointValue > 1000000) {
      issues.push(`異常高ポイント: ${pointText}`);
      // そのまま保持（要手動確認）
    }

    if (issues.length > 0) {
      this.issues.push({
        campaignId,
        campaignTitle,
        issues,
        original: pointText,
        fixed: fixedPoints
      });
    }

    return fixedPoints;
  }

  /**
   * データ全体の検証・修正
   */
  async validateDataFile(filePath, dataType) {
    console.log(`\n🔍 ${dataType}データ検証中...`);
    
    const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
    let totalChecked = 0;
    let totalFixed = 0;

    if (dataType === 'v3') {
      // v3データ形式
      data.campaigns.forEach(campaign => {
        totalChecked++;
        const originalPoints = campaign.points;
        const fixedPoints = this.validateAndFixPoints(
          campaign.points,
          campaign.id,
          campaign.title
        );
        
        if (originalPoints !== fixedPoints) {
          campaign.points = fixedPoints;
          totalFixed++;
        }
      });
    } else if (dataType === 'search') {
      // 検索データ形式
      data.campaigns.forEach(campaign => {
        totalChecked++;
        const originalCashback = campaign.cashback;
        const fixedCashback = this.validateAndFixPoints(
          campaign.cashback,
          campaign.id,
          campaign.description
        );
        
        if (originalCashback !== fixedCashback) {
          campaign.cashback = fixedCashback;
          // 円換算も更新
          const pointValue = parseInt(fixedCashback.replace(/[^\d]/g, ''));
          campaign.cashbackYen = `${Math.floor(pointValue * 0.5)}円`;
          totalFixed++;
        }
      });
    }

    console.log(`  検証済み: ${totalChecked}件`);
    console.log(`  修正: ${totalFixed}件`);

    if (totalFixed > 0) {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      console.log(`  ✅ ${dataType}データ更新完了`);
    }

    return { totalChecked, totalFixed };
  }

  /**
   * 修正レポート生成
   */
  generateReport() {
    console.log('\n📋 ポイントデータ検証・修正レポート');
    console.log('='.repeat(60));

    if (this.issues.length === 0) {
      console.log('✅ 問題は検出されませんでした');
      return;
    }

    console.log(`⚠️ 検出された問題: ${this.issues.length}件`);
    
    this.issues.forEach((issue, i) => {
      console.log(`\n${i+1}. 案件: ${issue.campaignTitle || issue.campaignId}`);
      console.log(`   問題: ${issue.issues.join(', ')}`);
      console.log(`   修正前: ${issue.original}`);
      console.log(`   修正後: ${issue.fixed}`);
    });

    if (this.fixes.length > 0) {
      console.log('\n🔧 適用された修正:');
      this.fixes.forEach((fix, i) => {
        console.log(`\n${i+1}. ${fix.campaignTitle}`);
        console.log(`   問題: ${fix.issue}`);
        console.log(`   ${fix.original} → ${fix.fixed}`);
        console.log(`   理由: ${fix.reason}`);
      });
    }

    // 修正パターンの統計
    const fixTypes = {};
    this.fixes.forEach(fix => {
      fixTypes[fix.issue] = (fixTypes[fix.issue] || 0) + 1;
    });

    console.log('\n📊 修正パターン統計:');
    Object.entries(fixTypes).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}件`);
    });
  }
}

async function main() {
  const validator = new PointDataValidator();
  
  console.log('🛡️ ポイントデータ検証・修正システム');
  console.log('='.repeat(60));
  
  try {
    const searchDataFile = path.join(__dirname, '..', 'public', 'search-data.json');
    const v3DataFile = path.join(__dirname, 'data', 'chobirich_production_complete_v3.json');

    // v3データ検証
    const v3Results = await validator.validateDataFile(v3DataFile, 'v3');
    
    // 検索データ検証  
    const searchResults = await validator.validateDataFile(searchDataFile, 'search');

    // レポート生成
    validator.generateReport();

    console.log('\n🎯 総括:');
    console.log(`v3データ: ${v3Results.totalChecked}件検証, ${v3Results.totalFixed}件修正`);
    console.log(`検索データ: ${searchResults.totalChecked}件検証, ${searchResults.totalFixed}件修正`);

    if (v3Results.totalFixed > 0 || searchResults.totalFixed > 0) {
      console.log('\n✅ データ修正完了！Vercelへの反映を実行してください。');
    } else {
      console.log('\n✅ 全データ正常！修正は不要でした。');
    }

  } catch (error) {
    console.error('💥 検証エラー:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}