import fetch from 'node-fetch';

async function runUltraMoppyScraping() {
  try {
    console.log('🎯 モッピー超効率的全案件スクレイピング実行開始...');
    console.log('   戦略: 最高効率クエリのみ + 深度ページネーション + 超高速処理');
    console.log('   特徴: 短時間で最大数の案件取得');
    console.log('   目標: 2,000件以上の案件取得（15分以内）');
    console.log('');
    
    const startTime = Date.now();
    
    const response = await fetch('http://localhost:3000/api/ultra-moppy-scrape', {
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
      console.log('🎉 超効率的スクレイピング成功!');
      console.log('='.repeat(80));
      
      // 突破結果
      console.log('🚀 突破結果:');
      console.log(`  ${result.breakthrough.message}`);
      console.log(`  改善前: ${result.breakthrough.previousCount}件`);
      console.log(`  改善後: ${result.breakthrough.currentCount.toLocaleString()}件`);
      console.log(`  改善率: ${result.breakthrough.improvement} 向上`);
      console.log(`  目標2,000件達成: ${result.breakthrough.targetReached ? '✅ Yes' : '❌ No'}`);
      console.log(`  処理時間: ${result.breakthrough.timeEfficiency}`);
      
      // 詳細統計
      console.log('\\n📊 詳細統計:');
      console.log(`  総案件数: ${result.stats.totalCampaigns.toLocaleString()}件`);
      console.log(`  処理クエリ数: ${result.stats.totalQueries}個`);
      console.log(`  処理ページ数: ${result.stats.totalPagesProcessed}ページ`);
      console.log(`  平均ページ処理時間: ${(result.stats.averagePageTime / 1000).toFixed(1)}秒`);
      console.log(`  重複除去数: ${result.stats.duplicatesRemoved.toLocaleString()}件`);
      console.log(`  重複除去率: ${result.performance.deduplicationRate}`);
      console.log(`  目標達成: ${result.stats.targetAchieved ? 'Yes' : 'No'}`);
      console.log(`  スクレイピング時間: ${(result.stats.scrapingTimeMs / 1000 / 60).toFixed(1)}分`);
      console.log(`  総処理時間: ${(totalTime / 1000 / 60).toFixed(1)}分`);
      
      // パフォーマンス分析
      console.log('\\n⚡ パフォーマンス分析:');
      console.log(`  案件取得速度: ${result.performance.campaignsPerSecond}件/秒`);
      console.log(`  クエリ処理速度: ${result.performance.queriesPerMinute}クエリ/分`);
      console.log(`  効率性: ${result.performance.efficiency.toFixed(1)}% (目標に対して)`);
      console.log(`  データ品質: 重複除去により高品質データを確保`);
      
      // データベース保存結果
      console.log('\\n💾 データベース保存結果:');
      console.log(`  新規保存: ${result.database.savedCount.toLocaleString()}件`);
      console.log(`  更新: ${result.database.updatedCount.toLocaleString()}件`);
      console.log(`  保存成功率: ${result.database.successRate}`);
      console.log(`  処理バッチ数: ${result.database.batchesProcessed}バッチ（超高速処理）`);
      
      if (result.database.errors.length > 0) {
        console.log(`  ⚠️  データベースエラー: ${result.database.errors.length}件`);
        result.database.errors.slice(0, 3).forEach((err, index) => {
          console.log(`    ${index + 1}. ${err.substring(0, 100)}...`);
        });
      } else {
        console.log('  ✅ 全案件が正常にデータベースに保存されました');
      }
      
      // クエリ別取得結果
      console.log('\\n📈 クエリ別取得結果:');
      Object.entries(result.debug.queryResults).forEach(([query, count], index) => {
        console.log(`  ${index + 1}. "${query}": ${count}件`);
      });
      
      // 最も効果的なクエリ
      if (result.debug.bestQuery) {
        console.log('\\n🏆 最も効果的なクエリ:');
        console.log(`  クエリ: "${result.debug.bestQuery.query}"`);
        console.log(`  取得数: ${result.debug.bestQuery.count}件`);
      }
      
      // データ処理効果
      console.log('\\n📊 データ処理効果:');
      console.log(`  Raw取得数: ${result.debug.totalRawCampaigns.toLocaleString()}件`);
      console.log(`  最終案件数: ${result.stats.totalCampaigns.toLocaleString()}件`);
      console.log(`  重複除去効果: ${result.performance.deduplicationRate}の重複を除去`);
      console.log(`  データ品質向上: 高品質なユニークデータを確保`);
      
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
      
      // 超効率化手法の効果分析
      console.log('\\n🔬 超効率化手法効果分析:');
      console.log(`  クエリ戦略: ${result.stats.totalQueries}個の最高効率クエリ`);
      console.log(`  深度ページネーション: 各クエリで複数ページを徹底処理`);
      console.log(`  リアルタイム重複除去: メモリ効率と品質を両立`);
      console.log(`  最適化された待機時間: 1.5秒/ページで高速処理`);
      console.log(`  超高速バッチ保存: 200件/バッチで効率的DB保存`);
      
      if (result.stats.totalQueries > 0) {
        console.log(`  クエリ平均効果: ${(result.stats.totalCampaigns / result.stats.totalQueries).toFixed(1)}件/クエリ`);
      }
      
      // 最終評価
      console.log('\\n🎯 最終評価:');
      
      if (result.stats.totalCampaigns >= 3000) {
        console.log('  🌟 大成功！超効率的スクレイピングで3,000件以上を達成');
        console.log('  🎉 最高効率クエリ戦略が完璧に機能しました');
        console.log('  🏆 ポイ速が大規模比較サイトとして完成');
        console.log('  🚀 短時間で大量データ取得という目標を達成');
      } else if (result.stats.totalCampaigns >= 2000) {
        console.log('  ✅ 成功！2,000件以上の案件取得を達成');
        console.log('  🚀 超効率化手法による大幅な改善を実現');
        console.log('  💪 実用的な大規模ポイント比較サイトとして十分機能');
      } else if (result.stats.totalCampaigns >= 1500) {
        console.log('  📈 良好！1,500件以上の案件を取得');
        console.log('  💡 超効率化戦略の基本的な効果を確認');
        console.log('  🔧 さらなるクエリ最適化で2,000件を目指しましょう');
      } else if (result.stats.totalCampaigns >= 1000) {
        console.log('  📊 改善成功。1,000件以上の案件を取得');
        console.log('  🔍 超効率化手法の基本的な効果を確認');
      } else {
        console.log('  ⚠️  超効率化手法の効果が限定的');
        console.log('  🔍 クエリ戦略の見直しが必要');
      }
      
      // 時間効率の評価
      const processingMinutes = result.stats.scrapingTimeMs / 1000 / 60;
      console.log('\\n⏱️ 時間効率評価:');
      
      if (processingMinutes <= 10) {
        console.log('  🚀 超高速！10分以内での完了を達成');
        console.log('  ⚡ 超効率化処理が完璧に機能');
      } else if (processingMinutes <= 15) {
        console.log('  ✅ 高速！15分以内での完了を達成');
        console.log('  💪 目標時間内で効率的に処理');
      } else if (processingMinutes <= 20) {
        console.log('  📈 良好！20分以内での完了');
        console.log('  🔧 更なる最適化の余地あり');
      } else {
        console.log('  ⚠️ 処理時間が長めです');
        console.log('  🔍 クエリ戦略の最適化を検討');
      }
      
      // 次のステップ
      console.log('\\n🎯 次のステップ:');
      
      if (result.stats.totalCampaigns >= 2000) {
        console.log('  1. ポイ速のサイト (http://localhost:3000) で大量データ検索テスト');
        console.log('  2. 豊富な案件による高品質な検索結果を確認');
        console.log('  3. 他のポイントサイト（ハピタス、ポイントインカム等）の追加');
        console.log('  4. 定期実行システムの本格運用（超効率版）');
        console.log('  5. ランキング機能の充実と精度向上');
        console.log('  6. 商用サーバーデプロイとドメイン設定');
      } else if (result.stats.totalCampaigns >= 1500) {
        console.log('  1. ポイ速のサイト (http://localhost:3000) で検索テスト');
        console.log('  2. 十分な案件数による充実した検索結果を確認');
        console.log('  3. より効率的なクエリ戦略の検討');
        console.log('  4. 他のポイントサイトの段階的追加準備');
      } else {
        console.log('  1. 現在の結果でのポイ速の動作確認');
        console.log('  2. クエリ戦略の拡張検討');
        console.log('  3. より効果的なクエリ組み合わせの研究');
      }
      
      // 超効率化の成功要因
      console.log('\\n🔑 超効率化の成功要因:');
      console.log(`  1. ${result.stats.totalQueries}個の最高効率クエリ戦略`);
      console.log(`  2. 深度ページネーション処理による徹底的データ取得`);
      console.log(`  3. リアルタイム重複除去による高品質データ確保`);
      console.log(`  4. 1.5秒待機による安定高速スクレイピング`);
      console.log(`  5. 超高速バッチ保存による処理時間短縮`);
      console.log(`  6. 優先度順処理による効率的リソース配分`);
      
      // ポイ速の最終状態
      console.log('\\n🏆 ポイ速の最終状態（超効率化後）:');
      console.log(`  総案件データ数: ${result.stats.totalCampaigns.toLocaleString()}件`);
      console.log(`  対応ポイントサイト: モッピー`);
      console.log(`  検索機能: 完全対応（大量データ）`);
      console.log(`  ランキング機能: 対応`);
      console.log(`  レスポンシブデザイン: 対応`);
      console.log(`  データ更新: 超効率的自動システム（${(processingMinutes).toFixed(1)}分）`);
      console.log(`  データ品質: 重複除去済み最高品質`);
      console.log(`  クエリ戦略: ${result.stats.totalQueries}個対応`);
      console.log(`  重複除去率: ${result.performance.deduplicationRate}`);
      
      if (result.stats.totalCampaigns >= 2000) {
        console.log(`  📊 大規模ポイント比較サイトとして完全に機能します！`);
        console.log(`  🚀 超効率化により短時間で大量データ取得を実現！`);
        console.log(`  ⚡ 最高効率クエリ戦略による確実な結果取得システム完成！`);
      } else if (result.stats.totalCampaigns >= 1500) {
        console.log(`  📊 高機能ポイント比較サイトとして機能します！`);
        console.log(`  ⚡ 超効率化により大幅な改善を達成！`);
      }
      
    } else {
      console.log('❌ 超効率的スクレイピング失敗:', result.error);
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
    console.log('  - 超効率化処理により従来より高速で完了します');
  }
}

console.log('='.repeat(90));
console.log('    モッピー超効率的全案件取得システム - 最高効率版');
console.log('    最高効率クエリ + 深度ページネーション + 超高速処理');
console.log('='.repeat(90));

runUltraMoppyScraping();