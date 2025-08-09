#!/usr/bin/env node

/**
 * 複数カテゴリのページネーション状況を確認
 */

const puppeteer = require('puppeteer');

async function checkCategoryPagination() {
  console.log('🔍 複数カテゴリのページネーション確認');
  
  const testCategories = [66, 161, 160, 177, 251, 184]; // サンプルカテゴリ
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  for (const categoryId of testCategories) {
    const page = await browser.newPage();
    
    try {
      const url = `https://pointi.jp/list.php?category=${categoryId}`;
      console.log(`\n📂 Category ${categoryId}: ${url}`);
      
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 20000 
      });

      // 案件数を確認
      const campaignCount = await page.$$eval('.box_ad', elements => elements.length);
      console.log(`  📊 案件数: ${campaignCount}件`);
      
      // ページネーションボタンを確認
      const paginationInfo = await page.evaluate(() => {
        const pageLinks = Array.from(document.querySelectorAll('a[onclick*="tab_select"]'));
        const pageNumbers = pageLinks
          .map(link => {
            const text = link.textContent.trim();
            const onclick = link.getAttribute('onclick');
            const match = onclick ? onclick.match(/tab_select\('tab1',\s*0,\s*\d+,\s*(\d+)\)/) : null;
            return {
              text: text,
              pageNumber: match ? parseInt(match[1]) : null,
              onclick: onclick
            };
          })
          .filter(info => info.pageNumber !== null);
        
        const maxPage = Math.max(...pageNumbers.map(p => p.pageNumber), 0);
        const hasNext = pageNumbers.some(p => p.text.includes('次へ'));
        
        return {
          totalPageLinks: pageNumbers.length,
          maxPageNumber: maxPage,
          hasNextButton: hasNext,
          pageNumbers: pageNumbers.map(p => p.pageNumber).sort((a,b) => a-b)
        };
      });
      
      console.log(`  📄 最大ページ番号: ${paginationInfo.maxPageNumber}`);
      console.log(`  🔗 ページリンク数: ${paginationInfo.totalPageLinks}`);
      console.log(`  ➡️ 次へボタン: ${paginationInfo.hasNextButton ? 'あり' : 'なし'}`);
      console.log(`  📋 利用可能ページ: [${paginationInfo.pageNumbers.join(', ')}]`);
      
      if (paginationInfo.maxPageNumber > 1) {
        console.log(`  ✅ 複数ページ検出 (最大${paginationInfo.maxPageNumber}ページ)`);
      } else {
        console.log(`  ❌ 単一ページのみ`);
      }
      
    } catch (error) {
      console.log(`  ❌ エラー: ${error.message}`);
    }
    
    await page.close();
  }
  
  await browser.close();
}

checkCategoryPagination().catch(console.error);