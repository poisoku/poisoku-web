#!/usr/bin/env node

/**
 * マフィア・シティ案件の正確なデータ抽出デバッグ
 * 109342pt → 09342pt になる問題の原因特定
 */

const ExtendedChobirichScraper = require('./src/sites/chobirich/ExtendedChobirichScraper');

async function debugMafiaCampaign() {
  console.log('🔍 マフィア・シティ案件データ抽出デバッグ');
  console.log('='.repeat(60));

  const scraper = new ExtendedChobirichScraper();
  
  try {
    await scraper.initialize();
    
    // 直接該当URLをスクレイピング
    const targetUrl = 'https://www.chobirich.com/ad_details/1840652';
    console.log(`📄 対象URL: ${targetUrl}`);
    
    const page = await scraper.browser.newPage();
    await page.setUserAgent(scraper.config.userAgent);
    await page.setViewport(scraper.config.viewport);
    
    console.log('\n🌐 ページアクセス中...');
    const response = await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    if (response.status() !== 200) {
      throw new Error(`HTTPエラー: ${response.status()}`);
    }
    
    // コンテンツ読み込み待機
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\n🔍 ページ内容分析');
    
    // ポイント関連のテキストを全て抽出
    const pointsDebug = await page.evaluate(() => {
      const results = {};
      
      // タイトル取得
      const titleEl = document.querySelector('h1, .campaign-title, .ad-title');
      results.title = titleEl ? titleEl.textContent.trim() : 'タイトル未発見';
      
      // ポイント関連要素を全て検索
      const pointSelectors = [
        '.ad-category__ad__pt',
        '.item-point', 
        '.campaign-point',
        '.cashback',
        '[class*="pt"]',
        '[class*="point"]',
        '[class*="reward"]',
        '.reward'
      ];
      
      results.pointElements = [];
      pointSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          results.pointElements.push({
            selector,
            text: el.textContent.trim(),
            innerHTML: el.innerHTML.trim()
          });
        });
      });
      
      // ページ全体からポイントらしきテキストを検索
      const bodyText = document.body.textContent;
      const pointMatches = bodyText.match(/\d+(?:,\d{3})*(?:ポイント|pt|円)/gi) || [];
      results.allPointMatches = pointMatches;
      
      // 特に大きな数値を検索
      const largeNumberMatches = bodyText.match(/\d{5,}(?:ポイント|pt)/gi) || [];
      results.largeNumbers = largeNumberMatches;
      
      // 109342 や 09342 を含むテキストを検索
      const mafiaSpecific = bodyText.match(/\d*09342\d*|109342\d*/gi) || [];
      results.mafiaSpecific = mafiaSpecific;
      
      return results;
    });
    
    console.log('\n📊 抽出結果:');
    console.log(`タイトル: ${pointsDebug.title}`);
    
    console.log('\n🎯 ポイント要素:');
    pointsDebug.pointElements.forEach((el, i) => {
      console.log(`  ${i+1}. ${el.selector}: "${el.text}"`);
    });
    
    console.log('\n💰 全ポイントマッチ:');
    pointsDebug.allPointMatches.forEach((match, i) => {
      console.log(`  ${i+1}. "${match}"`);
    });
    
    console.log('\n🔢 大きな数値:');
    pointsDebug.largeNumbers.forEach((match, i) => {
      console.log(`  ${i+1}. "${match}"`);
    });
    
    console.log('\n🎮 マフィア特有数値:');
    pointsDebug.mafiaSpecific.forEach((match, i) => {
      console.log(`  ${i+1}. "${match}"`);
    });
    
    // 実際のcleanPoints関数でのテスト
    console.log('\n🧪 cleanPoints関数テスト:');
    const testInputs = [
      '109342pt',
      '09342pt',
      '最大109342ポイント',
      '最大09342ポイント',
      '109,342pt',
      '109342ポイント'
    ];
    
    testInputs.forEach(input => {
      const result = scraper.cleanPoints(input);
      console.log(`  "${input}" → "${result}"`);
    });
    
    await page.close();
    
  } catch (error) {
    console.error('❌ デバッグエラー:', error);
  } finally {
    await scraper.cleanup();
  }
}

debugMafiaCampaign().catch(console.error);