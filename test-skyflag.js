const https = require('https');

const url = 'https://ow.skyflag.jp/ad/p/ow/index?_owp=AdMaGe2BxlEYjkLZE4r5rTvUmY5nAAdMaGe3DAdMaGe3D&suid=t1322517';

const options = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
  }
};

https.get(url, options, (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', JSON.stringify(res.headers, null, 2));
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('\n--- Response Body (first 2000 chars) ---');
    console.log(data.substring(0, 2000));
    
    // JSONレスポンスを探す
    if (data.includes('application/json') || data.includes('{')) {
      console.log('\n--- Searching for JSON data ---');
      const jsonMatches = data.match(/\{[^{}]*\}/g);
      if (jsonMatches) {
        jsonMatches.slice(0, 5).forEach((match, i) => {
          console.log(`\nJSON Match ${i + 1}:`, match.substring(0, 200));
        });
      }
    }
  });
}).on('error', (err) => {
  console.error('Error:', err);
});