#!/usr/bin/env node

/**
 * シンプルなポイントインカム調査
 */

const puppeteer = require('puppeteer');

async function debugPointIncome() {
  console.log('🔍 ポイントインカムの簡単調査');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  try {
    // 正しいポイントインカムURL形式を使用
    const testUrl = 'https://pointi.jp/list.php?category=66';
    
    console.log('📄 ページアクセス:', testUrl);
    await page.goto(testUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // ページタイトル確認
    const title = await page.title();
    console.log('📄 ページタイトル:', title);

    // HTML の一部を取得して構造確認
    const bodyHTML = await page.$eval('body', el => el.innerHTML.substring(0, 1000));
    console.log('🏗️ HTML構造（最初の1000文字）:');
    console.log(bodyHTML);

    // 案件要素の確認
    const boxAdCount = await page.$$eval('.box_ad', elements => elements.length).catch(() => 0);
    console.log('📦 .box_ad 要素数:', boxAdCount);

    // 代替セレクターの確認
    const alternativeSelectors = [
      '.campaign-item',
      '.ad-item', 
      '.list-item',
      '[class*="ad"]',
      '[class*="campaign"]',
      'article',
      '.item'
    ];

    for (const selector of alternativeSelectors) {
      try {
        const count = await page.$$eval(selector, elements => elements.length);
        if (count > 0) {
          console.log(`✅ ${selector}: ${count}個`);
        }
      } catch (e) {
        // ignore
      }
    }

    // ページネーション要素の確認
    const paginationTexts = ['次へ', '次', 'next', 'Next', '>', '»'];
    for (const text of paginationTexts) {
      try {
        const elements = await page.$x(`//a[contains(text(), '${text}')]`);
        if (elements.length > 0) {
          console.log(`🔗 「${text}」を含むリンク: ${elements.length}個`);
          
          for (let i = 0; i < Math.min(elements.length, 3); i++) {
            const href = await page.evaluate(el => el.getAttribute('href'), elements[i]);
            const onclick = await page.evaluate(el => el.getAttribute('onclick'), elements[i]);
            console.log(`  [${i}] href: ${href}, onclick: ${onclick}`);
          }
        }
      } catch (e) {
        // ignore
      }
    }

    // スクリーンショット保存
    await page.screenshot({ 
      path: 'pointincome_debug_simple.png',
      fullPage: true 
    });
    console.log('📸 スクリーンショット保存: pointincome_debug_simple.png');

  } catch (error) {
    console.error('❌ エラー:', error.message);
  } finally {
    await browser.close();
  }
}

debugPointIncome().catch(console.error);