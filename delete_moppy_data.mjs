import pg from 'pg';

// 環境変数を直接使用
const DATABASE_URL = process.env.DATABASE_URL;

const { Client } = pg;

async function deleteMoppyData() {
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL環境変数が設定されていません');
    return;
  }

  const client = new Client({
    connectionString: DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔗 データベースに接続しました');

    // 削除前の件数確認
    const beforeResult = await client.query('SELECT COUNT(*) FROM campaigns');
    const beforeCount = parseInt(beforeResult.rows[0].count);
    console.log(`削除前の案件数: ${beforeCount}件`);

    // モッピーデータを削除
    console.log('🗑️ モッピーデータを削除中...');
    const deleteResult = await client.query(`
      DELETE FROM campaigns 
      WHERE point_site_id IN (
        SELECT id FROM point_sites WHERE name = 'モッピー'
      )
    `);
    
    const deletedCount = deleteResult.rowCount;
    console.log(`✅ ${deletedCount}件のモッピーデータを削除しました`);

    // 削除後の件数確認
    const afterResult = await client.query('SELECT COUNT(*) FROM campaigns');
    const afterCount = parseInt(afterResult.rows[0].count);
    console.log(`削除後の案件数: ${afterCount}件`);

    console.log('\n📊 削除結果:');
    console.log(`- 削除前: ${beforeCount}件`);
    console.log(`- 削除件数: ${deletedCount}件`);
    console.log(`- 削除後: ${afterCount}件`);
    console.log(`- 残存データ: ダミーデータのみ`);

  } catch (error) {
    console.error('❌ エラー:', error.message);
  } finally {
    await client.end();
    console.log('🔌 データベース接続を終了しました');
  }
}

console.log('='.repeat(60));
console.log('    モッピーデータ削除処理');
console.log('='.repeat(60));

deleteMoppyData();