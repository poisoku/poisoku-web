const { createClient } = require('@supabase/supabase-js');

async function cleanDummyData() {
  console.log('🧹 Supabaseのダミーデータクリーンアップ開始...');
  
  // Supabaseクライアント初期化（.env.localから手動で設定）
  const supabase = createClient(
    'https://pjjhyzbnnslaauwzknrr.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqamh5emJubnNsYWF1d3prbnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5ODg4MzksImV4cCI6MjA2NjU2NDgzOX0.qcrcwNpwX83dCNbhxFaks2E68K_wp2W8urdYwfenDtM'
  );

  try {
    // 1. 現在のデータを確認
    console.log('\n📊 現在のデータ状況を確認中...');
    
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .limit(10);

    if (campaignsError) {
      console.error('❌ データ取得エラー:', campaignsError);
      return;
    }

    console.log(`📄 現在のキャンペーン数: ${campaigns.length} 件（最初の10件を表示）`);
    campaigns.forEach((campaign, index) => {
      console.log(`${index + 1}. ${campaign.site_name}: ${campaign.description?.substring(0, 50)}... (${campaign.cashback})`);
    });

    // 2. ダミーデータの特定パターン
    const dummyPatterns = [
      'サンプルサイト',
      'テストキャンペーン',
      'ダミー',
      'テスト',
      'Example',
      'sample',
      'test',
      'mock',
      'Demo'
    ];

    console.log('\n🔍 ダミーデータを検索中...');
    
    // ダミーデータを検索
    let dummyQuery = supabase
      .from('campaigns')
      .select('id, site_name, description, cashback');

    // 各パターンでOR検索
    const orConditions = dummyPatterns.map(pattern => 
      `site_name.ilike.%${pattern}%,description.ilike.%${pattern}%`
    ).join(',');

    const { data: dummyData, error: dummyError } = await supabase
      .from('campaigns')
      .select('id, site_name, description, cashback')
      .or(orConditions);

    if (dummyError) {
      console.error('❌ ダミーデータ検索エラー:', dummyError);
      return;
    }

    if (dummyData.length === 0) {
      console.log('✅ ダミーデータは見つかりませんでした');
      return;
    }

    console.log(`\n🎯 ${dummyData.length} 件のダミーデータを発見:`);
    dummyData.forEach((item, index) => {
      console.log(`${index + 1}. ${item.site_name}: ${item.description?.substring(0, 60)}...`);
    });

    // 3. ユーザーに確認を求める（実際の削除は手動で実行）
    console.log('\n⚠️  これらのデータを削除しますか？');
    console.log('削除を実行するには、以下のコマンドのコメントアウトを外してください:');
    console.log('\n// 削除実行コード:');
    dummyData.forEach(item => {
      console.log(`// DELETE FROM campaigns WHERE id = '${item.id}';`);
    });

    // 実際の削除（コメントアウト状態）
    /*
    console.log('\n🗑️  ダミーデータを削除中...');
    const deleteIds = dummyData.map(item => item.id);
    
    const { error: deleteError } = await supabase
      .from('campaigns')
      .delete()
      .in('id', deleteIds);

    if (deleteError) {
      console.error('❌ 削除エラー:', deleteError);
      return;
    }

    console.log(`✅ ${deleteIds.length} 件のダミーデータを削除しました`);
    */

    // 4. 削除後の統計情報
    const { count, error: countError } = await supabase
      .from('campaigns')
      .select('*', { count: 'exact', head: true });

    if (!countError) {
      console.log(`\n📊 現在のキャンペーン総数: ${count} 件`);
    }

  } catch (error) {
    console.error('❌ クリーンアップエラー:', error);
  }
}

// 実行
cleanDummyData();