const puppeteer = require('puppeteer');

async function analyzeChobirich() {
  console.log('ちょびリッチのサイト構造を調査開始...\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('1. トップページにアクセス...');
    await page.goto('https://www.chobirich.com/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // ページタイトル取得
    const title = await page.title();
    console.log('ページタイトル:', title);
    
    // カテゴリーリンクを探す
    console.log('\n2. カテゴリー/ナビゲーション構造を調査...');
    const navigation = await page.evaluate(() => {
      const results = {
        mainMenu: [],
        categories: [],
        campaignSections: []
      };
      
      // メインメニューを探す
      const menuSelectors = ['nav a', '.menu a', '.nav-link', '[class*="menu"] a', '.header a'];
      menuSelectors.forEach(selector => {
        const links = document.querySelectorAll(selector);
        links.forEach(link => {
          const href = link.getAttribute('href');
          const text = link.textContent.trim();
          if (href && text && !href.startsWith('#') && !href.includes('javascript:')) {
            results.mainMenu.push({ text, href });
          }
        });
      });
      
      // カテゴリーリンクを探す
      const categorySelectors = [
        'a[href*="category"]', 'a[href*="genre"]', 'a[href*="/c/"]',
        '.category a', '[class*="category"] a'
      ];
      categorySelectors.forEach(selector => {
        const links = document.querySelectorAll(selector);
        links.forEach(link => {
          const href = link.getAttribute('href');
          const text = link.textContent.trim();
          if (href && text) {
            results.categories.push({ text, href });
          }
        });
      });
      
      // 案件セクションを探す
      const sectionSelectors = ['.campaign', '.offer', '.item', '[class*="campaign"]', '[class*="offer"]'];
      sectionSelectors.forEach(selector => {
        const sections = document.querySelectorAll(selector);
        if (sections.length > 0) {
          results.campaignSections.push({
            selector,
            count: sections.length
          });
        }
      });
      
      return results;
    });
    
    console.log('メインメニュー:', navigation.mainMenu.slice(0, 10));
    console.log('カテゴリー:', navigation.categories.slice(0, 10));
    console.log('案件セクション:', navigation.campaignSections);
    
    // 案件データの構造を調査
    console.log('\n3. 案件データ構造を調査...');
    const campaignData = await page.evaluate(() => {
      const campaigns = [];
      
      // 一般的な案件要素を探す
      const selectors = [
        'a[href*="click"]', 'a[href*="redirect"]', 'a[href*="/ad/"]',
        '.campaign-item', '.offer-item', '[class*="item"]',
        'div[class*="card"]', 'article'
      ];
      
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          elements.forEach((el, index) => {
            if (index < 5) { // 最初の5件のみ
              const campaign = {
                selector,
                text: el.textContent.trim().substring(0, 100),
                href: el.getAttribute('href') || el.querySelector('a')?.getAttribute('href'),
                // ポイント数を探す
                points: (() => {
                  const text = el.textContent;
                  const matches = text.match(/(\d+(?:,\d+)?)\s*(?:pt|ポイント|円|%)/i);
                  return matches ? matches[0] : null;
                })()
              };
              if (campaign.text.length > 10) {
                campaigns.push(campaign);
              }
            }
          });
        }
      }
      
      return campaigns;
    });
    
    console.log('見つかった案件サンプル:');
    campaignData.forEach((campaign, i) => {
      console.log(`\n案件 ${i + 1}:`);
      console.log('セレクタ:', campaign.selector);
      console.log('テキスト:', campaign.text);
      console.log('リンク:', campaign.href);
      console.log('ポイント:', campaign.points);
    });
    
    // URLパターンを分析
    console.log('\n4. URLパターンを分析...');
    const allLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links
        .map(link => link.getAttribute('href'))
        .filter(href => href && href.startsWith('/') && !href.startsWith('//'))
        .filter((v, i, a) => a.indexOf(v) === i); // 重複削除
    });
    
    const patterns = {
      category: allLinks.filter(url => url.includes('category') || url.includes('genre')),
      campaign: allLinks.filter(url => url.includes('campaign') || url.includes('detail') || url.includes('ad')),
      other: allLinks.filter(url => url.includes('ranking') || url.includes('new'))
    };
    
    console.log('カテゴリーURL:', patterns.category.slice(0, 5));
    console.log('案件URL:', patterns.campaign.slice(0, 5));
    console.log('その他URL:', patterns.other.slice(0, 5));
    
    // スクリーンショット保存
    await page.screenshot({ path: 'chobirich-homepage.png', fullPage: false });
    console.log('\nスクリーンショットを保存: chobirich-homepage.png');
    
  } catch (error) {
    console.error('エラー:', error.message);
  } finally {
    await browser.close();
  }
}

// Puppeteerがインストールされているか確認
try {
  require.resolve('puppeteer');
  analyzeChobirich();
} catch (e) {
  console.log('Puppeteerがインストールされていません。');
  console.log('実行: npm install puppeteer');
}