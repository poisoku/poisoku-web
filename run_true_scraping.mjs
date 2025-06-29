import fetch from 'node-fetch';

async function runTrueScraping() {
  try {
    console.log('🎯 モッピー真の全案件スクレイピング実行開始...');
    console.log('   深層調査結果に基づく最終的な案件取得システム');
    console.log('   目標: 6,067件の案件取得 (現在22件から大幅増加)');
    console.log('   調査で発見された最も効果的なURL・セレクタを使用');
    console.log('');
    
    const startTime = Date.now();
    
    const response = await fetch('http://localhost:3000/api/true-scrape', {
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
      console.log('🎉 真の全案件スクレイピング成功!');
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
      console.log(`  スクレイピング時間: ${(result.stats.scrapingTimeMs / 1000 / 60).toFixed(1)}分`);
      console.log(`  総処理時間: ${(totalTime / 1000 / 60).toFixed(1)}分`);
      
      // パフォーマンス
      console.log('\\n⚡ パフォーマンス:');
      console.log(`  案件取得速度: ${result.performance.campaignsPerSecond}件/秒`);
      console.log(`  URL処理速度: ${result.performance.urlsPerMinute}URL/分`);
      console.log(`  効率性: ${result.performance.efficiency.toFixed(1)}% (調査目標に対して)`);
      
      // データベース保存結果
      console.log('\\n💾 データベース保存結果:');
      console.log(`  新規保存: ${result.database.savedCount.toLocaleString()}件`);
      console.log(`  更新: ${result.database.updatedCount.toLocaleString()}件`);
      console.log(`  保存成功率: ${result.database.successRate}`);
      console.log(`  処理バッチ数: ${result.database.batchesProcessed}バッチ`);
      
      if (result.database.errors.length > 0) {
        console.log(`  ⚠️  データベースエラー: ${result.database.errors.length}件`);
        if (result.database.errors.length <= 3) {
          result.database.errors.forEach((err, index) => {
            console.log(`    ${index + 1}. ${err.substring(0, 100)}...`);
          });
        } else {
          result.database.errors.slice(0, 3).forEach((err, index) => {
            console.log(`    ${index + 1}. ${err.substring(0, 80)}...`);
          });
          console.log(`    ... 他${result.database.errors.length - 3}件`);
        }
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
      
      if (result.stats.totalCampaigns >= 5000) {
        console.log('  🌟 完璧！数千件の案件取得に完全成功');
        console.log('  🎉 ポイ速が真の案件比較サイトとして完成しました');
      } else if (result.stats.totalCampaigns >= 1000) {
        console.log('  ✅ 大成功！千件以上の案件取得を達成');
        console.log('  🚀 ポイ速の価値が大幅に向上しました');
      } else if (result.stats.totalCampaigns >= 500) {
        console.log('  📈 良好！数百件の案件を取得');
        console.log('  💪 更なる最適化で千件突破を目指しましょう');
      } else if (result.stats.totalCampaigns >= 100) {
        console.log('  📊 改善成功。数百件の案件を取得');
        console.log('  🔧 セレクタやURL戦略の更なる改善が必要');
      } else {
        console.log('  ⚠️  更なる改善が必要です');
        console.log('  🔍 モッピーの構造変更の可能性を調査してください');
      }
      
      // 次のステップ
      console.log('\\n🎯 次のステップ:');
      console.log('  1. ポイ速のサイト (http://localhost:3000) で検索テスト');
      console.log('  2. 様々なキーワードで豊富な検索結果を確認');
      console.log('  3. 案件数の大幅増加を体感');
      console.log('  4. 還元率比較機能の充実を確認');
      
      if (result.stats.totalCampaigns >= 1000) {
        console.log('  5. 定期実行システムの構築を検討');
        console.log('  6. 他のポイントサイトの追加を検討');
      }
      
    } else {
      console.log('❌ 真の全案件スクレイピング失敗:', result.error);
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
console.log('    モッピー真の全案件取得システム - 最終決戦');
console.log('='.repeat(90));

runTrueScraping();