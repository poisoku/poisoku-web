#!/usr/bin/env node

/**
 * 強制モバイルアクセス試行
 * 全ての可能な方法でモバイル版にアクセスを試みる
 */

const puppeteer = require('puppeteer');

async function forceMobileAccess() {
  console.log('🚀 強制モバイルアクセス試行開始...');
  
  const browser = await puppeteer.launch({
    headless: false, // 可視化してデバッグ
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--disable-blink-features=AutomationControlled',
      '--user-agent=Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
      '--enable-mobile-user-agent'
    ]
  });
  
  try {
    const page = await browser.newPage();
    
    // 強制モバイル設定
    console.log('📱 強制モバイル環境設定...');
    
    // User-Agent設定
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1');
    
    // ビューポート設定
    await page.setViewport({
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      isLandscape: false
    });
    
    // モバイル専用ヘッダー
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    });
    
    // JavaScript環境をモバイルに偽装
    await page.evaluateOnNewDocument(() => {
      // Navigator properties
      Object.defineProperty(navigator, 'platform', { get: () => 'iPhone' });
      Object.defineProperty(navigator, 'userAgent', {
        get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1'
      });
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
      Object.defineProperty(navigator, 'vendor', { get: () => 'Apple Computer, Inc.' });
      
      // Screen properties
      Object.defineProperty(screen, 'width', { get: () => 390 });
      Object.defineProperty(screen, 'height', { get: () => 844 });
      Object.defineProperty(screen, 'availWidth', { get: () => 390 });
      Object.defineProperty(screen, 'availHeight', { get: () => 844 });
      
      // Window properties
      Object.defineProperty(window, 'orientation', { get: () => 0 });
      Object.defineProperty(window, 'innerWidth', { get: () => 390 });
      Object.defineProperty(window, 'innerHeight', { get: () => 844 });
      Object.defineProperty(window, 'outerWidth', { get: () => 390 });
      Object.defineProperty(window, 'outerHeight', { get: () => 844 });
      
      // Touch support
      window.DeviceMotionEvent = true;
      window.DeviceOrientationEvent = true;
      window.TouchEvent = true;
      
      // CSS media queries
      Object.defineProperty(window, 'matchMedia', {
        value: (query) => ({
          matches: query.includes('max-width: 768px') || query.includes('(pointer: coarse)'),
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => {},
        })
      });
    });
    
    // 方法1: リファラーを設定してモバイル版ページを要求
    console.log('\n📍 方法1: モバイルリファラー設定');
    await page.setExtraHTTPHeaders({
      'Referer': 'https://pc.moppy.jp/mobile/'
    });
    
    const targetUrl = 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=52&af_sorter=1&page=1';
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    let result1 = await checkPageContent(page, '方法1');
    
    // 方法2: URLパラメータを追加
    console.log('\n📍 方法2: モバイル判定パラメータ追加');
    const mobileUrl = targetUrl + '&mobile=1&device=mobile&ua=mobile';
    await page.goto(mobileUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    let result2 = await checkPageContent(page, '方法2');
    
    // 方法3: Cookieでモバイル判定を強制
    console.log('\n📍 方法3: モバイル判定Cookie強制設定');
    await page.setCookie(
      { name: 'mobile_view', value: '1', domain: 'pc.moppy.jp' },
      { name: 'device_type', value: 'mobile', domain: 'pc.moppy.jp' },
      { name: 'user_agent_type', value: 'mobile', domain: 'pc.moppy.jp' },
      { name: 'screen_size', value: 'small', domain: 'pc.moppy.jp' }
    );
    
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    let result3 = await checkPageContent(page, '方法3');
    
    // 方法4: JavaScript強制実行でモバイル版表示をトリガー
    console.log('\n📍 方法4: JavaScript強制モバイル版表示');
    await page.evaluate(() => {
      // 可能性のあるモバイル版切り替え関数
      if (window.switchToMobile) window.switchToMobile();
      if (window.setMobileView) window.setMobileView(true);
      if (window.detectDevice) window.detectDevice();
      if (window.initMobileLayout) window.initMobileLayout();
      
      // DOM操作でモバイル版クラスを追加
      document.body.classList.add('mobile', 'mobile-view', 'mobile-device');
      document.documentElement.classList.add('mobile', 'mobile-view', 'mobile-device');
      
      // CSSメディアクエリを強制
      const style = document.createElement('style');
      style.textContent = `
        @media screen and (max-width: 768px) {
          .pc-only { display: none !important; }
          .mobile-only { display: block !important; }
        }
      `;
      document.head.appendChild(style);
      
      // ページリロードイベントを発火
      window.dispatchEvent(new Event('resize'));
      window.dispatchEvent(new Event('orientationchange'));
    });
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    let result4 = await checkPageContent(page, '方法4');
    
    // 結果まとめ
    console.log('\n📊 全結果まとめ:');
    [result1, result2, result3, result4].forEach((result, index) => {
      console.log(`方法${index + 1}: ${result.campaigns}件, ページネーション: ${result.hasPagination ? 'あり' : 'なし'}, アプリ案件: ${result.hasAppCampaigns ? 'あり' : 'なし'}`);
    });
    
    // 30秒間表示して手動確認
    console.log('\n⏱️ 30秒間表示します（手動確認用）...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
  } catch (error) {
    console.error('💥 強制アクセスエラー:', error);
  } finally {
    await browser.close();
  }
}

async function checkPageContent(page, method) {
  return await page.evaluate((method) => {
    const siteIdLinks = document.querySelectorAll('a[href*="site_id"]').length;
    const hasPagination = document.body.textContent.includes('を表示') && document.body.textContent.includes('件中');
    const hasAppCampaigns = document.body.textContent.includes('Pontaアプリ') || 
                           document.body.textContent.includes('ローソン') ||
                           document.body.textContent.includes('新規アプリインストール');
    
    console.log(`${method}: ${siteIdLinks}件のsite_idリンク, ページネーション: ${hasPagination}, アプリ案件: ${hasAppCampaigns}`);
    
    return {
      campaigns: siteIdLinks,
      hasPagination: hasPagination,
      hasAppCampaigns: hasAppCampaigns
    };
  }, method);
}

// 実行
forceMobileAccess().catch(console.error);