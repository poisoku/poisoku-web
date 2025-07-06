const { createClient } = require('@supabase/supabase-js');

async function deletePointIncomePointTownDummy() {
  console.log('🗑️ ポイントインカム・ポイントタウンのダミーデータを削除中...');
  
  const supabase = createClient(
    'https://pjjhyzbnnslaauwzknrr.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqamh5emJubnNsYWF1d3prbnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5ODg4MzksImV4cCI6MjA2NjU2NDgzOX0.qcrcwNpwX83dCNbhxFaks2E68K_wp2W8urdYwfenDtM'
  );

  try {
    // 1. ポイントサイト情報を取得
    const { data: pointSites, error: sitesError } = await supabase
      .from('point_sites')
      .select('id, name')
      .in('name', ['ポイントインカム', 'ポイントタウン']);

    if (sitesError) {
      console.error('❌ ポイントサイト取得エラー:', sitesError);
      return;
    }

    console.log('📋 対象ポイントサイト:');
    pointSites.forEach(site => {
      console.log(`- ${site.name} (ID: ${site.id})`);
    });

    const targetSiteIds = pointSites.map(site => site.id);

    // 2. 該当するダミーデータを検索
    const { data: dummyData, error: searchError } = await supabase
      .from('campaigns')
      .select('id, name, description, cashback_rate, campaign_url, point_site_id')
      .in('point_site_id', targetSiteIds);

    if (searchError) {
      console.error('❌ ダミーデータ検索エラー:', searchError);
      return;
    }

    if (dummyData.length === 0) {
      console.log('✅ ポイントインカム・ポイントタウンのデータは見つかりませんでした');
      return;
    }

    console.log(`\n🎯 ${dummyData.length} 件のデータを発見:`);
    dummyData.forEach((item, index) => {
      const siteName = pointSites.find(s => s.id === item.point_site_id)?.name || 'Unknown';
      console.log(`${index + 1}. ${siteName}: ${item.name} (${item.cashback_rate})`);
      console.log(`   URL: ${item.campaign_url}`);
      console.log(`   Description: ${item.description || 'undefined'}`);
    });

    // 3. 削除実行
    console.log(`\n🗑️ ${dummyData.length} 件のデータを削除中...`);

    const deleteIds = dummyData.map(item => item.id);

    const { error: deleteError } = await supabase
      .from('campaigns')
      .delete()
      .in('id', deleteIds);

    if (deleteError) {
      console.error('❌ 削除エラー:', deleteError);
      return;
    }

    console.log(`✅ ${deleteIds.length} 件のポイントインカム・ポイントタウンのダミーデータを削除しました！`);

    // 4. 削除後の統計情報
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

    // 各サイトの残り件数を確認
    for (const site of pointSites) {
      const { count: siteCount, error: siteCountError } = await supabase
        .from('campaigns')
        .select('*', { count: 'exact', head: true })
        .eq('point_site_id', site.id);

      if (!siteCountError) {
        console.log(`📊 ${site.name}データ: ${siteCount} 件`);
      }
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
deletePointIncomePointTownDummy();