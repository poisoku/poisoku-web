#!/usr/bin/env node

/**
 * AJAXレスポンスの内容を確認
 */

const puppeteer = require('puppeteer');

async function checkAjaxResponse() {
  console.log('🔍 AJAXレスポンス内容の確認');
  
  const browser = await puppeteer.launch({ headless: false, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  await page.goto('https://pointi.jp/list.php?category=161', { waitUntil: 'networkidle2' });
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log('📊 1ページ目の状態確認');
  const page1State = await page.evaluate(() => {
    const campaigns = document.querySelectorAll('.box_ad');
    return {
      count: campaigns.length,
      firstTitle: campaigns[0] ? campaigns[0].querySelector('.title_list')?.textContent?.trim() : null,
      hasJQuery: typeof $ !== 'undefined',
      jqueryVersion: typeof $ !== 'undefined' ? $.fn.jquery : null
    };
  });
  
  console.log('   案件数:', page1State.count);
  console.log('   最初の案件:', page1State.firstTitle);
  console.log('   jQuery存在:', page1State.hasJQuery);
  console.log('   jQueryバージョン:', page1State.jqueryVersion);
  
  console.log('\n🌐 直接AJAXリクエスト送信');
  
  // 直接fetchでAJAXを呼び出し、レスポンスを確認
  const ajaxResult = await page.evaluate(async () => {
    try {
      const response = await fetch('ajax_load/load_list.php?order=1&page=2&max=24&narrow=0&category=161&data_type=', {
        method: 'GET',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'text/html, */*; q=0.01'
        }
      });
      
      const text = await response.text();
      
      return {
        success: response.ok,
        status: response.status,
        contentType: response.headers.get('content-type'),
        responseLength: text.length,
        responseStart: text.substring(0, 500),
        hasBoxAd: text.includes('box_ad'),
        campaignCount: (text.match(/box_ad/g) || []).length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });
  
  console.log('📊 AJAXレスポンス詳細:');
  console.log('   成功:', ajaxResult.success);
  console.log('   ステータス:', ajaxResult.status);
  console.log('   Content-Type:', ajaxResult.contentType);
  console.log('   レスポンス長:', ajaxResult.responseLength);
  console.log('   box_ad含有:', ajaxResult.hasBoxAd);
  console.log('   推定案件数:', ajaxResult.campaignCount);
  console.log('   レスポンス先頭:', ajaxResult.responseStart);
  
  if (ajaxResult.success && ajaxResult.hasBoxAd) {
    console.log('\n🔧 DOM更新の試行');
    
    const updateResult = await page.evaluate((responseText) => {
      try {
        // 複数の更新方法を試す
        let targetElement = null;
        
        // 方法1: 既存のコンテンツエリアを特定
        const selectors = [
          '#content_list',
          '.list_area',
          '.campaign_list',
          '[id*="list"]',
          '[class*="list"]'
        ];
        
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element) {
            targetElement = element;
            console.log('対象要素発見:', selector);
            break;
          }
        }
        
        // フォールバック: .box_adの親要素を特定
        if (!targetElement) {
          const firstBoxAd = document.querySelector('.box_ad');
          if (firstBoxAd) {
            targetElement = firstBoxAd.parentElement;
            console.log('フォールバック: .box_adの親要素を使用');
          }
        }
        
        if (targetElement) {
          const beforeCount = document.querySelectorAll('.box_ad').length;
          targetElement.innerHTML = responseText;
          const afterCount = document.querySelectorAll('.box_ad').length;
          
          return {
            success: true,
            beforeCount: beforeCount,
            afterCount: afterCount,
            targetSelector: targetElement.tagName + (targetElement.id ? '#' + targetElement.id : '') + (targetElement.className ? '.' + targetElement.className.split(' ')[0] : '')
          };
        } else {
          return {
            success: false,
            error: '適切な更新対象が見つかりません'
          };
        }
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    }, ajaxResult.responseStart);
    
    console.log('📊 DOM更新結果:');
    console.log('   成功:', updateResult.success);
    if (updateResult.success) {
      console.log('   更新前:', updateResult.beforeCount + '件');
      console.log('   更新後:', updateResult.afterCount + '件');
      console.log('   対象要素:', updateResult.targetSelector);
    } else {
      console.log('   エラー:', updateResult.error);
    }
  }
  
  console.log('\n手動確認のため10秒間ブラウザを開いておきます...');
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  await browser.close();
}

checkAjaxResponse();