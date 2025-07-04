#!/usr/bin/env node

const puppeteer = require('puppeteer');

(async () => {
  console.log('Puppeteer テスト開始...');
  
  try {
    // ブラウザを起動
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    console.log('ブラウザ起動成功');
    
    // 新しいページを開く
    const page = await browser.newPage();
    console.log('新しいページ作成');
    
    // ちょびリッチの楽天市場案件ページへ
    const url = 'https://www.chobirich.com/ad_details/36796/';
    console.log(`${url} にアクセス中...`);
    
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    console.log('ページ読み込み完了');
    
    // タイトルを取得
    const title = await page.title();
    console.log('ページタイトル:', title);
    
    // 還元率を取得
    const cashback = await page.evaluate(() => {
      // すべての要素から還元率を探す
      const allElements = document.querySelectorAll('*');
      let maxFontSize = 0;
      let cashbackText = '';
      
      allElements.forEach(el => {
        const text = el.textContent?.trim() || '';
        // 還元率のパターン（1%のような形式）
        if (/^\d+(?:\.\d+)?%$/.test(text)) {
          const style = window.getComputedStyle(el);
          const fontSize = parseInt(style.fontSize);
          
          // 最も大きいフォントサイズの要素を採用
          if (fontSize > maxFontSize) {
            maxFontSize = fontSize;
            cashbackText = text;
          }
        }
      });
      
      return {
        cashback: cashbackText,
        fontSize: maxFontSize
      };
    });
    
    console.log('\n=== 取得結果 ===');
    console.log('還元率:', cashback.cashback);
    console.log('フォントサイズ:', cashback.fontSize + 'px');
    
    // スクリーンショットを保存
    await page.screenshot({ path: 'chobirich-test.png' });
    console.log('\nスクリーンショット保存: chobirich-test.png');
    
    // ブラウザを閉じる
    await browser.close();
    console.log('\n正常終了');
    
  } catch (error) {
    console.error('エラー発生:', error);
  }
})();