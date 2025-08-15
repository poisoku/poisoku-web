#!/usr/bin/env node

/**
 * より大きなカテゴリでのページネーション調査
 */

const puppeteer = require('puppeteer');

async function investigateLargerCategories() {
  console.log('🔍 大きなカテゴリのページネーション調査');
  
  const largerCategories = [
    {
      url: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=52&af_sorter=1&page=1',
      name: 'クレジットカード',
      type: 'service'
    },
    {
      url: 'https://pc.moppy.jp/category/list.php?parent_category=8&child_category=119&af_sorter=1&page=1',
      name: '美容・健康',
      type: 'shopping'
    },
    {
      url: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=81&af_sorter=1&page=1',
      name: '本・CD・DVD',
      type: 'shopping'
    },
    {
      url: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=53&af_sorter=1&page=1',
      name: 'FX・先物取引',
      type: 'service'
    },
    {
      url: 'https://pc.moppy.jp/category/list.php?parent_category=8&child_category=115&af_sorter=1&page=1',
      name: 'グルメ・食品',
      type: 'shopping'
    }
  ];
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });
  
  try {
    for (const category of largerCategories) {
      console.log(`\n📂 カテゴリ: ${category.name}`);
      
      const page = await browser.newPage();
      
      try {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.goto(category.url, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        
        await new Promise(r => setTimeout(r, 3000));
        
        const pageInfo = await page.evaluate(() => {
          const result = {
            title: document.title,
            mainContentItems: 0,
            totalText: '',
            pageLinks: [],
            nextPageExists: false,
            maxPage: 0
          };
          
          // 1ページ目の案件数
          const items = document.querySelectorAll('.m-list__item');
          result.mainContentItems = items.length;
          
          // ページタイトルから件数情報取得
          const titleMatch = document.title.match(/(\d+)件/);
          if (titleMatch) {
            result.totalText = `${titleMatch[1]}件`;
          }
          
          // h1要素からも件数情報を取得
          const h1 = document.querySelector('h1');
          if (h1) {
            const h1Match = h1.textContent.match(/（(\d+)件）/);
            if (h1Match) {
              result.totalText = `${h1Match[1]}件`;
            }
          }
          
          // ページネーションリンクを収集
          const pageLinks = document.querySelectorAll('a[href*="page="]');
          pageLinks.forEach(link => {
            const href = link.href;
            const text = link.textContent.trim();
            const pageMatch = href.match(/page=(\d+)/);
            if (pageMatch) {
              const pageNum = parseInt(pageMatch[1]);
              result.pageLinks.push({ page: pageNum, text });
              result.maxPage = Math.max(result.maxPage, pageNum);
            }
          });
          
          // 次のページの存在確認
          const nextLink = document.querySelector('a[href*="page=2"]');
          result.nextPageExists = !!nextLink;
          
          // ページネーション情報を詳細表示
          const paginationContainer = document.querySelector('.pagination, .pager, [class*="page"]');
          if (paginationContainer) {
            result.paginationHTML = paginationContainer.innerHTML.slice(0, 200);
          }
          
          return result;
        });
        
        console.log(`  📄 ページタイトル: ${pageInfo.title}`);
        console.log(`  📊 1ページ目案件数: ${pageInfo.mainContentItems}件`);
        console.log(`  📈 総件数表示: ${pageInfo.totalText}`);
        console.log(`  📄 検出ページ: [${pageInfo.pageLinks.map(p => p.page).join(', ')}]`);
        console.log(`  📄 最大ページ: ${pageInfo.maxPage}`);
        console.log(`  ➡️ 次ページ存在: ${pageInfo.nextPageExists ? 'あり' : 'なし'}`);
        
        if (pageInfo.maxPage > 1) {
          console.log(`  🎯 複数ページ発見！総ページ数: ${pageInfo.maxPage}ページ`);
          const estimatedTotal = pageInfo.mainContentItems * pageInfo.maxPage;
          console.log(`  📦 推定総案件数: 約${estimatedTotal}件`);
        }
        
      } catch (error) {
        console.error(`  ❌ エラー: ${error.message}`);
      } finally {
        await page.close();
      }
      
      await new Promise(r => setTimeout(r, 1500));
    }
    
  } catch (error) {
    console.error('❌ 全体エラー:', error);
  } finally {
    await browser.close();
  }
}

investigateLargerCategories().catch(console.error);