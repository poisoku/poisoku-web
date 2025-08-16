#!/usr/bin/env node

/**
 * モッピー アプリ案件ページネーション検証
 * iOSのみのアクセスで正確な30件/ページを確認
 */

const puppeteer = require('puppeteer');

async function validateMoppyPagination() {
  console.log('🔍 モッピー アプリ案件ページネーション検証開始...');
  console.log('📱 検証方法: iOSのみのアクセスで各ページの案件数を確認');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // iOS User-Agent設定
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
    
    // モバイルビューポート設定
    await page.setViewport({ 
      width: 375, 
      height: 812,
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3
    });
    
    const baseUrl = 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=52&af_sorter=1';
    
    // 最初の3ページを検証
    for (let pageNum = 1; pageNum <= 3; pageNum++) {
      const pageUrl = `${baseUrl}&page=${pageNum}`;
      console.log(`\n📄 ページ ${pageNum} 検証中...`);
      console.log(`URL: ${pageUrl}`);
      
      try {
        await page.goto(pageUrl, { 
          waitUntil: 'networkidle2',
          timeout: 30000 
        });
        
        // ページ読み込み完了を待機
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // ページ分析
        const analysis = await page.evaluate(() => {
          const result = {
            title: document.title,
            url: window.location.href,
            
            // 案件要素のカウント
            appItems: {
              adlistItems: document.querySelectorAll('.adlist-item').length,
              campaignItems: document.querySelectorAll('.campaign-item').length,
              adElements: document.querySelectorAll('[class*="ad"]').length,
              itemElements: document.querySelectorAll('[class*="item"]').length,
              siteIdLinks: document.querySelectorAll('a[href*="site_id"]').length
            },
            
            // ページネーション情報
            pagination: {
              currentPageText: '',
              totalText: '',
              pageButtons: [],
              hasNextButton: false
            },
            
            // サンプル案件データ
            sampleCampaigns: []
          };
          
          // ページネーション情報取得
          const paginationTexts = document.querySelectorAll('*');
          paginationTexts.forEach(el => {
            const text = el.textContent?.trim() || '';
            // "1 - 30を表示 / 263件中" のようなパターンを探す
            if (text.match(/\d+\s*-\s*\d+を表示\s*\/\s*\d+件中/)) {
              result.pagination.totalText = text;
            }
          });
          
          // ページネーションボタンを探す
          const pageLinks = document.querySelectorAll('.a-pagination, [class*="page"], button, a');
          pageLinks.forEach(link => {
            const text = link.textContent?.trim() || '';
            if (/^\d+$/.test(text) && parseInt(text) <= 20) {
              result.pagination.pageButtons.push({
                text: text,
                isActive: link.classList.contains('a-pagination--active') || 
                         link.classList.contains('active') ||
                         link.classList.contains('current'),
                className: link.className
              });
            }
          });
          
          // site_idリンクから案件データ抽出
          const siteIdLinks = document.querySelectorAll('a[href*="site_id"]');
          for (let i = 0; i < Math.min(10, siteIdLinks.length); i++) {
            const link = siteIdLinks[i];
            let title = '';
            
            // タイトル取得（複数の方法で試行）
            const strongEl = link.querySelector('strong');
            if (strongEl) {
              title = strongEl.textContent?.trim() || '';
            }
            
            if (!title || title.length < 3) {
              title = link.textContent?.trim() || '';
            }
            
            if (!title || title.length < 3) {
              const parent = link.closest('div, li, section');
              if (parent) {
                const lines = parent.textContent?.split('\n').filter(line => line.trim().length > 0) || [];
                title = lines[0]?.trim() || '';
              }
            }
            
            title = title.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
            
            // ポイント情報取得
            const container = link.closest('div, li, section, article') || link.parentElement;
            let points = 'ポイント不明';
            
            if (container) {
              const containerText = container.textContent || '';
              const pointMatch = containerText.match(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(?:P|ポイント|円|%)/i);
              if (pointMatch) {
                const suffix = containerText.includes('%') ? '%' : 
                             containerText.includes('円') ? '円' : 
                             containerText.includes('ポイント') ? 'ポイント' : 'P';
                points = pointMatch[1] + suffix;
              }
            }
            
            if (title && title.length > 0) {
              result.sampleCampaigns.push({
                title: title,
                points: points,
                url: link.href
              });
            }
          }
          
          return result;
        });
        
        console.log(`📊 ページ ${pageNum} 分析結果:`);
        console.log(`  site_idリンク数: ${analysis.appItems.siteIdLinks}件`);
        console.log(`  .adlist-item: ${analysis.appItems.adlistItems}件`);
        console.log(`  .campaign-item: ${analysis.appItems.campaignItems}件`);
        console.log(`  [class*="ad"]: ${analysis.appItems.adElements}件`);
        console.log(`  [class*="item"]: ${analysis.appItems.itemElements}件`);
        
        if (analysis.pagination.totalText) {
          console.log(`  ページネーション: ${analysis.pagination.totalText}`);
        }
        
        if (analysis.pagination.pageButtons.length > 0) {
          const activeButton = analysis.pagination.pageButtons.find(btn => btn.isActive);
          console.log(`  現在ページ: ${activeButton ? activeButton.text : '不明'}`);
          console.log(`  利用可能ページ: ${analysis.pagination.pageButtons.map(btn => btn.text).join(', ')}`);
        }
        
        console.log('📋 サンプル案件:');
        analysis.sampleCampaigns.slice(0, 5).forEach((campaign, index) => {
          console.log(`  ${index + 1}. ${campaign.title} [${campaign.points}]`);
        });
        
      } catch (error) {
        console.error(`❌ ページ ${pageNum} エラー:`, error.message);
      }
      
      // 次のページへの待機
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
  } catch (error) {
    console.error('💥 検証エラー:', error);
  } finally {
    await browser.close();
  }
}

// 実行
validateMoppyPagination().catch(console.error);