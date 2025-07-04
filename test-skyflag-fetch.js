async function testSKYFLAG() {
  const url = 'https://ow.skyflag.jp/ad/p/ow/index?_owp=AdMaGe2BxlEYjkLZE4r5rTvUmY5nAAdMaGe3DAdMaGe3D&suid=t1322517';
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
  };
  
  try {
    console.log('Fetching SKYFLAG page...');
    const response = await fetch(url, { headers });
    
    console.log('Status:', response.status);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));
    
    const text = await response.text();
    console.log('Response length:', text.length);
    
    // HTMLの構造を確認
    if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
      console.log('\nHTML structure found');
      
      // 案件に関連しそうなキーワードを探す
      const keywords = ['ポイント', 'pt', 'PT', '円', '案件', 'キャンペーン', 'offer', 'campaign'];
      keywords.forEach(keyword => {
        if (text.includes(keyword)) {
          console.log(`Found keyword: ${keyword}`);
          // キーワード周辺のテキストを表示
          const index = text.indexOf(keyword);
          console.log('Context:', text.substring(Math.max(0, index - 50), Math.min(text.length, index + 100)));
        }
      });
    }
    
    // JSONデータを探す
    const jsonPattern = /\{[^{}]*"[^"]+"\s*:\s*[^{}]+\}/g;
    const jsonMatches = text.match(jsonPattern);
    if (jsonMatches) {
      console.log('\nFound potential JSON data:');
      jsonMatches.slice(0, 3).forEach((match, i) => {
        console.log(`JSON ${i + 1}:`, match.substring(0, 200));
      });
    }
    
    // データ取得用のAPIエンドポイントを探す
    const apiPatterns = [
      /api\/[^"'\s]+/gi,
      /\/data\/[^"'\s]+/gi,
      /\/offers?\/[^"'\s]+/gi,
      /\/campaigns?\/[^"'\s]+/gi
    ];
    
    apiPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        console.log('\nFound API endpoints:', matches);
      }
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testSKYFLAG();