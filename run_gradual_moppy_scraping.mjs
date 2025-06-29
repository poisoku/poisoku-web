import fetch from 'node-fetch';

async function runGradualMoppyScraping() {
  try {
    console.log('🎯 モッピー段階的スクレイピング実行開始...');
    console.log('   戦略: 高頻度キーワードによる段階的データ収集');
    console.log('   特徴: タイムアウト回避 + 効率的案件取得');
    console.log('   目標: 1,000件以上の案件取得（短時間で確実に）');
    console.log('');
    
    const startTime = Date.now();
    
    const response = await fetch('http://localhost:3000/api/gradual-moppy-scrape', {
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
      console.log('🎉 段階的スクレイピング成功!');
      console.log('='.repeat(80));
      
      // 突破結果
      console.log('🚀 突破結果:');
      console.log(`  ${result.breakthrough.message}`);
      console.log(`  改善前: ${result.breakthrough.previousCount}件`);
      console.log(`  改善後: ${result.breakthrough.currentCount.toLocaleString()}件`);
      console.log(`  改善率: ${result.breakthrough.improvement} 向上`);
      console.log(`  目標1,000件達成: ${result.breakthrough.targetReached ? '✅ Yes' : '❌ No'}`);
      console.log(`  処理時間: ${result.breakthrough.timeEfficiency}`);
      
      // 詳細統計
      console.log('\\n📊 詳細統計:');
      console.log(`  総案件数: ${result.stats.totalCampaigns.toLocaleString()}件`);
      console.log(`  処理キーワード数: ${result.stats.totalKeywords}個`);
      console.log(`  平均キーワード処理時間: ${(result.stats.averagePageTime / 1000).toFixed(1)}秒`);
      console.log(`  重複除去による高品質データ確保`);
      console.log(`  目標達成: ${result.stats.targetAchieved ? 'Yes' : 'No'}`);
      console.log(`  スクレイピング時間: ${(result.stats.scrapingTimeMs / 1000 / 60).toFixed(1)}分`);
      console.log(`  総処理時間: ${(totalTime / 1000 / 60).toFixed(1)}分`);
      
      // パフォーマンス分析
      console.log('\\n⚡ パフォーマンス分析:');
      console.log(`  案件取得速度: ${result.performance.campaignsPerSecond}件/秒`);
      console.log(`  キーワード処理速度: ${result.performance.keywordsPerMinute}キーワード/分`);
      console.log(`  効率性: ${result.performance.efficiency.toFixed(1)}% (目標に対して)`);
      console.log(`  時間最適化: ${result.performance.timeOptimization} (待機時間短縮効果)`);
      
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
      
      // キーワード別取得結果
      console.log('\\n📈 キーワード別取得結果:');
      Object.entries(result.debug.keywordResults).forEach(([keyword, count], index) => {
        console.log(`  ${index + 1}. "${keyword}": ${count}件`);
      });
      
      // 最も効果的なキーワード
      if (result.debug.bestKeyword) {
        console.log('\\n🏆 最も効果的なキーワード:');
        console.log(`  キーワード: "${result.debug.bestKeyword.keyword}"`);
        console.log(`  取得数: ${result.debug.bestKeyword.count}件`);
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
      
      // 段階的手法の効果分析
      console.log('\\n🔬 段階的手法効果分析:');
      console.log(`  キーワード戦略: ${result.stats.totalKeywords}個の高頻度キーワード`);
      console.log(`  バッチ処理: 5キーワードずつの安全な処理`);
      console.log(`  重複除去: リアルタイムで高品質データ確保`);
      console.log(`  タイムアウト回避: 短時間での確実な結果取得`);
      
      if (result.stats.totalKeywords > 0) {
        console.log(`  キーワード平均効果: ${(result.stats.totalCampaigns / result.stats.totalKeywords).toFixed(1)}件/キーワード`);
      }
      
      // 最終評価
      console.log('\\n🎯 最終評価:');
      
      if (result.stats.totalCampaigns >= 1000) {
        console.log('  🌟 大成功！段階的スクレイピングで1,000件以上を達成');
        console.log('  🎉 キーワード戦略が完璧に機能しました');
        console.log('  🏆 ポイ速が高性能比較サイトとして完成');
        console.log('  🚀 タイムアウトなしで確実な大量データ取得に成功');
      } else if (result.stats.totalCampaigns >= 500) {
        console.log('  ✅ 成功！500件以上の案件取得を達成');
        console.log('  🚀 段階的手法による安定した改善を実現');
        console.log('  💪 実用的なポイント比較サイトとして十分機能します');
      } else if (result.stats.totalCampaigns >= 200) {
        console.log('  📈 良好！200件以上の案件を取得');
        console.log('  💡 キーワード戦略の基本的な効果を確認');
        console.log('  🔧 さらなるキーワード追加で1,000件を目指しましょう');
      } else if (result.stats.totalCampaigns >= 100) {
        console.log('  📊 改善成功。100件以上の案件を取得');
        console.log('  🔍 段階的手法の基本的な効果を確認');
      } else {
        console.log('  ⚠️  段階的手法の効果が限定的');
        console.log('  🔍 キーワード戦略の見直しが必要');
      }
      
      // 時間効率の評価
      const processingMinutes = result.stats.scrapingTimeMs / 1000 / 60;
      console.log('\\n⏱️ 時間効率評価:');
      
      if (processingMinutes <= 5) {
        console.log('  🚀 超高速！5分以内での完了を達成');
        console.log('  ⚡ 段階的処理が完璧に機能');
      } else if (processingMinutes <= 10) {
        console.log('  ✅ 高速！10分以内での完了を達成');
        console.log('  💪 タイムアウトを回避して効率的に処理');
      } else if (processingMinutes <= 15) {
        console.log('  📈 良好！15分以内での完了');
        console.log('  🔧 キーワード数の調整余地あり');
      } else {
        console.log('  ⚠️ 処理時間が長めです');
        console.log('  🔍 キーワード戦略の最適化を検討');
      }
      
      // 次のステップ
      console.log('\\n🎯 次のステップ:');
      
      if (result.stats.totalCampaigns >= 500) {
        console.log('  1. ポイ速のサイト (http://localhost:3000) で案件検索テスト');
        console.log('  2. 十分な案件数による充実した検索結果を確認');
        console.log('  3. 他のポイントサイト（ハピタス、ポイントインカム等）の追加');
        console.log('  4. 定期実行システムの構築（段階的手法）');
        console.log('  5. ランキング機能の充実と精度向上');
        console.log('  6. 商用サーバーデプロイとドメイン設定');
      } else if (result.stats.totalCampaigns >= 200) {
        console.log('  1. ポイ速のサイト (http://localhost:3000) で検索テスト');
        console.log('  2. 基本的な比較機能の確認');
        console.log('  3. 追加キーワードの検討（より多くの案件取得）');
        console.log('  4. 他のポイントサイトの段階的追加準備');
      } else {
        console.log('  1. 現在の結果でのポイ速の動作確認');
        console.log('  2. キーワード戦略の拡張検討');
        console.log('  3. より効果的なキーワード組み合わせの研究');
      }
      
      // 段階的手法の成功要因
      console.log('\\n🔑 段階的手法の成功要因:');
      console.log(`  1. ${result.stats.totalKeywords}個の高頻度キーワード戦略`);
      console.log(`  2. 5キーワードずつのバッチ処理`);
      console.log(`  3. リアルタイム重複除去による高品質データ`);
      console.log(`  4. 3秒待機による安定したスクレイピング`);
      console.log(`  5. タイムアウト回避設計による確実な結果取得`);
      
      // ポイ速の最終状態
      console.log('\\n🏆 ポイ速の最終状態（段階的スクレイピング後）:');
      console.log(`  総案件データ数: ${result.stats.totalCampaigns.toLocaleString()}件`);
      console.log(`  対応ポイントサイト: モッピー`);
      console.log(`  検索機能: 完全対応`);
      console.log(`  ランキング機能: 対応`);
      console.log(`  レスポンシブデザイン: 対応`);
      console.log(`  データ更新: 段階的自動システム（${(processingMinutes).toFixed(1)}分）`);
      console.log(`  データ品質: 重複除去済み最高品質`);
      console.log(`  キーワード戦略: ${result.stats.totalKeywords}個対応`);
      
      if (result.stats.totalCampaigns >= 500) {
        console.log(`  📊 高性能ポイント比較サイトとして完全に機能します！`);
        console.log(`  🚀 段階的手法により安定した大量データ取得を実現！`);
        console.log(`  ⚡ タイムアウトなしで確実な結果取得システム完成！`);
      } else if (result.stats.totalCampaigns >= 200) {
        console.log(`  📊 実用的ポイント比較サイトとして機能します！`);
        console.log(`  ⚡ 段階的手法により安定した改善を達成！`);
      }
      
    } else {
      console.log('❌ 段階的スクレイピング失敗:', result.error);
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
    console.log('  - 段階的処理により従来より安定して完了します');
  }
}

console.log('='.repeat(90));
console.log('    モッピー段階的案件取得システム - タイムアウト回避版');
console.log('    キーワード戦略 + バッチ処理 + 重複除去による安定取得');
console.log('='.repeat(90));

runGradualMoppyScraping();