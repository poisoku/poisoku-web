const fs = require('fs');

try {
  const data = fs.readFileSync('/Users/kn/poisoku-web/public/search-data.json', 'utf8');
  const lines = data.split('\n');
  
  console.log('File has', lines.length, 'lines');
  
  const matches = [];
  lines.forEach((line, index) => {
    if (line.includes('獅子の如く')) {
      matches.push({
        lineNumber: index + 1,
        content: line.trim()
      });
    }
  });
  
  console.log('Found', matches.length, 'matches for "獅子の如く":');
  matches.forEach(match => {
    console.log(`Line ${match.lineNumber}: ${match.content}`);
  });
  
  if (matches.length === 0) {
    console.log('No matches found. Searching for any mobile app related entries...');
    
    // Search for app-related terms
    const appTerms = ['アプリ', 'app', 'iOS', 'Android', 'mobile'];
    appTerms.forEach(term => {
      const appMatches = [];
      lines.forEach((line, index) => {
        if (line.toLowerCase().includes(term.toLowerCase())) {
          appMatches.push({
            lineNumber: index + 1,
            content: line.trim()
          });
        }
      });
      console.log(`\nFound ${appMatches.length} matches for "${term}"`);
      if (appMatches.length > 0 && appMatches.length <= 10) {
        appMatches.forEach(match => {
          console.log(`  Line ${match.lineNumber}: ${match.content}`);
        });
      } else if (appMatches.length > 10) {
        console.log('  Too many matches, showing first 10:');
        appMatches.slice(0, 10).forEach(match => {
          console.log(`  Line ${match.lineNumber}: ${match.content}`);
        });
      }
    });
  }
  
} catch (error) {
  console.error('Error reading file:', error.message);
}