#!/usr/bin/env node

/**
 * 「いぬのきもち・ねこのきもち」案件を全カテゴリから検索
 */

const puppeteer = require('puppeteer');

async function findMissingCampaign() {
  console.log('🔍 「いぬのきもち・ねこのきもち」案件の検索');
  console.log('='.repeat(60));
  
  const browser = await puppeteer.launch({ 
    headless: false, 
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // まず、全ショッピングカテゴリのリストを取得
    console.log('📂 全ショッピングカテゴリを取得中...');
    await page.goto('https://pointi.jp/list.php', { waitUntil: 'networkidle2' });
    
    const allCategories = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="category="]'));
      return links
        .map(link => ({
          text: link.textContent.trim(),
          href: link.href,
          categoryId: link.href.match(/category=(\d+)/) ? parseInt(link.href.match(/category=(\d+)/)[1]) : null
        }))
        .filter(cat => cat.categoryId && cat.text.length > 0)
        .sort((a, b) => a.categoryId - b.categoryId);
    });
    
    console.log(`📊 発見されたカテゴリ数: ${allCategories.length}`);
    
    // 範囲を絞って検索（ショッピング関連のみ）
    const shoppingCategories = allCategories.filter(cat => 
      cat.categoryId >= 160 && cat.categoryId <= 300
    );
    
    console.log(`🎯 検索対象: ${shoppingCategories.length}カテゴリ（ID 160-300）`);
    
    let found = false;
    let foundInfo = null;
    
    for (const category of shoppingCategories) {
      console.log(`\n📂 カテゴリ${category.categoryId}: ${category.text}`);
      
      try {
        await page.goto(`https://pointi.jp/list.php?category=${category.categoryId}`, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 全ページをチェック（最大5ページ）
        let pageNum = 1;
        let hasNextPage = true;
        
        while (hasNextPage && pageNum <= 5) {
          const pageInfo = await page.evaluate(() => {
            const campaigns = Array.from(document.querySelectorAll('.box_ad'));
            const titles = campaigns.map(el => {
              const titleEl = el.querySelector('.title_list');
              return titleEl ? titleEl.textContent.trim() : '';
            });
            
            const hasInuNeko = titles.some(title => 
              title.includes('いぬのきもち') || title.includes('ねこのきもち')
            );
            
            const inuNekoTitle = titles.find(title => 
              title.includes('いぬのきもち') || title.includes('ねこのきもち')
            );
            
            const pageLinks = Array.from(document.querySelectorAll('a[onclick*="tab_select"]'));
            const nextButton = pageLinks.find(link => 
              link.textContent.trim().includes('次へ')
            );
            
            return {
              totalCampaigns: campaigns.length,
              hasInuNeko: hasInuNeko,
              inuNekoTitle: inuNekoTitle,
              hasNextPage: !!nextButton,
              nextOnclick: nextButton ? nextButton.getAttribute('onclick') : null
            };
          });
          
          console.log(`   ページ${pageNum}: ${pageInfo.totalCampaigns}件 - いぬねこ: ${pageInfo.hasInuNeko ? '✅' : '❌'}`);
          
          if (pageInfo.hasInuNeko) {
            console.log(`\n🎉 発見！`);
            console.log(`   カテゴリ: ${category.categoryId} - ${category.text}`);
            console.log(`   ページ: ${pageNum}`);
            console.log(`   タイトル: ${pageInfo.inuNekoTitle}`);
            
            found = true;
            foundInfo = {
              categoryId: category.categoryId,
              categoryName: category.text,
              pageNumber: pageNum,
              title: pageInfo.inuNekoTitle
            };
            break;
          }
          
          // 次のページに移動
          if (pageInfo.hasNextPage && pageNum < 5) {
            const paramMatch = pageInfo.nextOnclick.match(/tab_select\('([^']+)',\s*(\d+),\s*(\d+),\s*(\d+)\)/);
            if (paramMatch) {
              console.log(`     → ページ${pageNum + 1}へ移動...`);
              await page.evaluate((tab, p2, p3, p4) => {
                window.tab_select(tab, p2, p3, p4);
              }, paramMatch[1], parseInt(paramMatch[2]), parseInt(paramMatch[3]), parseInt(paramMatch[4]));
              
              await new Promise(resolve => setTimeout(resolve, 5000));
              pageNum++;
            } else {
              hasNextPage = false;
            }
          } else {
            hasNextPage = false;
          }
        }
        
        if (found) break;
        
      } catch (error) {
        console.log(`   ⚠️ エラー: ${error.message}`);
      }
    }
    
    if (found) {
      console.log('\n' + '='.repeat(60));
      console.log('✅ 結果');
      console.log('='.repeat(60));
      console.log(`カテゴリID: ${foundInfo.categoryId}`);
      console.log(`カテゴリ名: ${foundInfo.categoryName}`);
      console.log(`ページ番号: ${foundInfo.pageNumber}`);
      console.log(`案件タイトル: ${foundInfo.title}`);
    } else {
      console.log('\n❌ 「いぬのきもち・ねこのきもち」案件が見つかりませんでした');
    }
    
  } catch (error) {
    console.error('💥 エラー:', error);
  } finally {
    await browser.close();
  }
}

findMissingCampaign();