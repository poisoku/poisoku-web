// サイト調査のテストスクリプト
import fetch from 'node-fetch';

async function testInvestigation() {
  try {
    console.log('サイト調査テスト開始...');
    
    const response = await fetch('http://localhost:3000/api/investigate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer poisoku-scraping-secret-2024'
      },
      body: JSON.stringify({
        keyword: 'Yahoo'
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ 調査成功!');
      console.log('\n=== サマリー ===');
      console.log(`調査サイト数: ${result.summary.totalSites}`);
      
      result.summary.sitesAnalyzed.forEach(site => {
        console.log(`\n${site.siteName}:`);
        console.log(`  ページタイトル: ${site.pageTitle}`);
        console.log(`  候補要素: ${site.containerCandidates}個`);
        console.log(`  サンプル: ${site.sampleElements}個`);
        console.log(`  robots.txt: ${site.hasRobotsTxt ? '有' : '無'}`);
      });

      console.log('\n=== 推奨セレクタ ===');
      Object.entries(result.summary.recommendations).forEach(([siteName, rec]) => {
        console.log(`\n${siteName} (信頼度: ${rec.confidence}):`);
        console.log(`  コンテナ: ${rec.containerSelector || '未検出'}`);
        console.log(`  タイトル: ${rec.titleSelector || '未検出'}`);
        console.log(`  還元率: ${rec.cashbackSelector || '未検出'}`);
      });

    } else {
      console.log('❌ 調査失敗:', result.error);
    }

  } catch (error) {
    console.error('❌ テスト実行エラー:', error.message);
  }
}

testInvestigation();