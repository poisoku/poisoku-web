const fs = require('fs').promises;

/**
 * スクレイピングカバレッジの分析
 */
async function analyzeCoverage() {
  try {
    console.log('📊 スクレイピングカバレッジ分析開始\n');
    
    // 統一スクレイパーv2の結果を読み込み
    const data = await fs.readFile('chobirich_unified_v2_results.json', 'utf8');
    const results = JSON.parse(data);
    
    console.log('='.repeat(60));
    console.log('📈 基本統計');
    console.log('='.repeat(60));
    console.log(`総案件数: ${results.total_campaigns}件`);
    console.log(`実際の案件配列: ${results.campaigns.length}件`);
    
    // カテゴリ別集計
    console.log('\n📁 カテゴリ別内訳:');
    Object.entries(results.category_breakdown || {}).forEach(([category, count]) => {
      console.log(`  ${category}: ${count}件`);
    });
    
    // ユニークID分析
    const uniqueIds = new Set();
    const duplicateIds = new Set();
    const urlByCategory = {};
    const deviceBreakdown = {};
    
    results.campaigns.forEach(campaign => {
      if (uniqueIds.has(campaign.id)) {
        duplicateIds.add(campaign.id);
      } else {
        uniqueIds.add(campaign.id);
      }
      
      // カテゴリ別URL集計
      if (!urlByCategory[campaign.category]) {
        urlByCategory[campaign.category] = new Set();
      }
      urlByCategory[campaign.category].add(campaign.id);
      
      // デバイス別集計
      deviceBreakdown[campaign.device] = (deviceBreakdown[campaign.device] || 0) + 1;
    });
    
    console.log('\n🔍 重複・一意性分析:');
    console.log(`ユニークな案件ID: ${uniqueIds.size}件`);
    console.log(`重複している案件ID: ${duplicateIds.size}件`);
    
    if (duplicateIds.size > 0) {
      console.log('\n⚠️  重複案件の例:');
      const duplicateExamples = Array.from(duplicateIds).slice(0, 5);
      duplicateExamples.forEach(id => {
        const duplicates = results.campaigns.filter(c => c.id === id);
        console.log(`  ID ${id}: ${duplicates.length}回出現`);
        duplicates.forEach((dup, i) => {
          console.log(`    ${i+1}. ${dup.category} - ${dup.name.substring(0, 50)}...`);
        });
      });
    }
    
    console.log('\n📱 デバイス別内訳:');
    Object.entries(deviceBreakdown).forEach(([device, count]) => {
      console.log(`  ${device}: ${count}件`);
    });
    
    console.log('\n🎯 カテゴリ別ユニーク案件数:');
    Object.entries(urlByCategory).forEach(([category, ids]) => {
      console.log(`  ${category}: ${ids.size}件のユニーク案件`);
    });
    
    // 指定案件の確認
    const targetId = '1838584';
    const targetCampaigns = results.campaigns.filter(c => c.id === targetId);
    
    console.log('\n🔍 指定案件（ID: 1838584）の確認:');
    if (targetCampaigns.length > 0) {
      console.log(`✅ 発見: ${targetCampaigns.length}件`);
      targetCampaigns.forEach((campaign, i) => {
        console.log(`  ${i+1}. カテゴリ: ${campaign.category}`);
        console.log(`     名前: ${campaign.name.substring(0, 100)}...`);
        console.log(`     還元: ${campaign.cashback}`);
        console.log(`     URL: ${campaign.url}`);
      });
    } else {
      console.log('❌ 指定案件が見つかりません');
    }
    
    // 案件名の品質チェック
    console.log('\n🏷️  案件名の品質分析:');
    const nameQuality = {
      valid: 0,
      invalid: 0,
      examples: {
        valid: [],
        invalid: []
      }
    };
    
    results.campaigns.forEach(campaign => {
      // 無効な案件名のパターン
      const invalidPatterns = [
        /^アプリ大還元際$/,
        /^注目ワード$/,
        /^Yahoo!$/,
        /^楽天$/,
        /^.{1,2}$/,  // 2文字以下
        /^名前取得失敗$/
      ];
      
      const isInvalid = invalidPatterns.some(pattern => pattern.test(campaign.name.trim()));
      
      if (isInvalid) {
        nameQuality.invalid++;
        if (nameQuality.examples.invalid.length < 5) {
          nameQuality.examples.invalid.push(campaign.name);
        }
      } else {
        nameQuality.valid++;
        if (nameQuality.examples.valid.length < 5) {
          nameQuality.examples.valid.push(campaign.name);
        }
      }
    });
    
    console.log(`  有効な案件名: ${nameQuality.valid}件`);
    console.log(`  無効な案件名: ${nameQuality.invalid}件`);
    console.log(`  品質率: ${((nameQuality.valid / results.campaigns.length) * 100).toFixed(1)}%`);
    
    console.log('\n✅ 有効な案件名の例:');
    nameQuality.examples.valid.forEach((name, i) => {
      console.log(`  ${i+1}. ${name.substring(0, 60)}...`);
    });
    
    console.log('\n❌ 無効な案件名の例:');
    nameQuality.examples.invalid.forEach((name, i) => {
      console.log(`  ${i+1}. ${name}`);
    });
    
    // 推定総案件数の計算
    console.log('\n📊 推定カバレッジ:');
    console.log('テスト範囲:');
    console.log('  - ショッピング: 3カテゴリ × 3ページ = 234件');
    console.log('  - アプリ: 2ページ = 90件');
    console.log('  - 合計: 324件（重複除く: ' + uniqueIds.size + '件）');
    
    console.log('\n全体推定:');
    console.log('  - ショッピング: 12カテゴリ × 推定10-20ページ = 3,000-6,000件');
    console.log('  - アプリ: 推定30ページ = 1,350件');
    console.log('  - サービス・クレジットカード等: 推定1,000-2,000件');
    console.log('  - 推定総案件数: 5,000-10,000件');
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

// 実行
analyzeCoverage();