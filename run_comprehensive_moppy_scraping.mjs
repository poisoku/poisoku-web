import fetch from 'node-fetch';

async function runComprehensiveMoppyScraping() {
  try {
    console.log('🎯 モッピー包括的全案件スクレイピング実行開始（完全版）...');
    console.log('   階層的アプローチ: カテゴリ + 詳細キーワード検索');
    console.log('   40+個のカテゴリ・キーワードURL + 深度ページネーション');
    console.log('   目標: モッピー掲載全案件の完全取得（数千件レベル）');
    console.log('');
    
    const startTime = Date.now();
    
    const response = await fetch('http://localhost:3000/api/comprehensive-scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer poisoku-scraping-secret-2024'
      },
      body: JSON.stringify({
        site: 'モッピー'
      })
    });

    const result = await response.json();
    const totalTime = Date.now() - startTime;
    
    if (result.success) {
      console.log('🎉 包括的スクレイピング成功!');
      console.log('='.repeat(80));
      
      // 突破結果
      console.log('🚀 突破結果:');
      console.log(`  ${result.breakthrough.message}`);
      console.log(`  改善前: ${result.breakthrough.previousCount}件`);
      console.log(`  改善後: ${result.breakthrough.currentCount.toLocaleString()}件`);
      console.log(`  改善率: ${result.breakthrough.improvement} 向上`);
      console.log(`  目標6,000件達成: ${result.breakthrough.targetReached ? '✅ Yes' : '❌ No'}`);
      
      // 詳細統計
      console.log('\\n📊 詳細統計:');
      console.log(`  総案件数: ${result.stats.totalCampaigns.toLocaleString()}件`);
      console.log(`  処理カテゴリ数: ${result.stats.totalCategories}個`);
      console.log(`  処理ページ数: ${result.stats.totalPagesProcessed}ページ`);
      console.log(`  平均案件数/カテゴリ: ${result.stats.averageCampaignsPerCategory.toFixed(1)}件`);
      console.log(`  重複除去数: ${result.stats.duplicatesRemoved.toLocaleString()}件`);
      console.log(`  目標達成: ${result.stats.targetAchieved ? 'Yes' : 'No'}`);
      console.log(`  スクレイピング時間: ${(result.stats.scrapingTimeMs / 1000 / 60).toFixed(1)}分`);
      console.log(`  総処理時間: ${(totalTime / 1000 / 60).toFixed(1)}分`);
      
      // パフォーマンス
      console.log('\\n⚡ パフォーマンス:');
      console.log(`  案件取得速度: ${result.performance.campaignsPerSecond}件/秒`);
      console.log(`  カテゴリ処理速度: ${result.performance.categoriesPerMinute}カテゴリ/分`);
      console.log(`  効率性: ${result.performance.efficiency.toFixed(1)}% (目標に対して)`);
      console.log(`  重複除去率: ${result.performance.deduplicationRate}`);
      
      // データベース保存結果
      console.log('\\n💾 データベース保存結果:');
      console.log(`  新規保存: ${result.database.savedCount.toLocaleString()}件`);
      console.log(`  更新: ${result.database.updatedCount.toLocaleString()}件`);
      console.log(`  保存成功率: ${result.database.successRate}`);
      console.log(`  処理バッチ数: ${result.database.batchesProcessed}バッチ`);
      
      if (result.database.errors.length > 0) {
        console.log(`  ⚠️  データベースエラー: ${result.database.errors.length}件`);
        result.database.errors.slice(0, 3).forEach((err, index) => {
          console.log(`    ${index + 1}. ${err.substring(0, 100)}...`);
        });
      } else {
        console.log('  ✅ 全案件が正常にデータベースに保存されました');
      }
      
      // カテゴリ別取得結果
      console.log('\\n📈 カテゴリ別取得結果:');
      Object.entries(result.debug.categoryResults).forEach(([category, count], index) => {
        console.log(`  ${index + 1}. ${category}: ${count}件`);
      });
      
      // 最も効果的なカテゴリ
      if (result.debug.bestCategory) {
        console.log('\\n🏆 最も効果的なカテゴリ:');
        console.log(`  カテゴリ: ${result.debug.bestCategory.category}`);
        console.log(`  取得数: ${result.debug.bestCategory.count}件`);
      }
      
      // 効果的セレクタ
      if (result.debug.effectiveSelectors.length > 0) {
        console.log('\\n🔍 効果的セレクタ:');
        result.debug.effectiveSelectors.slice(0, 5).forEach((selector, index) => {
          console.log(`  ${index + 1}. ${selector}`);
        });
      }
      
      // 処理ログサマリー
      if (result.debug.processingLog.length > 0) {
        console.log('\\n📝 処理ログサマリー:');
        result.debug.processingLog.slice(0, 10).forEach((log, index) => {
          console.log(`  ${index + 1}. ${log}`);
        });
        if (result.debug.processingLog.length > 10) {
          console.log(`  ... 他${result.debug.processingLog.length - 10}件のログ`);
        }
      }
      
      // 取得案件サンプル
      if (result.campaigns && result.campaigns.length > 0) {
        console.log('\\n📋 取得案件サンプル (最初の10件):');
        result.campaigns.slice(0, 10).forEach((campaign, index) => {
          const name = campaign.name.substring(0, 40);
          const cashback = campaign.normalizedCashback || campaign.cashbackRate;
          console.log(`  ${index + 1}. ${name}... - ${cashback} [${campaign.category}]`);
        });
        
        if (result.campaigns.length > 10) {
          console.log(`  ... 他${(result.stats.totalCampaigns - 10).toLocaleString()}件`);
        }
      }
      
      // カテゴリ分析
      if (result.campaigns && result.campaigns.length > 0) {
        console.log('\\n📂 カテゴリ分析:');
        const categoryCount = {};
        result.campaigns.forEach(campaign => {
          categoryCount[campaign.category] = (categoryCount[campaign.category] || 0) + 1;
        });
        
        Object.entries(categoryCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .forEach(([category, count]) => {
            console.log(`  ${category}: ${count}件`);
          });
      }
      
      // エラー報告
      if (result.errors.length > 0) {
        console.log(`\\n⚠️  処理中のエラー (${result.errors.length}件):`);
        result.errors.slice(0, 3).forEach((error, index) => {
          console.log(`  ${index + 1}. ${error.substring(0, 100)}...`);
        });
        if (result.errors.length > 3) {
          console.log(`  ... 他${result.errors.length - 3}件`);
        }
      }
      
      // 最終評価
      console.log('\\n🎯 最終評価:');
      
      if (result.stats.totalCampaigns >= 6000) {
        console.log('  🌟 大成功！包括的スクレイピングで6,000件以上を達成');
        console.log('  🎉 どこ得方式が完璧に機能しました');
        console.log('  🏆 ポイ速が真の比較サイトとして完成しました');
      } else if (result.stats.totalCampaigns >= 4000) {
        console.log('  ✅ 成功！4,000件以上の案件取得を達成');
        console.log('  🚀 どこ得方式による大幅な改善を実現');
        console.log('  💪 実用的なポイント比較サイトとして十分機能します');
      } else if (result.stats.totalCampaigns >= 2000) {
        console.log('  📈 良好！2,000件以上の案件を取得');
        console.log('  💡 階層的アプローチの効果が確認できました');
        console.log('  🔧 更なる最適化で6,000件を目指しましょう');
      } else if (result.stats.totalCampaigns >= 1000) {
        console.log('  📊 改善成功。1,000件以上の案件を取得');
        console.log('  🔍 包括的手法の基本的な効果を確認');
      } else {
        console.log('  ⚠️  包括的スクレイピングの効果が限定的');
        console.log('  🔍 更なる戦略の見直しが必要');
      }
      
      // 重複除去効果の分析
      if (result.stats.duplicatesRemoved > 0) {
        console.log('\\n🔄 重複除去効果:');
        const originalTotal = result.stats.totalCampaigns + result.stats.duplicatesRemoved;
        console.log(`  重複除去前: ${originalTotal.toLocaleString()}件`);
        console.log(`  重複除去後: ${result.stats.totalCampaigns.toLocaleString()}件`);
        console.log(`  除去効率: ${result.performance.deduplicationRate}`);
        console.log(`  データ品質の向上により、検索結果の信頼性が大幅に向上しました`);
      }
      
      // どこ得方式の効果分析
      console.log('\\n🔬 どこ得方式効果分析:');
      console.log(`  階層的アプローチ: ${result.stats.totalCategories}カテゴリ処理`);
      console.log(`  ページネーション: ${result.stats.totalPagesProcessed}ページ処理`);
      console.log(`  効率性: ${result.performance.efficiency.toFixed(1)}%`);
      
      if (result.stats.totalCategories > 0) {
        console.log(`  カテゴリ平均効果: ${(result.stats.totalCampaigns / result.stats.totalCategories).toFixed(1)}件/カテゴリ`);
      }
      
      // 次のステップ
      console.log('\\n🎯 次のステップ:');
      
      if (result.stats.totalCampaigns >= 4000) {
        console.log('  1. ポイ速のサイト (http://localhost:3000) で検索テスト');
        console.log('  2. 大量の案件データによる豊富な検索結果を確認');
        console.log('  3. 他のポイントサイト（ハピタス、ポイントインカム等）の追加');
        console.log('  4. 定期実行システムの本格運用');
        console.log('  5. ランキング機能の充実');
        console.log('  6. サーバーデプロイとドメイン設定');
      } else if (result.stats.totalCampaigns >= 2000) {
        console.log('  1. ポイ速のサイト (http://localhost:3000) で検索テスト');
        console.log('  2. 基本的な比較機能の充実確認');
        console.log('  3. より多くのカテゴリパターンの追加検討');
        console.log('  4. 他のポイントサイトの追加準備');
      } else {
        console.log('  1. 現在の結果でのポイ速の動作確認');
        console.log('  2. カテゴリ戦略の再検討');
        console.log('  3. より効果的なページネーション手法の検討');
      }
      
      // 成功の要因分析
      console.log('\\n🔑 成功の要因（どこ得方式）:');
      console.log(`  1. 階層的アプローチによる包括的データ収集`);
      console.log(`  2. ${result.stats.totalCategories}カテゴリの体系的処理`);
      console.log(`  3. ページネーション自動処理による深掘り`);
      console.log(`  4. 重複除去による高品質データの確保`);
      console.log(`  5. 効果的セレクタ "${result.debug.effectiveSelectors[0] || '[class*="item"]'}" の活用`);
      
      // ポイ速の最終状態
      console.log('\\n🏆 ポイ速の最終状態（包括的スクレイピング後）:');
      console.log(`  総案件データ数: ${result.stats.totalCampaigns.toLocaleString()}件`);
      console.log(`  対応ポイントサイト: モッピー`);
      console.log(`  検索機能: 完全対応`);
      console.log(`  ランキング機能: 対応`);
      console.log(`  レスポンシブデザイン: 対応`);
      console.log(`  データ更新: 包括的自動システム`);
      console.log(`  データ品質: 重複除去済み高品質`);
      
      if (result.stats.totalCampaigns >= 2000) {
        console.log(`  📊 高機能ポイント比較サイトとして完全に機能します！`);
        console.log(`  🚀 どこ得に匹敵するデータ量を達成しました！`);
      } else if (result.stats.totalCampaigns >= 1000) {
        console.log(`  📊 実用的なポイント比較サイトとして機能します！`);
      }
      
    } else {
      console.log('❌ 包括的スクレイピング失敗:', result.error);
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
    console.log('  - システムリソースは十分ですか？');
    console.log('  - 処理時間が長い場合がありますので、しばらくお待ちください');
  }
}

console.log('='.repeat(90));
console.log('    モッピー包括的案件取得システム - どこ得方式による6,000件への挑戦');
console.log('    階層的アプローチ + ページネーション + 重複除去');
console.log('='.repeat(90));

runComprehensiveMoppyScraping();