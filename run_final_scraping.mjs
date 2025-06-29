import fetch from 'node-fetch';

async function runFinalScraping() {
  try {
    console.log('🎯 モッピー最終版スクレイピング実行開始...');
    console.log('   包括的調査結果に基づく最適化済みスクレイピング');
    console.log('   実証済みURL群とセレクタを使用');
    console.log('   目標: 1,500件以上の案件取得');
    console.log('');
    
    const startTime = Date.now();
    
    const response = await fetch('http://localhost:3000/api/final-scrape', {
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
      console.log('🎉 最終版スクレイピング成功!');
      console.log('='.repeat(80));
      
      // 突破結果
      console.log('🚀 突破結果:');
      console.log(`  ${result.breakthrough.message}`);
      console.log(`  改善前: ${result.breakthrough.previousCount}件`);
      console.log(`  改善後: ${result.breakthrough.currentCount.toLocaleString()}件`);
      console.log(`  改善率: ${result.breakthrough.improvement} 向上`);
      console.log(`  目標達成: ${result.breakthrough.targetReached ? '✅ Yes' : '❌ No'}`);
      
      // 詳細統計
      console.log('\\n📊 詳細統計:');
      console.log(`  総案件数: ${result.stats.totalCampaigns.toLocaleString()}件`);
      console.log(`  処理URL数: ${result.stats.totalUrls}個`);
      console.log(`  処理ページ数: ${result.stats.totalPagesProcessed}ページ`);
      console.log(`  平均案件数/ページ: ${result.stats.averageCampaignsPerPage.toFixed(1)}件`);
      console.log(`  ユニーク案件数: ${result.stats.uniqueCampaigns.toLocaleString()}件`);
      console.log(`  重複除去数: ${result.stats.duplicatesRemoved.toLocaleString()}件`);
      console.log(`  目標達成: ${result.stats.targetAchieved ? 'Yes' : 'No'}`);
      console.log(`  スクレイピング時間: ${(result.stats.scrapingTimeMs / 1000 / 60).toFixed(1)}分`);
      console.log(`  総処理時間: ${(totalTime / 1000 / 60).toFixed(1)}分`);
      
      // パフォーマンス
      console.log('\\n⚡ パフォーマンス:');
      console.log(`  案件取得速度: ${result.performance.campaignsPerSecond}件/秒`);
      console.log(`  URL処理速度: ${result.performance.urlsPerMinute}URL/分`);
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
      
      // デバッグ情報
      console.log('\\n🔍 処理詳細:');
      console.log(`  処理URL数: ${result.debug.urlsProcessed}`);
      
      if (result.debug.effectiveSelectors.length > 0) {
        console.log(`  効果的なセレクタ: ${result.debug.effectiveSelectors.slice(0, 3).join(', ')}`);
      }
      
      if (result.debug.bestUrl) {
        console.log(`  最も効果的なURL: ${result.debug.bestUrl.url}`);
        console.log(`  最大取得数: ${result.debug.bestUrl.count}件`);
      }
      
      // URL別取得数（詳細）
      console.log('\\n📈 URL別取得結果:');
      Object.entries(result.debug.campaignCounts).forEach(([url, count], index) => {
        const shortUrl = url.replace('https://pc.moppy.jp', '');
        console.log(`  ${index + 1}. ${shortUrl}: ${count}件`);
      });
      
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
      
      if (result.stats.totalCampaigns >= 2000) {
        console.log('  🌟 大成功！最終版スクレイピングで2000件以上を達成');
        console.log('  🎉 ポイ速の案件データが大幅に充実しました');
        console.log('  📈 これで検索機能が真価を発揮します');
      } else if (result.stats.totalCampaigns >= 1500) {
        console.log('  ✅ 成功！1500件以上の案件取得を達成');
        console.log('  🚀 ポイ速の価値が大幅に向上しました');
        console.log('  💪 豊富な案件データで比較検討が可能になります');
      } else if (result.stats.totalCampaigns >= 1000) {
        console.log('  📈 良好！1000件以上の案件を取得');
        console.log('  💡 基本的な比較サイトとしての機能は達成');
        console.log('  🔧 更なる最適化で1500件突破を目指しましょう');
      } else if (result.stats.totalCampaigns >= 800) {
        console.log('  📊 改善成功。800件以上の案件を取得');
        console.log('  🔍 想定よりは少ないですが大幅な改善');
      } else {
        console.log('  ⚠️  想定よりも少ない結果となりました');
        console.log('  🔍 技術的な制約や構造的な問題の可能性');
      }
      
      // 重複除去効果の分析
      if (result.stats.duplicatesRemoved > 0) {
        console.log('\\n🔄 重複除去効果:');
        const originalTotal = result.stats.totalCampaigns + result.stats.duplicatesRemoved;
        console.log(`  重複除去前: ${originalTotal.toLocaleString()}件`);
        console.log(`  重複除去後: ${result.stats.totalCampaigns.toLocaleString()}件`);
        console.log(`  除去効率: ${result.performance.deduplicationRate}`);
        console.log(`  データ品質の向上により、検索結果の精度が向上しました`);
      }
      
      // 次のステップ
      console.log('\\n🎯 次のステップ:');
      
      if (result.stats.totalCampaigns >= 1500) {
        console.log('  1. ポイ速のサイト (http://localhost:3000) で検索テスト');
        console.log('  2. 様々なキーワードで豊富な検索結果を確認');
        console.log('  3. 案件数の大幅増加を体感');
        console.log('  4. 他のポイントサイト（ハピタス等）の追加を検討');
        console.log('  5. 定期実行システムの構築');
        console.log('  6. ランキング機能の充実');
      } else if (result.stats.totalCampaigns >= 1000) {
        console.log('  1. ポイ速のサイト (http://localhost:3000) で検索テスト');
        console.log('  2. 基本的な比較機能の確認');
        console.log('  3. ユーザビリティの改善');
        console.log('  4. より多くのURL戦略の検討');
      } else {
        console.log('  1. 現在の結果でのポイ速の動作確認');
        console.log('  2. 技術的制約の再調査');
        console.log('  3. 代替戦略の検討');
      }
      
      // 成功の鍵分析
      console.log('\\n🔑 成功の鍵:');
      console.log(`  1. 包括的調査による実証済みURL群の活用`);
      console.log(`  2. 効果的セレクタ "${result.debug.effectiveSelectors[0] || '[class*="item"]'}" の採用`);
      console.log(`  3. 適切な待機時間（15秒）の設定`);
      console.log(`  4. 重複除去による高品質データの確保`);
      console.log(`  5. 複数URL処理による包括的データ収集`);
      
      // ポイ速の最終状態
      console.log('\\n🏆 ポイ速の最終状態:');
      console.log(`  案件データ数: ${result.stats.totalCampaigns.toLocaleString()}件`);
      console.log(`  対応ポイントサイト: モッピー`);
      console.log(`  検索機能: 完全対応`);
      console.log(`  ランキング機能: 対応`);
      console.log(`  レスポンシブデザイン: 対応`);
      console.log(`  データ更新: 手動実行`);
      
      if (result.stats.totalCampaigns >= 1000) {
        console.log(`  📊 実用的なポイント比較サイトとして機能します！`);
      }
      
    } else {
      console.log('❌ 最終版スクレイピング失敗:', result.error);
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
  }
}

console.log('='.repeat(90));
console.log('    モッピー最終版案件取得システム - 集大成');
console.log('    包括的調査結果に基づく最適化済みスクレイピング');
console.log('='.repeat(90));

runFinalScraping();