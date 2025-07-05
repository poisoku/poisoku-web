const http = require('http');

// テスト用のHTTPリクエスト関数
function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
}

async function testSearchAPI() {
  console.log('🧪 検索API テスト開始');
  console.log('='.repeat(60));
  
  const tests = [
    {
      name: '基本検索（全件取得）',
      path: '/api/search-campaigns'
    },
    {
      name: 'キーワード検索（ショップ）',
      path: '/api/search-campaigns?keyword=ショップ'
    },
    {
      name: 'カテゴリフィルタ（shopping）',
      path: '/api/search-campaigns?category=shopping'
    },
    {
      name: 'カテゴリフィルタ（finance）',
      path: '/api/search-campaigns?category=finance'
    },
    {
      name: 'サイトフィルタ（ちょびリッチ）',
      path: '/api/search-campaigns?site=ちょびリッチ'
    },
    {
      name: 'ページング（2ページ目）',
      path: '/api/search-campaigns?page=2&limit=5'
    },
    {
      name: 'ソート（作成日降順）',
      path: '/api/search-campaigns?sort=created_at&order=desc&limit=5'
    },
    {
      name: '複合検索（ショップ + shopping カテゴリ）',
      path: '/api/search-campaigns?keyword=ショップ&category=shopping&limit=3'
    }
  ];

  for (const test of tests) {
    console.log(`\n🔍 ${test.name}`);
    console.log(`   URL: ${test.path}`);
    
    try {
      const result = await makeRequest(test.path);
      
      if (result.status === 200) {
        console.log(`   ✅ ステータス: ${result.status}`);
        console.log(`   📊 件数: ${result.data.total}件`);
        console.log(`   📄 ページ: ${result.data.page}/${result.data.totalPages}`);
        
        if (result.data.campaigns && result.data.campaigns.length > 0) {
          console.log(`   📝 サンプル: ${result.data.campaigns[0].name}`);
        }
      } else {
        console.log(`   ❌ ステータス: ${result.status}`);
        console.log(`   エラー: ${JSON.stringify(result.data, null, 2)}`);
      }
      
    } catch (error) {
      console.log(`   💥 リクエストエラー: ${error.message}`);
    }
    
    // 次のテストまで少し待機
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🎉 検索API テスト完了');
  console.log('\n💡 使用方法:');
  console.log('1. npm run dev でNext.jsサーバーを起動');
  console.log('2. このテストスクリプトを実行');
  console.log('3. ブラウザで http://localhost:3000/api/search-campaigns をテスト');
}

// 実行
testSearchAPI().catch(console.error);