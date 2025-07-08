const puppeteer = require('puppeteer');

async function testPointIncomeStructure() {
  console.log('🔍 ポイントインカムのサイト構造を調査中...\n');
  
  const browser = await puppeteer.launch({
    headless: false, // ブラウザを表示
    args: ['--no-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // トップページにアクセス
    console.log('📍 トップページアクセス中...');
    await page.goto('https://pointi.jp', { waitUntil: 'networkidle2' });
    
    // カテゴリリンクを探す
    console.log('\n📂 カテゴリ情報を取得中...');
    const categoryInfo = await page.evaluate(() => {
      const categories = [];
      
      // ナビゲーションメニューを探す
      const navSelectors = [
        'nav a',
        '.nav-menu a',
        '.menu a',
        '.category-list a',
        '[class*="nav"] a',
        '[class*="menu"] a'
      ];
      
      for (const selector of navSelectors) {
        const links = document.querySelectorAll(selector);
        if (links.length > 0) {
          links.forEach(link => {
            if (link.href && link.textContent) {
              categories.push({
                text: link.textContent.trim(),
                url: link.href,
                selector: selector
              });
            }
          });
          break;
        }
      }
      
      return {
        categories: categories.slice(0, 20), // 最初の20件
        totalFound: categories.length
      };
    });
    
    console.log(`✅ ${categoryInfo.totalFound}個のリンクを発見`);
    console.log('\n主要なカテゴリ:');
    categoryInfo.categories.forEach(cat => {
      console.log(`  - ${cat.text}: ${cat.url}`);
    });
    
    // ショッピングページを試す
    console.log('\n📍 ショッピングページを探索中...');
    const shoppingUrls = [
      'https://pointi.jp/shopping',
      'https://pointi.jp/contents/shopping',
      'https://pointi.jp/category/shopping'
    ];
    
    for (const url of shoppingUrls) {
      try {
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
        if (response && response.status() === 200) {
          console.log(`✅ 有効なURL発見: ${url}`);
          
          // 案件要素を探す
          const campaignInfo = await page.evaluate(() => {
            const selectors = [
              '.campaign-item',
              '.offer-item',
              '.shop-item',
              'article',
              '.list-item',
              '[class*="campaign"]',
              '[class*="offer"]',
              '.case-list li',
              '.point-list li'
            ];
            
            const found = [];
            for (const selector of selectors) {
              const elements = document.querySelectorAll(selector);
              if (elements.length > 0) {
                // 最初の要素のHTML構造を取得
                const firstEl = elements[0];
                const structure = {
                  selector: selector,
                  count: elements.length,
                  html: firstEl.outerHTML.substring(0, 500),
                  classes: firstEl.className,
                  links: Array.from(firstEl.querySelectorAll('a')).map(a => a.href)
                };
                found.push(structure);
              }
            }
            
            return found;
          });
          
          if (campaignInfo.length > 0) {
            console.log('\n🎯 案件要素を発見:');
            campaignInfo.forEach(info => {
              console.log(`  セレクタ: ${info.selector}`);
              console.log(`  件数: ${info.count}件`);
              console.log(`  クラス: ${info.classes}`);
              console.log('---');
            });
          }
          
          break;
        }
      } catch (error) {
        console.log(`❌ ${url} はアクセスできません`);
      }
    }
    
    // 特定の案件詳細ページの構造を確認
    console.log('\n📍 案件詳細ページの構造を確認中...');
    const detailLinks = await page.$$eval('a[href*="/ad/"], a[href*="/offer/"], a[href*="/campaign/"]', links => 
      links.slice(0, 3).map(link => link.href)
    );
    
    if (detailLinks.length > 0) {
      console.log(`\n詳細ページ例: ${detailLinks[0]}`);
      await page.goto(detailLinks[0], { waitUntil: 'networkidle2' });
      
      const detailStructure = await page.evaluate(() => {
        const info = {
          title: '',
          cashback: '',
          selectors: {}
        };
        
        // タイトル要素を探す
        const titleSelectors = ['h1', 'h2', '.title', '[class*="title"]'];
        for (const sel of titleSelectors) {
          const el = document.querySelector(sel);
          if (el && el.textContent.trim()) {
            info.title = el.textContent.trim();
            info.selectors.title = sel;
            break;
          }
        }
        
        // 還元率要素を探す
        const cashbackSelectors = ['.point', '.cashback', '[class*="point"]', '[class*="cashback"]'];
        for (const sel of cashbackSelectors) {
          const el = document.querySelector(sel);
          if (el && el.textContent.match(/\d/)) {
            info.cashback = el.textContent.trim();
            info.selectors.cashback = sel;
            break;
          }
        }
        
        // 円分表記を探す
        const yenText = document.body.textContent.match(/[(（]\d{1,3}(?:,\d{3})*円分[)）]/);
        if (yenText) {
          info.yenNotation = yenText[0];
        }
        
        return info;
      });
      
      console.log('\n詳細ページ構造:');
      console.log(`  タイトル: ${detailStructure.title}`);
      console.log(`  還元率: ${detailStructure.cashback}`);
      if (detailStructure.yenNotation) {
        console.log(`  円表記: ${detailStructure.yenNotation}`);
      }
      console.log(`  セレクタ:`, detailStructure.selectors);
    }
    
    console.log('\n✅ 調査完了！');
    
  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await browser.close();
  }
}

// 実行
testPointIncomeStructure();