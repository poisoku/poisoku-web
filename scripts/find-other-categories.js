const puppeteer = require('puppeteer');

async function findOtherCategories() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    console.log('ちょびリッチのトップページから他のカテゴリーを探索...\n');
    await page.goto('https://www.chobirich.com/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // カテゴリーリンクを探す
    const categories = await page.evaluate(() => {
      const result = {
        navigationLinks: [],
        categoryLinks: [],
        menuLinks: []
      };

      // メインナビゲーションを探す
      const navSelectors = [
        'nav a', '.nav a', '.menu a', '.navigation a',
        'header a', '.category a', '[class*="category"] a'
      ];

      navSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(link => {
          const href = link.getAttribute('href');
          const text = link.textContent.trim();
          
          if (href && text && href.includes('/')) {
            result.navigationLinks.push({
              text: text,
              href: href,
              fullUrl: href.startsWith('http') ? href : `https://www.chobirich.com${href}`
            });
          }
        });
      });

      // 特定のカテゴリーキーワードを含むリンクを探す
      const categoryKeywords = [
        'ショッピング', 'サービス', 'クレジットカード', 'クレカ', 
        '旅行', 'トラベル', 'アプリ', 'ゲーム', 'FX', '証券',
        'マネー', '金融', '保険', '美容', '健康', 'グルメ'
      ];

      document.querySelectorAll('a').forEach(link => {
        const href = link.getAttribute('href');
        const text = link.textContent.trim();
        
        if (href && text) {
          categoryKeywords.forEach(keyword => {
            if (text.includes(keyword) || href.includes(keyword.toLowerCase())) {
              result.categoryLinks.push({
                keyword: keyword,
                text: text,
                href: href,
                fullUrl: href.startsWith('http') ? href : `https://www.chobirich.com${href}`
              });
            }
          });
        }
      });

      // URLパターンから推測
      document.querySelectorAll('a').forEach(link => {
        const href = link.getAttribute('href');
        
        if (href) {
          // /category/, /service/, /creditcard/ などのパターンを探す
          const patterns = [
            /\/(service|サービス)/,
            /\/(creditcard|クレジット)/,
            /\/(travel|旅行)/,
            /\/(money|マネー|金融)/,
            /\/(app|アプリ)/,
            /\/(game|ゲーム)/
          ];

          patterns.forEach(pattern => {
            if (pattern.test(href)) {
              result.menuLinks.push({
                pattern: pattern.source,
                text: link.textContent.trim(),
                href: href,
                fullUrl: href.startsWith('http') ? href : `https://www.chobirich.com${href}`
              });
            }
          });
        }
      });

      return result;
    });

    console.log('=== ナビゲーションリンク ===');
    const uniqueNav = categories.navigationLinks
      .filter((link, index, self) => 
        index === self.findIndex(l => l.href === link.href)
      )
      .slice(0, 20);
    
    uniqueNav.forEach((link, i) => {
      console.log(`${i + 1}. "${link.text}" → ${link.href}`);
    });

    console.log('\n=== カテゴリー関連リンク ===');
    const uniqueCategory = categories.categoryLinks
      .filter((link, index, self) => 
        index === self.findIndex(l => l.href === link.href)
      )
      .slice(0, 15);
    
    uniqueCategory.forEach((link, i) => {
      console.log(`${i + 1}. [${link.keyword}] "${link.text}" → ${link.href}`);
    });

    console.log('\n=== URLパターンマッチ ===');
    const uniqueMenu = categories.menuLinks
      .filter((link, index, self) => 
        index === self.findIndex(l => l.href === link.href)
      );
    
    uniqueMenu.forEach((link, i) => {
      console.log(`${i + 1}. [${link.pattern}] "${link.text}" → ${link.href}`);
    });

    // 推測される主要カテゴリーURLをテスト
    console.log('\n=== 推測カテゴリーURLのテスト ===');
    const testUrls = [
      'https://www.chobirich.com/service/serv/101/',
      'https://www.chobirich.com/creditcard/card/101/',
      'https://www.chobirich.com/travel/tra/101/',
      'https://www.chobirich.com/money/mon/101/',
      'https://www.chobirich.com/app/app/101/',
      'https://www.chobirich.com/game/gam/101/'
    ];

    for (const testUrl of testUrls) {
      try {
        console.log(`テスト中: ${testUrl}`);
        const response = await page.goto(testUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 15000
        });
        
        const status = response.status();
        console.log(`  → ステータス: ${status} ${status < 400 ? '✅' : '❌'}`);
        
        if (status < 400) {
          // 案件数を確認
          const campaignCount = await page.evaluate(() => {
            return document.querySelectorAll('a[href*="/ad_details/"]').length;
          });
          console.log(`  → 案件数: ${campaignCount}件`);
        }
        
      } catch (error) {
        console.log(`  → エラー: ${error.message}`);
      }
    }

  } finally {
    await browser.close();
  }
}

findOtherCategories().catch(console.error);