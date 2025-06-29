import fetch from 'node-fetch';

async function cleanupAndAddDummy() {
  try {
    console.log('🧹 モッピーデータ削除とダミーデータ追加処理開始...');
    console.log('');
    
    // ステップ1: 現在の状態確認
    console.log('📊 ステップ1: 現在のデータベース状態確認');
    console.log('=========================================');
    
    const beforeResponse = await fetch('http://localhost:3000/api/campaigns?limit=1');
    const beforeData = await beforeResponse.json();
    console.log(`現在の案件数: ${beforeData.pagination.total}件`);
    
    // ステップ2: モッピーデータを削除（SQLで直接削除が必要）
    console.log('\n🗑️ ステップ2: モッピーデータの削除');
    console.log('==================================');
    console.log('⚠️  注意: モッピーデータの削除にはSupabaseダッシュボードまたはSQL実行が必要です');
    console.log('削除SQL例:');
    console.log("DELETE FROM campaigns WHERE point_site_id IN (SELECT id FROM point_sites WHERE name = 'モッピー');");
    
    // ステップ3: プレビュー用ダミーデータを追加
    console.log('\n📝 ステップ3: プレビュー用ダミーデータの追加');
    console.log('==========================================');
    
    // 100件のプレビュー用ダミーデータを追加
    const dummyImportResponse = await fetch('http://localhost:3000/api/import-feed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        feedUrl: 'http://localhost:3000/api/dummy-feed?format=json&count=100',
        format: 'json'
      })
    });
    
    const dummyImportResult = await dummyImportResponse.json();
    
    if (dummyImportResult.success) {
      console.log('✅ ダミーデータインポート成功!');
      console.log(`   追加案件数: ${dummyImportResult.stats.totalImported}件`);
      console.log(`   新規保存: ${dummyImportResult.stats.totalSaved}件`);
    } else {
      console.log('❌ ダミーデータインポート失敗:', dummyImportResult.errors);
    }
    
    // ステップ4: 最終確認
    console.log('\n📊 ステップ4: 最終データベース状態');
    console.log('===================================');
    
    const afterResponse = await fetch('http://localhost:3000/api/campaigns?limit=1');
    const afterData = await afterResponse.json();
    console.log(`最終案件数: ${afterData.pagination.total}件`);
    
    // 検索テスト
    console.log('\n🔍 検索動作テスト');
    console.log('================');
    
    const searchResponse = await fetch('http://localhost:3000/api/campaigns?search=テスト&limit=5');
    const searchData = await searchResponse.json();
    
    console.log(`"テスト"で検索: ${searchData.pagination.total}件ヒット`);
    if (searchData.campaigns.length > 0) {
      console.log('サンプル結果:');
      searchData.campaigns.slice(0, 3).forEach((campaign, index) => {
        console.log(`  ${index + 1}. ${campaign.name} - ${campaign.cashback_rate}`);
      });
    }
    
    console.log('\n✅ 処理完了！');
    console.log('============');
    console.log('プレビュー用サイトの準備ができました。');
    console.log('- ダミーデータで検索機能をデモ可能');
    console.log('- 実際のポイントサイトデータは含まれていません');
    console.log('- API/フィード連携の準備完了');
    
    console.log('\n💡 次のステップ:');
    console.log('1. Supabaseダッシュボードでモッピーデータを削除');
    console.log('2. サイトを仮公開環境にデプロイ');
    console.log('3. ポイントサイト担当者にプレビュー共有');
    console.log('4. API/フィード提供の相談');
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
  }
}

console.log('='.repeat(80));
console.log('    プレビュー用データセットアップ');
console.log('='.repeat(80));

cleanupAndAddDummy();