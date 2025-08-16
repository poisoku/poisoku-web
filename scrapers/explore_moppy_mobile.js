#!/usr/bin/env node

/**
 * モッピー モバイル版サイトでアプリカテゴリを探索
 */

const puppeteer = require('puppeteer');

async function exploreMoppyMobile() {
  console.log('🔍 モッピー モバイル版サイト探索開始...');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // iOSモバイルUser-Agent設定
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
    await page.setViewport({ width: 375, height: 667 });
    
    // モッピーのトップページにアクセス
    const topUrl = 'https://pc.moppy.jp/';
    console.log(`📍 トップページアクセス: ${topUrl}`);
    
    await page.goto(topUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // カテゴリリンクを探索
    const categoryInfo = await page.evaluate(() => {
      const result = {
        allLinks: [],
        appRelatedLinks: [],
        categoryLinks: [],
        currentUrl: window.location.href
      };
      
      // すべてのリンクを取得
      const allLinks = document.querySelectorAll('a[href*="category"]');
      allLinks.forEach(link => {
        const href = link.href;
        const text = link.textContent?.trim() || '';
        
        if (href && text) {
          result.allLinks.push({ href, text });
          
          // アプリ関連キーワードチェック
          const appKeywords = ['アプリ', 'app', 'ダウンロード', 'インストール', 'スマホ', 'モバイル'];
          if (appKeywords.some(keyword => text.toLowerCase().includes(keyword.toLowerCase()))) {
            result.appRelatedLinks.push({ href, text });
          }
          
          // カテゴリリンクを抽出
          if (href.includes('parent_category')) {
            result.categoryLinks.push({ href, text });
          }
        }
      });
      
      return result;
    });
    
    console.log(`\n📊 トップページ分析結果:`);
    console.log(`現在のURL: ${categoryInfo.currentUrl}`);
    console.log(`カテゴリリンク数: ${categoryInfo.categoryLinks.length}`);
    console.log(`アプリ関連リンク数: ${categoryInfo.appRelatedLinks.length}`);
    
    if (categoryInfo.appRelatedLinks.length > 0) {
      console.log('\n📱 アプリ関連リンク:');
      categoryInfo.appRelatedLinks.forEach((link, index) => {
        console.log(`${index + 1}. ${link.text}`);
        console.log(`   URL: ${link.href}`);
      });
    }
    
    console.log('\n📂 カテゴリリンク一覧:');
    categoryInfo.categoryLinks.slice(0, 20).forEach((link, index) => {
      console.log(`${index + 1}. ${link.text} -> ${link.href}`);
    });
    
    // parent_category=4のページを詳しく調査
    console.log('\n🔍 parent_category=4 の詳細調査...');
    
    const cat4Url = 'https://pc.moppy.jp/category/list.php?parent_category=4';
    await page.goto(cat4Url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const cat4Analysis = await page.evaluate(() => {
      const result = {
        title: document.title,
        url: window.location.href,
        childCategories: [],
        sampleLinks: []
      };
      
      // 子カテゴリリンクを探す
      const childLinks = document.querySelectorAll('a[href*="child_category"]');
      childLinks.forEach(link => {
        const href = link.href;
        const text = link.textContent?.trim() || '';
        if (href && text) {
          result.childCategories.push({ href, text });
        }
      });
      
      // サンプルリンク取得
      const siteIdLinks = document.querySelectorAll('a[href*="site_id"]');
      for (let i = 0; i < Math.min(10, siteIdLinks.length); i++) {
        const link = siteIdLinks[i];
        result.sampleLinks.push({
          text: link.textContent?.trim() || '',
          href: link.href
        });
      }
      
      return result;
    });
    
    console.log(`📄 ページタイトル: ${cat4Analysis.title}`);
    console.log(`🔗 現在のURL: ${cat4Analysis.url}`);
    console.log(`📂 子カテゴリ数: ${cat4Analysis.childCategories.length}`);
    
    if (cat4Analysis.childCategories.length > 0) {
      console.log('\n📱 子カテゴリ一覧:');
      cat4Analysis.childCategories.forEach((cat, index) => {
        console.log(`${index + 1}. ${cat.text}`);
        console.log(`   URL: ${cat.href}`);
      });
    }
    
    // スマホ専用URLパターンも試す
    console.log('\n🔍 スマホ専用URLパターン調査...');
    
    const mobileUrls = [
      'https://sp.moppy.jp/',
      'https://m.moppy.jp/',
      'https://pc.moppy.jp/smartphone/',
      'https://pc.moppy.jp/mobile/',
      'https://pc.moppy.jp/app/'
    ];
    
    for (const mobileUrl of mobileUrls) {
      try {
        console.log(`\n📍 テスト: ${mobileUrl}`);
        const response = await page.goto(mobileUrl, { 
          waitUntil: 'domcontentloaded', 
          timeout: 10000 
        });
        
        if (response && response.ok()) {
          const finalUrl = page.url();
          const title = await page.title();
          console.log(`✅ アクセス成功`);
          console.log(`   最終URL: ${finalUrl}`);
          console.log(`   タイトル: ${title}`);
          
          // アプリ関連コンテンツを探す
          const hasAppContent = await page.evaluate(() => {
            const bodyText = document.body?.textContent || '';
            const appKeywords = ['アプリ', 'ダウンロード', 'インストール', 'iOS', 'Android'];
            return appKeywords.some(keyword => bodyText.includes(keyword));
          });
          
          if (hasAppContent) {
            console.log(`   📱 アプリ関連コンテンツあり`);
          }
        }
      } catch (error) {
        console.log(`❌ アクセス失敗: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('💥 探索エラー:', error);
  } finally {
    await browser.close();
  }
}

// 実行
exploreMoppyMobile().catch(console.error);