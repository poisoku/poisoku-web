const puppeteer = require('puppeteer');

async function findMoreCategories() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    const iosUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
    await page.setUserAgent(iosUserAgent);
    
    console.log('🔍 ちょびリッチの他のカテゴリURL探索開始\n');

    // 追加のカテゴリパターンをテスト
    const testCategories = [
      // ショッピング系の他の番号
      'https://www.chobirich.com/shopping/shop/105',
      'https://www.chobirich.com/shopping/shop/112',
      'https://www.chobirich.com/shopping/shop/113',
      
      // サービス系の他の番号
      'https://www.chobirich.com/earn/apply/102',
      'https://www.chobirich.com/earn/apply/105',
      'https://www.chobirich.com/earn/apply/112',
      
      // 別のURLパターンの可能性
      'https://www.chobirich.com/service/',
      'https://www.chobirich.com/creditcard/',
      'https://www.chobirich.com/travel/',
      'https://www.chobirich.com/money/',
      'https://www.chobirich.com/game/',
      'https://www.chobirich.com/entertainment/',
      
      // 他の可能性のあるパス
      'https://www.chobirich.com/earn/',
      'https://www.chobirich.com/campaign/',
      'https://www.chobirich.com/special/',
      'https://www.chobirich.com/news/',
      
      // 特定のサービスカテゴリ
      'https://www.chobirich.com/earn/service/',
      'https://www.chobirich.com/earn/credit/',
      'https://www.chobirich.com/earn/travel/',
      'https://www.chobirich.com/earn/money/',
    ];

    const validCategories = [];
    
    for (const testUrl of testCategories) {
      try {
        console.log(`テスト中: ${testUrl}`);
        
        const response = await page.goto(testUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 15000
        });
        
        const status = response.status();
        
        if (status === 200) {
          // ページ内容を確認
          const pageInfo = await page.evaluate(() => {
            const title = document.title;
            const campaignLinks = document.querySelectorAll('a[href*="/ad_details/"]');
            const categoryName = document.querySelector('h1, .page-title, .category-title')?.innerText?.trim() || '';
            
            return {
              title,
              campaignCount: campaignLinks.length,
              categoryName,
              hasCampaigns: campaignLinks.length > 0
            };
          });
          
          if (pageInfo.hasCampaigns) {
            console.log(`  ✅ 有効 - ${pageInfo.campaignCount}件の案件 (${pageInfo.categoryName})`);
            validCategories.push({
              url: testUrl,
              campaignCount: pageInfo.campaignCount,
              categoryName: pageInfo.categoryName,
              title: pageInfo.title
            });
          } else {
            console.log(`  ⚠️ 案件なし - ${pageInfo.title}`);
          }
        } else {
          console.log(`  ❌ ステータス: ${status}`);
        }
        
      } catch (error) {
        console.log(`  ❌ エラー: ${error.message}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`\n📊 新規発見カテゴリ: ${validCategories.length}件\n`);
    
    if (validCategories.length > 0) {
      validCategories.forEach((cat, i) => {
        console.log(`${i + 1}. ${cat.categoryName || 'Unknown'}`);
        console.log(`   URL: ${cat.url}`);
        console.log(`   案件数: ${cat.campaignCount}件`);
        console.log(`   タイトル: ${cat.title}`);
        console.log('');
      });
    }

    // メインページのナビゲーションも確認
    console.log('🏠 メインページのナビゲーション確認...');
    await page.goto('https://www.chobirich.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
    
    const navigationLinks = await page.evaluate(() => {
      const links = [];
      document.querySelectorAll('a').forEach(link => {
        const href = link.getAttribute('href');
        const text = link.innerText?.trim();
        
        if (href && text && (
          href.includes('/earn/') ||
          href.includes('/shopping/') ||
          href.includes('/service') ||
          href.includes('/credit') ||
          href.includes('/travel') ||
          href.includes('/money') ||
          href.includes('/game') ||
          href.includes('/app')
        )) {
          links.push({
            text,
            href: href.startsWith('http') ? href : `https://www.chobirich.com${href}`
          });
        }
      });
      
      return links.filter((link, index, self) => 
        index === self.findIndex(l => l.href === link.href)
      ).slice(0, 10);
    });
    
    console.log('\n🔗 メインページで発見されたカテゴリリンク:');
    navigationLinks.forEach((link, i) => {
      console.log(`${i + 1}. "${link.text}" → ${link.href}`);
    });

  } finally {
    await browser.close();
  }
}

findMoreCategories().catch(console.error);