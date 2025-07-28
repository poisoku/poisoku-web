const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class DebugScraper {
  async debug() {
    console.log('🔍 デバッグモード開始');
    
    const browser = await puppeteer.launch({
      headless: false, // ブラウザを表示
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1280, height: 720 }
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    
    try {
      // ファッションカテゴリで確認
      const url = 'https://pointi.jp/list.php?group=152';
      console.log(`📍 アクセス: ${url}`);
      
      const response = await page.goto(url, { 
        waitUntil: 'networkidle0',
        timeout: 30000
      });
      
      console.log(`📊 HTTPステータス: ${response.status()}`);
      console.log(`📊 レスポンスURL: ${response.url()}`);
      
      // ページタイトル確認
      const title = await page.title();
      console.log(`📊 ページタイトル: ${title}`);
      
      // ページの内容を少し確認
      const bodyText = await page.evaluate(() => {
        return document.body ? document.body.innerText.substring(0, 200) : 'ボディなし';
      });
      console.log(`📊 ページ内容（最初の200文字）:\n${bodyText}`);
      
      // 案件リンクのセレクタを複数試す
      const selectors = [
        '.box_ad_inner a[href*="/ad/"]',
        'a[href*="/ad/"]',
        '.campaign-link',
        '.ad-link',
        '[href*="pointi.jp/ad/"]'
      ];
      
      for (const selector of selectors) {
        console.log(`\n🔍 セレクタテスト: ${selector}`);
        
        try {
          const links = await page.$$eval(selector, elements => {
            return elements.map(el => ({
              href: el.href,
              text: el.textContent.trim().substring(0, 50)
            }));
          });
          
          console.log(`📊 発見リンク数: ${links.length}件`);
          
          if (links.length > 0) {
            console.log('📋 最初の3件:');
            links.slice(0, 3).forEach((link, i) => {
              console.log(`  ${i + 1}. ${link.text} - ${link.href}`);
            });
          }
        } catch (error) {
          console.log(`❌ セレクタエラー: ${error.message}`);
        }
      }
      
      // ページのHTMLを部分的に保存
      const html = await page.content();
      await fs.writeFile('debug_page.html', html);
      console.log('\n💾 ページHTMLを debug_page.html に保存しました');
      
      // スクリーンショット撮影
      await page.screenshot({ path: 'debug_screenshot.png', fullPage: false });
      console.log('📸 スクリーンショットを debug_screenshot.png に保存しました');
      
      console.log('\n⏸️ ブラウザを10秒間表示します（手動確認用）');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
    } catch (error) {
      console.error('❌ デバッグエラー:', error);
    } finally {
      await browser.close();
    }
  }
}

// 実行
(async () => {
  const scraper = new DebugScraper();
  await scraper.debug();
})();