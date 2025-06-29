import fetch from 'node-fetch';

async function runEfficientScraping() {
  try {
    console.log('🎯 モッピー効率的スクレイピング実行開始...');
    console.log('   最も効果的なページを重点的に処理');
    console.log('   目標: 1,000件以上の案件取得 (現在233件から大幅増加)');
    console.log('   処理時間を短縮し、確実に結果を出すアプローチ');
    console.log('');
    
    const startTime = Date.now();
    
    const response = await fetch('http://localhost:3000/api/efficient-scrape', {
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
      console.log(`  目標達成: ${result.breakthrough.targetReached ? '✅ Yes' : '❌ No'}`);
      
      // 詳細統計
      console.log('\\n📊 詳細統計:');
      console.log(`  総案件数: ${result.stats.totalCampaigns.toLocaleString()}件`);
      console.log(`  処理URL数: ${result.stats.totalUrls}個`);
      console.log(`  処理ページ数: ${result.stats.totalPagesProcessed}ページ`);
      console.log(`  平均案件数/ページ: ${result.stats.averageCampaignsPerPage.toFixed(1)}件`);
      console.log(`  目標達成: ${result.stats.targetAchieved ? 'Yes' : 'No'}`);
      console.log(`  スクレイピング時間: ${(result.stats.scrapingTimeMs / 1000).toFixed(1)}秒`);
      console.log(`  総処理時間: ${(totalTime / 1000).toFixed(1)}秒`);
      
      // パフォーマンス
      console.log('\\n⚡ パフォーマンス:');
      console.log(`  案件取得速度: ${result.performance.campaignsPerSecond}件/秒`);
      console.log(`  URL処理速度: ${result.performance.urlsPerMinute}URL/分`);
      console.log(`  効率性: ${result.performance.efficiency.toFixed(1)}% (目標に対して)`);
      
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
      
      // URL別取得数
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
      
      if (result.stats.totalCampaigns >= 1500) {
        console.log('  🌟 大成功！効率的スクレイピングで1500件以上を達成');
        console.log('  🎉 ポイ速の案件データが大幅に充実しました');
      } else if (result.stats.totalCampaigns >= 1000) {
        console.log('  ✅ 成功！1000件以上の案件取得を達成');
        console.log('  🚀 ポイ速の価値が大幅に向上しました');
      } else if (result.stats.totalCampaigns >= 500) {
        console.log('  📈 良好！500件以上の案件を取得');
        console.log('  💪 更なる最適化で1000件突破を目指しましょう');
      } else {
        console.log('  📊 改善成功。数百件の案件を取得');
        console.log('  🔧 セレクタやURL戦略の更なる改善が必要');
      }
      
      // 次のステップ
      console.log('\\n🎯 次のステップ:');
      console.log('  1. ポイ速のサイト (http://localhost:3000) で検索テスト');
      console.log('  2. 様々なキーワードで豊富な検索結果を確認');
      console.log('  3. 案件数の大幅増加を体感');
      console.log('  4. 還元率比較機能の充実を確認');
      
      if (result.stats.totalCampaigns >= 1000) {
        console.log('  5. 他のポイントサイトの追加を検討');
        console.log('  6. 定期実行システムの構築を検討');
      } else {
        console.log('  5. さらなるURL・セレクタの最適化');
        console.log('  6. ページネーションの活用検討');
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
    console.log('  - サーバーリソースは十分ですか？');
  }
}

console.log('='.repeat(90));
console.log('    モッピー効率的案件取得システム - 1,000件への挑戦');
console.log('='.repeat(90));

runEfficientScraping();