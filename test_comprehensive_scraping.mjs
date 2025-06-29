import fetch from 'node-fetch';

async function testComprehensiveScraping() {
  try {
    console.log('🚀 モッピー全案件スクレイピングテスト開始...');
    console.log('⚠️  注意: これは時間がかかる可能性があります（数分～十数分）');
    
    const startTime = Date.now();
    
    const response = await fetch('http://localhost:3000/api/comprehensive-scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer poisoku-scraping-secret-2024'
      },
      body: JSON.stringify({
        site: 'モッピー',
        fullScrape: true
      })
    });

    const result = await response.json();
    const totalTime = Date.now() - startTime;
    
    if (result.success) {
      console.log('\\n✅ 全案件スクレイピング成功!');
      console.log('=====================================');
      
      // 基本統計
      console.log('📊 基本統計:');
      console.log(`  総案件数: ${result.stats.totalCampaigns}件`);
      console.log(`  処理ページ数: ${result.stats.totalPages}ページ`);
      console.log(`  スクレイピング時間: ${(result.stats.processingTimeMs / 1000).toFixed(1)}秒`);
      console.log(`  総処理時間: ${(totalTime / 1000).toFixed(1)}秒`);
      
      // データベース保存結果
      console.log('\\n💾 データベース保存:');
      console.log(`  新規保存: ${result.database.savedCount}件`);
      console.log(`  更新: ${result.database.updatedCount}件`);
      if (result.database.errors.length > 0) {
        console.log(`  エラー: ${result.database.errors.length}件`);
        console.log('  エラー詳細:');
        result.database.errors.slice(0, 5).forEach((err, index) => {
          console.log(`    ${index + 1}. ${err}`);
        });
        if (result.database.errors.length > 5) {
          console.log(`    ... 他${result.database.errors.length - 5}件`);
        }
      } else {
        console.log('  ✅ 全ての案件が正常に保存されました');
      }
      
      // 取得案件サンプル
      console.log('\\n📋 取得案件サンプル（最初の10件）:');
      result.campaigns.slice(0, 10).forEach((campaign, index) => {
        const cashback = campaign.normalizedCashback || campaign.cashbackRate;
        const category = campaign.category ? `[${campaign.category}]` : '';
        console.log(`  ${index + 1}. ${campaign.name.substring(0, 50)}... - ${cashback} ${category}`);
      });
      
      // 推奨事項
      if (result.recommendations) {
        console.log('\\n💡 分析結果:');
        console.log(`  案件発見数: ${result.recommendations.totalCampaignsFound}件`);
        console.log(`  ページ処理数: ${result.recommendations.pagesProcessed}ページ`);
        
        if (result.recommendations.categoryDistribution) {
          console.log('  カテゴリ分布:');
          Object.entries(result.recommendations.categoryDistribution).forEach(([category, count]) => {
            console.log(`    ${category}: ${count}件`);
          });
        }
        
        if (result.recommendations.cashbackTypes) {
          console.log('  還元タイプ:');
          console.log(`    固定額: ${result.recommendations.cashbackTypes.fixed}件`);
          console.log(`    パーセント: ${result.recommendations.cashbackTypes.percentage}件`);
        }
        
        if (result.recommendations.nextSteps && result.recommendations.nextSteps.length > 0) {
          console.log('  推奨事項:');
          result.recommendations.nextSteps.forEach((step, index) => {
            console.log(`    ${index + 1}. ${step}`);
          });
        }
      }
      
      // デバッグ情報
      console.log('\\n🔍 デバッグ情報:');
      console.log(`  訪問URL数: ${result.debug.visitedUrls}`);
      console.log(`  処理ページ数: ${result.debug.pagesProcessed}`);
      
      if (result.errors && result.errors.length > 0) {
        console.log(`\\n⚠️  処理中のエラー (${result.errors.length}件):`);
        result.errors.slice(0, 3).forEach((error, index) => {
          console.log(`  ${index + 1}. ${error}`);
        });
        if (result.errors.length > 3) {
          console.log(`  ... 他${result.errors.length - 3}件`);
        }
      }
      
      // 成功メッセージ
      console.log('\\n🎉 モッピーの全案件自動取得システムが正常に動作しました！');
      console.log('   ポイ速での還元率比較が可能になりました。');
      
    } else {
      console.log('❌ 全案件スクレイピング失敗:', result.error);
      if (result.errors) {
        console.log('エラー詳細:', result.errors);
      }
    }
    
  } catch (error) {
    console.error('❌ テスト実行エラー:', error.message);
  }
}

// 統計情報も取得
async function testDetailedStats() {
  try {
    console.log('\\n📈 詳細統計情報を取得中...');
    
    const response = await fetch('http://localhost:3000/api/comprehensive-scrape?days=1&detailed=true');
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ 統計取得成功:');
      console.log(`  総スクレイピング: ${data.stats.totalScrapings}回`);
      console.log(`  成功: ${data.stats.successfulScrapings}回`);
      console.log(`  総案件: ${data.stats.totalCampaigns}件`);
      console.log(`  平均案件数: ${data.stats.averageCampaignsPerScraping.toFixed(1)}件/回`);
      console.log(`  非アクティブ化: ${data.deactivatedCampaigns}件`);
      
      if (data.stats.sitesStats.length > 0) {
        console.log('\\n📊 サイト別統計:');
        data.stats.sitesStats.forEach(site => {
          console.log(`  ${site.siteName}: ${site.campaigns}件 (成功率: ${site.successRate.toFixed(1)}%)`);
        });
      }
    } else {
      console.log('❌ 統計取得失敗:', data.error);
    }
  } catch (error) {
    console.error('❌ 統計取得エラー:', error.message);
  }
}

// メイン実行
console.log('='.repeat(60));
console.log('   モッピー全案件自動取得システム テスト');
console.log('='.repeat(60));

testComprehensiveScraping().then(() => {
  return testDetailedStats();
}).then(() => {
  console.log('\\n✨ 全テスト完了！');
}).catch(error => {
  console.error('❌ メインテストエラー:', error);
});