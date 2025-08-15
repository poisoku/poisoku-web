#!/usr/bin/env node

/**
 * モッピー除外ロジックの他カテゴリでの再現性テスト
 */

const puppeteer = require('puppeteer');

async function testExclusionLogic() {
  console.log('🧪 モッピー除外ロジック再現性テスト開始');
  
  const testUrls = [
    {
      url: 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=52&af_sorter=1&page=1',
      name: 'クレジットカード',
      type: 'service'
    },
    {
      url: 'https://pc.moppy.jp/category/list.php?parent_category=8&child_category=119&af_sorter=1&page=1', 
      name: '美容・健康',
      type: 'shopping'
    },
    {
      url: 'https://pc.moppy.jp/category/list.php?parent_category=6&child_category=81&af_sorter=1&page=1',
      name: '本・CD・DVD',
      type: 'shopping'
    }
  ];
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });
  
  try {
    for (const testCase of testUrls) {
      console.log(`\n📂 テスト対象: ${testCase.name}`);
      console.log(`🔗 URL: ${testCase.url}`);
      
      const page = await browser.newPage();
      
      try {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.goto(testCase.url, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        
        await new Promise(r => setTimeout(r, 3000));
        
        const analysis = await page.evaluate(() => {
          const result = {
            totalLinks: 0,
            mainContentLinks: 0,
            excludedLinks: 0,
            trendingWordLinks: 0,
            trackRefTwLinks: 0,
            analysisDetails: []
          };
          
          // 全リンクを収集
          const allLinks = document.querySelectorAll('a[href*="detail.php"]');
          result.totalLinks = allLinks.length;
          
          allLinks.forEach((link, index) => {
            const href = link.href;
            const parentClass = link.parentElement?.className || '';
            const closestListItem = link.closest('.m-list__item');
            const closestTrending = link.closest('.m-trending-words__list-item') || link.closest('.m-trending-words');
            const hasTrackRefTw = href.includes('track_ref=tw');
            
            const linkInfo = {
              index,
              href: href.slice(0, 80) + '...',
              text: link.textContent?.trim().slice(0, 30) || '',
              parentClass,
              isMainContent: !!closestListItem,
              isTrending: !!closestTrending,
              hasTrackRefTw,
              containerDepth: 0
            };
            
            // コンテナ深度計算
            let container = link.parentElement;
            while (container && container !== document.body) {
              linkInfo.containerDepth++;
              container = container.parentElement;
            }
            
            // 分類
            if (closestListItem && !closestTrending && !hasTrackRefTw) {
              result.mainContentLinks++;
              linkInfo.classification = 'main-content';
            } else {
              result.excludedLinks++;
              if (closestTrending) {
                result.trendingWordLinks++;
                linkInfo.classification = 'trending-excluded';
              } else if (hasTrackRefTw) {
                result.trackRefTwLinks++;
                linkInfo.classification = 'track-ref-tw-excluded';
              } else {
                linkInfo.classification = 'other-excluded';
              }
            }
            
            result.analysisDetails.push(linkInfo);
          });
          
          return result;
        });
        
        // 結果表示
        console.log(`📊 分析結果:`);
        console.log(`  総リンク数: ${analysis.totalLinks}件`);
        console.log(`  メインコンテンツ: ${analysis.mainContentLinks}件`);
        console.log(`  除外対象: ${analysis.excludedLinks}件`);
        console.log(`    - 注目ワードエリア: ${analysis.trendingWordLinks}件`);
        console.log(`    - track_ref=tw: ${analysis.trackRefTwLinks}件`);
        console.log(`    - その他除外: ${analysis.excludedLinks - analysis.trendingWordLinks - analysis.trackRefTwLinks}件`);
        
        // 除外効果の確認
        const exclusionRate = (analysis.excludedLinks / analysis.totalLinks * 100).toFixed(1);
        console.log(`  🛡️ 除外率: ${exclusionRate}%`);
        
        // サンプル表示
        const mainContentSamples = analysis.analysisDetails.filter(d => d.classification === 'main-content').slice(0, 3);
        const excludedSamples = analysis.analysisDetails.filter(d => d.classification.includes('excluded')).slice(0, 3);
        
        if (mainContentSamples.length > 0) {
          console.log(`  ✅ メインコンテンツ例:`);
          mainContentSamples.forEach((sample, i) => {
            console.log(`    ${i + 1}. ${sample.text} (${sample.parentClass})`);
          });
        }
        
        if (excludedSamples.length > 0) {
          console.log(`  🚫 除外案件例:`);
          excludedSamples.forEach((sample, i) => {
            console.log(`    ${i + 1}. ${sample.text} (${sample.classification})`);
          });
        }
        
      } catch (error) {
        console.error(`  ❌ エラー: ${error.message}`);
      } finally {
        await page.close();
      }
      
      await new Promise(r => setTimeout(r, 2000));
    }
    
  } catch (error) {
    console.error('❌ 全体エラー:', error);
  } finally {
    await browser.close();
  }
}

testExclusionLogic().catch(console.error);