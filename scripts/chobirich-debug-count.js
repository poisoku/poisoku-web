const puppeteer = require('puppeteer');

async function debugChobirichCount() {
  console.log('🔍 ちょびリッチ案件数調査開始\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    const iosUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
    await page.setUserAgent(iosUserAgent);
    await page.setViewport({ width: 390, height: 844 });
    
    // ページごとの統計
    const pageStats = [];
    const allUrls = new Set();
    const appUrls = new Set();
    
    // アプリ判定用キーワード
    const appKeywords = [
      'アプリ', 'app', 'インストール', 'ダウンロード',
      'ゲーム', 'game', 'レベル', 'level', 'クリア',
      'iOS', 'iPhone', 'iPad', 'Android', 'アンドロイド',
      'Google Play', 'App Store', 'プレイ', 'play',
      'チュートリアル', 'アプリランド', 'アプリdeちょ'
    ];
    
    for (let pageNum = 1; pageNum <= 30; pageNum++) {
      const url = pageNum === 1 
        ? 'https://www.chobirich.com/smartphone?sort=point'
        : `https://www.chobirich.com/smartphone?sort=point&page=${pageNum}`;
      
      console.log(`📄 ページ ${pageNum} 分析中...`);
      
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const pageData = await page.evaluate(() => {
          // リンク要素を取得
          const links = document.querySelectorAll('a[href*="/ad_details/"]');
          const items = [];
          
          links.forEach(link => {
            const href = link.href;
            const text = link.innerText || '';
            const parent = link.closest('.campaign-item, [class*="item"], li, div');
            const parentText = parent ? parent.innerText : '';
            
            items.push({
              url: href,
              text: text,
              parentText: parentText
            });
          });
          
          // ページ情報
          const pageInfo = document.body.innerText.substring(0, 500);
          const hasNext = !!document.querySelector('a[href*="page=' + (parseInt(window.location.search.match(/page=(\d+)/)?.[1] || '1') + 1) + '"]');
          
          return { items, pageInfo, hasNext };
        });
        
        if (pageData.items.length === 0) {
          console.log(`  → 案件なし - 終了`);
          break;
        }
        
        // アプリ案件の判定
        let pageAppCount = 0;
        pageData.items.forEach(item => {
          allUrls.add(item.url);
          
          const combinedText = (item.text + ' ' + item.parentText).toLowerCase();
          const isApp = appKeywords.some(keyword => combinedText.includes(keyword.toLowerCase()));
          
          if (isApp) {
            appUrls.add(item.url);
            pageAppCount++;
          }
        });
        
        const stat = {
          page: pageNum,
          totalItems: pageData.items.length,
          appItems: pageAppCount,
          hasNext: pageData.hasNext
        };
        
        pageStats.push(stat);
        console.log(`  → 総案件: ${stat.totalItems}, アプリ案件: ${stat.appItems}`);
        
        if (!pageData.hasNext) {
          console.log(`  → 次ページなし - 終了`);
          break;
        }
        
      } catch (error) {
        console.log(`  → エラー: ${error.message}`);
        break;
      }
    }
    
    // 統計表示
    console.log('\n📊 === 最終統計 ===');
    console.log(`総ページ数: ${pageStats.length}`);
    console.log(`総案件数: ${allUrls.size}`);
    console.log(`アプリ案件数（推定）: ${appUrls.size}`);
    
    console.log('\n📑 ページ別詳細:');
    pageStats.forEach(stat => {
      console.log(`  ページ ${stat.page}: 総${stat.totalItems}件, アプリ${stat.appItems}件`);
    });
    
    // 最後の5ページの詳細表示
    console.log('\n🔍 最後の5ページのURL:');
    const lastPages = pageStats.slice(-5);
    for (const stat of lastPages) {
      console.log(`\nページ ${stat.page} のURL:`);
      const pageUrl = stat.page === 1 
        ? 'https://www.chobirich.com/smartphone?sort=point'
        : `https://www.chobirich.com/smartphone?sort=point&page=${stat.page}`;
      console.log(`  ${pageUrl}`);
    }
    
  } finally {
    await browser.close();
  }
}

// 実行
debugChobirichCount().catch(console.error);