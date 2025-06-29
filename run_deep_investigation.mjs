import fetch from 'node-fetch';

async function runDeepInvestigation() {
  try {
    console.log('🔬 モッピー深層構造調査開始...');
    console.log('   モッピーサイトの真の構造を解明し、数千件の案件の在り処を突き止めます');
    console.log('   ブラウザが自動で開いて詳細調査を実行します');
    console.log('');
    
    const startTime = Date.now();
    
    const response = await fetch('http://localhost:3000/api/deep-investigate', {
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
      console.log('✅ 深層構造調査成功!');
      console.log('='.repeat(70));
      
      // 重要な発見事項
      console.log('🎯 重要な発見事項:');
      if (result.summary.criticalFindings.length > 0) {
        result.summary.criticalFindings.forEach((finding, index) => {
          console.log(`  ${index + 1}. ${finding}`);
        });
      } else {
        console.log('  特筆すべき発見はありませんでした。');
      }
      
      // 調査サマリー
      console.log('\\n📊 調査サマリー:');
      console.log(`  調査ページ数: ${result.summary.totalPagesInvestigated}ページ`);
      console.log(`  発見案件総数: ${result.summary.totalCampaignsFound}件`);
      console.log(`  ページネーション: ${result.summary.paginationFound ? 'あり' : 'なし'}`);
      console.log(`  最大ページ数: ${result.summary.maxPages}ページ`);
      console.log(`  調査時間: ${(totalTime / 1000).toFixed(1)}秒`);
      
      // 最も効果的なページ
      if (result.summary.bestPage) {
        console.log('\\n🏆 最も案件数が多いページ:');
        console.log(`  URL: ${result.summary.bestPage.url}`);
        console.log(`  タイトル: ${result.summary.bestPage.title}`);
        console.log(`  案件数: ${result.summary.bestPage.campaignCount}件`);
      }
      
      // 効果的なセレクタ
      if (result.summary.effectiveSelectors.length > 0) {
        console.log('\\n🎯 効果的なセレクタ:');
        result.summary.effectiveSelectors.slice(0, 5).forEach((selector, index) => {
          console.log(`  ${index + 1}. ${selector}`);
        });
      }
      
      // 詳細なページ分析
      console.log('\\n📋 詳細ページ分析:');
      if (result.investigation.findings.actualCampaignPages.length > 0) {
        result.investigation.findings.actualCampaignPages.forEach((page, index) => {
          console.log(`\\n  ${index + 1}. ${page.url}`);
          console.log(`     タイトル: ${page.title}`);
          console.log(`     案件数: ${page.campaignCount}件`);
          
          if (page.selectors.campaignElements.length > 0) {
            console.log(`     案件セレクタ: ${page.selectors.campaignElements.slice(0, 2).join(', ')}`);
          }
          
          if (page.selectors.nameElements.length > 0) {
            console.log(`     名前セレクタ: ${page.selectors.nameElements.slice(0, 2).join(', ')}`);
          }
          
          if (page.selectors.priceElements.length > 0) {
            console.log(`     価格セレクタ: ${page.selectors.priceElements.slice(0, 2).join(', ')}`);
          }
        });
      } else {
        console.log('  調査されたページがありません。');
      }
      
      // ページネーション詳細
      if (result.investigation.findings.paginationAnalysis.hasNextPage) {
        console.log('\\n📄 ページネーション詳細:');
        console.log(`  パターン: ${result.investigation.findings.paginationAnalysis.paginationPattern}`);
        console.log(`  最大ページ: ${result.investigation.findings.paginationAnalysis.maxPageFound}`);
        console.log(`  ページネーションURL数: ${result.investigation.findings.paginationAnalysis.paginationUrls.length}個`);
        
        if (result.investigation.findings.paginationAnalysis.paginationUrls.length > 0) {
          console.log('  URL例:');
          result.investigation.findings.paginationAnalysis.paginationUrls.slice(0, 3).forEach((url, index) => {
            console.log(`    ${index + 1}. ${url}`);
          });
        }
      }
      
      // 推奨事項
      if (result.investigation.recommendations.length > 0) {
        console.log('\\n💡 調査結果に基づく推奨事項:');
        result.investigation.recommendations.forEach((rec, index) => {
          console.log(`  ${index + 1}. ${rec}`);
        });
      }
      
      // HTMLサンプル
      if (result.investigation.htmlSamples.length > 0) {
        console.log('\\n📄 HTMLサンプル (最初の2つ):');
        result.investigation.htmlSamples.slice(0, 2).forEach((sample, index) => {
          console.log(`\\n  ${index + 1}. ${sample.substring(0, 300)}...`);
        });
      }
      
      // データパターン
      if (result.investigation.findings.realStructure.dataPatterns.length > 0) {
        console.log('\\n🔍 発見されたデータパターン:');
        result.investigation.findings.realStructure.dataPatterns.slice(0, 5).forEach((pattern, index) => {
          console.log(`  ${index + 1}. ${pattern}`);
        });
      }
      
      // 次のアクション提案
      console.log('\\n🚀 次のアクション提案:');
      
      if (result.summary.totalCampaignsFound > 100) {
        console.log('  ✅ 案件発見成功！');
        console.log('  1. 発見されたセレクタを使ってスクレイピングシステムを更新');
        console.log('  2. 最も効果的なページを重点的にスクレイピング');
        console.log('  3. ページネーションを活用して全ページを処理');
      } else if (result.summary.totalCampaignsFound > 20) {
        console.log('  ⚠️  中程度の案件発見');
        console.log('  1. より多くのページを調査する必要があります');
        console.log('  2. 別のアプローチでの案件発見を試してください');
      } else {
        console.log('  ❌ 案件発見が不十分');
        console.log('  1. モッピーのサイト構造が大幅に変更されている可能性');
        console.log('  2. JavaScript生成コンテンツの可能性を調査');
        console.log('  3. 別のポイントサイトでの実装を優先検討');
      }
      
      console.log('\\n🎯 最終判定:');
      if (result.summary.totalCampaignsFound >= 1000) {
        console.log('  🎉 大成功！数千件の案件発見ルートを特定しました');
      } else if (result.summary.totalCampaignsFound >= 100) {
        console.log('  ✅ 成功！数百件の案件を発見、さらなる最適化で向上可能');
      } else {
        console.log('  ⚠️  改善が必要。別のアプローチを検討してください');
      }
      
    } else {
      console.log('❌ 深層構造調査失敗:', result.error);
    }
    
  } catch (error) {
    console.error('❌ 調査実行エラー:', error.message);
    console.log('\\n💡 確認事項:');
    console.log('  - npm run dev が起動していますか？');
    console.log('  - Puppeteerが正常にインストールされていますか？');
    console.log('  - ブラウザが開けない環境ではありませんか？');
  }
}

console.log('='.repeat(80));
console.log('    モッピー深層構造調査 - 真実の解明');
console.log('='.repeat(80));

runDeepInvestigation();