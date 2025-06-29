// リアルスクレイピングのテストスクリプト
import fetch from 'node-fetch';

async function testRealScraping() {
  try {
    console.log('🚀 リアルスクレイピングテスト開始...');
    
    const testKeywords = ['Yahoo', 'Amazon', '楽天'];
    
    for (const keyword of testKeywords) {
      console.log(`\n=== ${keyword} をテスト中 ===`);
      
      const response = await fetch('http://localhost:3001/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer poisoku-scraping-secret-2024'
        },
        body: JSON.stringify({
          keyword: keyword,
          sites: ['ハピタス', 'モッピー']
        })
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ スクレイピング成功!');
        console.log(`総案件数: ${result.totalCampaigns}`);
        console.log(`処理時間: ${result.processingTimeMs}ms`);
        
        // サイト別結果
        result.sites.forEach(site => {
          console.log(`\n📊 ${site.siteName}:`);
          console.log(`  成功: ${site.success ? 'Yes' : 'No'}`);
          console.log(`  案件数: ${site.campaignsFound}`);
          console.log(`  ページタイトル: ${site.debug.pageTitle}`);
          console.log(`  最終URL: ${site.debug.finalUrl}`);
          console.log(`  要素数: ${site.debug.foundElements}`);
          
          if (site.errors.length > 0) {
            console.log(`  エラー: ${site.errors.join(', ')}`);
          }
          
          if (site.debug.htmlSnippet) {
            console.log(`  HTML片: ${site.debug.htmlSnippet.substring(0, 100)}...`);
          }
        });

        // 取得できた案件サンプル
        if (result.campaigns && result.campaigns.length > 0) {
          console.log('\n📋 取得できた案件（最初の3件）:');
          result.campaigns.slice(0, 3).forEach((campaign, index) => {
            console.log(`  ${index + 1}. ${campaign.name} - ${campaign.cashbackRate} (${campaign.pointSiteName})`);
          });
        }

        // 推奨事項
        if (result.recommendations) {
          console.log('\n💡 推奨事項:');
          console.log(`  成功サイト: ${result.recommendations.successfulSites}/${result.recommendations.totalSitesScraped}`);
          console.log(`  データのあるサイト: ${result.recommendations.sitesWithData.join(', ')}`);
          
          if (result.recommendations.nextSteps.length > 0) {
            console.log('  次のステップ:');
            result.recommendations.nextSteps.forEach(step => {
              console.log(`    - ${step}`);
            });
          }
        }

        // データベース保存結果
        if (result.database) {
          console.log('\n💾 データベース保存:');
          console.log(`  新規保存: ${result.database.savedCount}件`);
          console.log(`  更新: ${result.database.updatedCount}件`);
          if (result.database.errors.length > 0) {
            console.log(`  エラー: ${result.database.errors.length}件`);
          }
        }

      } else {
        console.log('❌ スクレイピング失敗:', result.error);
      }
      
      // キーワード間の間隔
      if (testKeywords.indexOf(keyword) < testKeywords.length - 1) {
        console.log('\n⏳ 次のテストまで待機中...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    console.log('\n🎯 全テスト完了!');

  } catch (error) {
    console.error('❌ テスト実行エラー:', error.message);
  }
}

// 統計も取得してみる
async function testStats() {
  try {
    console.log('\n📈 統計情報を取得中...');
    
    const response = await fetch('http://localhost:3001/api/scrape?days=1');
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ 統計取得成功:');
      console.log(`  総スクレイピング: ${data.stats.totalScrapings}回`);
      console.log(`  成功: ${data.stats.successfulScrapings}回`);
      console.log(`  総案件: ${data.stats.totalCampaigns}件`);
      console.log(`  平均案件数: ${data.stats.averageCampaignsPerScraping.toFixed(1)}件/回`);
      
      if (data.stats.sitesStats.length > 0) {
        console.log('\n📊 サイト別統計:');
        data.stats.sitesStats.forEach(site => {
          console.log(`  ${site.siteName}: ${site.campaigns}件 (成功率: ${site.successRate.toFixed(1)}%)`);
        });
      }
    } else {
      console.log('❌ 統計取得失敗:', data.error);
    }
  } catch (error) {
    console.error('❌ 統計取得エラー:', error.message);
  }
}

// メイン実行
testRealScraping().then(() => {
  return testStats();
}).then(() => {
  console.log('\n✨ すべてのテストが完了しました！');
}).catch(error => {
  console.error('❌ メインテストエラー:', error);
});