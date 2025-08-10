#!/usr/bin/env node

/**
 * 手動検証用スクリプト - 実際のサイト動作を観察
 */

const puppeteer = require('puppeteer');

async function manualVerification() {
  console.log('👀 手動検証用ブラウザを開きます');
  console.log('='.repeat(60));
  
  const browser = await puppeteer.launch({ 
    headless: false, 
    devtools: true,
    args: ['--no-sandbox', '--start-maximized'] 
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  console.log('🌐 カテゴリ161にアクセス中...');
  await page.goto('https://pointi.jp/list.php?category=161', { waitUntil: 'networkidle2' });
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  const initialState = await page.evaluate(() => {
    const campaigns = document.querySelectorAll('.box_ad');
    const nextButton = Array.from(document.querySelectorAll('a[onclick*="tab_select"]'))
      .find(link => link.textContent.trim().includes('次へ'));
    
    return {
      campaignCount: campaigns.length,
      firstTitle: campaigns[0] ? campaigns[0].querySelector('.title_list')?.textContent?.trim() : null,
      hasNextButton: !!nextButton,
      nextButtonText: nextButton ? nextButton.textContent.trim() : null,
      onclick: nextButton ? nextButton.getAttribute('onclick') : null
    };
  });
  
  console.log('📊 初期状態:');
  console.log(`   案件数: ${initialState.campaignCount}件`);
  console.log(`   最初の案件: ${initialState.firstTitle}`);
  console.log(`   次へボタン存在: ${initialState.hasNextButton}`);
  console.log(`   次へボタンテキスト: ${initialState.nextButtonText}`);
  console.log(`   onclick: ${initialState.onclick}`);
  
  if (initialState.hasNextButton) {
    console.log('\n=====================================');
    console.log('🖱️ 手動操作の指示');
    console.log('=====================================');
    console.log('1. 開いたブラウザウィンドウで「次へ>」ボタンをクリックしてください');
    console.log('2. ページが変わるかどうかを観察してください');
    console.log('3. Developer Toolsを開いてNetworkタブでAJAXリクエストを確認してください');
    console.log('4. 確認が終わったらこのコンソールでEnterキーを押してください');
    console.log('=====================================');
    
    // ユーザーの入力を待機
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    await new Promise(resolve => {
      rl.question('手動操作完了後、Enterキーを押してください...', () => {
        rl.close();
        resolve();
      });
    });
    
    // 手動操作後の状態を確認
    const afterState = await page.evaluate(() => {
      const campaigns = document.querySelectorAll('.box_ad');
      return {
        campaignCount: campaigns.length,
        firstTitle: campaigns[0] ? campaigns[0].querySelector('.title_list')?.textContent?.trim() : null,
        currentUrl: window.location.href
      };
    });
    
    console.log('\n📊 手動操作後の状態:');
    console.log(`   案件数: ${afterState.campaignCount}件`);
    console.log(`   最初の案件: ${afterState.firstTitle}`);
    console.log(`   現在URL: ${afterState.currentUrl}`);
    
    if (afterState.firstTitle !== initialState.firstTitle) {
      console.log('✅ ページネーションが正常に動作しました');
    } else if (afterState.campaignCount === 0) {
      console.log('❌ ページネーション後、案件が0件になりました');
    } else {
      console.log('⚠️ ページネーションが動作していない可能性があります');
    }
  } else {
    console.log('❌ 次へボタンが見つかりません（このカテゴリは1ページのみ）');
  }
  
  console.log('\nブラウザを閉じています...');
  await browser.close();
  
  console.log('\n📝 検証結果のまとめ:');
  console.log('=====================================');
  console.log('この手動検証で以下のことが分かります：');
  console.log('1. 実際のサイトで「次へ」ボタンが機能するかどうか');
  console.log('2. AJAXリクエストが正常に送信されるかどうか');
  console.log('3. サーバーからの応答内容');
  console.log('4. DOM更新が正常に行われるかどうか');
  console.log('=====================================');
}

manualVerification();