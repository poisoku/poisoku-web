import fetch from 'node-fetch';

async function investigateMoppy() {
  try {
    console.log('🔍 モッピーサイト構造調査開始...');
    console.log('   サイトの全体構造を分析し、数千の案件を取得する方法を発見します。');
    console.log('');
    
    const startTime = Date.now();
    
    const response = await fetch('http://localhost:3000/api/investigate-site', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer poisoku-scraping-secret-2024'
      },
      body: JSON.stringify({
        site: 'モッピー',
        deepAnalysis: true
      })
    });

    const result = await response.json();
    const totalTime = Date.now() - startTime;
    
    if (result.success) {
      console.log('✅ モッピーサイト構造調査成功!');
      console.log('='.repeat(60));
      
      // 基本統計
      console.log('📊 調査結果サマリー:');
      console.log(`  推定総案件数: ${result.summary.estimatedCampaigns.toLocaleString()}件`);
      console.log(`  発見カテゴリ数: ${result.summary.categoriesFound}個`);
      console.log(`  推定総ページ数: ${result.summary.pagesEstimated}ページ`);
      console.log(`  調査時間: ${(totalTime / 1000).toFixed(1)}秒`);
      
      // ナビゲーション構造
      console.log('\\n🧭 ナビゲーション構造:');
      const nav = result.analysis.navigationStructure;
      console.log(`  メインカテゴリ: ${nav.mainCategories.length}個`);
      if (nav.mainCategories.length > 0) {
        console.log('    カテゴリ例:');
        nav.mainCategories.slice(0, 5).forEach((cat, index) => {
          console.log(`      ${index + 1}. ${cat}`);
        });
      }
      
      console.log(`\\n  ページネーション情報:`);
      console.log(`    最大ページ数: ${nav.paginationInfo.maxPageFound}`);
      console.log(`    1ページ当たり案件数: ${nav.paginationInfo.itemsPerPage}件`);
      console.log(`    ページネーションパターン: ${nav.paginationInfo.paginationPattern || 'なし'}`);
      
      // 案件構造
      console.log('\\n📦 案件構造分析:');
      const campaign = result.analysis.campaignStructure;
      console.log(`  発見されたリストセレクタ: ${campaign.listSelectors.length}個`);
      if (campaign.listSelectors.length > 0) {
        console.log('    セレクタ例:');
        campaign.listSelectors.slice(0, 3).forEach((selector, index) => {
          console.log(`      ${index + 1}. ${selector}`);
        });
      }
      
      console.log(`\\n  発見されたアイテムセレクタ: ${campaign.itemSelectors.length}個`);
      if (campaign.itemSelectors.length > 0) {
        console.log('    セレクタ例:');
        campaign.itemSelectors.slice(0, 3).forEach((selector, index) => {
          console.log(`      ${index + 1}. ${selector}`);
        });
      }
      
      // URL パターン
      console.log('\\n🔗 URL パターン:');
      const urls = result.analysis.urlPatterns;
      console.log(`  カテゴリURL: ${urls.categoryUrls.length}個`);
      if (urls.categoryUrls.length > 0) {
        console.log('    URL例:');
        urls.categoryUrls.slice(0, 5).forEach((url, index) => {
          console.log(`      ${index + 1}. ${url}`);
        });
      }
      
      console.log(`\\n  ページネーションURL: ${urls.paginationUrls.length}個`);
      if (urls.paginationUrls.length > 0) {
        console.log('    URL例:');
        urls.paginationUrls.slice(0, 3).forEach((url, index) => {
          console.log(`      ${index + 1}. ${url}`);
        });
      }
      
      // 問題点と推奨事項
      console.log('\\n⚠️  現在の問題点:');
      if (result.analysis.recommendations.length > 0) {
        result.analysis.recommendations.forEach((rec, index) => {
          console.log(`  ${index + 1}. ${rec}`);
        });
      } else {
        console.log('  特に問題は見つかりませんでした。');
      }
      
      // 次のアクション
      console.log('\\n🎯 推奨される次のアクション:');
      if (result.summary.nextActions.length > 0) {
        result.summary.nextActions.forEach((action, index) => {
          console.log(`  ${index + 1}. ${action}`);
        });
      }
      
      // 改善提案
      console.log('\\n💡 スクレイピング改善提案:');
      
      if (result.summary.estimatedCampaigns > 1000) {
        console.log('  ✅ 大量の案件が存在することを確認しました');
        console.log('     → 現在のスクレイピングでは取得できていない案件が大量にあります');
      }
      
      if (nav.paginationInfo.maxPageFound > 2) {
        console.log(`  ✅ ページネーション対応が必要です (最大${nav.paginationInfo.maxPageFound}ページ)`);
        console.log('     → 現在は1-2ページしか処理していないため、大量の案件を見逃しています');
      }
      
      if (campaign.itemSelectors.length > 1) {
        console.log(`  ✅ 複数のセレクタパターンが発見されました (${campaign.itemSelectors.length}種類)`);
        console.log('     → より包括的なセレクタを使用することで取得率を向上できます');
      }
      
      console.log('\\n🚀 次のステップ:');
      console.log('  1. 調査結果を基にスクレイピングシステムを改修');
      console.log('  2. 全カテゴリ・全ページ対応のスクレイピング実装');
      console.log('  3. 改修後の全案件取得テスト実行');
      console.log('  4. 数千件の案件データがデータベースに登録されることを確認');
      
    } else {
      console.log('❌ サイト構造調査失敗:', result.error);
    }
    
  } catch (error) {
    console.error('❌ 調査実行エラー:', error.message);
    console.log('\\n💡 確認事項:');
    console.log('  - npm run dev が起動していますか？');
    console.log('  - インターネット接続は正常ですか？');
  }
}

console.log('='.repeat(70));
console.log('    モッピーサイト構造調査 - 全案件取得への道');
console.log('='.repeat(70));

investigateMoppy();