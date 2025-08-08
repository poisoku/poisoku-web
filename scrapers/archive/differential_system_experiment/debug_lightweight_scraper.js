#!/usr/bin/env node

/**
 * 軽量スクレイパーデバッグ版
 */

const puppeteer = require('puppeteer');

async function debugCategoryPage() {
  const browser = await puppeteer.launch({
    headless: false,
    devtools: true
  });

  const page = await browser.newPage();
  
  try {
    const testUrl = 'https://www.chobirich.com/shopping/shop/101';
    console.log(`🔍 デバッグ対象URL: ${testUrl}`);
    
    await page.goto(testUrl, { waitUntil: 'networkidle2' });
    
    // ページタイトル確認
    const title = await page.title();
    console.log(`📄 ページタイトル: ${title}`);
    
    // 利用可能なセレクタを調査
    const selectors = await page.evaluate(() => {
      const results = {
        allElements: document.querySelectorAll('*').length,
        candidateSelectors: []
      };
      
      // よく使われるセレクタパターンを検索
      const patterns = [
        '.campaign', '.ad', '.item', '.list-item', '.card',
        '[class*="campaign"]', '[class*="ad"]', '[class*="item"]',
        'a[href*="/ad_details/"]', 'a[href*="/campaign/"]'
      ];
      
      patterns.forEach(pattern => {
        const elements = document.querySelectorAll(pattern);
        if (elements.length > 0) {
          results.candidateSelectors.push({
            selector: pattern,
            count: elements.length,
            sample: elements[0]?.className || elements[0]?.tagName
          });
        }
      });
      
      return results;
    });
    
    console.log('🔍 セレクタ調査結果:');
    console.log(`   総要素数: ${selectors.allElements}`);
    console.log('   候補セレクタ:');
    selectors.candidateSelectors.forEach(sel => {
      console.log(`     ${sel.selector}: ${sel.count}個 (例: ${sel.sample})`);
    });
    
    // 特定の要素を詳細調査
    const detailedAnalysis = await page.evaluate(() => {
      const links = document.querySelectorAll('a[href*="/ad_details/"], a[href*="/campaign/"]');
      const results = [];
      
      for (let i = 0; i < Math.min(5, links.length); i++) {
        const link = links[i];
        const parent = link.closest('[class]');
        
        results.push({
          href: link.href,
          text: link.textContent.trim().substring(0, 50),
          parentClass: parent?.className || 'no-class',
          parentTag: parent?.tagName || 'no-parent'
        });
      }
      
      return results;
    });
    
    console.log('\n📊 案件リンク詳細分析:');
    detailedAnalysis.forEach((item, i) => {
      console.log(`   ${i+1}. ${item.text}`);
      console.log(`      URL: ${item.href}`);
      console.log(`      親要素: ${item.parentTag}.${item.parentClass}`);
    });
    
    // 30秒間待機してページを確認
    console.log('\n⏳ 30秒間ページを確認中...');
    await page.waitForTimeout(30000);
    
  } catch (error) {
    console.error('❌ デバッグエラー:', error);
  } finally {
    await browser.close();
  }
}

// 実行
debugCategoryPage().then(() => {
  console.log('✅ デバッグ完了');
  process.exit(0);
}).catch(error => {
  console.error('💥 実行エラー:', error);
  process.exit(1);
});