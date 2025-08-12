#!/usr/bin/env node

require('dotenv').config();
const puppeteer = require('puppeteer');

/**
 * AJAX ページネーション方式の動作確認テスト
 * 発見されたAPIエンドポイントを使用して追加データを取得する
 */
async function testAjaxPaginationApproach() {
  console.log('🧪 AJAX ページネーション方式テスト開始');
  console.log('='.repeat(70));
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 390, height: 844 }
  });
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15');
    
    // テスト対象：ゲームカテゴリ（285）
    const categoryId = 285;
    const baseUrl = `https://sp.pointi.jp/pts_app.php?cat_no=${categoryId}&sort=&sub=4`;
    
    console.log(`📱 ベースURL: ${baseUrl}`);
    
    // 1. 通常のページアクセス（ページ1）
    console.log('\n📄 ページ1: 通常アクセス');
    await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const page1Count = await page.evaluate(() => {
      return document.querySelectorAll('.box01').length;
    });
    
    console.log(`  取得件数: ${page1Count}件`);
    
    // 2. AJAXでページ2を取得
    console.log('\n📄 ページ2: AJAX取得');
    const ajaxUrl = `https://sp.pointi.jp/ajax_load/load_category_top.php?rate_form=1&sort=&sub=4&page=2&category=${categoryId}&limit_count=500`;
    console.log(`  AJAX URL: ${ajaxUrl}`);
    
    const ajaxResponse = await page.evaluate(async (url) => {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'text/html, */*; q=0.01',
            'X-Requested-With': 'XMLHttpRequest'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const text = await response.text();
        return {
          success: true,
          content: text,
          length: text.length
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          content: '',
          length: 0
        };
      }
    }, ajaxUrl);
    
    if (ajaxResponse.success) {
      console.log(`  ✅ AJAX成功: ${ajaxResponse.length}文字のHTMLを取得`);
      
      // HTMLを解析して案件数をカウント
      const ajaxCampaignCount = await page.evaluate((htmlContent) => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        const count = tempDiv.querySelectorAll('.box01').length;
        tempDiv.remove();
        return count;
      }, ajaxResponse.content);
      
      console.log(`  案件数: ${ajaxCampaignCount}件`);
      
      if (ajaxCampaignCount > 0) {
        console.log(`  🎉 ページ2で${ajaxCampaignCount}件の案件を発見！`);
        
        // 実際の案件データの一部を表示
        const sampleCampaigns = await page.evaluate((htmlContent) => {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = htmlContent;
          
          const samples = [];
          const campaigns = tempDiv.querySelectorAll('.box01');
          
          for (let i = 0; i < Math.min(3, campaigns.length); i++) {
            const element = campaigns[i];
            const titleEl = element.querySelector('.title, h3, h4, strong, a');
            const linkEl = element.querySelector('a[href]');
            
            if (titleEl && linkEl) {
              samples.push({
                title: titleEl.textContent.trim().substring(0, 40) + '...',
                url: linkEl.getAttribute('href')
              });
            }
          }
          
          tempDiv.remove();
          return samples;
        }, ajaxResponse.content);
        
        console.log(`  📋 サンプル案件:`);
        sampleCampaigns.forEach((campaign, index) => {
          console.log(`    ${index + 1}. ${campaign.title}`);
          console.log(`       ${campaign.url}`);
        });
        
      } else {
        console.log(`  📭 ページ2には案件がありません`);
      }
      
      // 3. ページ3も試してみる
      console.log('\n📄 ページ3: AJAX取得');
      const page3Url = `https://sp.pointi.jp/ajax_load/load_category_top.php?rate_form=1&sort=&sub=4&page=3&category=${categoryId}&limit_count=500`;
      
      const page3Response = await page.evaluate(async (url) => {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'text/html, */*; q=0.01',
            'X-Requested-With': 'XMLHttpRequest'
          }
        });
        const text = await response.text();
        return text;
      }, page3Url);
      
      const page3Count = await page.evaluate((htmlContent) => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        const count = tempDiv.querySelectorAll('.box01').length;
        tempDiv.remove();
        return count;
      }, page3Response);
      
      console.log(`  案件数: ${page3Count}件`);
      
    } else {
      console.log(`  ❌ AJAX失敗: ${ajaxResponse.error}`);
    }
    
    // 4. 合計確認
    console.log('\n📊 結果まとめ:');
    console.log(`  ページ1 (通常): ${page1Count}件`);
    
    let page2Count = 0;
    if (ajaxResponse.success) {
      page2Count = ajaxCampaignCount;
      console.log(`  ページ2 (AJAX): ${page2Count}件`);
    } else {
      console.log(`  ページ2 (AJAX): 失敗`);
    }
    
    console.log(`  ページ3 (AJAX): ${page3Count || 0}件`);
    
    const total = page1Count + page2Count + (page3Count || 0);
    console.log(`  🎯 合計取得可能: ${total}件`);
    
    if (total > page1Count) {
      console.log(`  ✅ AJAX方式で ${total - page1Count}件の追加案件を発見！`);
    } else {
      console.log(`  ⚠️ 追加案件が見つかりませんでした`);
    }
    
    // 10秒待機（確認用）
    console.log('\n⏸️ 10秒後に終了します...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
  } finally {
    await browser.close();
    console.log('\n✅ テスト完了');
  }
}

// 実行
testAjaxPaginationApproach().catch(console.error);