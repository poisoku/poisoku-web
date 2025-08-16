#!/usr/bin/env node

/**
 * モッピーページレイアウト詳細調査
 * 15件vs30件の違いを特定
 */

const puppeteer = require('puppeteer');

async function debugPageLayout() {
  console.log('🔍 モッピーページレイアウト詳細調査開始...');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // 最新のiOS User-Agent
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1');
    
    // iPhoneビューポート
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
    
    // 詳細なページ構造分析
    const analysis = await page.evaluate(() => {
      const result = {
        // ページ情報
        title: document.title,
        url: window.location.href,
        
        // ページネーション情報
        paginationInfo: '',
        
        // 各種セレクターでの案件数
        selectors: {
          'a[href*="site_id"]': document.querySelectorAll('a[href*="site_id"]').length,
          '.adlist-item': document.querySelectorAll('.adlist-item').length,
          '.campaign-item': document.querySelectorAll('.campaign-item').length,
          '[class*="ad"]': document.querySelectorAll('[class*="ad"]').length,
          '[class*="item"]': document.querySelectorAll('[class*="item"]').length,
          'tr': document.querySelectorAll('tr').length,
          'li': document.querySelectorAll('li').length,
          'div': document.querySelectorAll('div').length
        },
        
        // 実際の案件詳細（最初の20件）
        campaigns: [],
        
        // ページネーション詳細
        paginationElements: [],
        
        // DOM構造サンプル
        domStructure: ''
      };
      
      // ページネーション情報の取得
      const allText = document.body.textContent;
      const paginationMatch = allText.match(/(\d+)\s*-\s*(\d+)を表示\s*\/\s*(\d+)件中/);
      if (paginationMatch) {
        result.paginationInfo = `${paginationMatch[1]}-${paginationMatch[2]}を表示 / ${paginationMatch[3]}件中`;
      }
      
      // site_idリンクから詳細情報取得
      const siteIdLinks = document.querySelectorAll('a[href*="site_id"]');
      siteIdLinks.forEach((link, index) => {
        if (index < 20) { // 最初の20件のみ
          const container = link.closest('div, li, tr, section, article') || link.parentElement;
          
          let title = '';
          const strongEl = link.querySelector('strong');
          if (strongEl) {
            title = strongEl.textContent?.trim() || '';
          } else {
            title = link.textContent?.trim() || '';
          }
          
          // ポイント情報
          let points = '';
          if (container) {
            const containerText = container.textContent || '';
            const pointMatch = containerText.match(/(\d{1,3}(?:,\d{3})*)(?:P|ポイント|円)/i);
            if (pointMatch) {
              points = pointMatch[0];
            }
          }
          
          // 親要素のクラス名
          const parentClass = container ? container.className : '';
          
          result.campaigns.push({
            index: index + 1,
            title: title.substring(0, 100),
            points: points,
            url: link.href,
            parentClass: parentClass,
            visible: isElementVisible(link)
          });
        }
      });
      
      // ページネーション要素の詳細
      const pageButtons = document.querySelectorAll('a, button, span');
      pageButtons.forEach(btn => {
        const text = btn.textContent?.trim() || '';
        if (/^[1-9]\d*$/.test(text) && parseInt(text) <= 20) {
          result.paginationElements.push({
            text: text,
            isActive: btn.classList.contains('active') || btn.classList.contains('current'),
            className: btn.className,
            tagName: btn.tagName
          });
        }
      });
      
      // DOM構造の一部を取得
      const bodyHtml = document.body.innerHTML;
      result.domStructure = bodyHtml.substring(0, 2000) + '...';
      
      // 要素の可視性チェック関数
      function isElementVisible(element) {
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               style.opacity !== '0' &&
               element.offsetWidth > 0 && 
               element.offsetHeight > 0;
      }
      
      return result;
    });
    
    console.log('\n📊 ページ分析結果:');
    console.log(`📄 タイトル: ${analysis.title}`);
    console.log(`🔗 URL: ${analysis.url}`);
    console.log(`📈 ページネーション: ${analysis.paginationInfo || '見つかりません'}`);
    
    console.log('\n🔍 セレクター別案件数:');
    Object.entries(analysis.selectors).forEach(([selector, count]) => {
      console.log(`  ${selector}: ${count}件`);
    });
    
    if (analysis.paginationElements.length > 0) {
      console.log('\n📄 ページネーション要素:');
      analysis.paginationElements.forEach(elem => {
        const active = elem.isActive ? ' (現在のページ)' : '';
        console.log(`  ${elem.text}${active} [${elem.tagName}.${elem.className}]`);
      });
    }
    
    console.log('\n📋 発見された案件一覧:');
    analysis.campaigns.forEach(campaign => {
      const visible = campaign.visible ? '✅' : '❌';
      console.log(`  ${campaign.index}. ${visible} ${campaign.title} [${campaign.points}]`);
      console.log(`     親クラス: ${campaign.parentClass}`);
    });
    
    // ページのスクリーンショットを保存
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = `/Users/kn/poisoku-web/scrapers/debug_moppy_page_${timestamp}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 スクリーンショット保存: ${screenshotPath}`);
    
    return analysis;
    
  } catch (error) {
    console.error('💥 調査エラー:', error);
  } finally {
    await browser.close();
  }
}

// 実行
debugPageLayout().catch(console.error);