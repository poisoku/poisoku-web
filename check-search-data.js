// Simple check of search-data.json structure
const fs = require('fs');

try {
  console.log('Reading search-data.json...');
  const data = fs.readFileSync('./public/search-data.json', 'utf8');
  
  // Parse in chunks to avoid memory issues
  console.log('File size:', Math.round(data.length / 1024 / 1024 * 100) / 100, 'MB');
  
  // Look for 獅子の如く specifically
  const shishiMatches = (data.match(/獅子の如く/g) || []).length;
  console.log('Occurrences of "獅子の如く":', shishiMatches);
  
  // Find lines containing 獅子の如く
  const lines = data.split('\n');
  const shishiLines = [];
  lines.forEach((line, index) => {
    if (line.includes('獅子の如く')) {
      shishiLines.push({
        lineNumber: index + 1,
        content: line.trim()
      });
    }
  });
  
  console.log('\nLines containing "獅子の如く":');
  shishiLines.forEach(line => {
    console.log(`Line ${line.lineNumber}: ${line.content}`);
  });
  
  // Check for device-specific entries
  const androidMatches = (data.match(/Android/gi) || []).length;
  const iosMatches = (data.match(/iOS/gi) || []).length;
  const appMatches = (data.match(/アプリ/g) || []).length;
  
  console.log('\nMobile app related matches:');
  console.log('Android:', androidMatches);
  console.log('iOS:', iosMatches);
  console.log('アプリ (app):', appMatches);
  
  // Look for 2000円 cashback (typical for 獅子の如く)
  const cashback2000 = (data.match(/2000円|2,000円/g) || []).length;
  console.log('2000円 cashback matches:', cashback2000);
  
  // Check what sites are included
  const sitesMatches = {
    'ポイントインカム': (data.match(/ポイントインカム/g) || []).length,
    'ちょびリッチ': (data.match(/ちょびリッチ/g) || []).length,
    'moppy': (data.match(/moppy/gi) || []).length,
    'モッピー': (data.match(/モッピー/g) || []).length
  };
  
  console.log('\nPoint sites represented:');
  Object.entries(sitesMatches).forEach(([site, count]) => {
    console.log(`${site}: ${count} campaigns`);
  });
  
} catch (error) {
  console.error('Error:', error.message);
}