#!/usr/bin/env node

/**
 * モッピー モバイルアプリ案件調査
 * iOS/Android User-Agentでのアクセス内容確認
 */

const puppeteer = require('puppeteer');

async function debugMoppyMobileApp() {
  console.log('📱 モッピー モバイルアプリ案件調査開始...');
  console.log('🎯 仮説: モバイルUser-Agentで数百件のアプリ案件が表示される');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    // iOS/Android両方のUser-Agentをテスト
    const userAgents = {
      ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      android: 'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    };
    
    // 仕様書更新版URL（af_sorter=1&page=1を追加）
    const baseUrl = 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=52&af_sorter=1&page=1';
    
    for (const [osType, userAgent] of Object.entries(userAgents)) {
      console.log(`\n🔍 ${osType.toUpperCase()}環境での調査開始...`);
      console.log(`📱 User-Agent: ${userAgent.substring(0, 80)}...`);
      
      const page = await browser.newPage();
      
      try {
        // モバイル環境設定
        await page.setUserAgent(userAgent);
        await page.setViewport({ width: 375, height: 667 });
        
        console.log(`📍 アクセス URL: ${baseUrl}`);
        await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 4000));
        
        // ページ内容解析
        const analysis = await page.evaluate((osType) => {
          const result = {
            osType: osType,
            title: document.title,
            url: window.location.href,
            totalLinks: document.querySelectorAll('a').length,
            siteIdLinks: document.querySelectorAll('a[href*="site_id"]').length,
            
            // アプリ案件の特徴的要素
            appElements: {
              downloadButtons: document.querySelectorAll('*[class*="download"], *[class*="install"], *[class*="app"]').length,
              bodyText: document.body.textContent || '',
              hasAppKeywords: false
            },
            
            // ページネーション
            pagination: {
              pageButtons: document.querySelectorAll('.a-pagination').length,
              numberButtons: []
            },
            
            // サンプルタイトル
            sampleTitles: [],
            sampleUrls: [],
            
            // ポイント情報
            pointSamples: []
          };
          
          // アプリ関連キーワードの検査
          const bodyText = result.appElements.bodyText.toLowerCase();
          const appKeywords = ['ios', 'android', 'iphone', 'app store', 'google play', 'アプリ', 'インストール', 'ダウンロード'];
          result.appElements.hasAppKeywords = appKeywords.some(keyword => bodyText.includes(keyword.toLowerCase()));
          
          // bodyTextは長すぎるので削除（ログ出力を簡潔にするため）
          delete result.appElements.bodyText;
          
          // ページネーションボタン詳細
          const pageLinks = document.querySelectorAll('.a-pagination');
          pageLinks.forEach((link, index) => {
            const text = link.textContent?.trim() || '';
            if (/^\d+$/.test(text)) {
              result.pagination.numberButtons.push({
                text: text,
                href: link.href || 'no href',
                className: link.className,
                isActive: link.classList.contains('a-pagination--active')
              });
            }
          });
          
          // site_idリンクからサンプルデータ取得
          const siteIdLinks = document.querySelectorAll('a[href*="site_id"]');
          for (let i = 0; i < Math.min(20, siteIdLinks.length); i++) {
            const link = siteIdLinks[i];
            let title = link.textContent?.trim() || '';
            
            // より詳細なタイトル取得を試行
            if (!title || title.length < 3) {
              const parent = link.closest('div, li, section, article');
              if (parent) {
                const parentText = parent.textContent || '';
                const lines = parentText.trim().split('\n').filter(line => line.trim().length > 0);
                title = lines[0] || `案件_${i + 1}`;
              }
            }
            
            // ポイント情報取得
            const container = link.closest('div, li, section, article') || link.parentElement;
            let points = 'ポイント不明';
            
            if (container) {
              const containerText = container.textContent || '';
              
              // ポイント抽出パターン
              const pointPatterns = [
                /(\\d{1,3}(?:,\\d{3})*(?:\\.\\d+)?)\\s*P(?:t)?/i,
                /(\\d{1,3}(?:,\\d{3})*(?:\\.\\d+)?)\\s*ポイント/i,
                /(\\d{1,3}(?:,\\d{3})*(?:\\.\\d+)?)\\s*円/i,
                /(\\d{1,2}(?:\\.\\d+)?)\\s*%/i
              ];
              
              for (const pattern of pointPatterns) {
                const match = containerText.match(pattern);
                if (match) {
                  points = match[1] + (containerText.includes('%') ? '%' : 
                                     containerText.includes('円') ? '円' : 
                                     containerText.includes('ポイント') ? 'ポイント' : 'P');
                  break;
                }
              }
            }
            
            if (title && title.length > 0) {
              result.sampleTitles.push(title);
              result.sampleUrls.push(link.href);
              result.pointSamples.push(points);
            }
          }
          
          return result;
        }, osType);
        
        // 結果表示
        console.log(`\\n📊 ${osType.toUpperCase()}環境 分析結果:`);
        console.log('================================');
        console.log(`📄 ページタイトル: ${analysis.title}`);
        console.log(`🔗 最終URL: ${analysis.url}`);
        console.log(`📝 総リンク数: ${analysis.totalLinks}`);
        console.log(`🎯 site_idリンク数: ${analysis.siteIdLinks}`);
        console.log(`📱 アプリ関連要素: ${JSON.stringify(analysis.appElements)}`);
        console.log(`📄 ページネーション: ${analysis.pagination.pageButtons}個のボタン`);
        
        if (analysis.pagination.numberButtons.length > 0) {
          console.log('\\n📋 ページボタン詳細:');
          analysis.pagination.numberButtons.forEach((btn, index) => {
            console.log(`${index + 1}. "${btn.text}" ${btn.isActive ? '(現在ページ)' : ''}`);
          });
        }
        
        console.log('\\n📋 サンプル案件:');
        for (let i = 0; i < Math.min(15, analysis.sampleTitles.length); i++) {
          console.log(`${i + 1}. ${analysis.sampleTitles[i]} [${analysis.pointSamples[i]}]`);
        }
        
        if (analysis.sampleTitles.length === 0) {
          console.log('⚠️  案件が見つかりませんでした');
        }
        
        // 2ページ目テスト（ページネーションがある場合）
        if (analysis.pagination.numberButtons.some(btn => btn.text === '2')) {
          console.log(`\\n🔍 ${osType.toUpperCase()} 2ページ目テスト...`);
          
          try {
            const page2Button = analysis.pagination.numberButtons.find(btn => btn.text === '2');
            if (page2Button && page2Button.href !== 'no href') {
              await page.goto(page2Button.href, { waitUntil: 'networkidle2', timeout: 20000 });
              await new Promise(resolve => setTimeout(resolve, 3000));
              
              const page2Analysis = await page.evaluate(() => ({
                siteIdLinks: document.querySelectorAll('a[href*="site_id"]').length,
                currentUrl: window.location.href,
                sampleTitles: Array.from(document.querySelectorAll('a[href*="site_id"]')).slice(0, 5).map(link => {
                  let title = link.textContent?.trim() || '';
                  if (!title || title.length < 3) {
                    const parent = link.closest('div, li, section, article');
                    if (parent) {
                      const lines = (parent.textContent || '').trim().split('\\n').filter(line => line.trim().length > 0);
                      title = lines[0] || '';
                    }
                  }
                  return title;
                })
              }));
              
              console.log(`📄 2ページ目 URL: ${page2Analysis.currentUrl}`);
              console.log(`📄 2ページ目 site_idリンク数: ${page2Analysis.siteIdLinks}`);
              console.log('📋 2ページ目サンプル:');
              page2Analysis.sampleTitles.forEach((title, index) => {
                if (title) console.log(`${index + 1}. ${title}`);
              });
            }
          } catch (error) {
            console.log(`❌ ${osType.toUpperCase()} 2ページ目テスト失敗:`, error.message);
          }
        }
        
      } finally {
        await page.close();
      }
    }
    
  } catch (error) {
    console.error('💥 調査エラー:', error);
  } finally {
    await browser.close();
  }
}

// 実行
debugMoppyMobileApp().catch(console.error);