import fetch from 'node-fetch';

async function testOne() {
  try {
    console.log('🚀 楽天キーワードでモッピーをテスト...');
    
    const response = await fetch('http://localhost:3000/api/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer poisoku-scraping-secret-2024'
      },
      body: JSON.stringify({
        keyword: '楽天',
        sites: ['モッピー']
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ スクレイピング成功!');
      console.log('総案件数:', result.totalCampaigns);
      console.log('処理時間:', result.processingTimeMs + 'ms');
      
      if (result.database) {
        console.log('\n💾 データベース保存:');
        console.log('新規保存:', result.database.savedCount + '件');
        console.log('更新:', result.database.updatedCount + '件');
        if (result.database.errors.length > 0) {
          console.log('\n❌ データベースエラー (' + result.database.errors.length + '件):');
          result.database.errors.forEach((err, index) => {
            console.log(`  ${index + 1}. ${err}`);
          });
        } else {
          console.log('✅ データベース保存成功!');
        }
      }
      
      if (result.campaigns && result.campaigns.length > 0) {
        console.log('\n📋 取得できた案件（最初の3件）:');
        result.campaigns.slice(0, 3).forEach((campaign, index) => {
          console.log(`  ${index + 1}. ${campaign.name} - ${campaign.cashbackRate} (${campaign.pointSiteName})`);
        });
      }
      
    } else {
      console.log('❌ スクレイピング失敗:', result.error);
    }
  } catch (error) {
    console.error('❌ テストエラー:', error.message);
  }
}

testOne();