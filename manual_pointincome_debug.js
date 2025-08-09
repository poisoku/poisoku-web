#!/usr/bin/env node

/**
 * 手動デバッグ用 - ブラウザ画面を見ながら確認
 */

const puppeteer = require('puppeteer');

async function manualDebug() {
  console.log('🖥️ 手動デバッグ開始（ブラウザ画面表示）');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1200,900']
  });

  const page = await browser.newPage();
  
  try {
    const testUrl = 'https://pointi.jp/list.php?category=66';
    
    console.log('📄 ページアクセス:', testUrl);
    await page.goto(testUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // 初期状態の案件数
    const initialCount = await page.$$eval('.box_ad', elements => elements.length);
    console.log('📊 初期案件数:', initialCount);

    // 最初の案件タイトル取得
    const firstTitle = await page.evaluate(() => {
      const firstAd = document.querySelector('.box_ad .title_list');
      return firstAd ? firstAd.textContent.trim() : null;
    });
    console.log('📝 最初の案件:', firstTitle);

    console.log('\n🔍 「次へ」ボタン検索...');
    
    // 次へボタンの詳細情報
    const nextButtonInfo = await page.evaluate(() => {
      const nextLinks = Array.from(document.querySelectorAll('a[onclick*="tab_select"]'));
      return nextLinks.map(link => ({
        text: link.textContent.trim(),
        onclick: link.getAttribute('onclick'),
        href: link.getAttribute('href'),
        className: link.className,
        visible: link.offsetWidth > 0 && link.offsetHeight > 0
      }));
    });

    console.log('🔗 検出された次へボタン:', JSON.stringify(nextButtonInfo, null, 2));

    // 「次へ」ボタンをクリック
    console.log('\n🖱️ 「次へ」ボタンクリック実行...');
    
    const clickSuccess = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[onclick*="tab_select"]'));
      for (const link of links) {
        if (link.textContent.includes('次へ')) {
          console.log('Found next button, clicking...');
          link.click();
          return true;
        }
      }
      return false;
    });

    if (clickSuccess) {
      
      console.log('⏳ 5秒待機中...');
      await page.waitForTimeout(5000);
      
      // クリック後の状態確認
      const afterCount = await page.$$eval('.box_ad', elements => elements.length);
      const afterFirstTitle = await page.evaluate(() => {
        const firstAd = document.querySelector('.box_ad .title_list');
        return firstAd ? firstAd.textContent.trim() : null;
      });
      
      console.log('📊 クリック後案件数:', afterCount);
      console.log('📝 クリック後最初の案件:', afterFirstTitle);
      console.log('🔄 内容変化:', firstTitle !== afterFirstTitle ? '変化あり' : '変化なし');
      
      // URL変化確認
      const currentUrl = page.url();
      console.log('🌐 現在のURL:', currentUrl);
      
    } else {
      console.log('❌ 「次へ」ボタンが見つかりません');
    }

    console.log('\n⏸️ ブラウザを開いたまま60秒待機（手動確認用）...');
    console.log('   この間にブラウザで手動操作して確認してください');
    await page.waitForTimeout(60000);

  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await browser.close();
  }
}

manualDebug();