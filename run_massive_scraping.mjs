import fetch from 'node-fetch';

async function runMassiveScraping() {
  try {
    console.log('🚀 モッピー大規模全案件スクレイピング実行開始...');
    console.log('   目標: 数千～数万件の案件を取得してデータベースに登録');
    console.log('   予想処理時間: 10-30分');
    console.log('');
    
    const startTime = Date.now();
    
    const response = await fetch('http://localhost:3000/api/massive-scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer poisoku-scraping-secret-2024'
      },
      body: JSON.stringify({
        site: 'モッピー',
        maxCampaigns: 25000 // 上限設定
      })
    });

    const result = await response.json();
    const totalTime = Date.now() - startTime;
    
    if (result.success) {
      console.log('✅ 大規模全案件スクレイピング成功!');
      console.log('='.repeat(70));
      
      // 基本統計
      console.log('📊 スクレイピング結果:');
      console.log(`  総案件数: ${result.stats.totalCampaigns.toLocaleString()}件`);
      console.log(`  処理カテゴリ数: ${result.stats.totalCategories}個`);
      console.log(`  処理ページ数: ${result.stats.totalPagesProcessed}ページ`);
      console.log(`  平均案件数/ページ: ${result.stats.averageCampaignsPerPage.toFixed(1)}件`);
      console.log(`  スクレイピング時間: ${(result.stats.scrapingTimeMs / 1000 / 60).toFixed(1)}分`);
      console.log(`  総処理時間: ${(totalTime / 1000 / 60).toFixed(1)}分`);
      
      // パフォーマンス
      console.log('\\n⚡ パフォーマンス:');
      console.log(`  案件取得速度: ${result.performance.campaignsPerSecond}件/秒`);
      console.log(`  ページ処理速度: ${result.performance.pagesPerMinute}ページ/分`);
      console.log(`  効率性: ${result.performance.efficiency.toFixed(1)}%`);
      
      // データベース保存結果
      console.log('\\n💾 データベース保存結果:');
      console.log(`  新規保存: ${result.database.savedCount.toLocaleString()}件`);
      console.log(`  更新: ${result.database.updatedCount.toLocaleString()}件`);
      console.log(`  処理バッチ数: ${result.database.batchesProcessed}バッチ`);
      console.log(`  保存成功率: ${result.recommendations.database.successRate}`);
      
      if (result.database.errors.length > 0) {
        console.log(`  ⚠️  データベースエラー: ${result.database.errors.length}件`);
        if (result.database.errors.length <= 5) {
          result.database.errors.forEach((err, index) => {
            console.log(`    ${index + 1}. ${err.substring(0, 100)}...`);
          });
        } else {
          console.log('    最初の5件:');
          result.database.errors.slice(0, 5).forEach((err, index) => {
            console.log(`    ${index + 1}. ${err.substring(0, 80)}...`);
          });
          console.log(`    ... 他${result.database.errors.length - 5}件`);
        }
      } else {
        console.log('  ✅ 全案件が正常にデータベースに保存されました');
      }
      
      // 取得案件のサンプル（カテゴリ別）
      if (result.campaigns && result.campaigns.length > 0) {
        console.log('\\n📋 取得案件サンプル (最初の10件):');
        result.campaigns.slice(0, 10).forEach((campaign, index) => {
          const name = campaign.name.substring(0, 45);
          const cashback = campaign.normalizedCashback || campaign.cashbackRate;
          console.log(`  ${index + 1}. ${name}... - ${cashback} [${campaign.category}]`);
        });
        
        if (result.campaigns.length > 10) {
          console.log(`  ... 他${(result.stats.totalCampaigns - 10).toLocaleString()}件`);
        }
      }
      
      // 品質分析
      console.log('\\n📈 データ品質分析:');
      console.log(`  取得案件数: ${result.recommendations.dataQuality.campaignsFound.toLocaleString()}件`);
      console.log(`  期待範囲: ${result.recommendations.dataQuality.expectedRange[0].toLocaleString()}-${result.recommendations.dataQuality.expectedRange[1].toLocaleString()}件`);
      console.log(`  品質評価: ${result.recommendations.dataQuality.quality}`);
      console.log(`  効率性: ${result.recommendations.efficiency.toFixed(1)}%`);
      
      // デバッグ情報
      console.log('\\n🔍 処理詳細:');
      console.log(`  処理カテゴリ数: ${result.debug.categoriesProcessed}`);
      console.log(`  処理ページ数: ${result.debug.pagesProcessed}`);
      console.log(`  エラー数: ${result.debug.errorCount}`);
      
      // 推奨事項
      if (result.recommendations.nextSteps.length > 0) {
        console.log('\\n💡 推奨事項:');
        result.recommendations.nextSteps.forEach((step, index) => {
          console.log(`  ${index + 1}. ${step}`);
        });
      }
      
      // 比較：以前との改善
      console.log('\\n📊 改善結果:');
      console.log(`  改善前: 20件 → 改善後: ${result.stats.totalCampaigns.toLocaleString()}件`);
      const improvement = ((result.stats.totalCampaigns - 20) / 20 * 100).toFixed(0);
      console.log(`  改善率: ${improvement}%向上`);
      
      // 次のステップ
      console.log('\\n🎯 次のステップ:');
      console.log('  1. ポイ速のサイト (http://localhost:3000) で検索テスト');
      console.log('  2. 様々なキーワードで豊富な検索結果を確認');
      console.log('  3. 還元率の正規化が正しく機能していることを確認');
      console.log('  4. 定期実行システムの構築を検討');
      
      if (result.stats.totalCampaigns > 1000) {
        console.log('\\n🎉 大成功！数千件の案件取得に成功しました！');
        console.log('   ポイ速が真の案件比較サイトとして機能するようになりました。');
      } else {
        console.log('\\n⚠️  取得件数が期待より少ないです。さらなる最適化が必要です。');
      }
      
    } else {
      console.log('❌ 大規模スクレイピング失敗:', result.error);
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
    console.log('  - サーバーに十分なメモリがありますか？');
  }
}

console.log('='.repeat(80));
console.log('    モッピー大規模全案件取得システム - 数千件への挑戦');
console.log('='.repeat(80));

runMassiveScraping();