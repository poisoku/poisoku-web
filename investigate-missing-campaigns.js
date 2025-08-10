#!/usr/bin/env node

/**
 * ポイントインカム案件取りこぼし調査
 */

const puppeteer = require('puppeteer');

async function investigateMissingCampaigns() {
  console.log('🔍 ポイントインカム案件取りこぼし調査開始');
  console.log('='.repeat(60));
  
  const browser = await puppeteer.launch({
    headless: false,  // デバッグのため表示
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // 特定の案件URLを直接確認
    console.log('\n🎯 特定案件の直接確認');
    console.log('URL: https://pointi.jp/ad/12069/');
    await page.goto('https://pointi.jp/ad/12069/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 案件詳細情報を取得
    const campaignDetail = await page.evaluate(() => {
      const title = document.querySelector('h1, .campaign_title, .title')?.textContent?.trim();
      const category = document.querySelector('.breadcrumb, .category')?.textContent?.trim();
      const url = window.location.href;
      return { title, category, url };
    });
    
    console.log('📄 案件詳細:');
    console.log(`  タイトル: ${campaignDetail.title}`);
    console.log(`  カテゴリ: ${campaignDetail.category}`);
    console.log(`  URL: ${campaignDetail.url}`);
    
    // カテゴリ一覧から該当案件を探す - 複数の可能性のあるカテゴリをチェック
    const categoriesToCheck = [
      { id: 184, name: 'グルメ・食品', url: 'https://pointi.jp/list.php?category=184' },
      { id: 183, name: 'ペット・生活', url: 'https://pointi.jp/list.php?category=183' },
      { id: 253, name: 'その他商品', url: 'https://pointi.jp/list.php?category=253' },
      { id: 169, name: '健康・美容', url: 'https://pointi.jp/list.php?category=169' },
      { id: 166, name: '化粧品・コスメ', url: 'https://pointi.jp/list.php?category=166' },
      { id: 231, name: '暮らし・生活', url: 'https://pointi.jp/list.php?category=231' }
    ];
    
    for (const category of categoriesToCheck) {
      console.log(`\n📂 ${category.name} (ID: ${category.id}) を調査中...`);
      console.log(`URL: ${category.url}`);
      
      await page.goto(category.url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const foundInCategory = await searchThroughAllPages(page, category);
      
      if (foundInCategory) {
        console.log(`✅ 「いぬのきもち・ねこのきもち」案件を${category.name}で発見！`);
        break;
      } else {
        console.log(`❌ ${category.name}では見つかりませんでした`);
      }
    }
    
    // 全カテゴリのページ数調査
    console.log('\n🔍 各カテゴリのページ数調査');
    await investigatePageCounts(page);
    
  } catch (error) {
    console.error('❌ 調査エラー:', error);
  } finally {
    await browser.close();
  }
}

async function searchThroughAllPages(page, category) {
  let currentPage = 1;
  let hasNextPage = true;
  let found = false;
  
  while (hasNextPage && currentPage <= 10) { // 最大10ページまで調査
    console.log(`   📄 ページ${currentPage}を検索中...`);
    
    // ページの案件を検索
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
    
    // 「いぬのきもち・ねこのきもち」または ID 12069 を検索
    const targetCampaign = campaigns.find(c => 
      c.title.includes('いぬのきもち') || 
      c.title.includes('ねこのきもち') ||
      c.id === '12069'
    );
    
    if (targetCampaign) {
      console.log(`      🎯 発見！ページ${currentPage}に存在:`);
      console.log(`         タイトル: ${targetCampaign.title}`);
      console.log(`         ID: ${targetCampaign.id}`);
      console.log(`         URL: ${targetCampaign.url}`);
      found = true;
      break;
    }
    
    console.log(`      案件${campaigns.length}件をチェック - 該当なし`);
    
    // 次のページへ
    hasNextPage = await navigateToNextPage(page, currentPage);
    if (hasNextPage) {
      currentPage++;
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  return found;
}

async function navigateToNextPage(page, currentPage) {
  try {
    const nextPageNumber = currentPage + 1;
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
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

    if (!nextButtonInfo.found) {
      return false;
    }

    if (nextButtonInfo.targetPage && nextButtonInfo.targetPage <= currentPage) {
      return false;
    }

    // JavaScriptページネーション実行
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
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 内容変化の確認
    const contentChanged = await page.evaluate(() => {
      const ads = document.querySelectorAll('.box_ad');
      return ads.length > 0;
    });
    
    return contentChanged;
    
  } catch (error) {
    return false;
  }
}

async function investigatePageCounts(page) {
  const shoppingCategories = [
    66, 161, 160, 229, 244, 245, 246, 177, 179, 247, 178, 248, 249, 262, 250,
    251, 184, 185, 263, 252, 264, 265, 183, 253, 169, 166, 168, 167, 255, 256,
    261, 254, 171, 162, 163, 164, 173, 174, 175, 176, 230, 225, 195, 257, 258,
    194, 196, 193, 259, 260, 180
  ];
  
  console.log('\n📊 各カテゴリのページ数とページネーション調査（先頭10カテゴリ）:');
  
  for (let i = 0; i < Math.min(10, shoppingCategories.length); i++) {
    const categoryId = shoppingCategories[i];
    console.log(`\n🔍 カテゴリ${categoryId}:`);
    
    await page.goto(`https://pointi.jp/list.php?category=${categoryId}`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // ページネーション情報を取得
    const pageInfo = await page.evaluate(() => {
      const campaignCount = document.querySelectorAll('.box_ad').length;
      
      // ページネーションリンクを調査
      const pageLinks = Array.from(document.querySelectorAll('a[onclick*="tab_select"]'));
      const pageNumbers = pageLinks
        .map(link => {
          const onclick = link.getAttribute('onclick');
          const text = link.textContent.trim();
          const pageMatch = onclick.match(/tab_select\([^,]+,\s*\d+,\s*\d+,\s*(\d+)\)/);
          const pageNum = pageMatch ? parseInt(pageMatch[1]) : null;
          return { text, pageNum, onclick };
        })
        .filter(item => item.pageNum !== null);
      
      const maxPage = pageNumbers.length > 0 ? Math.max(...pageNumbers.map(p => p.pageNum)) : 1;
      
      return {
        campaignCount,
        maxPage,
        pageLinks: pageNumbers
      };
    });
    
    console.log(`   📄 1ページ目の案件数: ${pageInfo.campaignCount}件`);
    console.log(`   📊 最大ページ番号: ${pageInfo.maxPage}`);
    console.log(`   🔗 ページネーションリンク: ${pageInfo.pageLinks.length}個`);
    
    if (pageInfo.pageLinks.length > 0) {
      console.log('   📝 ページリンク詳細:');
      pageInfo.pageLinks.slice(0, 5).forEach(link => {
        console.log(`      "${link.text}" → ページ${link.pageNum}`);
      });
    }
  }
}

investigateMissingCampaigns();