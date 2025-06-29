import fetch from 'node-fetch';

async function runEfficientMoppyScraping() {
  try {
    console.log('🎯 モッピー効率的スクレイピング実行開始（タイムアウト回避版）...');
    console.log('   並列処理: 3ワーカー同時実行で3倍高速化');
    console.log('   フェーズ別処理: 高→中→低優先度で効率的実行');
    console.log('   最適化: 5秒待機 + 効率的URL選択');
    console.log('   目標: 6,000件以上の案件取得（20分以内完了）');
    console.log('');
    
    const startTime = Date.now();
    
    const response = await fetch('http://localhost:3000/api/efficient-moppy-scrape', {
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
      console.log('🎉 効率的スクレイピング成功!');
      console.log('='.repeat(80));
      
      // 突破結果
      console.log('🚀 突破結果:');
      console.log(`  ${result.breakthrough.message}`);
      console.log(`  改善前: ${result.breakthrough.previousCount}件`);
      console.log(`  改善後: ${result.breakthrough.currentCount.toLocaleString()}件`);
      console.log(`  改善率: ${result.breakthrough.improvement} 向上`);
      console.log(`  目標6,000件達成: ${result.breakthrough.targetReached ? '✅ Yes' : '❌ No'}`);
      console.log(`  処理時間: ${result.breakthrough.timeEfficiency}`);
      
      // 詳細統計
      console.log('\\n📊 詳細統計:');
      console.log(`  総案件数: ${result.stats.totalCampaigns.toLocaleString()}件`);
      console.log(`  処理URL数: ${result.stats.totalUrls}個`);
      console.log(`  処理ページ数: ${result.stats.totalPagesProcessed}ページ`);
      console.log(`  並列ワーカー数: ${result.stats.parallelWorkers}ワーカー`);
      console.log(`  平均ページ処理時間: ${(result.stats.averagePageTime / 1000).toFixed(1)}秒`);
      console.log(`  重複除去数: ${result.stats.duplicatesRemoved.toLocaleString()}件`);
      console.log(`  目標達成: ${result.stats.targetAchieved ? 'Yes' : 'No'}`);
      console.log(`  スクレイピング時間: ${(result.stats.scrapingTimeMs / 1000 / 60).toFixed(1)}分`);
      console.log(`  総処理時間: ${(totalTime / 1000 / 60).toFixed(1)}分`);
      
      // パフォーマンス分析
      console.log('\\n⚡ パフォーマンス分析:');
      console.log(`  案件取得速度: ${result.performance.campaignsPerSecond}件/秒`);
      console.log(`  ページ処理速度: ${result.performance.pagesPerMinute}ページ/分`);
      console.log(`  効率性: ${result.performance.efficiency.toFixed(1)}% (目標に対して)`);
      console.log(`  並列効果: ${result.performance.parallelEffectiveness} (3ワーカー効果)`);
      console.log(`  時間最適化: ${result.performance.timeOptimization} (待機時間短縮効果)`);
      
      // データベース保存結果
      console.log('\\n💾 データベース保存結果:');
      console.log(`  新規保存: ${result.database.savedCount.toLocaleString()}件`);
      console.log(`  更新: ${result.database.updatedCount.toLocaleString()}件`);
      console.log(`  保存成功率: ${result.database.successRate}`);
      console.log(`  処理バッチ数: ${result.database.batchesProcessed}バッチ (高速処理)`);
      
      if (result.database.errors.length > 0) {
        console.log(`  ⚠️  データベースエラー: ${result.database.errors.length}件`);
        result.database.errors.slice(0, 3).forEach((err, index) => {
          console.log(`    ${index + 1}. ${err.substring(0, 100)}...`);
        });
      } else {
        console.log('  ✅ 全案件が正常にデータベースに保存されました');
      }
      
      // URL別取得結果
      console.log('\\n📈 URL別取得結果（並列処理）:');
      Object.entries(result.debug.urlResults).forEach(([url, count], index) => {
        console.log(`  ${index + 1}. ${url}: ${count}件`);
      });
      
      // 最も効果的なURL
      if (result.debug.bestUrl) {
        console.log('\\n🏆 最も効果的なURL:');
        console.log(`  URL: ${result.debug.bestUrl.url}`);
        console.log(`  取得数: ${result.debug.bestUrl.count}件`);
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
      
      // 効率化効果の分析
      console.log('\\n🔬 効率化効果分析:');
      const estimatedOldTime = result.stats.totalPagesProcessed * 10; // 従来の10秒/ページ
      const actualTime = result.stats.scrapingTimeMs / 1000;
      const speedUp = estimatedOldTime / actualTime;
      
      console.log(`  従来推定時間: ${(estimatedOldTime / 60).toFixed(1)}分`);
      console.log(`  実際処理時間: ${(actualTime / 60).toFixed(1)}分`);
      console.log(`  高速化倍率: ${speedUp.toFixed(1)}倍`);
      console.log(`  並列効果: ${result.stats.parallelWorkers}ワーカーによる並列処理`);
      console.log(`  待機時間最適化: 10秒 → 5秒（50%短縮）`);
      
      // 最終評価
      console.log('\\n🎯 最終評価:');
      
      if (result.stats.totalCampaigns >= 6000) {
        console.log('  🌟 大成功！効率的スクレイピングで6,000件以上を達成');
        console.log('  🎉 並列処理 + 最適化によりタイムアウトを回避');
        console.log('  🏆 ポイ速が真の大規模比較サイトとして完成');
        console.log('  🚀 どこ得に匹敵する大量データを短時間で取得');
      } else if (result.stats.totalCampaigns >= 4000) {
        console.log('  ✅ 成功！4,000件以上の案件取得を達成');
        console.log('  🚀 効率化により大幅な改善を実現');
        console.log('  💪 実用的な大規模ポイント比較サイトとして完成');
        console.log('  ⚡ 並列処理の効果が大きく現れました');
      } else if (result.stats.totalCampaigns >= 2000) {
        console.log('  📈 良好！2,000件以上の案件を取得');
        console.log('  💡 効率化手法の基本的な効果を確認');
        console.log('  🔧 更なる最適化で6,000件を目指しましょう');
      } else if (result.stats.totalCampaigns >= 1000) {
        console.log('  📊 改善成功。1,000件以上の案件を取得');
        console.log('  🔍 効率化の基本的な効果を確認');
      } else {
        console.log('  ⚠️  効率化の効果が限定的');
        console.log('  🔍 更なる戦略の見直しが必要');
      }
      
      // 時間効率の評価
      const processingMinutes = result.stats.scrapingTimeMs / 1000 / 60;
      console.log('\\n⏱️ 時間効率評価:');
      
      if (processingMinutes <= 10) {
        console.log('  🚀 超高速！10分以内での完了を達成');
        console.log('  ⚡ 並列処理 + 最適化が完璧に機能');
      } else if (processingMinutes <= 20) {
        console.log('  ✅ 高速！20分以内での完了を達成');
        console.log('  💪 タイムアウトを回避して効率的に処理');
      } else if (processingMinutes <= 30) {
        console.log('  📈 良好！30分以内での完了');
        console.log('  🔧 更なる最適化の余地あり');
      } else {
        console.log('  ⚠️ 処理時間が長めです');
        console.log('  🔍 並列数やURL戦略の見直しを検討');
      }
      
      // 次のステップ
      console.log('\\n🎯 次のステップ:');
      
      if (result.stats.totalCampaigns >= 4000) {
        console.log('  1. ポイ速のサイト (http://localhost:3000) で大量データ検索テスト');
        console.log('  2. 豊富な案件による高品質な検索結果を確認');
        console.log('  3. 他のポイントサイト（ハピタス、ポイントインカム等）の追加');
        console.log('  4. 定期実行システムの本格運用（効率化版）');
        console.log('  5. ランキング機能の充実と精度向上');
        console.log('  6. 商用サーバーデプロイとドメイン設定');
      } else if (result.stats.totalCampaigns >= 2000) {
        console.log('  1. ポイ速のサイト (http://localhost:3000) で検索テスト');
        console.log('  2. 基本的な大量データ比較機能の確認');
        console.log('  3. より効率的なURL戦略の検討');
        console.log('  4. 並列数の調整検討（4-5ワーカー）');
      } else {
        console.log('  1. 現在の結果でのポイ速の動作確認');
        console.log('  2. 並列処理パラメータの調整');
        console.log('  3. より効果的なURL選択戦略の検討');
      }
      
      // 効率化の成功要因
      console.log('\\n🔑 効率化の成功要因:');
      console.log(`  1. ${result.stats.parallelWorkers}ワーカー並列処理による高速化`);
      console.log(`  2. フェーズ別処理による効率的リソース配分`);
      console.log(`  3. 待機時間最適化（10秒→5秒）`);
      console.log(`  4. 効率的URL選択による無駄な処理の削減`);
      console.log(`  5. リアルタイム重複除去によるメモリ効率向上`);
      console.log(`  6. 高速バッチ保存による処理時間短縮`);
      
      // ポイ速の最終状態
      console.log('\\n🏆 ポイ速の最終状態（効率化後）:');
      console.log(`  総案件データ数: ${result.stats.totalCampaigns.toLocaleString()}件`);
      console.log(`  対応ポイントサイト: モッピー`);
      console.log(`  検索機能: 完全対応（大量データ）`);
      console.log(`  ランキング機能: 対応`);
      console.log(`  レスポンシブデザイン: 対応`);
      console.log(`  データ更新: 高速自動システム（${(processingMinutes).toFixed(1)}分）`);
      console.log(`  データ品質: 重複除去済み最高品質`);
      console.log(`  並列処理: ${result.stats.parallelWorkers}ワーカー対応`);
      
      if (result.stats.totalCampaigns >= 4000) {
        console.log(`  📊 大規模ポイント比較サイトとして完全に機能します！`);
        console.log(`  🚀 どこ得に匹敵する高性能システムを実現！`);
        console.log(`  ⚡ 効率的な並列処理により短時間で大量データ取得成功！`);
      } else if (result.stats.totalCampaigns >= 2000) {
        console.log(`  📊 高機能ポイント比較サイトとして機能します！`);
        console.log(`  ⚡ 効率化により大幅な改善を達成！`);
      }
      
    } else {
      console.log('❌ 効率的スクレイピング失敗:', result.error);
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
    console.log('  - システムリソースは十分ですか？（並列処理のため）');
    console.log('  - 並列処理により従来より高速で完了します');
  }
}

console.log('='.repeat(90));
console.log('    モッピー効率的案件取得システム - タイムアウト回避版');
console.log('    並列処理 + フェーズ別実行 + 最適化により6,000件への挑戦');
console.log('='.repeat(90));

runEfficientMoppyScraping();