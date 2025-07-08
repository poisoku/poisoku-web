const puppeteer = require('puppeteer');

async function findAllCategories() {
  console.log('🔍 ポイントインカムの全カテゴリIDを調査中...\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // トップページにアクセス
    console.log('📍 トップページにアクセス...');
    await page.goto('https://pointi.jp', { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // カテゴリリンクを収集
    const categoryLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="list.php?category="]'));
      const categories = {};
      
      links.forEach(link => {
        const match = link.href.match(/category=(\d+)/);
        if (match) {
          const categoryId = match[1];
          const categoryName = link.textContent.trim();
          if (categoryName && !categories[categoryId]) {
            categories[categoryId] = categoryName;
          }
        }
      });
      
      return categories;
    });
    
    console.log('✅ 発見したカテゴリ一覧:\n');
    
    const categoryArray = [];
    for (const [id, name] of Object.entries(categoryLinks)) {
      console.log(`  { name: '${name}', id: ${id} },`);
      categoryArray.push({ name, id: parseInt(id) });
    }
    
    // サービスページなど他のページも確認
    console.log('\n📍 サービスページを確認...');
    await page.goto('https://pointi.jp/service/', { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const serviceCategories = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="list.php?category="]'));
      const categories = {};
      
      links.forEach(link => {
        const match = link.href.match(/category=(\d+)/);
        if (match) {
          const categoryId = match[1];
          const categoryName = link.textContent.trim();
          if (categoryName && !categories[categoryId]) {
            categories[categoryId] = categoryName;
          }
        }
      });
      
      return categories;
    });
    
    console.log('\n✅ サービスページで追加発見:');
    for (const [id, name] of Object.entries(serviceCategories)) {
      if (!categoryArray.find(cat => cat.id === parseInt(id))) {
        console.log(`  { name: '${name}', id: ${id} },`);
        categoryArray.push({ name, id: parseInt(id) });
      }
    }
    
    // カテゴリIDを直接試してみる（一般的なIDパターン）
    console.log('\n📍 追加のカテゴリIDを確認中...');
    const testIds = [67, 68, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90];
    
    for (const testId of testIds) {
      try {
        const testUrl = `https://pointi.jp/list.php?category=${testId}`;
        const response = await page.goto(testUrl, { 
          waitUntil: 'domcontentloaded', 
          timeout: 10000 
        });
        
        if (response && response.status() === 200) {
          // ページタイトルやh1からカテゴリ名を取得
          const categoryInfo = await page.evaluate(() => {
            const h1 = document.querySelector('h1');
            const title = document.title;
            return {
              h1: h1 ? h1.textContent.trim() : '',
              title: title
            };
          });
          
          if (!categoryArray.find(cat => cat.id === testId)) {
            const name = categoryInfo.h1 || `カテゴリ${testId}`;
            console.log(`  ✅ ID ${testId}: ${name}`);
            categoryArray.push({ name, id: testId });
          }
        }
      } catch (error) {
        // 404や他のエラーは無視
      }
    }
    
    // 最終的なカテゴリ配列を出力
    console.log('\n📋 最終的なカテゴリ配列（コピー用）:\n');
    console.log('const categories = [');
    categoryArray
      .sort((a, b) => a.id - b.id)
      .forEach(cat => {
        console.log(`  { name: '${cat.name}', id: ${cat.id} },`);
      });
    console.log('];');
    
    console.log(`\n✅ 合計 ${categoryArray.length} カテゴリを発見`);
    
  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await browser.close();
  }
}

// 実行
findAllCategories();