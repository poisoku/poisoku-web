#!/usr/bin/env node

/**
 * モッピーアプリ案件ページ構造調査用デバッグスクリプト
 */

const puppeteer = require('puppeteer');

async function debugMoppyAppStructure() {
  console.log('🔍 モッピーアプリ案件ページ構造調査開始...');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // iOS User-Agent
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
    await page.setViewport({ width: 375, height: 667 });
    
    // 1ページ目にアクセス
    const url = 'https://pc.moppy.jp/category/list.php?parent_category=4&af_sorter=1&page=1';
    console.log(`📍 アクセス URL: ${url}`);
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // ページ構造調査
    const analysis = await page.evaluate(() => {
      const result = {
        title: document.title,
        url: window.location.href,
        bodyClasses: document.body.className,
        totalLinks: document.querySelectorAll('a').length,
        siteIdLinks: document.querySelectorAll('a[href*="site_id"]').length,
        adDetailLinks: document.querySelectorAll('a[href*="/ad/detail.php"]').length,
        possibleCampaignElements: {
          '.campaign-item': document.querySelectorAll('.campaign-item').length,
          '.ad-item': document.querySelectorAll('.ad-item').length,  
          '.list-item': document.querySelectorAll('.list-item').length,
          'li': document.querySelectorAll('li').length,
          '[class*="item"]': document.querySelectorAll('[class*="item"]').length,
          '[class*="campaign"]': document.querySelectorAll('[class*="campaign"]').length,
          '[class*="ad"]': document.querySelectorAll('[class*="ad"]').length,
        },
        sampleTitles: [],
        paginationInfo: {
          nextPageLinks: document.querySelectorAll('a[href*="page=2"], a[href*="次"], a[href*="next"]').length,
          pageNumbers: [],
          totalPages: null
        }
      };
      
      // サンプルタイトル取得（最初の20個のsite_idリンク）
      const siteIdLinks = document.querySelectorAll('a[href*="site_id"]');
      for (let i = 0; i < Math.min(20, siteIdLinks.length); i++) {
        const link = siteIdLinks[i];
        const title = link.textContent?.trim() || '';
        const href = link.href;
        if (title) {
          result.sampleTitles.push({ title, href });
        }
      }
      
      // ページネーション情報
      const pageLinks = document.querySelectorAll('a[href*="page="]');
      const pageNumbers = [];
      pageLinks.forEach(link => {
        const match = link.href.match(/page=(\d+)/);
        if (match) {
          pageNumbers.push(parseInt(match[1]));
        }
      });
      result.paginationInfo.pageNumbers = [...new Set(pageNumbers)].sort((a, b) => a - b);
      
      // 総ページ数推定
      if (pageNumbers.length > 0) {
        result.paginationInfo.totalPages = Math.max(...pageNumbers);
      }
      
      return result;
    });
    
    console.log('\n📊 ページ構造分析結果:');
    console.log('=====================================');
    console.log(`📄 ページタイトル: ${analysis.title}`);
    console.log(`🔗 現在のURL: ${analysis.url}`);
    console.log(`📝 総リンク数: ${analysis.totalLinks}`);
    console.log(`🎯 site_idリンク数: ${analysis.siteIdLinks}`);
    console.log(`📋 /ad/detail.phpリンク数: ${analysis.adDetailLinks}`);
    
    console.log('\n🔍 可能な案件要素セレクター:');
    Object.entries(analysis.possibleCampaignElements).forEach(([selector, count]) => {
      console.log(`  ${selector}: ${count}個`);
    });
    
    console.log('\n📋 サンプルタイトル（最初の20件）:');
    analysis.sampleTitles.forEach((item, index) => {
      console.log(`${index + 1}. ${item.title}`);
    });
    
    console.log('\n📄 ページネーション情報:');
    console.log(`次ページリンク: ${analysis.paginationInfo.nextPageLinks}個`);
    console.log(`ページ番号: ${analysis.paginationInfo.pageNumbers.join(', ')}`);
    console.log(`推定総ページ数: ${analysis.paginationInfo.totalPages}`);
    
    // 2ページ目も確認
    if (analysis.paginationInfo.totalPages && analysis.paginationInfo.totalPages > 1) {
      console.log('\n🔍 2ページ目も調査中...');
      
      const page2Url = 'https://pc.moppy.jp/category/list.php?parent_category=4&af_sorter=1&page=2';
      await page.goto(page2Url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const page2Analysis = await page.evaluate(() => ({
        siteIdLinks: document.querySelectorAll('a[href*="site_id"]').length,
        sampleTitles: Array.from(document.querySelectorAll('a[href*="site_id"]')).slice(0, 10).map(link => link.textContent?.trim() || '')
      }));
      
      console.log(`📄 2ページ目 site_idリンク数: ${page2Analysis.siteIdLinks}`);
      console.log('📋 2ページ目サンプルタイトル:');
      page2Analysis.sampleTitles.forEach((title, index) => {
        console.log(`${index + 1}. ${title}`);
      });
    }
    
  } catch (error) {
    console.error('💥 調査エラー:', error);
  } finally {
    await browser.close();
  }
}

// 実行
debugMoppyAppStructure().catch(console.error);