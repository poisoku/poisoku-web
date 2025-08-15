#!/usr/bin/env node

/**
 * モッピーページネーション調査
 * 各カテゴリのページ数を確認
 */

const puppeteer = require('puppeteer');

async function investigatePagination() {
  console.log('📄 モッピーページネーション調査開始');
  
  const testCategories = [
    {
      url: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=80&af_sorter=1&page=1',
      name: '総合通販',
      type: 'shopping'
    },
    {
      url: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=51&af_sorter=1&page=1',
      name: '金融・投資',
      type: 'service'
    },
    {
      url: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=143&af_sorter=1&page=1',
      name: 'ファッション',
      type: 'shopping'
    }
  ];
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });
  
  try {
    for (const category of testCategories) {
      console.log(`\n📂 カテゴリ: ${category.name}`);
      console.log(`🔗 URL: ${category.url}`);
      
      const page = await browser.newPage();
      
      try {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.goto(category.url, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        
        await new Promise(r => setTimeout(r, 3000));
        
        const paginationInfo = await page.evaluate(() => {
          const result = {
            totalItemsText: '',
            totalItems: 0,
            currentPage: 1,
            totalPages: 0,
            paginationExists: false,
            paginationLinks: [],
            nextPageExists: false,
            itemsPerPage: 0
          };
          
          // 総件数の取得
          const totalText = document.querySelector('h1, .total, [class*="count"], [class*="total"]');
          if (totalText) {
            result.totalItemsText = totalText.textContent.trim();
            const match = result.totalItemsText.match(/(\d+)件/);
            if (match) {
              result.totalItems = parseInt(match[1]);
            }
          }
          
          // 1ページ目の案件数をカウント
          const mainContentItems = document.querySelectorAll('.m-list__item');
          result.itemsPerPage = mainContentItems.length;
          
          // ページネーション要素の検索
          const paginationSelectors = [
            '.pagination',
            '.pager',
            '[class*="page"]',
            'a[href*="page="]'
          ];
          
          paginationSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              result.paginationExists = true;
            }
          });
          
          // ページリンクの収集
          const pageLinks = document.querySelectorAll('a[href*="page="]');
          pageLinks.forEach(link => {
            const href = link.href;
            const pageMatch = href.match(/page=(\d+)/);
            if (pageMatch) {
              const pageNum = parseInt(pageMatch[1]);
              if (!result.paginationLinks.includes(pageNum)) {
                result.paginationLinks.push(pageNum);
              }
            }
          });
          
          result.paginationLinks.sort((a, b) => a - b);
          if (result.paginationLinks.length > 0) {
            result.totalPages = Math.max(...result.paginationLinks);
          }
          
          // 次のページリンクの存在確認
          const nextLink = document.querySelector('a[href*="page=2"], a[href*="次"], a[href*="next"]');
          result.nextPageExists = !!nextLink;
          
          // 総件数から推定ページ数を計算
          if (result.totalItems > 0 && result.itemsPerPage > 0) {
            const estimatedPages = Math.ceil(result.totalItems / result.itemsPerPage);
            if (result.totalPages === 0) {
              result.totalPages = estimatedPages;
            }
          }
          
          return result;
        });
        
        // 結果表示
        console.log(`📊 ページネーション情報:`);
        console.log(`  総件数表示: "${paginationInfo.totalItemsText}"`);
        console.log(`  総件数: ${paginationInfo.totalItems}件`);
        console.log(`  1ページ目の案件数: ${paginationInfo.itemsPerPage}件`);
        console.log(`  ページネーション存在: ${paginationInfo.paginationExists ? 'あり' : 'なし'}`);
        console.log(`  検出されたページ: [${paginationInfo.paginationLinks.join(', ')}]`);
        console.log(`  推定総ページ数: ${paginationInfo.totalPages}ページ`);
        console.log(`  次ページリンク: ${paginationInfo.nextPageExists ? 'あり' : 'なし'}`);
        
        if (paginationInfo.totalPages > 1) {
          console.log(`  ⚠️ ${paginationInfo.totalPages - 1}ページの案件が未取得`);
          const missedItems = paginationInfo.totalItems - paginationInfo.itemsPerPage;
          console.log(`  📉 未取得案件数: 約${missedItems}件`);
        } else {
          console.log(`  ✅ 全案件取得済み（1ページのみ）`);
        }
        
      } catch (error) {
        console.error(`  ❌ エラー: ${error.message}`);
      } finally {
        await page.close();
      }
      
      await new Promise(r => setTimeout(r, 2000));
    }
    
  } catch (error) {
    console.error('❌ 全体エラー:', error);
  } finally {
    await browser.close();
  }
}

investigatePagination().catch(console.error);