import fetch from 'node-fetch';

async function runComprehensiveInvestigation() {
  try {
    console.log('🔍 モッピー包括的構造調査実行開始...');
    console.log('   実際のブラウザとスクレイピング結果の差異を詳細分析');
    console.log('   ヘッドレスブラウザを使用して実際の表示内容を確認');
    console.log('   目標: 6,067件との差異原因を特定');
    console.log('');
    
    const startTime = Date.now();
    
    const response = await fetch('http://localhost:3000/api/comprehensive-investigation', {
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
      console.log('🎉 包括的構造調査成功!');
      console.log('='.repeat(80));
      
      // 調査概要
      console.log('🔍 調査概要:');
      console.log(`  調査URL数: ${result.investigation.totalSitesAnalyzed}サイト`);
      console.log(`  実ブラウザ総要素数: ${result.investigation.realBrowserCount.toLocaleString()}要素`);
      console.log(`  スクレイピング総要素数: ${result.investigation.scrapingCount.toLocaleString()}要素`);
      console.log(`  差異: ${result.investigation.difference.toLocaleString()}要素`);
      console.log(`  乖離率: ${result.investigation.discrepancyPercentage}`);
      
      // URL別詳細分析
      console.log('\\n📊 URL別詳細分析:');
      result.analysisResults.forEach((analysis, index) => {
        console.log(`\\n  ${index + 1}. ${analysis.description}`);
        console.log(`     URL: ${analysis.url}`);
        console.log(`     実ブラウザ: ${analysis.browserElementCount.toLocaleString()}要素`);
        console.log(`     スクレイピング: ${analysis.scrapingElementCount.toLocaleString()}要素`);
        console.log(`     差異: ${analysis.difference.toLocaleString()}要素`);
        
        if (analysis.effectiveSelectors.length > 0) {
          console.log(`     効果的セレクタ: ${analysis.effectiveSelectors.slice(0, 3).join(', ')}`);
        }
        
        if (analysis.analysisNotes.length > 0) {
          console.log(`     分析メモ:`);
          analysis.analysisNotes.forEach(note => {
            console.log(`       - ${note}`);
          });
        }
      });
      
      // 原因分析
      console.log('\\n🔬 原因分析:');
      if (result.insights.possibleCauses.length > 0) {
        console.log('  考えられる原因:');
        result.insights.possibleCauses.forEach((cause, index) => {
          console.log(`    ${index + 1}. ${cause}`);
        });
      } else {
        console.log('  明確な原因は特定されませんでした');
      }
      
      // 推奨事項
      console.log('\\n💡 推奨事項:');
      if (result.insights.recommendations.length > 0) {
        result.insights.recommendations.forEach((recommendation, index) => {
          console.log(`  ${index + 1}. ${recommendation}`);
        });
      } else {
        console.log('  追加の推奨事項はありません');
      }
      
      // パフォーマンス情報
      console.log('\\n⚡ パフォーマンス:');
      console.log(`  総処理時間: ${(result.performance.processingTimeMs / 1000 / 60).toFixed(1)}分`);
      console.log(`  URL当たり平均処理時間: ${result.performance.averageTimePerUrl}`);
      
      // 最大差異URL特定
      let maxDifferenceUrl = null;
      let maxDifference = 0;
      result.analysisResults.forEach(analysis => {
        if (analysis.difference > maxDifference) {
          maxDifference = analysis.difference;
          maxDifferenceUrl = analysis;
        }
      });
      
      if (maxDifferenceUrl) {
        console.log('\\n🎯 最大差異URL:');
        console.log(`  URL: ${maxDifferenceUrl.url}`);
        console.log(`  説明: ${maxDifferenceUrl.description}`);
        console.log(`  差異: ${maxDifferenceUrl.difference.toLocaleString()}要素`);
        console.log(`  このURLが最も大きな差異を示しており、問題の核心である可能性があります`);
      }
      
      // 総合評価と次のステップ
      console.log('\\n🎯 総合評価:');
      
      const overallDiscrepancy = parseFloat(result.investigation.discrepancyPercentage);
      
      if (overallDiscrepancy > 80) {
        console.log('  🚨 重大な乖離が発見されました');
        console.log('  実ブラウザとスクレイピング結果に大きな差があります');
        console.log('  JavaScript動的読み込みや特殊な表示ロジックが原因の可能性が高いです');
      } else if (overallDiscrepancy > 50) {
        console.log('  ⚠️  中程度の乖離が確認されました');
        console.log('  一部のコンテンツが正しく取得できていない可能性があります');
      } else if (overallDiscrepancy > 20) {
        console.log('  📊 軽度の乖離が確認されました');
        console.log('  セレクタの最適化で改善できる可能性があります');
      } else {
        console.log('  ✅ 乖離は軽微です');
        console.log('  現在のスクレイピング手法は基本的に正しく動作しています');
      }
      
      // 次のアクション計画
      console.log('\\n🚀 次のアクション計画:');
      
      if (overallDiscrepancy > 50) {
        console.log('  1. 最も効果的だったセレクタを使用した改良版スクレイパーの実装');
        console.log('  2. JavaScript読み込み完了検知の精度向上');
        console.log('  3. より長い待機時間（30秒以上）での再試行');
        console.log('  4. 段階的スクロールとAjax監視の組み合わせ');
      } else {
        console.log('  1. 現在のスクレイピング手法の微調整');
        console.log('  2. より多くのURLパターンの探索');
        console.log('  3. 他のポイントサイトへの対応拡大');
      }
      
      // 実装すべき具体的な改善案
      if (maxDifferenceUrl && maxDifferenceUrl.effectiveSelectors.length > 0) {
        console.log('\\n🔧 具体的な改善案:');
        console.log(`  推奨セレクタ: "${maxDifferenceUrl.effectiveSelectors[0]}"`);
        console.log(`  対象URL: ${maxDifferenceUrl.url}`);
        console.log(`  期待効果: ${maxDifferenceUrl.difference.toLocaleString()}要素の追加取得`);
      }
      
    } else {
      console.log('❌ 包括的構造調査失敗:', result.error);
    }
    
  } catch (error) {
    console.error('❌ 実行エラー:', error.message);
    console.log('\\n💡 確認事項:');
    console.log('  - npm run dev が起動していますか？');
    console.log('  - インターネット接続は正常ですか？');
    console.log('  - ブラウザが正常に起動できる環境ですか？');
  }
}

console.log('='.repeat(90));
console.log('    モッピー包括的構造調査システム - 真の問題を特定');
console.log('='.repeat(90));

runComprehensiveInvestigation();