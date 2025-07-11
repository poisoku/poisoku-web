const puppeteer = require('puppeteer');

async function findRakuten() {
  console.log('🔍 ポイントインカムで楽天市場を探索中...\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // グループ一覧
    const groups = [
      { name: 'EC・ネットショッピング', id: 65 },
      { name: 'ファッション', id: 152 },
      { name: 'グルメ', id: 154 },
      { name: '美容', id: 148 },
      { name: '衛生用品', id: 147 },
      { name: 'エンタメ・家電', id: 151 },
      { name: '住まい・暮らし', id: 155 },
      { name: 'その他（ショッピング）', id: 153 }
    ];
    
    let found = false;
    
    for (const group of groups) {
      console.log(`📂 ${group.name}を確認中...`);
      const url = `https://pointi.jp/list.php?group=${group.id}`;
      
      await page.goto(url, { waitUntil: 'networkidle2' });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 楽天を探す
      const rakutenFound = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('.box_ad_inner'));
        const rakutenLinks = [];
        
        links.forEach(link => {
          const text = link.textContent;
          if (text && (text.includes('楽天') || text.includes('Rakuten'))) {
            const anchor = link.querySelector('a');
            if (anchor) {
              rakutenLinks.push({
                text: text.trim(),
                url: anchor.href
              });
            }
          }
        });
        
        return rakutenLinks;
      });
      
      if (rakutenFound.length > 0) {
        console.log(`\n✅ ${group.name}で楽天関連案件を発見！`);
        rakutenFound.forEach(item => {
          console.log(`  - ${item.text.substring(0, 50)}...`);
          console.log(`    URL: ${item.url}`);
        });
        found = true;
      }
      
      // ページネーションも確認
      const hasNextPage = await page.$('.pager a[href*="page=2"]');
      if (hasNextPage) {
        console.log('  (複数ページあり)');
      }
    }
    
    if (!found) {
      console.log('\n❌ 楽天市場が見つかりませんでした');
      console.log('別のカテゴリやページにある可能性があります');
    }
    
  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await browser.close();
  }
}

// 実行
findRakuten();