const puppeteer = require('puppeteer');

async function identifyServiceCategories() {
  console.log('🔍 サービス系カテゴリ名を調査中...\n');
  
  // ユーザーから提供されたカテゴリID
  const categoryIds = [
    70, 75, 281, 73, 74, 276, 78, 235, 79, 240,
    72, 76, 81, 274, 237, 209, 271, 232, 269, 234,
    238, 280, 272, 278, 277, 283, 279, 77, 236, 270, 82
  ];
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    const categories = [];
    
    // 最初の10個をテスト
    for (let i = 0; i < Math.min(10, categoryIds.length); i++) {
      const id = categoryIds[i];
      const url = `https://pointi.jp/list.php?category=${id}`;
      
      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // カテゴリ名を取得
        const categoryInfo = await page.evaluate(() => {
          // パンくずリストから取得を試みる
          const breadcrumb = document.querySelector('.breadcrumb li:last-child');
          const h1 = document.querySelector('h1');
          const pageTitle = document.querySelector('.page-title');
          
          let categoryName = '';
          if (breadcrumb && breadcrumb.textContent) {
            categoryName = breadcrumb.textContent.trim();
          } else if (h1) {
            categoryName = h1.textContent.trim();
          } else if (pageTitle) {
            categoryName = pageTitle.textContent.trim();
          } else {
            // タイトルタグから取得
            categoryName = document.title.split('|')[0].trim();
          }
          
          // 案件数も取得
          const campaigns = document.querySelectorAll('.box_ad_inner a[href*="/ad/"]');
          
          return {
            name: categoryName,
            campaignCount: campaigns.length
          };
        });
        
        console.log(`✅ ID ${id}: ${categoryInfo.name} (${categoryInfo.campaignCount}件)`);
        categories.push({
          id: id,
          name: categoryInfo.name,
          count: categoryInfo.campaignCount
        });
        
      } catch (error) {
        console.log(`❌ ID ${id}: アクセスエラー`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n📋 カテゴリリスト（コード形式）:');
    categories.forEach(cat => {
      console.log(`  { name: '${cat.name}', id: ${cat.id}, type: 'category' },`);
    });
    
  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await browser.close();
  }
}

identifyServiceCategories();