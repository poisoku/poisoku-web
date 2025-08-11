#!/usr/bin/env node

/**
 * モバイル版ポイントインカムのページ構造調査
 */

const puppeteer = require('puppeteer');

async function investigateMobileStructure() {
  console.log('🔍 モバイル版ポイントインカムページ構造調査');
  console.log('='.repeat(60));
  
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox'] 
  });
  
  try {
    const page = await browser.newPage();
    
    // iOS Safari のユーザーエージェント
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
    
    await page.setViewport({
      width: 375,
      height: 812,
      isMobile: true,
      hasTouch: true
    });
    
    console.log('🌐 カテゴリ161にアクセス中...');
    await page.goto('https://pointi.jp/list.php?category=161', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // ページ構造を詳しく調査
    const pageInfo = await page.evaluate(() => {
      // さまざまなセレクタを試す
      const selectors = [
        '.box_ad',
        '.campaign',
        '.list_item',
        '[class*="ad"]',
        '[class*="campaign"]',
        '[class*="item"]',
        'li',
        '.row',
        '.item'
      ];
      
      const results = {};
      
      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        results[selector] = elements.length;
      });
      
      // DOM構造の一部を取得
      const bodyHTML = document.body.innerHTML.substring(0, 2000);
      
      // JavaScriptのコンソールエラーがないかチェック
      const scripts = Array.from(document.querySelectorAll('script')).map(script => {
        return {
          src: script.src || 'inline',
          content: script.innerHTML.substring(0, 100)
        };
      });
      
      // AJAXリクエストの存在確認
      const hasJQuery = typeof $ !== 'undefined';
      
      return {
        title: document.title,
        url: window.location.href,
        selectors: results,
        bodyStart: bodyHTML,
        scriptsCount: scripts.length,
        hasJQuery: hasJQuery,
        bodyLength: document.body.innerHTML.length
      };
    });
    
    console.log('📊 ページ情報:');
    console.log(`   タイトル: ${pageInfo.title}`);
    console.log(`   URL: ${pageInfo.url}`);
    console.log(`   body長: ${pageInfo.bodyLength}文字`);
    console.log(`   jQuery存在: ${pageInfo.hasJQuery}`);
    console.log(`   スクリプト数: ${pageInfo.scriptsCount}`);
    
    console.log('\n📊 セレクタ別要素数:');
    Object.entries(pageInfo.selectors).forEach(([selector, count]) => {
      if (count > 0) {
        console.log(`   ${selector}: ${count}個`);
      }
    });
    
    console.log('\n📄 Body HTML (先頭2000文字):');
    console.log(pageInfo.bodyStart);
    
    // ネットワークリクエストを監視
    console.log('\n🌐 ネットワーク監視開始（5秒間）...');
    const networkRequests = [];
    
    page.on('response', response => {
      if (response.url().includes('pointi.jp')) {
        networkRequests.push({
          url: response.url(),
          status: response.status(),
          contentType: response.headers()['content-type']
        });
      }
    });
    
    // スクロールしてネットワーク活動を観察
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\n📡 ネットワークリクエスト:');
    networkRequests.forEach((req, i) => {
      console.log(`   ${i + 1}. ${req.url} (${req.status}) ${req.contentType || ''}`);
    });
    
    // 特定のスマートフォン向けクラスやIDを探す
    const mobileElements = await page.evaluate(() => {
      const mobileSelectors = [
        '[class*="mobile"]',
        '[class*="smart"]',
        '[class*="phone"]',
        '[id*="mobile"]',
        '[id*="smart"]',
        '[id*="phone"]'
      ];
      
      const results = {};
      mobileSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          results[selector] = {
            count: elements.length,
            examples: Array.from(elements).slice(0, 3).map(el => ({
              tagName: el.tagName,
              className: el.className,
              id: el.id,
              content: el.textContent ? el.textContent.substring(0, 50) : ''
            }))
          };
        }
      });
      
      return results;
    });
    
    if (Object.keys(mobileElements).length > 0) {
      console.log('\n📱 モバイル向け要素:');
      Object.entries(mobileElements).forEach(([selector, info]) => {
        console.log(`   ${selector}: ${info.count}個`);
        info.examples.forEach((ex, i) => {
          console.log(`     ${i + 1}. <${ex.tagName} class="${ex.className}" id="${ex.id}">${ex.content}...`);
        });
      });
    } else {
      console.log('\n📱 モバイル専用要素は見つかりませんでした');
    }
    
    console.log('\n手動確認のため15秒間ブラウザを開いておきます...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await browser.close();
  }
}

investigateMobileStructure();