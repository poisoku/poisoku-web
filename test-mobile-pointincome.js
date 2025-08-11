#!/usr/bin/env node

/**
 * モバイル版ポイントインカムの無限スクロールテスト
 */

const puppeteer = require('puppeteer');

async function testMobilePointIncome() {
  console.log('📱 モバイル版ポイントインカム無限スクロールテスト');
  console.log('='.repeat(60));
  
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--window-size=375,812'] // iPhone X サイズ
  });
  
  try {
    const page = await browser.newPage();
    
    // iOS Safari のユーザーエージェントを設定
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
    
    // iPhone X のビューポートを設定
    await page.setViewport({
      width: 375,
      height: 812,
      isMobile: true,
      hasTouch: true
    });
    
    // カテゴリ161（食品・ネットスーパー）でテスト
    console.log('🌐 カテゴリ161にアクセス中...');
    await page.goto('https://pointi.jp/list.php?category=161', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 初期状態の確認
    const initialState = await page.evaluate(() => {
      const campaigns = document.querySelectorAll('.box_ad');
      return {
        campaignCount: campaigns.length,
        firstTitle: campaigns[0] ? campaigns[0].querySelector('.title_list')?.textContent?.trim() : null,
        lastTitle: campaigns[campaigns.length - 1] ? campaigns[campaigns.length - 1].querySelector('.title_list')?.textContent?.trim() : null,
        pageHeight: document.body.scrollHeight,
        viewportHeight: window.innerHeight
      };
    });
    
    console.log('📊 初期状態:');
    console.log(`   案件数: ${initialState.campaignCount}件`);
    console.log(`   最初の案件: ${initialState.firstTitle}`);
    console.log(`   最後の案件: ${initialState.lastTitle}`);
    console.log(`   ページ高さ: ${initialState.pageHeight}px`);
    console.log(`   ビューポート高さ: ${initialState.viewportHeight}px`);
    
    // スクロールによる案件読み込みテスト
    console.log('\n🔄 スクロールテスト開始...');
    
    let previousCount = initialState.campaignCount;
    let scrollCount = 0;
    let noChangeCount = 0;
    const maxScrolls = 10; // 最大10回スクロール
    
    while (scrollCount < maxScrolls && noChangeCount < 3) {
      scrollCount++;
      console.log(`\n📜 スクロール ${scrollCount}回目`);
      
      // ページの一番下までスクロール
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      
      // 新しいコンテンツの読み込みを待つ
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 現在の状態を確認
      const currentState = await page.evaluate(() => {
        const campaigns = document.querySelectorAll('.box_ad');
        return {
          campaignCount: campaigns.length,
          lastTitle: campaigns[campaigns.length - 1] ? campaigns[campaigns.length - 1].querySelector('.title_list')?.textContent?.trim() : null,
          pageHeight: document.body.scrollHeight
        };
      });
      
      console.log(`   案件数: ${currentState.campaignCount}件 (前回比: +${currentState.campaignCount - previousCount})`);
      console.log(`   最後の案件: ${currentState.lastTitle}`);
      console.log(`   ページ高さ: ${currentState.pageHeight}px`);
      
      if (currentState.campaignCount === previousCount) {
        noChangeCount++;
        console.log(`   ⚠️ 案件数が変化なし (${noChangeCount}/3)`);
      } else {
        noChangeCount = 0;
        console.log(`   ✅ 新しい案件を検出！`);
      }
      
      previousCount = currentState.campaignCount;
    }
    
    // 最終結果
    const finalState = await page.evaluate(() => {
      const campaigns = document.querySelectorAll('.box_ad');
      const uniqueIds = new Set();
      
      campaigns.forEach(campaign => {
        const linkElement = campaign.querySelector('a[href*="./ad/"]');
        if (linkElement) {
          const href = linkElement.getAttribute('href');
          const idMatch = href.match(/\/ad\/(\d+)\//);
          if (idMatch) {
            uniqueIds.add(idMatch[1]);
          }
        }
      });
      
      return {
        totalCampaigns: campaigns.length,
        uniqueCampaigns: uniqueIds.size,
        firstTitle: campaigns[0] ? campaigns[0].querySelector('.title_list')?.textContent?.trim() : null,
        lastTitle: campaigns[campaigns.length - 1] ? campaigns[campaigns.length - 1].querySelector('.title_list')?.textContent?.trim() : null
      };
    });
    
    console.log('\n📊 最終結果:');
    console.log(`   総案件数: ${finalState.totalCampaigns}件`);
    console.log(`   ユニーク案件数: ${finalState.uniqueCampaigns}件`);
    console.log(`   最初の案件: ${finalState.firstTitle}`);
    console.log(`   最後の案件: ${finalState.lastTitle}`);
    
    if (finalState.totalCampaigns > initialState.campaignCount) {
      console.log(`\n🎉 無限スクロール成功！ ${initialState.campaignCount}件 → ${finalState.totalCampaigns}件`);
    } else {
      console.log('\n❌ 無限スクロールで追加案件が読み込まれませんでした');
    }
    
    console.log('\n手動確認のため10秒間ブラウザを開いておきます...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await browser.close();
  }
}

testMobilePointIncome();