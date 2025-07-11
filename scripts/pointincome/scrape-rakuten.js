const puppeteer = require('puppeteer');
const fs = require('fs').promises;

async function scrapeRakutenOnly() {
  console.log('🔍 ポイントインカムで楽天市場を取得中...\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (['image', 'font', 'stylesheet'].includes(request.resourceType())) {
        request.abort();
      } else {
        request.continue();
      }
    });
    
    // EC・ネットショッピンググループの2ページ目以降も確認
    console.log('📂 EC・ネットショッピンググループを確認中...');
    
    const results = [];
    
    // 複数ページを確認
    for (let pageNum = 1; pageNum <= 3; pageNum++) {
      const url = pageNum === 1 
        ? 'https://pointi.jp/list.php?group=65'
        : `https://pointi.jp/list.php?group=65&page=${pageNum}`;
        
      console.log(`  📄 ページ ${pageNum} を確認...`);
      await page.goto(url, { waitUntil: 'networkidle2' });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 楽天案件を探す
      const rakutenLinks = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('.box_ad_inner'));
        const found = [];
        
        links.forEach(link => {
          const text = link.textContent;
          const anchor = link.querySelector('a');
          
          if (text && anchor && 
              (text.includes('楽天市場') || 
               text.includes('楽天全国スーパー') || 
               text.includes('Rakuten'))) {
            found.push({
              title: text.trim().replace(/\s+/g, ' '),
              url: anchor.href
            });
          }
        });
        
        return found;
      });
      
      if (rakutenLinks.length > 0) {
        console.log(`    ✅ ${rakutenLinks.length}件の楽天案件を発見`);
        
        // 詳細ページを取得
        for (const link of rakutenLinks) {
          console.log(`\n  📍 詳細取得: ${link.title.substring(0, 40)}...`);
          
          await page.goto(link.url, { waitUntil: 'networkidle2' });
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          const detail = await page.evaluate(() => {
            const data = {
              title: '',
              cashback: '',
              yenText: ''
            };
            
            const h2 = document.querySelector('h2');
            if (h2) data.title = h2.textContent.trim();
            
            const percentEl = document.querySelector('.ad_pt.red.bold');
            if (percentEl) data.cashback = percentEl.textContent.trim();
            
            const yenEl = document.querySelector('.pt_yen.bold');
            if (yenEl) data.yenText = yenEl.textContent.trim();
            
            return data;
          });
          
          const idMatch = link.url.match(/\/ad\/(\d+)/);
          
          results.push({
            id: `pi_${idMatch ? idMatch[1] : Date.now()}`,
            title: detail.title || link.title,
            url: link.url,
            cashback: detail.cashback,
            cashbackYen: detail.yenText ? detail.yenText.match(/\d+/)?.[0] + '円' : null,
            siteName: 'ポイントインカム',
            device: 'PC',
            category: 'EC・ネットショッピング'
          });
          
          console.log(`    還元率: ${detail.cashback || detail.yenText || '不明'}`);
        }
      }
    }
    
    // 結果を保存
    if (results.length > 0) {
      const data = {
        siteName: 'ポイントインカム',
        scrapedAt: new Date().toISOString(),
        campaigns: results
      };
      
      await fs.writeFile(
        'pointincome_rakuten.json',
        JSON.stringify(data, null, 2),
        'utf8'
      );
      
      console.log(`\n✅ ${results.length}件の楽天案件を保存しました`);
      console.log('💾 ファイル: pointincome_rakuten.json');
    } else {
      console.log('\n❌ 楽天市場が見つかりませんでした');
    }
    
  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await browser.close();
  }
}

// 実行
scrapeRakutenOnly();