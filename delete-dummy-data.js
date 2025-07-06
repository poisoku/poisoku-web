const { createClient } = require('@supabase/supabase-js');

async function deleteDummyData() {
  console.log('🗑️ ダミーデータを削除中...');
  
  const supabase = createClient(
    'https://pjjhyzbnnslaauwzknrr.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqamh5emJubnNsYWF1d3prbnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5ODg4MzksImV4cCI6MjA2NjU2NDgzOX0.qcrcwNpwX83dCNbhxFaks2E68K_wp2W8urdYwfenDtM'
  );

  try {
    // ダミーデータのIDリスト
    const deleteIds = [
      '8bab314d-d6cb-4a01-9cbd-af5dbff7ff02',
      '1b4fb530-5094-4c42-8cbd-a6201f779a20',
      'c0c9d063-1ec8-447e-a0d9-8b96abe919a8',
      '5783ad68-a0ac-46fa-8ee6-10cecdf3e804',
      'fafd3dee-bce6-4a3e-8375-3e09c6ea3846',
      '10fb2b6e-bfc8-4691-9a0f-ea6157d1c5d8',
      '21d226af-2b35-4cb0-86e6-9513bbdcb375',
      '58e943eb-f223-4620-9cba-d67abdda07ed',
      '8af3349e-bad8-4300-a7e3-87e8eb1ad0ab',
      '4ab8ea73-83b4-4cf0-9474-528b99bc8e91',
      'd7d70441-c7c6-4428-a843-ac5d61631e88',
      'f749acd3-a53f-4fab-9d52-18df80640e97',
      '21bad2e2-f5a2-4e65-8d24-4a16f15c1c7e',
      'a1d2b251-e294-4012-b584-cfaded6d1e3a',
      'c3eb4b80-ea29-4cda-b6e3-b5d7670c724e',
      '479256ae-cf33-482b-a28a-819eefcf7109',
      '36cf017a-0b06-47e5-881f-e29d3f65e86c',
      '183acb58-b535-40fe-9694-a72445d4e37e',
      '3c7056d7-e177-41f2-b642-2006c703bd81',
      '80436a6a-94e5-4831-8fcc-8d7d16eecec1',
      'f205e7c3-75cb-44eb-8e5c-d9e0a76ca13b',
      '882bfded-9f00-47c0-9502-0f56544a8729',
      '9a91360b-dc38-4d25-b65a-94cc67497d8e',
      '163b5851-f850-42a0-bdd0-7a1c0e2ff7f6',
      '29523aef-09f3-4a40-8a76-cea35020cfac',
      '9fcd130f-ed2c-4a48-b7d7-87ace004d43a',
      '9b52265d-567d-43ca-90c3-d76469f3b478',
      '2aa61778-9f93-414b-9d99-d3012ca9c11a',
      '4f5f1448-f1e5-408c-86c1-5178027a278c',
      '31508d78-1c54-4ff6-a1ce-1cc5f82d2669',
      'f5cee650-5cbe-4b57-8139-6ff986d2fdc6',
      '143447c5-7e3b-4cd9-b7d8-25e4172c7ddb',
      '10d3a50e-415b-47f8-94a6-5250c8e5bdcf',
      '992b77f3-1d37-4bcb-bb39-474a3f96ae95',
      '050e311e-ca7e-4b38-8d6e-8619081ebf7b',
      'de602763-09ac-41fb-857f-62c4756458b7',
      '93cc5ad1-c84f-4972-af4e-5c813b7d8d31',
      '676b1d46-e9ab-4ec2-b787-0871a9ee961b',
      'e7330f64-9b09-42b5-a4d8-3035beda9768',
      '9aafa3de-8342-4971-b5e6-93ade9992b62',
      'f45d4d34-e3cb-4e38-8b5b-66fccfbfd203',
      '92621f98-f904-41aa-acd5-f8639b8f998b',
      'fb425ed7-d069-4894-b66b-c701ab0e334a'
    ];

    console.log(`🎯 ${deleteIds.length} 件のダミーデータを削除します...`);

    // 削除実行
    const { error: deleteError } = await supabase
      .from('campaigns')
      .delete()
      .in('id', deleteIds);

    if (deleteError) {
      console.error('❌ 削除エラー:', deleteError);
      return;
    }

    console.log(`✅ ${deleteIds.length} 件のダミーデータを削除しました！`);

    // 削除後の統計情報
    const { count, error: countError } = await supabase
      .from('campaigns')
      .select('*', { count: 'exact', head: true });

    if (!countError) {
      console.log(`📊 削除後のキャンペーン総数: ${count} 件`);
    }

    // ちょびリッチデータの数も確認
    const { count: chobiCount, error: chobiError } = await supabase
      .from('campaigns')
      .select('*', { count: 'exact', head: true })
      .like('description', '%ちょび%');

    if (!chobiError) {
      console.log(`📊 ちょびリッチデータ: ${chobiCount} 件`);
    }

    // 残ったデータのサンプルを表示
    const { data: remainingData, error: remainingError } = await supabase
      .from('campaigns')
      .select('id, name, description, cashback_rate')
      .limit(5);

    if (!remainingError && remainingData.length > 0) {
      console.log('\n📋 残ったデータのサンプル:');
      remainingData.forEach((item, index) => {
        console.log(`${index + 1}. ${item.name}: ${item.description?.substring(0, 50)}... (${item.cashback_rate})`);
      });
    }

  } catch (error) {
    console.error('❌ 削除処理エラー:', error);
  }
}

// 実行
deleteDummyData();