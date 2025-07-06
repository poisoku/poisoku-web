const { createClient } = require('@supabase/supabase-js');

async function cleanDummyData() {
  console.log('🧹 Supabaseのダミーデータクリーンアップ開始...');
  
  const supabase = createClient(
    'https://pjjhyzbnnslaauwzknrr.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqamh5emJubnNsYWF1d3prbnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5ODg4MzksImV4cCI6MjA2NjU2NDgzOX0.qcrcwNpwX83dCNbhxFaks2E68K_wp2W8urdYwfenDtM'
  );

  try {
    // 1. 現在のデータを確認
    console.log('\n📊 現在のデータ状況を確認中...');
    
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('id, name, description, cashback_rate, campaign_url')
      .limit(10);

    if (campaignsError) {
      console.error('❌ データ取得エラー:', campaignsError);
      return;
    }

    console.log(`📄 現在のキャンペーン数: ${campaigns.length} 件（最初の10件を表示）`);
    campaigns.forEach((campaign, index) => {
      console.log(`${index + 1}. ${campaign.name}: ${campaign.description?.substring(0, 50)}... (${campaign.cashback_rate})`);
      console.log(`   URL: ${campaign.campaign_url}`);
    });

    // 2. ダミーデータの特定パターン
    console.log('\n🔍 ダミーデータを検索中...');
    
    // example.comのURLを持つダミーデータを検索
    const { data: exampleComData, error: exampleError } = await supabase
      .from('campaigns')
      .select('id, name, description, cashback_rate, campaign_url')
      .like('campaign_url', '%example.com%');

    // テスト的なディスクリプションを持つデータを検索
    const { data: testDescData, error: testError } = await supabase
      .from('campaigns')
      .select('id, name, description, cashback_rate, campaign_url')
      .like('description', '%高還元率でお得にポイントを貯められます%');

    if (exampleError || testError) {
      console.error('❌ ダミーデータ検索エラー:', exampleError || testError);
      return;
    }

    // 重複を除去してダミーデータをまとめる
    const allDummyData = [];
    const seenIds = new Set();

    [...(exampleComData || []), ...(testDescData || [])].forEach(item => {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        allDummyData.push(item);
      }
    });

    if (allDummyData.length === 0) {
      console.log('✅ ダミーデータは見つかりませんでした');
      
      // ちょびリッチ以外のデータがある場合は表示
      const { data: nonChobirichData, error: nonChobiError } = await supabase
        .from('campaigns')
        .select('id, name, description, cashback_rate')
        .not('description', 'like', '%ちょび%')
        .limit(5);

      if (!nonChobiError && nonChobirichData.length > 0) {
        console.log('\n📋 ちょびリッチ以外のデータ:');
        nonChobirichData.forEach((item, index) => {
          console.log(`${index + 1}. ${item.name}: ${item.description?.substring(0, 50)}...`);
        });
      }
      return;
    }

    console.log(`\n🎯 ${allDummyData.length} 件のダミーデータを発見:`);
    allDummyData.forEach((item, index) => {
      console.log(`${index + 1}. ${item.name}: ${item.description?.substring(0, 60)}...`);
      console.log(`   URL: ${item.campaign_url}`);
    });

    // 3. 削除確認
    console.log('\n⚠️  これらのダミーデータを削除しますか？');
    console.log('削除を実行するには、下記のコードのコメントアウトを外してください:\n');

    // 削除実行コード（コメントアウト状態）
    console.log('// 削除実行コード:');
    console.log('/*');
    console.log('const deleteIds = [');
    allDummyData.forEach(item => {
      console.log(`  '${item.id}',`);
    });
    console.log('];');
    console.log('');
    console.log('const { error: deleteError } = await supabase');
    console.log('  .from("campaigns")');
    console.log('  .delete()');
    console.log('  .in("id", deleteIds);');
    console.log('*/');

    // 4. 現在の統計情報
    const { count, error: countError } = await supabase
      .from('campaigns')
      .select('*', { count: 'exact', head: true });

    if (!countError) {
      console.log(`\n📊 現在のキャンペーン総数: ${count} 件`);
    }

    // ちょびリッチデータの数も確認
    const { count: chobiCount, error: chobiError } = await supabase
      .from('campaigns')
      .select('*', { count: 'exact', head: true })
      .like('description', '%ちょび%');

    if (!chobiError) {
      console.log(`📊 ちょびリッチデータ: ${chobiCount} 件`);
    }

  } catch (error) {
    console.error('❌ クリーンアップエラー:', error);
  }
}

// 実行
cleanDummyData();