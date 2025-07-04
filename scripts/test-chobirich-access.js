const puppeteer = require('puppeteer');

async function testAccess() {
  console.log('🔍 ちょびリッチアクセステスト開始...\n');
  
  const browser = await puppeteer.launch({
    headless: false, // ブラウザを表示
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // 通常のブラウザのUser-Agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('1. トップページテスト...');
    await page.goto('https://www.chobirich.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    await page.waitForTimeout(3000);
    
    const topPageTitle = await page.title();
    console.log(`   タイトル: ${topPageTitle}`);
    
    if (topPageTitle.includes('403') || topPageTitle.includes('Forbidden')) {
      console.log('❌ トップページでブロックされています');
      return false;
    }
    
    console.log('✅ トップページアクセス成功');
    
    console.log('\n2. 案件ページテスト...');
    await page.goto('https://www.chobirich.com/ad_details/1794491/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    await page.waitForTimeout(3000);
    
    const adPageTitle = await page.title();
    console.log(`   タイトル: ${adPageTitle}`);
    
    if (adPageTitle.includes('403') || adPageTitle.includes('Forbidden')) {
      console.log('❌ 案件ページでブロックされています');
      return false;
    }
    
    const pageText = await page.evaluate(() => document.body.textContent);
    
    if (pageText.includes('Forbidden') || pageText.includes('アクセスが拒否')) {
      console.log('❌ 案件ページでアクセス拒否されています');
      return false;
    }
    
    console.log('✅ 案件ページアクセス成功');
    
    // 案件名を取得してみる
    const campaignName = await page.evaluate(() => {
      const titleElement = document.querySelector('h1.AdDetails__title, h1');
      return titleElement ? titleElement.textContent.trim() : 'なし';
    });
    
    console.log(`   案件名: ${campaignName}`);
    
    console.log('\n🎉 アクセステスト完了 - ブロックされていません');
    return true;
    
  } catch (error) {
    console.error('❌ アクセステストエラー:', error.message);
    return false;
  } finally {
    await browser.close();
  }
}

testAccess().then(success => {
  if (success) {
    console.log('\n✅ 結論: アクセス可能です');
    console.log('💡 提案: より人間らしいアクセスパターンでスクレイピングを試してください');
  } else {
    console.log('\n❌ 結論: ブロックされています');
    console.log('⏰ 提案: 数時間〜1日待ってから再試行してください');
  }
}).catch(console.error);