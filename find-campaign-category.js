#!/usr/bin/env node

/**
 * 特定案件のカテゴリを特定
 */

const puppeteer = require('puppeteer');

async function findCampaignCategory() {
  console.log('🔍 「いぬのきもち・ねこのきもち」案件のカテゴリ特定');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // すべてのカテゴリをチェック
    const allCategories = [
      // ショッピングカテゴリ
      66, 161, 160, 229, 244, 245, 246, 177, 179, 247, 178, 248, 249, 262, 250,
      251, 184, 185, 263, 252, 264, 265, 183, 253, 169, 166, 168, 167, 255, 256,
      261, 254, 171, 162, 163, 164, 173, 174, 175, 176, 230, 225, 195, 257, 258,
      194, 196, 193, 259, 260, 180,
      // サービスカテゴリ
      69, 70, 75, 281, 73, 74, 276, 78, 235, 79, 240, 72, 76, 81, 274, 237,
      209, 271, 232, 269, 234, 238, 280, 272, 278, 277, 283, 279, 77, 236, 270, 82
    ];
    
    for (const categoryId of allCategories) {
      console.log(`\n🔍 カテゴリ${categoryId}をチェック中...`);
      
      try {
        await page.goto(`https://pointi.jp/list.php?category=${categoryId}`, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 全ページをチェック（最大5ページ）
        let found = false;
        let currentPage = 1;
        
        while (currentPage <= 5 && !found) {
          console.log(`   📄 ページ${currentPage}をチェック...`);
          
          // このページで該当案件を検索
          const campaigns = await page.evaluate(() => {
            const campaigns = [];
            const campaignElements = document.querySelectorAll('.box_ad');
            
            campaignElements.forEach((element, index) => {
              try {
                const titleElement = element.querySelector('.title_list');
                const title = titleElement ? titleElement.textContent.trim() : '';
                
                const linkElement = element.querySelector('a[href*="./ad/"]');
                const relativeUrl = linkElement ? linkElement.getAttribute('href') : '';
                
                let id = '';
                if (relativeUrl) {
                  const idMatch = relativeUrl.match(/\/ad\/(\d+)\//); 
                  id = idMatch ? idMatch[1] : '';
                }
                
                if (title) {
                  campaigns.push({
                    id,
                    title,
                    url: relativeUrl
                  });
                }
              } catch (e) {
                // エラーは無視
              }
            });
            
            return campaigns;
          });
          
          // 対象案件を検索
          const targetCampaign = campaigns.find(c => 
            c.title.toLowerCase().includes('いぬのきもち') || 
            c.title.toLowerCase().includes('ねこのきもち') ||
            c.id === '12069'
          );
          
          if (targetCampaign) {
            console.log(`🎯 発見！カテゴリ${categoryId}のページ${currentPage}に存在:`);
            console.log(`   タイトル: ${targetCampaign.title}`);
            console.log(`   ID: ${targetCampaign.id}`);
            console.log(`   URL: ${targetCampaign.url}`);
            found = true;
            
            // このカテゴリの全ページ数も調査
            const pageInfo = await page.evaluate(() => {
              const pageLinks = Array.from(document.querySelectorAll('a[onclick*="tab_select"]'));
              const pageNumbers = pageLinks
                .map(link => {
                  const onclick = link.getAttribute('onclick');
                  const pageMatch = onclick.match(/tab_select\([^,]+,\s*\d+,\s*\d+,\s*(\d+)\)/);
                  return pageMatch ? parseInt(pageMatch[1]) : null;
                })
                .filter(num => num !== null);
              
              return {
                maxPage: pageNumbers.length > 0 ? Math.max(...pageNumbers) : 1,
                totalCampaigns: document.querySelectorAll('.box_ad').length
              };
            });
            
            console.log(`   📊 このカテゴリの最大ページ: ${pageInfo.maxPage}`);
            console.log(`   📄 現在のページの案件数: ${pageInfo.totalCampaigns}`);
            
            return categoryId;
          }
          
          console.log(`      案件${campaigns.length}件をチェック - 該当なし`);
          
          // 次のページへ
          const hasNext = await navigateToNextPage(page, currentPage);
          if (hasNext) {
            currentPage++;
            await new Promise(resolve => setTimeout(resolve, 3000));
          } else {
            break;
          }
        }
        
      } catch (error) {
        console.log(`   ⚠️ カテゴリ${categoryId}でエラー: ${error.message}`);
        continue;
      }
    }
    
    console.log('\n❌ 該当案件が見つかりませんでした');
    console.log('💡 可能性:');
    console.log('   1. 案件が削除または非公開になった');
    console.log('   2. スマホアプリ専用カテゴリに移動した');
    console.log('   3. カテゴリリストに含まれていないカテゴリに存在');
    
  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await browser.close();
  }
}

async function navigateToNextPage(page, currentPage) {
  try {
    const nextPageNumber = currentPage + 1;
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const nextButtonInfo = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[onclick*="tab_select"]'));
      
      for (const link of links) {
        const text = link.textContent.trim();
        if (text.includes('次へ') || text === '次へ>') {
          const onclick = link.getAttribute('onclick');
          const pageMatch = onclick.match(/tab_select\([^,]+,\s*\d+,\s*\d+,\s*(\d+)\)/);
          const targetPage = pageMatch ? parseInt(pageMatch[1]) : null;
          
          return {
            found: true,
            onclick: onclick,
            targetPage: targetPage
          };
        }
      }
      
      return { found: false };
    });

    if (!nextButtonInfo.found || (nextButtonInfo.targetPage && nextButtonInfo.targetPage <= currentPage)) {
      return false;
    }

    const clickResult = await page.evaluate((nextPage) => {
      if (typeof window.tab_select === 'function') {
        window.tab_select('tab1', 0, 63, nextPage);
        return true;
      }
      return false;
    }, nextButtonInfo.targetPage || nextPageNumber);
    
    if (!clickResult) {
      return false;
    }
    
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    const contentChanged = await page.evaluate(() => {
      const ads = document.querySelectorAll('.box_ad');
      return ads.length > 0;
    });
    
    return contentChanged;
    
  } catch (error) {
    return false;
  }
}

findCampaignCategory();