const puppeteer = require('puppeteer');

async function checkCategoryNames() {
  console.log('🔍 カテゴリ67, 68の名前を確認中...\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // カテゴリ67を確認
    console.log('📍 カテゴリ67にアクセス...');
    await page.goto('https://pointi.jp/list.php?category=67', { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const cat67Info = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      const breadcrumb = document.querySelector('.breadcrumb, .pankuzu, [class*="bread"]');
      const title = document.title;
      
      return {
        h1: h1 ? h1.textContent.trim() : '',
        breadcrumb: breadcrumb ? breadcrumb.textContent.trim() : '',
        title: title
      };
    });
    
    console.log('カテゴリ67:');
    console.log(`  h1: ${cat67Info.h1}`);
    console.log(`  title: ${cat67Info.title}`);
    console.log(`  breadcrumb: ${cat67Info.breadcrumb}`);
    
    // カテゴリ68を確認
    console.log('\n📍 カテゴリ68にアクセス...');
    await page.goto('https://pointi.jp/list.php?category=68', { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const cat68Info = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      const breadcrumb = document.querySelector('.breadcrumb, .pankuzu, [class*="bread"]');
      const title = document.title;
      
      return {
        h1: h1 ? h1.textContent.trim() : '',
        breadcrumb: breadcrumb ? breadcrumb.textContent.trim() : '',
        title: title
      };
    });
    
    console.log('\nカテゴリ68:');
    console.log(`  h1: ${cat68Info.h1}`);
    console.log(`  title: ${cat68Info.title}`);
    console.log(`  breadcrumb: ${cat68Info.breadcrumb}`);
    
    // カテゴリ80（アプリ）も確認
    console.log('\n📍 カテゴリ80を確認（アプリカテゴリの可能性）...');
    await page.goto('https://pointi.jp/list.php?category=80', { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const cat80Info = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      const title = document.title;
      return {
        h1: h1 ? h1.textContent.trim() : '',
        title: title
      };
    });
    
    console.log('\nカテゴリ80:');
    console.log(`  h1: ${cat80Info.h1}`);
    console.log(`  title: ${cat80Info.title}`);
    
  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await browser.close();
  }
}

// 実行
checkCategoryNames();