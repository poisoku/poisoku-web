#!/usr/bin/env node

/**
 * 詳細なページネーション存在確認
 * 実際にpage=2にアクセスして確認
 */

const puppeteer = require('puppeteer');

async function detailedPaginationCheck() {
  console.log('🔍 詳細ページネーション存在確認');
  
  const testUrl = 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=80&af_sorter=1&page=1';
  
  const browser = await puppeteer.launch({
    headless: false, // 視覚的確認のため
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });
  
  try {
    console.log(`\n📂 総合通販カテゴリの詳細調査`);
    console.log(`🔗 URL: ${testUrl}`);
    
    // ページ1の詳細調査
    console.log('\n📄 ページ1の詳細調査');
    const page1 = await browser.newPage();
    
    await page1.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page1.goto(testUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    await new Promise(r => setTimeout(r, 5000));
    
    const page1Info = await page1.evaluate(() => {
      const result = {
        title: document.title,
        url: window.location.href,
        mainContentItems: 0,
        allPageLinks: [],
        paginationHTML: '',
        totalCountText: '',
        nextPageLink: null,
        bodyText: ''
      };
      
      // メインコンテンツアイテム数
      const items = document.querySelectorAll('.m-list__item');
      result.mainContentItems = items.length;
      
      // 全てのページリンクを詳細に調査
      const allLinks = document.querySelectorAll('a[href]');
      allLinks.forEach(link => {
        const href = link.href;
        const text = link.textContent.trim();
        const className = link.className;
        
        if (href.includes('page=') || text.match(/\d+/) || text.includes('次') || text.includes('前') || text.includes('next') || text.includes('prev')) {
          result.allPageLinks.push({
            href: href,
            text: text,
            className: className
          });
        }
      });
      
      // ページネーション関連のHTML要素を探す
      const paginationSelectors = [
        '.pagination',
        '.pager', 
        '.page-nav',
        '[class*="pagination"]',
        '[class*="pager"]',
        '[class*="page"]'
      ];
      
      paginationSelectors.forEach(selector => {
        const element = document.querySelector(selector);
        if (element) {
          result.paginationHTML += `${selector}: ${element.outerHTML.slice(0, 300)}\n`;
        }
      });
      
      // 件数表示を詳細に探す
      const countSelectors = ['h1', '.count', '.total', '[class*="count"]', '[class*="total"]'];
      countSelectors.forEach(selector => {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent.trim();
          if (text.includes('件') || text.match(/\d+/)) {
            result.totalCountText += `${selector}: ${text}\n`;
          }
        }
      });
      
      // 次のページリンクを詳細に探す
      const nextSelectors = [
        'a[href*="page=2"]',
        'a:contains("次")',
        'a:contains(">")',
        'a:contains("next")',
        '.next',
        '.pagination a:last-child'
      ];
      
      nextSelectors.forEach(selector => {
        try {
          const element = document.querySelector(selector);
          if (element) {
            result.nextPageLink = {
              selector: selector,
              href: element.href,
              text: element.textContent.trim()
            };
          }
        } catch (e) {
          // セレクタエラーは無視
        }
      });
      
      // 全体のテキストから件数情報を探す
      result.bodyText = document.body.textContent.slice(0, 1000);
      
      return result;
    });
    
    console.log(`  📊 1ページ目案件数: ${page1Info.mainContentItems}件`);
    console.log(`  📄 タイトル: ${page1Info.title}`);
    console.log(`  🔗 検出されたページリンク: ${page1Info.allPageLinks.length}個`);
    
    if (page1Info.allPageLinks.length > 0) {
      console.log(`  📋 ページリンク詳細:`);
      page1Info.allPageLinks.slice(0, 10).forEach((link, i) => {
        console.log(`    ${i + 1}. "${link.text}" → ${link.href.slice(0, 80)}...`);
      });
    }
    
    if (page1Info.totalCountText) {
      console.log(`  📈 件数表示: ${page1Info.totalCountText.replace(/\n/g, ' | ')}`);
    }
    
    if (page1Info.nextPageLink) {
      console.log(`  ➡️ 次ページリンク発見: "${page1Info.nextPageLink.text}" → ${page1Info.nextPageLink.href}`);
    }
    
    await page1.close();
    
    // ページ2への直接アクセステスト
    console.log('\n📄 ページ2への直接アクセステスト');
    const page2Url = testUrl.replace('page=1', 'page=2');
    const page2 = await browser.newPage();
    
    try {
      await page2.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      console.log(`  🔗 ページ2 URL: ${page2Url}`);
      
      await page2.goto(page2Url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      await new Promise(r => setTimeout(r, 3000));
      
      const page2Info = await page2.evaluate(() => {
        const result = {
          title: document.title,
          url: window.location.href,
          mainContentItems: 0,
          isValidPage: false,
          errorMessage: '',
          hasContent: false
        };
        
        // メインコンテンツアイテム数
        const items = document.querySelectorAll('.m-list__item');
        result.mainContentItems = items.length;
        result.hasContent = items.length > 0;
        
        // エラーページかどうかチェック
        const bodyText = document.body.textContent.toLowerCase();
        if (bodyText.includes('error') || bodyText.includes('not found') || bodyText.includes('エラー')) {
          result.errorMessage = bodyText.slice(0, 200);
        } else {
          result.isValidPage = true;
        }
        
        return result;
      });
      
      console.log(`  📊 ページ2案件数: ${page2Info.mainContentItems}件`);
      console.log(`  ✅ 有効なページ: ${page2Info.isValidPage ? 'はい' : 'いいえ'}`);
      console.log(`  📝 コンテンツ存在: ${page2Info.hasContent ? 'あり' : 'なし'}`);
      
      if (page2Info.mainContentItems > 0) {
        console.log(`  🎉 ページ2に案件発見！複数ページ確認`);
      } else {
        console.log(`  ⚠️ ページ2に案件なし`);
      }
      
      if (page2Info.errorMessage) {
        console.log(`  ❌ エラー: ${page2Info.errorMessage}`);
      }
      
    } catch (error) {
      console.error(`  ❌ ページ2アクセスエラー: ${error.message}`);
    } finally {
      await page2.close();
    }
    
    // ページ3のテストも実行
    console.log('\n📄 ページ3への直接アクセステスト');
    const page3Url = testUrl.replace('page=1', 'page=3');
    const page3 = await browser.newPage();
    
    try {
      await page3.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      await page3.goto(page3Url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 3000));
      
      const page3Info = await page3.evaluate(() => {
        const items = document.querySelectorAll('.m-list__item');
        return { mainContentItems: items.length, hasContent: items.length > 0 };
      });
      
      console.log(`  📊 ページ3案件数: ${page3Info.mainContentItems}件`);
      
      if (page3Info.mainContentItems > 0) {
        console.log(`  🎉 ページ3にも案件発見！さらに多ページ存在`);
      }
      
    } catch (error) {
      console.error(`  ❌ ページ3アクセスエラー: ${error.message}`);
    } finally {
      await page3.close();
    }
    
    console.log('\n⏱️ 5秒後にブラウザを閉じます...');
    await new Promise(r => setTimeout(r, 5000));
    
  } catch (error) {
    console.error('❌ 全体エラー:', error);
  } finally {
    await browser.close();
  }
}

detailedPaginationCheck().catch(console.error);