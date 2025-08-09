#!/usr/bin/env node

const puppeteer = require('puppeteer');

async function debugPointIncomePagination() {
  console.log('🔍 ポイントインカムページネーション詳細調査');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  try {
    // より短いタイムアウトで素早くテスト
    await page.goto('https://pointi.jp/list.php?category=66', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });

    console.log('✅ ページロード成功');
    
    // 現在のページ内容を確認
    const initialCampaigns = await page.$$eval('.box_ad', elements => 
      elements.map(el => {
        const title = el.querySelector('.title_list');
        return title ? title.textContent.trim() : '';
      }).slice(0, 3)
    );
    
    console.log('📋 初期の案件（最初3件）:');
    initialCampaigns.forEach((title, i) => console.log(`  ${i+1}. ${title}`));
    
    // tab_select関数が存在するかチェック
    const hasTabSelect = await page.evaluate(() => {
      return typeof window.tab_select === 'function';
    });
    console.log(`🔧 tab_select関数: ${hasTabSelect ? '存在' : '存在しない'}`);
    
    // ページネーションボタンの詳細調査
    const paginationInfo = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('a[onclick*="tab_select"]'));
      return buttons.map(btn => ({
        text: btn.textContent.trim(),
        onclick: btn.getAttribute('onclick'),
        href: btn.getAttribute('href'),
        classes: btn.className,
        visible: btn.offsetWidth > 0 && btn.offsetHeight > 0
      }));
    });
    
    console.log('🔗 ページネーションボタン情報:');
    paginationInfo.forEach((info, i) => {
      console.log(`  ${i+1}. テキスト: "${info.text}"`);
      console.log(`     onclick: ${info.onclick}`);
      console.log(`     visible: ${info.visible}`);
    });
    
    // 次へボタンをクリックしてみる
    const nextButtonFound = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('a[onclick*="tab_select"]'));
      const nextButton = buttons.find(btn => btn.textContent.includes('次へ'));
      
      if (nextButton) {
        console.log('次へボタンクリック実行...');
        nextButton.click();
        return true;
      }
      return false;
    });
    
    if (nextButtonFound) {
      console.log('🖱️ 次へボタンクリック実行');
      
      // 10秒待機
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // クリック後の案件をチェック
      const afterCampaigns = await page.$$eval('.box_ad', elements => 
        elements.map(el => {
          const title = el.querySelector('.title_list');
          return title ? title.textContent.trim() : '';
        }).slice(0, 3)
      );
      
      console.log('📋 クリック後の案件（最初3件）:');
      afterCampaigns.forEach((title, i) => console.log(`  ${i+1}. ${title}`));
      
      // 変化があったかチェック
      const changed = JSON.stringify(initialCampaigns) !== JSON.stringify(afterCampaigns);
      console.log(`🔄 内容変化: ${changed ? 'あり' : 'なし'}`);
    }
    
    console.log('\n⏸️ 30秒間ブラウザを開いたまま待機...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
  } finally {
    await browser.close();
  }
}

debugPointIncomePagination();