#!/usr/bin/env node

/**
 * モバイル版ポイントインカムのセレクタを詳細調査
 */

const puppeteer = require('puppeteer');

async function debugMobileSelectors() {
  console.log('🔍 モバイル版セレクタ詳細調査');
  console.log('='.repeat(60));
  
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox'] 
  });
  
  try {
    const page = await browser.newPage();
    
    // iOS Safari設定
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
    await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
    
    console.log('🌐 カテゴリ161にアクセス中...');
    await page.goto('https://pointi.jp/list.php?category=161', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 全要素のclass属性を調査
    const elementAnalysis = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*[class]');
      const classCount = {};
      const tagCount = {};
      const textElements = [];
      
      allElements.forEach(el => {
        // class属性の統計
        const classes = el.className.split(' ').filter(c => c.length > 0);
        classes.forEach(cls => {
          classCount[cls] = (classCount[cls] || 0) + 1;
        });
        
        // タグ名の統計
        tagCount[el.tagName] = (tagCount[el.tagName] || 0) + 1;
        
        // テキストを含む要素（案件名の可能性）
        const text = el.textContent ? el.textContent.trim() : '';
        if (text.length > 10 && text.length < 100 && !text.includes('Copyright') && !text.includes('JavaScript')) {
          textElements.push({
            tagName: el.tagName,
            className: el.className,
            text: text.substring(0, 50),
            selector: el.tagName.toLowerCase() + (el.className ? '.' + el.className.split(' ')[0] : '')
          });
        }
      });
      
      // 頻出classを抽出
      const sortedClasses = Object.entries(classCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20);
      
      return {
        totalElements: allElements.length,
        topClasses: sortedClasses,
        tagCount: tagCount,
        textElements: textElements.slice(0, 10)
      };
    });
    
    console.log('📊 要素統計:');
    console.log(`   総要素数: ${elementAnalysis.totalElements}`);
    
    console.log('\\n📋 頻出クラス名 (上位20):');
    elementAnalysis.topClasses.forEach(([cls, count]) => {
      console.log(`   ${cls}: ${count}個`);
    });
    
    console.log('\\n📄 テキスト含有要素 (案件名候補):');
    elementAnalysis.textElements.forEach((el, i) => {
      console.log(`   ${i + 1}. <${el.selector}> ${el.text}...`);
    });
    
    // 特定パターンの要素を検索
    const specificElements = await page.evaluate(() => {
      const patterns = [
        // 案件関連
        '[class*="ad"]',
        '[class*="campaign"]',
        '[class*="item"]',
        '[class*="list"]',
        '[class*="box"]',
        '[class*="card"]',
        
        // ポイント関連
        '[class*="point"]',
        '[class*="pt"]',
        '[class*="price"]',
        '[class*="cash"]',
        
        // リンク関連
        'a[href*="ad"]',
        'a[href*="campaign"]',
        
        // 一般的なコンテナ
        'article',
        'section',
        '.row',
        '.col'
      ];
      
      const results = {};
      
      patterns.forEach(pattern => {
        try {
          const elements = document.querySelectorAll(pattern);
          if (elements.length > 0) {
            results[pattern] = {
              count: elements.length,
              examples: Array.from(elements).slice(0, 3).map(el => ({
                tagName: el.tagName,
                className: el.className,
                text: el.textContent ? el.textContent.trim().substring(0, 50) : '',
                href: el.href || ''
              }))
            };
          }
        } catch (e) {
          // Invalid selector
        }
      });
      
      return results;
    });
    
    console.log('\\n🎯 特定パターン要素:');
    Object.entries(specificElements).forEach(([pattern, info]) => {
      console.log(`   ${pattern}: ${info.count}個`);
      info.examples.forEach((ex, i) => {
        console.log(`     ${i + 1}. <${ex.tagName}> ${ex.text}... ${ex.href}`);
      });
    });
    
    // DOMの階層構造を調査
    const domStructure = await page.evaluate(() => {
      const getStructure = (element, depth = 0, maxDepth = 4) => {
        if (depth > maxDepth) return null;
        
        const info = {
          tagName: element.tagName,
          className: element.className,
          id: element.id,
          childCount: element.children.length,
          hasText: element.textContent && element.textContent.trim().length > 0
        };
        
        if (element.children.length > 0 && depth < maxDepth) {
          info.children = Array.from(element.children).slice(0, 3).map(child => 
            getStructure(child, depth + 1, maxDepth)
          ).filter(Boolean);
        }
        
        return info;
      };
      
      const body = document.body;
      return getStructure(body);
    });
    
    console.log('\\n🌳 DOM構造 (最初の3レベル):');
    const printStructure = (node, indent = '') => {
      if (!node) return;
      console.log(`${indent}<${node.tagName}${node.className ? ` class="${node.className}"` : ''}${node.id ? ` id="${node.id}"` : ''}> (${node.childCount}子要素)`);
      if (node.children) {
        node.children.forEach(child => printStructure(child, indent + '  '));
      }
    };
    printStructure(domStructure);
    
    console.log('\\n手動確認のため20秒間ブラウザを開いておきます...');
    console.log('案件要素の構造を直接確認してください');
    await new Promise(resolve => setTimeout(resolve, 20000));
    
  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await browser.close();
  }
}

debugMobileSelectors();