import fetch from 'node-fetch';

async function runAdvancedScraping() {
  try {
    console.log('🎯 モッピー高度スクレイピング実行開始...');
    console.log('   無限スクロール対応');
    console.log('   手動ページネーション');
    console.log('   複数読み込み戦略');
    console.log('   目標: 1,000件以上の案件取得 (最終的に6,067件を目指す)');
    console.log('');
    
    const startTime = Date.now();
    
    const response = await fetch('http://localhost:3000/api/advanced-scrape', {
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
      console.log('🎉 高度スクレイピング成功!');
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
      
      // 高度処理機能の分析
      console.log('\\n🔧 高度処理機能:');
      console.log(`  無限スクロール試行: ${result.stats.infiniteScrollAttempts}回`);
      console.log(`  無限スクロール成功: ${result.stats.successfulScrolls}回`);
      console.log(`  手動ページネーション試行: ${result.stats.manualPaginationAttempts}回`);
      console.log(`  手動ページネーション成功: ${result.stats.successfulPageNavigations}回`);
      
      // パフォーマンス
      console.log('\\n⚡ パフォーマンス:');
      console.log(`  案件取得速度: ${result.performance.campaignsPerSecond}件/秒`);
      console.log(`  URL処理速度: ${result.performance.urlsPerMinute}URL/分`);
      console.log(`  効率性: ${result.performance.efficiency.toFixed(1)}% (目標に対して)`);
      console.log(`  スクロール成功率: ${result.performance.scrollSuccessRate}`);
      console.log(`  ページネーション成功率: ${result.performance.paginationSuccessRate}`);
      
      // スクロール詳細分析
      console.log('\\n🔄 スクロール詳細分析:');
      Object.entries(result.debug.scrollingData || {}).forEach(([url, scrollInfo]) => {
        const shortUrl = url.replace('https://pc.moppy.jp', '');
        console.log(`  ${shortUrl}:`);
        console.log(`    スクロール試行: ${scrollInfo.attempts || 0}回`);
        console.log(`    スクロール成功: ${scrollInfo.successful || 0}回`);
        if (scrollInfo.elementsFound && scrollInfo.elementsFound.length > 0) {
          const firstCount = scrollInfo.elementsFound[0];
          const lastCount = scrollInfo.elementsFound[scrollInfo.elementsFound.length - 1];
          console.log(`    要素増加: ${firstCount} → ${lastCount}要素`);
        }
      });
      
      // ページネーション詳細分析
      console.log('\\n📄 ページネーション詳細分析:');
      Object.entries(result.debug.paginationAttempts || {}).forEach(([url, paginationInfo]) => {
        const shortUrl = url.replace('https://pc.moppy.jp', '');
        console.log(`  ${shortUrl}:`);
        console.log(`    ページ移動試行: ${paginationInfo.total || 0}回`);
        console.log(`    ページ移動成功: ${paginationInfo.successful || 0}回`);
        if (paginationInfo.pages && paginationInfo.pages.length > 0) {
          console.log(`    処理成功ページ: ${paginationInfo.pages.join(', ')}`);
        }
      });
      
      // 読み込み戦略分析
      console.log('\\n🎯 読み込み戦略分析:');
      Object.entries(result.debug.loadingStrategies || {}).forEach(([url, strategy]) => {
        const shortUrl = url.replace('https://pc.moppy.jp', '');
        console.log(`  ${shortUrl}: ${strategy}`);
      });
      
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
      
      if (result.stats.totalCampaigns >= 3000) {
        console.log('  🌟 大成功！高度スクレイピングで3000件以上を達成');
        console.log('  🎉 無限スクロールと手動ページネーションが完璧に機能しました');
      } else if (result.stats.totalCampaigns >= 2000) {
        console.log('  ✅ 成功！2000件以上の案件取得を達成');
        console.log('  🚀 高度スクレイピング手法が大幅な改善をもたらしました');
      } else if (result.stats.totalCampaigns >= 1500) {
        console.log('  📈 良好！1500件以上の案件を取得');
        console.log('  💪 高度処理の効果が確認できました');
      } else if (result.stats.totalCampaigns >= 1000) {
        console.log('  📊 改善成功。1000件以上の案件を取得');
        console.log('  🔧 更なる高度処理の最適化で目標達成を目指しましょう');
      } else {
        console.log('  ⚠️  高度スクレイピング手法の効果が限定的');
        console.log('  🔍 根本的なアプローチの見直しが必要な可能性があります');
      }
      
      // 次のステップ
      console.log('\\n🎯 次のステップ:');
      
      if (result.stats.totalCampaigns >= 1000) {
        console.log('  1. ポイ速のサイト (http://localhost:3000) で検索テスト');
        console.log('  2. 様々なキーワードで豊富な検索結果を確認');
        console.log('  3. 案件数の大幅増加を体感');
        console.log('  4. 他のポイントサイトの追加を検討');
      } else {
        console.log('  1. より多くのURLパターンの探索');
        console.log('  2. 別のスクレイピング手法の検討');
        console.log('  3. サイト構造の再調査');
        console.log('  4. APIエンドポイントの探索検討');
      }
      
      // 高度処理効果分析
      console.log('\\n🔬 高度処理効果分析:');
      const scrollSuccessRate = result.stats.infiniteScrollAttempts > 0 ? 
        (result.stats.successfulScrolls / result.stats.infiniteScrollAttempts * 100).toFixed(1) : 0;
      const paginationSuccessRate = result.stats.manualPaginationAttempts > 0 ? 
        (result.stats.successfulPageNavigations / result.stats.manualPaginationAttempts * 100).toFixed(1) : 0;
      
      console.log(`  無限スクロール効果: ${scrollSuccessRate}% 成功率`);
      console.log(`  手動ページネーション効果: ${paginationSuccessRate}% 成功率`);
      
      if (result.stats.successfulScrolls > 0) {
        console.log(`  スクロールによる要素増加: 平均${(result.stats.totalCampaigns / Math.max(result.stats.successfulScrolls, 1)).toFixed(1)}件/スクロール`);
      }
      
      if (result.stats.successfulPageNavigations > 0) {
        console.log(`  ページネーションによる取得増加: 平均${(result.stats.totalCampaigns / Math.max(result.stats.successfulPageNavigations, 1)).toFixed(1)}件/ページ`);
      }
      
      if (result.debug.bestUrl) {
        console.log(`  最も効果的な設定:`);
        console.log(`    URL: ${result.debug.bestUrl.url}`);
        console.log(`    取得数: ${result.debug.bestUrl.count}件`);
        console.log(`    戦略: ${result.debug.loadingStrategies[result.debug.bestUrl.url] || '不明'}`);
      }
      
    } else {
      console.log('❌ 高度スクレイピング失敗:', result.error);
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
    console.log('  - 十分な処理時間を確保していますか？');
    console.log('  - システムリソースは十分ですか？');
  }
}

console.log('='.repeat(90));
console.log('    モッピー高度案件取得システム - Solution 3');
console.log('    無限スクロール ＋ 手動ページネーション ＋ 複数読み込み戦略');
console.log('='.repeat(90));

runAdvancedScraping();