const puppeteer = require('puppeteer');

async function checkPagination() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // ショッピングカテゴリーの1ページ目
    console.log('ショッピングカテゴリー1ページ目を確認...');
    await page.goto('https://www.chobirich.com/shopping/shop/101/', {
      waitUntil: 'networkidle2'
    });

    // ページネーションリンクを探す
    const paginationInfo = await page.evaluate(() => {
      const info = {
        currentUrl: window.location.href,
        paginationLinks: [],
        nextPageLink: null,
        pageNumbers: []
      };

      // ページネーション要素を探す
      const selectors = [
        '.pagination a',
        '.pager a',
        'a[href*="page="]',
        'a[href*="/p/"]',
        'a[href*="/page/"]',
        '.next a',
        'a.next',
        'a[rel="next"]'
      ];

      selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(link => {
          const href = link.getAttribute('href');
          const text = link.textContent.trim();
          if (href && !info.paginationLinks.find(l => l.href === href)) {
            info.paginationLinks.push({
              href: href,
              text: text,
              fullUrl: new URL(href, window.location.origin).href
            });
          }
        });
      });

      // 「次へ」リンクを特定
      const nextPatterns = ['次へ', 'next', '>', '»'];
      info.paginationLinks.forEach(link => {
        if (nextPatterns.some(pattern => link.text.toLowerCase().includes(pattern.toLowerCase()))) {
          info.nextPageLink = link;
        }
      });

      // ページ番号を抽出
      info.paginationLinks.forEach(link => {
        const pageNum = parseInt(link.text);
        if (!isNaN(pageNum)) {
          info.pageNumbers.push(pageNum);
        }
      });

      return info;
    });

    console.log('\n=== ページネーション情報 ===');
    console.log('現在のURL:', paginationInfo.currentUrl);
    console.log('\nページネーションリンク:');
    paginationInfo.paginationLinks.forEach(link => {
      console.log(`- ${link.text}: ${link.href}`);
    });

    if (paginationInfo.nextPageLink) {
      console.log('\n次ページリンク:', paginationInfo.nextPageLink.href);
    }

    if (paginationInfo.pageNumbers.length > 0) {
      console.log('\nページ番号:', paginationInfo.pageNumbers);
    }

    // URLパターンを分析
    console.log('\n=== URLパターン分析 ===');
    const urlPatterns = new Set();
    paginationInfo.paginationLinks.forEach(link => {
      // URLからパターンを抽出
      const patterns = [
        /page=(\d+)/,
        /\/p\/(\d+)/,
        /\/page\/(\d+)/,
        /\/(\d+)\/$/
      ];
      
      patterns.forEach(pattern => {
        const match = link.href.match(pattern);
        if (match) {
          urlPatterns.add(`パターン: ${pattern.source} - 例: ${link.href}`);
        }
      });
    });

    urlPatterns.forEach(pattern => console.log(pattern));

    // スクリーンショット
    await page.screenshot({ path: 'chobirich-pagination.png' });
    console.log('\nスクリーンショット保存: chobirich-pagination.png');

  } finally {
    await browser.close();
  }
}

checkPagination().catch(console.error);