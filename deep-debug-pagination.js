#!/usr/bin/env node

/**
 * ページネーション深度デバッグ - 実際のブラウザ動作を詳細観察
 */

const puppeteer = require('puppeteer');

async function deepDebugPagination() {
  console.log('🔍 ページネーション深度デバッグ');
  console.log('='.repeat(60));
  
  const browser = await puppeteer.launch({
    headless: false,
    devtools: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // コンソールログをキャプチャ
    page.on('console', msg => {
      console.log(`🖥️ ブラウザコンソール: ${msg.text()}`);
    });
    
    // ネットワークリクエストを監視
    page.on('response', response => {
      if (response.url().includes('list.php')) {
        console.log(`🌐 ネットワーク応答: ${response.url()} - ${response.status()}`);
      }
    });
    
    console.log('\n📂 カテゴリ161の詳細調査');
    await page.goto('https://pointi.jp/list.php?category=161', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // 初期ページの詳細な状態を取得
    const initialState = await page.evaluate(() => {
      const campaigns = Array.from(document.querySelectorAll('.box_ad'));
      const nextButton = Array.from(document.querySelectorAll('a[onclick*="tab_select"]'))
        .find(link => link.textContent.trim().includes('次へ'));
      
      const onclick = nextButton ? nextButton.getAttribute('onclick') : null;
      const paramMatch = onclick ? onclick.match(/tab_select\('([^']+)',\s*(\d+),\s*(\d+),\s*(\d+)\)/) : null;
      
      return {
        campaignCount: campaigns.length,
        firstCampaign: campaigns[0] ? campaigns[0].querySelector('.title_list')?.textContent?.trim() : null,
        onclick: onclick,
        params: paramMatch ? {
          tab: paramMatch[1],
          param2: parseInt(paramMatch[2]),
          param3: parseInt(paramMatch[3]),
          param4: parseInt(paramMatch[4])
        } : null,
        hasTabSelect: typeof window.tab_select === 'function',
        jqueryVersion: window.$ ? window.$.fn.jquery : 'not found'
      };
    });
    
    console.log('📊 初期状態:');
    console.log(`   案件数: ${initialState.campaignCount}件`);
    console.log(`   最初の案件: ${initialState.firstCampaign}`);
    console.log(`   onclick: ${initialState.onclick}`);
    console.log(`   パラメータ: ${JSON.stringify(initialState.params)}`);
    console.log(`   tab_select関数存在: ${initialState.hasTabSelect}`);
    console.log(`   jQuery: ${initialState.jqueryVersion}`);
    
    if (initialState.params) {
      console.log('\n🔄 ページネーション実行前の準備...');
      
      // 実際にページネーションを実行する前の状態
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log('🖱️ ページネーション実行中...');
      
      // ページネーションを実行し、その結果を詳細に監視
      const paginationResult = await page.evaluate((params) => {
        console.log(`tab_select実行準備: (${params.tab}, ${params.param2}, ${params.param3}, ${params.param4})`);
        
        // 実行前のDOM状態を記録
        const beforeState = {
          campaignCount: document.querySelectorAll('.box_ad').length,
          bodyLength: document.body.innerHTML.length,
          timestamp: new Date().toISOString()
        };
        
        // tab_select関数を実行
        if (typeof window.tab_select === 'function') {
          try {
            window.tab_select(params.tab, params.param2, params.param3, params.param4);
            console.log('tab_select実行完了');
          } catch (error) {
            console.error('tab_select実行エラー:', error);
            return { success: false, error: error.message, beforeState };
          }
        } else {
          return { success: false, error: 'tab_select関数が見つからない', beforeState };
        }
        
        return { success: true, beforeState };
        
      }, initialState.params);
      
      console.log('📊 ページネーション実行結果:');
      console.log(`   成功: ${paginationResult.success}`);
      if (paginationResult.error) {
        console.log(`   エラー: ${paginationResult.error}`);
      }
      console.log(`   実行前案件数: ${paginationResult.beforeState.campaignCount}件`);
      
      // 5秒間隔で最大30秒間、状態の変化を監視
      for (let i = 0; i < 6; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const currentState = await page.evaluate(() => {
          const campaigns = document.querySelectorAll('.box_ad');
          return {
            campaignCount: campaigns.length,
            firstCampaign: campaigns[0] ? campaigns[0].querySelector('.title_list')?.textContent?.trim() : null,
            bodyLength: document.body.innerHTML.length,
            readyState: document.readyState,
            timestamp: new Date().toISOString()
          };
        });
        
        console.log(`⏰ ${(i+1)*5}秒後の状態:`);
        console.log(`   案件数: ${currentState.campaignCount}件`);
        console.log(`   最初の案件: ${currentState.firstCampaign}`);
        console.log(`   body長: ${currentState.bodyLength}文字`);
        console.log(`   readyState: ${currentState.readyState}`);
        
        if (currentState.campaignCount > 0 && currentState.firstCampaign !== initialState.firstCampaign) {
          console.log('✅ ページネーション成功を検出！');
          break;
        }
      }
      
      console.log('\n💡 手動でブラウザ上で「次へ>」ボタンをクリックして、動作を確認してください');
      console.log('   ブラウザは開いたままになります。確認が終わったらEnterを押してください。');
      
    } else {
      console.log('❌ ページネーションパラメータが取得できませんでした');
    }
    
    // ユーザーの確認を待つ
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    await new Promise(resolve => {
      rl.question('手動確認完了後、Enterキーを押してください...', () => {
        rl.close();
        resolve();
      });
    });
    
  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await browser.close();
  }
}

deepDebugPagination();