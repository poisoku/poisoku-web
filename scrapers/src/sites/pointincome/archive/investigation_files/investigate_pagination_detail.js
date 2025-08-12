#!/usr/bin/env node

const puppeteer = require('puppeteer');

/**
 * ページネーション要素の詳細調査
 */
async function investigatePaginationDetail() {
  console.log('🔍 ページネーション詳細調査開始');
  console.log('='.repeat(70));
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    // カテゴリ285（ゲーム）で詳細調査
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15');
    await page.setViewport({ width: 390, height: 844 });
    
    const url = 'https://sp.pointi.jp/pts_app.php?cat_no=285&sort=&sub=4';
    console.log(`📱 テストURL: ${url}\n`);
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // ページネーション要素の詳細調査
    const paginationDetails = await page.evaluate(() => {
      const result = {
        pageElements: [],
        buttons: [],
        links: [],
        scripts: [],
        ajaxInfo: null
      };
      
      // ページネーション関連要素を検索
      const pageElements = document.querySelectorAll('[class*="page"], .pager, .pagination, nav');
      pageElements.forEach(el => {
        result.pageElements.push({
          tagName: el.tagName,
          className: el.className,
          id: el.id,
          innerHTML: el.innerHTML.substring(0, 500),
          textContent: el.textContent.trim().substring(0, 200)
        });
      });
      
      // ボタン要素を検索
      const buttons = document.querySelectorAll('button, input[type="button"], [role="button"]');
      buttons.forEach(btn => {
        if (btn.textContent.includes('次') || btn.textContent.includes('もっと') || 
            btn.textContent.includes('more') || btn.textContent.includes('続き')) {
          result.buttons.push({
            tagName: btn.tagName,
            type: btn.type,
            className: btn.className,
            id: btn.id,
            textContent: btn.textContent.trim(),
            onclick: btn.onclick ? btn.onclick.toString() : null,
            value: btn.value
          });
        }
      });
      
      // リンク要素を検索
      const links = document.querySelectorAll('a');
      links.forEach(link => {
        const text = link.textContent.trim();
        if (text.includes('次') || text.includes('もっと') || 
            text.includes('more') || text.includes('続き') ||
            text.match(/^\d+$/) || text.includes('ページ')) {
          result.links.push({
            href: link.href,
            textContent: text,
            className: link.className,
            onclick: link.getAttribute('onclick')
          });
        }
      });
      
      // スクリプトタグの内容を確認
      const scripts = document.querySelectorAll('script');
      scripts.forEach(script => {
        const content = script.textContent;
        if (content.includes('load') || content.includes('more') || 
            content.includes('page') || content.includes('ajax')) {
          result.scripts.push(content.substring(0, 500));
        }
      });
      
      // Ajax関連の情報を探す
      if (typeof $ !== 'undefined' && $.ajax) {
        result.ajaxInfo = {
          jqueryExists: true,
          ajaxMethod: typeof $.ajax
        };
      }
      
      // グローバル関数を確認
      const globalFuncs = [];
      for (const key in window) {
        if (typeof window[key] === 'function') {
          const funcStr = window[key].toString();
          if (funcStr.includes('load') || funcStr.includes('more') || 
              funcStr.includes('page') || funcStr.includes('ajax')) {
            globalFuncs.push({
              name: key,
              preview: funcStr.substring(0, 200)
            });
          }
        }
      }
      result.globalFunctions = globalFuncs.slice(0, 10);
      
      return result;
    });
    
    console.log('📄 ページネーション要素:');
    paginationDetails.pageElements.forEach((el, idx) => {
      console.log(`\n  要素 ${idx + 1}:`);
      console.log(`    タグ: ${el.tagName}`);
      console.log(`    クラス: ${el.className}`);
      console.log(`    テキスト: ${el.textContent}`);
      if (el.innerHTML.length > 100) {
        console.log(`    HTML (一部): ${el.innerHTML.substring(0, 200)}...`);
      }
    });
    
    if (paginationDetails.buttons.length > 0) {
      console.log('\n🔘 ボタン要素:');
      paginationDetails.buttons.forEach((btn, idx) => {
        console.log(`  ボタン ${idx + 1}: "${btn.textContent}"`);
        console.log(`    タグ: ${btn.tagName}, クラス: ${btn.className}`);
      });
    }
    
    if (paginationDetails.links.length > 0) {
      console.log('\n🔗 リンク要素:');
      paginationDetails.links.forEach((link, idx) => {
        console.log(`  リンク ${idx + 1}: "${link.textContent}"`);
        console.log(`    href: ${link.href}`);
        if (link.onclick) {
          console.log(`    onclick: ${link.onclick}`);
        }
      });
    }
    
    if (paginationDetails.globalFunctions && paginationDetails.globalFunctions.length > 0) {
      console.log('\n🔧 関連グローバル関数:');
      paginationDetails.globalFunctions.forEach(func => {
        console.log(`  ${func.name}: ${func.preview.substring(0, 100)}...`);
      });
    }
    
    // ページ2へのアクセスを試みる
    console.log('\n📖 ページ2へのアクセステスト:');
    const page2Url = 'https://sp.pointi.jp/pts_app.php?cat_no=285&sort=&sub=4&page=2';
    await page.goto(page2Url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const page2Data = await page.evaluate(() => {
      const campaigns = document.querySelectorAll('.box01');
      return {
        campaignCount: campaigns.length,
        firstCampaignText: campaigns[0]?.textContent.trim().substring(0, 100)
      };
    });
    
    console.log(`  URL: ${page2Url}`);
    console.log(`  案件数: ${page2Data.campaignCount}件`);
    if (page2Data.firstCampaignText) {
      console.log(`  最初の案件: ${page2Data.firstCampaignText}...`);
    }
    
    // ページ3へのアクセスを試みる
    console.log('\n📖 ページ3へのアクセステスト:');
    const page3Url = 'https://sp.pointi.jp/pts_app.php?cat_no=285&sort=&sub=4&page=3';
    await page.goto(page3Url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const page3Data = await page.evaluate(() => {
      const campaigns = document.querySelectorAll('.box01');
      return {
        campaignCount: campaigns.length,
        firstCampaignText: campaigns[0]?.textContent.trim().substring(0, 100)
      };
    });
    
    console.log(`  URL: ${page3Url}`);
    console.log(`  案件数: ${page3Data.campaignCount}件`);
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
  } finally {
    await browser.close();
    console.log('\n✅ 調査完了');
  }
}

// 実行
investigatePaginationDetail().catch(console.error);