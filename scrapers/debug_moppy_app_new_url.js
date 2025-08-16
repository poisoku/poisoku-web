#!/usr/bin/env node

/**
 * 新しいモッピーアプリ案件URL構造調査
 * parent_category=4&child_category=52
 */

const puppeteer = require('puppeteer');

async function debugNewMoppyAppUrl() {
  console.log('🔍 新モッピーアプリ案件URL調査開始...');
  console.log('📍 対象: parent_category=4&child_category=52');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // iOS User-Agent
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
    await page.setViewport({ width: 375, height: 667 });
    
    // 新URLにアクセス
    const url = 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=52';
    console.log(`📍 アクセス URL: ${url}`);
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // ページ構造調査
    const analysis = await page.evaluate(() => {
      const result = {
        title: document.title,
        url: window.location.href,
        bodyClasses: document.body.className,
        totalLinks: document.querySelectorAll('a').length,
        siteIdLinks: document.querySelectorAll('a[href*="site_id"]').length,
        adDetailLinks: document.querySelectorAll('a[href*="/ad/detail.php"]').length,
        
        // ページネーション関連
        paginationElements: {
          numberButtons: document.querySelectorAll('button:not([type]), [class*="page"], [class*="pagination"] button, a[class*="page"]').length,
          numberedLinks: [],
          jsButtons: document.querySelectorAll('button').length,
          clickableNumbers: []
        },
        
        // アプリ案件セレクター
        possibleSelectors: {
          '.campaign-item': document.querySelectorAll('.campaign-item').length,
          '.ad-item': document.querySelectorAll('.ad-item').length,
          '.list-item': document.querySelectorAll('.list-item').length,
          'li': document.querySelectorAll('li').length,
          '[class*="item"]': document.querySelectorAll('[class*="item"]').length,
          '[class*="campaign"]': document.querySelectorAll('[class*="campaign"]').length,
          '[class*="ad"]': document.querySelectorAll('[class*="ad"]').length,
        },
        
        sampleTitles: [],
        htmlStructureSample: ''
      };
      
      // ページネーション要素の詳細調査
      const pageButtons = document.querySelectorAll('button, a, span, div');
      pageButtons.forEach((el, index) => {
        const text = el.textContent?.trim() || '';
        if (/^\d+$/.test(text) && parseInt(text) <= 20) {
          result.paginationElements.clickableNumbers.push({
            text: text,
            tagName: el.tagName,
            className: el.className,
            onclick: el.onclick ? 'has onclick' : 'no onclick',
            index: index
          });
        }
      });
      
      // サンプルタイトル取得
      const siteIdLinks = document.querySelectorAll('a[href*="site_id"]');
      for (let i = 0; i < Math.min(15, siteIdLinks.length); i++) {
        const link = siteIdLinks[i];
        const title = link.textContent?.trim() || '';
        const href = link.href;
        if (title) {
          result.sampleTitles.push({ title, href });
        }
      }
      
      // HTML構造サンプル
      result.htmlStructureSample = document.body.innerHTML.substring(0, 2000);
      
      return result;
    });
    
    console.log('\n📊 新URL分析結果:');
    console.log('=====================================');
    console.log(`📄 ページタイトル: ${analysis.title}`);
    console.log(`🔗 現在のURL: ${analysis.url}`);
    console.log(`📝 総リンク数: ${analysis.totalLinks}`);
    console.log(`🎯 site_idリンク数: ${analysis.siteIdLinks}`);
    console.log(`📋 /ad/detail.phpリンク数: ${analysis.adDetailLinks}`);
    
    console.log('\n🔍 ページネーション要素:');
    console.log(`JSボタン総数: ${analysis.paginationElements.jsButtons}`);
    console.log(`数字ボタン候補: ${analysis.paginationElements.clickableNumbers.length}個`);
    
    if (analysis.paginationElements.clickableNumbers.length > 0) {
      console.log('\n📋 数字ボタン詳細:');
      analysis.paginationElements.clickableNumbers.forEach((btn, index) => {
        console.log(`${index + 1}. "${btn.text}" (${btn.tagName}) class="${btn.className}" ${btn.onclick}`);
      });
    }
    
    console.log('\n🔍 案件要素セレクター:');
    Object.entries(analysis.possibleSelectors).forEach(([selector, count]) => {
      console.log(`  ${selector}: ${count}個`);
    });
    
    console.log('\n📋 サンプルタイトル:');
    analysis.sampleTitles.forEach((item, index) => {
      console.log(`${index + 1}. ${item.title}`);
    });
    
    if (analysis.sampleTitles.length === 0) {
      console.log('⚠️  案件が見つかりませんでした');
      console.log('\n🔍 HTML構造サンプル:');
      console.log(analysis.htmlStructureSample);
    }
    
    // 2ページ目ボタンのテスト（もし存在すれば）
    if (analysis.paginationElements.clickableNumbers.length > 1) {
      console.log('\n🔍 2ページ目ボタンクリックテスト...');
      
      try {
        const secondPageButton = analysis.paginationElements.clickableNumbers.find(btn => btn.text === '2');
        if (secondPageButton) {
          // 2ページ目ボタンをクリック
          await page.evaluate((buttonIndex) => {
            const buttons = document.querySelectorAll('button, a, span, div');
            const targetButton = buttons[buttonIndex];
            if (targetButton && targetButton.click) {
              targetButton.click();
            }
          }, secondPageButton.index);
          
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          const page2Analysis = await page.evaluate(() => ({
            siteIdLinks: document.querySelectorAll('a[href*="site_id"]').length,
            currentUrl: window.location.href,
            sampleTitles: Array.from(document.querySelectorAll('a[href*="site_id"]')).slice(0, 5).map(link => link.textContent?.trim() || '')
          }));
          
          console.log(`📄 2ページ目クリック後 URL: ${page2Analysis.currentUrl}`);
          console.log(`📄 2ページ目 site_idリンク数: ${page2Analysis.siteIdLinks}`);
          console.log('📋 2ページ目サンプルタイトル:');
          page2Analysis.sampleTitles.forEach((title, index) => {
            console.log(`${index + 1}. ${title}`);
          });
        }
      } catch (error) {
        console.log('❌ 2ページ目テスト失敗:', error.message);
      }
    }
    
  } catch (error) {
    console.error('💥 調査エラー:', error);
  } finally {
    await browser.close();
  }
}

// 実行
debugNewMoppyAppUrl().catch(console.error);