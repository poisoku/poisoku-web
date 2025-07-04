const https = require('https');

function fetchChobirich(path = '/') {
  const options = {
    hostname: 'www.chobirich.com',
    path: path,
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({ status: res.statusCode, data });
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function analyzeChobirich() {
  console.log('ちょびリッチ サイト構造調査\n');
  
  try {
    // トップページを取得
    console.log('1. トップページを取得中...');
    const homepage = await fetchChobirich('/');
    console.log('ステータス:', homepage.status);
    console.log('データサイズ:', homepage.data.length, 'bytes');
    
    // HTMLかどうか確認
    if (homepage.data.includes('<!DOCTYPE') || homepage.data.includes('<html')) {
      console.log('HTMLページを取得しました');
      
      // タイトルを抽出
      const titleMatch = homepage.data.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch) {
        console.log('ページタイトル:', titleMatch[1]);
      }
      
      // カテゴリーリンクを探す
      console.log('\n2. カテゴリーリンクを探索...');
      const categoryPatterns = [
        /href="([^"]*category[^"]*)"/gi,
        /href="([^"]*genre[^"]*)"/gi,
        /href="(\/c\/[^"]*)"/gi
      ];
      
      const foundCategories = new Set();
      categoryPatterns.forEach(pattern => {
        const matches = homepage.data.matchAll(pattern);
        for (const match of matches) {
          foundCategories.add(match[1]);
        }
      });
      
      console.log('見つかったカテゴリーURL:');
      Array.from(foundCategories).slice(0, 10).forEach(url => {
        console.log(' -', url);
      });
      
      // 案件リンクパターンを探す
      console.log('\n3. 案件リンクパターンを探索...');
      const campaignPatterns = [
        /href="([^"]*\/ad\/[^"]*)"/gi,
        /href="([^"]*\/click[^"]*)"/gi,
        /href="([^"]*\/campaign[^"]*)"/gi,
        /href="([^"]*\/detail[^"]*)"/gi
      ];
      
      const foundCampaigns = new Set();
      campaignPatterns.forEach(pattern => {
        const matches = homepage.data.matchAll(pattern);
        for (const match of matches) {
          foundCampaigns.add(match[1]);
        }
      });
      
      console.log('見つかった案件URL:');
      Array.from(foundCampaigns).slice(0, 10).forEach(url => {
        console.log(' -', url);
      });
      
      // ポイント表記を探す
      console.log('\n4. ポイント表記パターンを探索...');
      const pointPatterns = [
        /(\d+(?:,\d+)?)\s*pt/gi,
        /(\d+(?:,\d+)?)\s*ポイント/gi,
        /(\d+(?:,\d+)?)\s*ちょびpt/gi,
        /(\d+(?:,\d+)?)\s*%/gi
      ];
      
      const foundPoints = new Set();
      pointPatterns.forEach(pattern => {
        const matches = homepage.data.matchAll(pattern);
        for (const match of matches) {
          foundPoints.add(match[0]);
        }
      });
      
      console.log('見つかったポイント表記:');
      Array.from(foundPoints).slice(0, 10).forEach(point => {
        console.log(' -', point);
      });
      
      // 重要なURLパターンを探す
      console.log('\n5. その他の重要URL...');
      const importantUrls = {
        ranking: homepage.data.match(/href="([^"]*ranking[^"]*)"/i),
        new: homepage.data.match(/href="([^"]*new[^"]*)"/i),
        search: homepage.data.match(/href="([^"]*search[^"]*)"/i)
      };
      
      Object.entries(importantUrls).forEach(([key, match]) => {
        if (match) {
          console.log(`${key}:`, match[1]);
        }
      });
      
    } else {
      console.log('HTMLではないレスポンスを受信しました');
      console.log('最初の500文字:', homepage.data.substring(0, 500));
    }
    
  } catch (error) {
    console.error('エラー:', error.message);
  }
}

analyzeChobirich();