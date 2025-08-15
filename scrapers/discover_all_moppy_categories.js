#!/usr/bin/env node

/**
 * モッピー全カテゴリ発見システム
 * スマホアプリ案件以外のすべてのカテゴリURLを収集
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;

async function discoverAllCategories() {
  console.log('🔍 モッピー全カテゴリ発見システム開始');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // モッピーのメインページからカテゴリを探索
    console.log('\n📂 メインページからカテゴリ探索中...');
    await page.goto('https://pc.moppy.jp', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    await new Promise(r => setTimeout(r, 3000));
    
    // カテゴリリンクを収集
    const categoryLinks = await page.evaluate(() => {
      const result = {
        shopping: [],
        service: [],
        other: [],
        appCategories: []
      };
      
      // 全てのリンクを調査
      const allLinks = document.querySelectorAll('a[href*="category"]');
      
      allLinks.forEach(link => {
        const href = link.href;
        const text = link.textContent?.trim() || '';
        
        // カテゴリURLパターンのチェック
        if (href.includes('/category/list.php')) {
          const urlParams = new URLSearchParams(href.split('?')[1]);
          const parentCategory = urlParams.get('parent_category');
          const childCategory = urlParams.get('child_category');
          
          if (parentCategory && childCategory) {
            const categoryInfo = {
              url: href,
              name: text,
              parentCategory: parseInt(parentCategory),
              childCategory: parseInt(childCategory),
              type: 'unknown'
            };
            
            // カテゴリタイプの推定
            if (text.includes('アプリ') || text.includes('スマホ') || text.includes('ゲーム')) {
              categoryInfo.type = 'app';
              result.appCategories.push(categoryInfo);
            } else if (parentCategory === '6') {
              categoryInfo.type = 'shopping';
              result.shopping.push(categoryInfo);
            } else if (parentCategory === '4') {
              categoryInfo.type = 'service';
              result.service.push(categoryInfo);
            } else {
              result.other.push(categoryInfo);
            }
          }
        }
      });
      
      return result;
    });
    
    console.log(`📊 発見されたカテゴリ:`);
    console.log(`  ショッピング: ${categoryLinks.shopping.length}カテゴリ`);
    console.log(`  サービス: ${categoryLinks.service.length}カテゴリ`);
    console.log(`  その他: ${categoryLinks.other.length}カテゴリ`);
    console.log(`  アプリ（除外対象）: ${categoryLinks.appCategories.length}カテゴリ`);
    
    // より詳細なカテゴリ探索（直接URLパターンを試す）
    console.log('\n🔍 詳細カテゴリ探索中...');
    
    const allCategories = [];
    
    // ショッピングカテゴリの系統的探索
    for (let parent = 6; parent <= 8; parent++) {
      for (let child = 80; child <= 150; child++) {
        const testUrl = `https://pc.moppy.jp/category/list.php?parent_category=${parent}&child_category=${child}&af_sorter=1&page=1`;
        
        try {
          await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
          await new Promise(r => setTimeout(r, 1000));
          
          const pageInfo = await page.evaluate(() => {
            const title = document.title;
            const items = document.querySelectorAll('.m-list__item').length;
            const isValidCategory = items > 0 && !title.includes('エラー') && !title.includes('Not Found');
            
            // アプリ関連かチェック
            const isAppCategory = title.includes('アプリ') || 
                                title.includes('スマホ') || 
                                title.includes('ゲーム') ||
                                title.includes('iPhone') ||
                                title.includes('Android');
            
            return {
              title: title.replace(' | ポイ活するならモッピー｜ポイントサイトの副業で副収入・お小遣い稼ぎ', ''),
              items,
              isValidCategory,
              isAppCategory
            };
          });
          
          if (pageInfo.isValidCategory && !pageInfo.isAppCategory) {
            const categoryInfo = {
              url: testUrl,
              baseUrl: `https://pc.moppy.jp/category/list.php?parent_category=${parent}&child_category=${child}&af_sorter=1&page=`,
              name: pageInfo.title,
              parentCategory: parent,
              childCategory: child,
              type: parent === 6 ? 'shopping' : parent === 4 ? 'service' : 'other',
              itemCount: pageInfo.items
            };
            
            allCategories.push(categoryInfo);
            console.log(`  ✅ ${categoryInfo.name} (${categoryInfo.itemCount}件)`);
          } else if (pageInfo.isAppCategory) {
            console.log(`  📱 ${pageInfo.title} (アプリ - 除外)`);
          }
          
        } catch (error) {
          // URLが存在しない場合は無視
        }
        
        await new Promise(r => setTimeout(r, 100));
      }
    }
    
    // サービスカテゴリの系統的探索
    for (let parent = 4; parent <= 4; parent++) {
      for (let child = 51; child <= 120; child++) {
        const testUrl = `https://pc.moppy.jp/category/list.php?parent_category=${parent}&child_category=${child}&af_sorter=1&page=1`;
        
        try {
          await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
          await new Promise(r => setTimeout(r, 1000));
          
          const pageInfo = await page.evaluate(() => {
            const title = document.title;
            const items = document.querySelectorAll('.m-list__item').length;
            const isValidCategory = items > 0 && !title.includes('エラー') && !title.includes('Not Found');
            
            const isAppCategory = title.includes('アプリ') || 
                                title.includes('スマホ') || 
                                title.includes('ゲーム') ||
                                title.includes('iPhone') ||
                                title.includes('Android');
            
            return {
              title: title.replace(' | ポイ活するならモッピー｜ポイントサイトの副業で副収入・お小遣い稼ぎ', ''),
              items,
              isValidCategory,
              isAppCategory
            };
          });
          
          if (pageInfo.isValidCategory && !pageInfo.isAppCategory) {
            const categoryInfo = {
              url: testUrl,
              baseUrl: `https://pc.moppy.jp/category/list.php?parent_category=${parent}&child_category=${child}&af_sorter=1&page=`,
              name: pageInfo.title,
              parentCategory: parent,
              childCategory: child,
              type: 'service',
              itemCount: pageInfo.items
            };
            
            allCategories.push(categoryInfo);
            console.log(`  ✅ ${categoryInfo.name} (${categoryInfo.itemCount}件)`);
          } else if (pageInfo.isAppCategory) {
            console.log(`  📱 ${pageInfo.title} (アプリ - 除外)`);
          }
          
        } catch (error) {
          // URLが存在しない場合は無視
        }
        
        await new Promise(r => setTimeout(r, 100));
      }
    }
    
    // 結果をタイプ別に分類
    const finalCategories = {
      shopping: allCategories.filter(c => c.type === 'shopping'),
      service: allCategories.filter(c => c.type === 'service'),
      other: allCategories.filter(c => c.type === 'other')
    };
    
    // 結果をファイルに保存
    const outputFile = '/Users/kn/poisoku-web/scrapers/moppy_all_categories.json';
    await fs.writeFile(outputFile, JSON.stringify({
      discoverDate: new Date().toISOString(),
      totalCategories: allCategories.length,
      categories: finalCategories,
      summary: {
        shopping: finalCategories.shopping.length,
        service: finalCategories.service.length,
        other: finalCategories.other.length,
        total: allCategories.length
      }
    }, null, 2));
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 カテゴリ発見完了レポート');
    console.log('='.repeat(60));
    console.log(`✅ 発見カテゴリ総数: ${allCategories.length}カテゴリ`);
    console.log(`🛒 ショッピング: ${finalCategories.shopping.length}カテゴリ`);
    console.log(`🏦 サービス: ${finalCategories.service.length}カテゴリ`);
    console.log(`📋 その他: ${finalCategories.other.length}カテゴリ`);
    console.log(`💾 保存完了: ${outputFile}`);
    
    // 主要カテゴリ一覧表示
    if (finalCategories.shopping.length > 0) {
      console.log('\n🛒 ショッピングカテゴリ一覧:');
      finalCategories.shopping.slice(0, 10).forEach((cat, i) => {
        console.log(`  ${i + 1}. ${cat.name} (${cat.itemCount}件)`);
      });
      if (finalCategories.shopping.length > 10) {
        console.log(`  ... 他${finalCategories.shopping.length - 10}カテゴリ`);
      }
    }
    
    if (finalCategories.service.length > 0) {
      console.log('\n🏦 サービスカテゴリ一覧:');
      finalCategories.service.slice(0, 10).forEach((cat, i) => {
        console.log(`  ${i + 1}. ${cat.name} (${cat.itemCount}件)`);
      });
      if (finalCategories.service.length > 10) {
        console.log(`  ... 他${finalCategories.service.length - 10}カテゴリ`);
      }
    }
    
    return allCategories;
    
  } catch (error) {
    console.error('❌ カテゴリ発見エラー:', error);
    return [];
  } finally {
    await browser.close();
  }
}

discoverAllCategories().catch(console.error);