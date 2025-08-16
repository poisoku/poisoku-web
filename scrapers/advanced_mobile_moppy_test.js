#!/usr/bin/env node

/**
 * 高度なモバイル環境設定でモッピーアプリ案件にアクセス
 * 実際のモバイルブラウザの動作を完全に模擬
 */

const puppeteer = require('puppeteer');

async function advancedMobileMoppyTest() {
  console.log('🚀 高度なモバイル環境設定でモッピーアプリ案件アクセス開始...');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--disable-blink-features=AutomationControlled',
      '--disable-extensions',
      '--no-first-run',
      '--no-default-browser-check',
      '--force-device-scale-factor=3'
    ]
  });
  
  try {
    const page = await browser.newPage();
    
    console.log('📱 完全なモバイル環境を設定中...');
    
    // 1. 最新のiOS User-Agent（Safari 17.0）
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1');
    
    // 2. 完全なモバイルビューポート設定
    await page.setViewport({
      width: 390,      // iPhone 14 Pro width
      height: 844,     // iPhone 14 Pro height
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      isLandscape: false
    });
    
    // 3. 完全なモバイルHTTPヘッダー設定
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0'
    });
    
    // 4. JavaScript実行環境をモバイルに設定
    await page.evaluateOnNewDocument(() => {
      // モバイルデバイス検出のプロパティを設定
      Object.defineProperty(navigator, 'platform', {
        get: () => 'iPhone'
      });
      
      Object.defineProperty(navigator, 'userAgent', {
        get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1'
      });
      
      // タッチサポートを有効化
      Object.defineProperty(navigator, 'maxTouchPoints', {
        get: () => 5
      });
      
      // モバイル固有のウィンドウプロパティ
      Object.defineProperty(window, 'orientation', {
        get: () => 0
      });
      
      // モバイル判定を確実にするプロパティ
      window.DeviceMotionEvent = true;
      window.DeviceOrientationEvent = true;
    });
    
    console.log('🔄 複数のアクセス方法を試行...');
    
    // 方法1: 直接URL
    console.log('\n📍 方法1: 直接URLアクセス');
    const directUrl = 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=52&af_sorter=1&page=1';
    await page.goto(directUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    let analysis1 = await page.evaluate(() => ({
      title: document.title,
      url: window.location.href,
      siteIdLinks: document.querySelectorAll('a[href*="site_id"]').length,
      bodyText: document.body.textContent.substring(0, 500)
    }));
    
    console.log(`結果1: ${analysis1.siteIdLinks}件のsite_idリンク`);
    console.log(`URL: ${analysis1.url}`);
    
    // 方法2: トップページ経由でナビゲーション
    console.log('\n📍 方法2: トップページ経由ナビゲーション');
    await page.goto('https://pc.moppy.jp/', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // アプリリンクを探してクリック
    const appLinkFound = await page.evaluate(() => {
      const links = document.querySelectorAll('a');
      for (const link of links) {
        const text = link.textContent?.trim() || '';
        const href = link.href || '';
        if (text.includes('アプリ') && href.includes('child_category=52')) {
          link.click();
          return true;
        }
      }
      return false;
    });
    
    if (appLinkFound) {
      console.log('✅ アプリリンクをクリック');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      let analysis2 = await page.evaluate(() => ({
        title: document.title,
        url: window.location.href,
        siteIdLinks: document.querySelectorAll('a[href*="site_id"]').length
      }));
      
      console.log(`結果2: ${analysis2.siteIdLinks}件のsite_idリンク`);
      console.log(`URL: ${analysis2.url}`);
    } else {
      console.log('❌ アプリリンクが見つかりませんでした');
    }
    
    // 方法3: 特定のCookieを設定してアクセス
    console.log('\n📍 方法3: モバイル判定Cookieを設定');
    await page.setCookie(
      { name: 'mobile', value: '1', domain: 'pc.moppy.jp' },
      { name: 'device', value: 'mobile', domain: 'pc.moppy.jp' },
      { name: 'user_agent', value: 'mobile', domain: 'pc.moppy.jp' }
    );
    
    await page.goto(directUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    let analysis3 = await page.evaluate(() => ({
      title: document.title,
      url: window.location.href,
      siteIdLinks: document.querySelectorAll('a[href*="site_id"]').length
    }));
    
    console.log(`結果3: ${analysis3.siteIdLinks}件のsite_idリンク`);
    
    // 方法4: モバイル専用サブドメインを試行
    console.log('\n📍 方法4: モバイル専用サブドメインテスト');
    const mobileUrls = [
      'https://m.moppy.jp/category/list.php?parent_category=4&child_category=52',
      'https://sp.moppy.jp/category/list.php?parent_category=4&child_category=52',
      'https://mobile.moppy.jp/category/list.php?parent_category=4&child_category=52'
    ];
    
    for (const mobileUrl of mobileUrls) {
      try {
        await page.goto(mobileUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
        const finalUrl = page.url();
        console.log(`✅ ${mobileUrl} → ${finalUrl}`);
      } catch (error) {
        console.log(`❌ ${mobileUrl} アクセス失敗`);
      }
    }
    
    // 方法5: JavaScript強制実行でモバイル版をトリガー
    console.log('\n📍 方法5: JavaScript強制実行');
    await page.goto(directUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await page.evaluate(() => {
      // モバイル版のJavaScript実行をトリガー
      if (window.jQuery) {
        window.jQuery(document).trigger('ready');
        window.jQuery(window).trigger('load');
      }
      
      // 可能なモバイル判定関数を実行
      if (window.checkMobile) window.checkMobile();
      if (window.initMobile) window.initMobile();
      if (window.mobileInit) window.mobileInit();
      
      // DOM更新を強制
      document.dispatchEvent(new Event('DOMContentLoaded'));
      window.dispatchEvent(new Event('load'));
    });
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    let analysis5 = await page.evaluate(() => {
      const result = {
        title: document.title,
        url: window.location.href,
        siteIdLinks: document.querySelectorAll('a[href*="site_id"]').length,
        sampleTitles: []
      };
      
      // より詳細なアプリ案件検索
      const allLinks = document.querySelectorAll('a');
      const appKeywords = ['アプリ', 'インストール', 'ダウンロード', 'Ponta', 'ローソン', 'ゲーム'];
      
      allLinks.forEach(link => {
        const text = link.textContent?.trim() || '';
        if (appKeywords.some(keyword => text.includes(keyword))) {
          if (result.sampleTitles.length < 10) {
            result.sampleTitles.push(text);
          }
        }
      });
      
      return result;
    });
    
    console.log(`結果5: ${analysis5.siteIdLinks}件のsite_idリンク`);
    if (analysis5.sampleTitles.length > 0) {
      console.log('🎯 発見されたアプリ関連案件:');
      analysis5.sampleTitles.forEach((title, index) => {
        console.log(`  ${index + 1}. ${title}`);
      });
    }
    
    // 最終確認: ページソースの確認
    console.log('\n📄 ページソース分析...');
    const pageContent = await page.content();
    const hasAppContent = pageContent.includes('Pontaアプリ') || 
                         pageContent.includes('ローソン') || 
                         pageContent.includes('新規アプリインストール');
    
    console.log(`アプリ関連コンテンツ存在: ${hasAppContent ? 'YES' : 'NO'}`);
    
    if (hasAppContent) {
      console.log('🎉 アプリ案件コンテンツを発見！');
    } else {
      console.log('⚠️ まだデスクトップ版のコンテンツです');
    }
    
  } catch (error) {
    console.error('💥 テストエラー:', error);
  } finally {
    await browser.close();
  }
}

// 実行
advancedMobileMoppyTest().catch(console.error);