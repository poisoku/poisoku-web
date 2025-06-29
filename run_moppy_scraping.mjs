import fetch from 'node-fetch';

async function runMoppyScraping() {
  try {
    console.log('🚀 モッピー全案件スクレイピング実行開始...');
    console.log('⚠️  注意: 処理に時間がかかります（5-15分程度）');
    console.log('');
    
    const startTime = Date.now();
    
    const response = await fetch('http://localhost:3000/api/comprehensive-scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer poisoku-scraping-secret-2024'
      },
      body: JSON.stringify({
        site: 'モッピー',
        fullScrape: true,
        testMode: false // フル実行
      })
    });

    const result = await response.json();
    const totalTime = Date.now() - startTime;
    
    if (result.success) {
      console.log('✅ モッピー全案件スクレイピング成功!');
      console.log('='.repeat(50));
      
      // 基本統計
      console.log('📊 スクレイピング結果:');
      console.log(`  総案件数: ${result.stats.totalCampaigns}件`);
      console.log(`  処理ページ数: ${result.stats.totalPages}ページ`);
      console.log(`  スクレイピング時間: ${(result.stats.processingTimeMs / 1000 / 60).toFixed(1)}分`);
      console.log(`  総処理時間: ${(totalTime / 1000 / 60).toFixed(1)}分`);
      
      // データベース保存結果
      console.log('\\n💾 データベース保存結果:');
      console.log(`  新規保存: ${result.database.savedCount}件`);
      console.log(`  更新: ${result.database.updatedCount}件`);
      
      if (result.database.errors.length > 0) {
        console.log(`  エラー: ${result.database.errors.length}件`);
        console.log('  ⚠️  主なエラー:');
        result.database.errors.slice(0, 3).forEach((err, index) => {
          console.log(`    ${index + 1}. ${err.substring(0, 100)}...`);
        });
      } else {
        console.log('  ✅ 全案件が正常にデータベースに保存されました');
      }
      
      // 取得案件のサンプル（カテゴリ別）
      console.log('\\n📋 取得案件サンプル:');
      
      // カテゴリ別に分類
      const categoryGroups = {};
      result.campaigns.forEach(campaign => {
        if (!categoryGroups[campaign.category]) {
          categoryGroups[campaign.category] = [];
        }
        categoryGroups[campaign.category].push(campaign);
      });
      
      Object.entries(categoryGroups).forEach(([category, campaigns]) => {
        console.log(`\\n  【${category}】 (${campaigns.length}件)`);
        campaigns.slice(0, 3).forEach((campaign, index) => {
          const name = campaign.name.substring(0, 40);
          const cashback = campaign.normalizedCashback || campaign.cashbackRate;
          console.log(`    ${index + 1}. ${name}... - ${cashback}`);
        });
        if (campaigns.length > 3) {
          console.log(`    ... 他${campaigns.length - 3}件`);
        }
      });
      
      // 推奨事項
      if (result.recommendations) {
        console.log('\\n💡 分析結果:');
        if (result.recommendations.categoryDistribution) {
          console.log('  カテゴリ別分布:');
          Object.entries(result.recommendations.categoryDistribution)
            .sort((a, b) => b[1] - a[1])
            .forEach(([category, count]) => {
              console.log(`    ${category}: ${count}件`);
            });
        }
        
        if (result.recommendations.cashbackTypes) {
          console.log('\\n  還元タイプ分析:');
          console.log(`    固定額案件: ${result.recommendations.cashbackTypes.fixed}件`);
          console.log(`    パーセント案件: ${result.recommendations.cashbackTypes.percentage}件`);
        }
      }
      
      // 次のステップ
      console.log('\\n🎯 次のステップ:');
      console.log('  1. ポイ速のサイト (http://localhost:3000) で検索テスト');
      console.log('  2. 楽天、Amazon、じゃらんなどのキーワードで検索');
      console.log('  3. モッピーのデータが正常に表示されることを確認');
      console.log('  4. 還元率の表示形式（〇〇円、〇〇%）を確認');
      
      console.log('\\n🎉 モッピー全案件の自動取得が完了しました！');
      console.log('   ポイ速で検索して結果を確認してください。');
      
    } else {
      console.log('❌ スクレイピング失敗:', result.error);
      if (result.errors && result.errors.length > 0) {
        console.log('\\nエラー詳細:');
        result.errors.forEach((error, index) => {
          console.log(`  ${index + 1}. ${error}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ 実行エラー:', error.message);
    console.log('\\n💡 確認事項:');
    console.log('  - npm run dev が起動していますか？');
    console.log('  - インターネット接続は正常ですか？');
    console.log('  - Supabaseデータベースに接続できますか？');
  }
}

console.log('='.repeat(60));
console.log('    モッピー全案件自動取得システム 実行');
console.log('='.repeat(60));

runMoppyScraping();