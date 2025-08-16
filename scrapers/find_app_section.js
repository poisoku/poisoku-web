#!/usr/bin/env node

/**
 * ページ内のアプリ案件セクション特定
 * ユーザーのスクリーンショット通りのアプリ案件を見つける
 */

const puppeteer = require('puppeteer');

async function findAppSection() {
  console.log('🔍 ページ内のアプリ案件セクション特定開始...');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // モバイル設定
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1');
    await page.setViewport({
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      isLandscape: false
    });
    
    const targetUrl = 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=52&af_sorter=1&page=1';
    console.log(`📱 アクセス中: ${targetUrl}`);
    
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // ページ全体を徹底調査
    const fullAnalysis = await page.evaluate(() => {
      const result = {
        // ユーザーのスクリーンショットの案件を探す
        targetCampaigns: {
          'Earnimo': false,
          'WINTICKET': false,
          'GLIT': false,
          'メルカリ': false,
          'TikTok': false,
          'au Wi-Fi': false,
          'Pontaアプリ': false,
          'ローソン': false,
          'ブロックパズル': false,
          'CokeON': false,
          'ピッコマ': false
        },
        
        // 全テキストコンテンツ検索
        fullTextSearch: [],
        
        // 全リンク要素調査
        allLinks: [],
        
        // 特定のクラス・ID要素調査
        specialElements: [],
        
        // iframe存在確認
        iframes: [],
        
        // Ajax/動的読み込み要素
        dynamicElements: []
      };
      
      const bodyText = document.body.textContent || '';
      
      // ターゲット案件をテキスト検索
      Object.keys(result.targetCampaigns).forEach(target => {
        if (bodyText.includes(target)) {
          result.targetCampaigns[target] = true;
          
          // 該当テキストの周辺要素を取得
          const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
          );
          
          let node;
          while (node = walker.nextNode()) {
            if (node.textContent.includes(target)) {
              const parentElement = node.parentElement;
              if (parentElement) {
                result.fullTextSearch.push({
                  target: target,
                  text: node.textContent.trim().substring(0, 200),
                  parentTag: parentElement.tagName,
                  parentClass: parentElement.className,
                  parentId: parentElement.id,
                  hasLink: !!parentElement.querySelector('a'),
                  linkHref: parentElement.querySelector('a')?.href || ''
                });
              }
            }
          }
        }
      });
      
      // 全リンク要素調査（site_id以外も含む）
      const allLinkElements = document.querySelectorAll('a');
      allLinkElements.forEach((link, index) => {
        if (index < 100) { // 最初の100個
          const text = link.textContent?.trim() || '';
          const href = link.href || '';
          
          // ユーザーのスクリーンショットの案件名をチェック
          const isTargetCampaign = Object.keys(result.targetCampaigns).some(target => 
            text.toLowerCase().includes(target.toLowerCase())
          );
          
          if (isTargetCampaign || href.includes('moppy.jp')) {
            result.allLinks.push({
              index: index + 1,
              text: text.substring(0, 100),
              href: href,
              isTargetCampaign: isTargetCampaign,
              parentClass: link.parentElement?.className || '',
              parentTag: link.parentElement?.tagName || ''
            });
          }
        }
      });
      
      // 特殊な要素（アプリ案件を含む可能性のあるコンテナ）
      const specialSelectors = [
        '.campaign-list',
        '.ad-list', 
        '.app-list',
        '.mobile-list',
        '[class*="campaign"]',
        '[class*="app"]',
        '[class*="mobile"]',
        '[data-category]',
        '[data-type]'
      ];
      
      specialSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((elem, index) => {
          if (index < 10) {
            result.specialElements.push({
              selector: selector,
              index: index,
              className: elem.className,
              id: elem.id,
              textContent: elem.textContent?.substring(0, 200) || '',
              childrenCount: elem.children.length,
              hasTargetCampaign: Object.keys(result.targetCampaigns).some(target => 
                elem.textContent?.includes(target)
              )
            });
          }
        });
      });
      
      // iframe確認
      const iframeElements = document.querySelectorAll('iframe');
      iframeElements.forEach((iframe, index) => {
        result.iframes.push({
          index: index,
          src: iframe.src,
          className: iframe.className,
          id: iframe.id
        });
      });
      
      // 動的に読み込まれる可能性のある要素
      const dynamicSelectors = [
        '[data-src]',
        '[data-url]',
        '[data-load]',
        '.lazy',
        '.loading',
        '.ajax'
      ];
      
      dynamicSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((elem, index) => {
          if (index < 5) {
            result.dynamicElements.push({
              selector: selector,
              index: index,
              dataSrc: elem.getAttribute('data-src'),
              dataUrl: elem.getAttribute('data-url'),
              className: elem.className
            });
          }
        });
      });
      
      return result;
    });
    
    console.log('\n📊 ページ全体調査結果:');
    
    console.log('\n🎯 ターゲット案件検出状況:');
    Object.entries(fullAnalysis.targetCampaigns).forEach(([campaign, found]) => {
      const status = found ? '✅' : '❌';
      console.log(`  ${status} ${campaign}`);
    });
    
    if (fullAnalysis.fullTextSearch.length > 0) {
      console.log('\n📝 発見されたターゲット案件の詳細:');
      fullAnalysis.fullTextSearch.forEach(item => {
        console.log(`  🎯 ${item.target}:`);
        console.log(`     テキスト: ${item.text}`);
        console.log(`     親要素: ${item.parentTag}.${item.parentClass}`);
        console.log(`     リンク: ${item.hasLink ? 'あり' : 'なし'} ${item.linkHref}`);
        console.log('');
      });
    }
    
    if (fullAnalysis.allLinks.length > 0) {
      console.log('\n🔗 関連リンク一覧:');
      fullAnalysis.allLinks.forEach(link => {
        const target = link.isTargetCampaign ? '🎯' : '  ';
        console.log(`${target} ${link.index}. ${link.text}`);
        console.log(`     URL: ${link.href}`);
        console.log(`     親: ${link.parentTag}.${link.parentClass}`);
      });
    }
    
    if (fullAnalysis.specialElements.length > 0) {
      console.log('\n🏗️ 特殊要素調査:');
      fullAnalysis.specialElements.forEach(elem => {
        const hasTarget = elem.hasTargetCampaign ? '🎯' : '  ';
        console.log(`${hasTarget} ${elem.selector}: ${elem.childrenCount}個の子要素`);
        if (elem.hasTargetCampaign) {
          console.log(`     ターゲット案件を含む内容: ${elem.textContent}`);
        }
      });
    }
    
    if (fullAnalysis.iframes.length > 0) {
      console.log('\n🖼️ iframe要素:');
      fullAnalysis.iframes.forEach(iframe => {
        console.log(`  ${iframe.index}. ${iframe.src}`);
      });
    }
    
    if (fullAnalysis.dynamicElements.length > 0) {
      console.log('\n⚡ 動的要素:');
      fullAnalysis.dynamicElements.forEach(elem => {
        console.log(`  ${elem.selector}: ${elem.dataSrc || elem.dataUrl || 'データなし'}`);
      });
    }
    
    // 発見されたターゲット案件の数をカウント
    const foundCount = Object.values(fullAnalysis.targetCampaigns).filter(Boolean).length;
    console.log(`\n📈 発見されたターゲット案件: ${foundCount}/${Object.keys(fullAnalysis.targetCampaigns).length}件`);
    
    if (foundCount >= 6) {
      console.log('🎉 ユーザーのスクリーンショットの案件を多数発見！');
      console.log('💡 正しいページにアクセスできているが、抽出方法に問題がある可能性');
    } else if (foundCount > 0) {
      console.log('⚠️ 一部の案件は発見されました。部分的にアクセスできている状況');
    } else {
      console.log('❌ ターゲット案件が発見されませんでした。別のページまたは動的読み込みの可能性');
    }
    
    return fullAnalysis;
    
  } catch (error) {
    console.error('💥 調査エラー:', error);
  } finally {
    await browser.close();
  }
}

// 実行
findAppSection().catch(console.error);