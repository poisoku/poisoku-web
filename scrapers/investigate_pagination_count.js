#!/usr/bin/env node

/**
 * ページネーション件数の詳細調査
 * 263件との違いを特定
 */

const puppeteer = require('puppeteer');

async function investigatePaginationCount() {
  console.log('🔍 ページネーション件数の詳細調査開始...');
  
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
    
    console.log('🔍 各ページの詳細情報を調査中...');
    
    for (let pageNum = 1; pageNum <= 10; pageNum++) {
      const pageUrl = `https://pc.moppy.jp/category/list.php?parent_category=4&child_category=52&af_sorter=1&page=${pageNum}`;
      console.log(`\n📄 ページ ${pageNum} 調査中...`);
      
      try {
        await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const pageAnalysis = await page.evaluate(() => {
          const result = {
            // ページネーション情報
            paginationText: '',
            
            // タイトル要素の詳細
            totalTitles: 0,
            appTitles: 0,
            
            // サンプルタイトル
            sampleTitles: [],
            
            // ページ番号ボタン
            pageButtons: []
          };
          
          // ページネーション情報の取得
          const bodyText = document.body.textContent;
          const paginationMatch = bodyText.match(/(\d+)\s*-\s*(\d+)を表示\s*\/\s*(\d+)件中/);
          if (paginationMatch) {
            result.paginationText = paginationMatch[0];
          }
          
          // 全タイトル要素
          const allTitles = document.querySelectorAll('h3.a-list__item__title');
          result.totalTitles = allTitles.length;
          
          // アプリキーワード
          const appKeywords = [
            'アプリ', 'インストール', '新規アプリ', 'ダウンロード',
            '初回起動', 'LINE', 'ライン', 'iOS', 'Android',
            'アプリ版', 'モバイルアプリ', 'スマホアプリ', 'Ponta',
            'ローソン', 'TikTok', 'メルカリ', 'WINTICKET', 'GLIT',
            'au Wi-Fi', 'CokeON', 'ピッコマ', 'ブロックパズル',
            'Earnimo', '三國志', 'エバーテイル'
          ];
          
          // アプリ案件の判定
          allTitles.forEach((titleEl, index) => {
            const title = titleEl.textContent?.trim() || '';
            
            const isAppCampaign = appKeywords.some(keyword => 
              title.toLowerCase().includes(keyword.toLowerCase())
            );
            
            if (isAppCampaign) {
              result.appTitles++;
              if (result.sampleTitles.length < 5) {
                result.sampleTitles.push(title);
              }
            }
          });
          
          // ページ番号ボタン
          const pageElements = document.querySelectorAll('a, button, span');
          pageElements.forEach(elem => {
            const text = elem.textContent?.trim();
            if (/^[1-9]\d*$/.test(text) && parseInt(text) <= 20) {
              result.pageButtons.push({
                number: parseInt(text),
                isActive: elem.classList.contains('active') || 
                         elem.classList.contains('current') || 
                         elem.classList.contains('a-pagination--active')
              });
            }
          });
          
          return result;
        });
        
        console.log(`  📊 ページネーション: ${pageAnalysis.paginationText || '見つかりません'}`);
        console.log(`  📋 全タイトル要素: ${pageAnalysis.totalTitles}件`);
        console.log(`  📱 アプリ案件: ${pageAnalysis.appTitles}件`);
        
        if (pageAnalysis.sampleTitles.length > 0) {
          console.log(`  📝 サンプル案件:`);
          pageAnalysis.sampleTitles.forEach((title, index) => {
            console.log(`    ${index + 1}. ${title}`);
          });
        }
        
        if (pageAnalysis.pageButtons.length > 0) {
          const currentPage = pageAnalysis.pageButtons.find(btn => btn.isActive);
          const maxPage = Math.max(...pageAnalysis.pageButtons.map(btn => btn.number));
          console.log(`  📄 現在ページ: ${currentPage ? currentPage.number : '不明'}, 最大ページ: ${maxPage}`);
        }
        
        // アプリ案件が0件の場合は終了
        if (pageAnalysis.appTitles === 0) {
          console.log(`📄 ページ ${pageNum}: アプリ案件が見つかりません（調査終了）`);
          break;
        }
        
      } catch (error) {
        console.error(`❌ ページ ${pageNum} エラー:`, error.message);
        break;
      }
      
      // 次のページへの待機
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
  } catch (error) {
    console.error('💥 調査エラー:', error);
  } finally {
    await browser.close();
  }
}

// 実行
investigatePaginationCount().catch(console.error);