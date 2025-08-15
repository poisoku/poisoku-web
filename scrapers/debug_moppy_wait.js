#!/usr/bin/env node

/**
 * モッピー動的コンテンツ調査スクリプト
 * JavaScriptで読み込まれる要素を待機して取得
 */

const puppeteer = require('puppeteer');

async function investigateMoppyDynamic() {
  console.log('🔍 モッピー動的コンテンツ調査開始');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    const testUrl = 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=80&af_sorter=1&page=1';
    
    console.log(`📄 アクセス中: ${testUrl}`);
    await page.goto(testUrl, { waitUntil: 'networkidle0', timeout: 60000 });
    
    // 動的コンテンツ読み込み待機
    console.log('⏳ 動的コンテンツ読み込み待機中...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 全ての可能な案件要素を探索
    const campaigns = await page.evaluate(() => {
      const results = [];
      
      // より広範囲にリンクを探す
      const allLinks = document.querySelectorAll('a[href]');
      const campaignPattern = /\/shopping\/detail\.php|\/ad\/detail\.php/;
      
      allLinks.forEach((link) => {
        if (campaignPattern.test(link.href)) {
          // 親要素から情報を収集
          let parent = link.parentElement;
          let pointText = '';
          
          // ポイント情報を探す（親要素を遡る）
          for (let i = 0; i < 5 && parent; i++) {
            const text = parent.innerText || '';
            const pointMatch = text.match(/\d+[,\d]*P(?!C)|[\d.]+%/);
            if (pointMatch) {
              pointText = pointMatch[0];
              break;
            }
            parent = parent.parentElement;
          }
          
          // 画像要素を探す
          const img = link.querySelector('img');
          
          results.push({
            title: link.title || link.innerText.trim() || (img ? img.alt : ''),
            url: link.href,
            points: pointText,
            imgSrc: img ? img.src : null,
            className: link.className,
            parentClassName: link.parentElement ? link.parentElement.className : ''
          });
        }
      });
      
      return results;
    });
    
    console.log(`\n📊 発見された案件数: ${campaigns.length}件`);
    
    if (campaigns.length > 0) {
      console.log('\n最初の5件の詳細:');
      campaigns.slice(0, 5).forEach((campaign, i) => {
        console.log(`\n${i + 1}. ${campaign.title || '(タイトルなし)'}`);
        console.log(`   URL: ${campaign.url}`);
        console.log(`   ポイント: ${campaign.points || '不明'}`);
        console.log(`   クラス: ${campaign.className}`);
        console.log(`   親クラス: ${campaign.parentClassName}`);
      });
    } else {
      console.log('⚠️ 案件が見つかりませんでした');
      
      // ページのHTMLを出力して確認
      const bodyText = await page.evaluate(() => document.body.innerText);
      console.log('\nページ本文の一部:');
      console.log(bodyText.slice(0, 500));
    }
    
    console.log('\n⏱️ 10秒後にブラウザを閉じます...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await browser.close();
  }
}

investigateMoppyDynamic().catch(console.error);