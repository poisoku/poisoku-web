const puppeteer = require('puppeteer');

/**
 * 指定案件（1840652）がどのページにあるかを探すスクリプト
 */
async function findMissingCampaign() {
  console.log('🔍 指定案件（ID: 1840652）の検索開始\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // iOS User Agent設定
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
  
  // リソース最適化
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const resourceType = req.resourceType();
    if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
      req.abort();
    } else {
      req.continue();
    }
  });
  
  const targetId = '1840652';
  let found = false;
  
  try {
    // 1. アプリページで検索（Android案件の可能性が高い）
    console.log('📱 アプリページでの検索開始...');
    
    for (let pageNum = 1; pageNum <= 50 && !found; pageNum++) {
      const url = pageNum === 1
        ? 'https://www.chobirich.com/smartphone?sort=point'
        : `https://www.chobirich.com/smartphone?sort=point&page=${pageNum}`;
      
      console.log(`📄 アプリページ${pageNum}を確認中...`);
      
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      
      if (response.status() !== 200) {
        console.log(`❌ ページ${pageNum}: HTTPステータス ${response.status()}`);
        continue;
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const pageData = await page.evaluate((targetId) => {
        const campaignLinks = document.querySelectorAll('a[href*="/ad_details/"]');
        const results = [];
        
        campaignLinks.forEach(link => {
          const href = link.href;
          
          if (href.includes(targetId)) {
            const container = link.closest('div, li, article, section, tr');
            let campaignName = link.textContent?.trim() || '';
            let cashback = '';
            
            if (container) {
              const textContent = container.textContent || '';
              
              if (!campaignName) {
                const lines = textContent.split('\n').filter(line => line.trim());
                if (lines.length > 0) {
                  campaignName = lines[0].trim();
                }
              }
              
              const pointMatch = textContent.match(/(\d+(?:,\d{3})*)\s*(?:pt|ポイント)/i);
              if (pointMatch) {
                cashback = pointMatch[1] + 'pt';
              }
            }
            
            let device = 'all';
            if (campaignName.includes('iOS') || campaignName.includes('iPhone')) {
              device = 'ios';
            } else if (campaignName.includes('Android')) {
              device = 'android';
            }
            
            results.push({
              id: targetId,
              name: campaignName,
              url: href,
              cashback: cashback,
              device: device,
              pageNumber: pageNum
            });
          }
        });
        
        return results;
      }, targetId);
      
      if (pageData.length > 0) {
        console.log(`\n🎯 発見！アプリページ${pageNum}で指定案件を発見:`);
        pageData.forEach(campaign => {
          console.log(`   名前: ${campaign.name}`);
          console.log(`   デバイス: ${campaign.device}`);
          console.log(`   還元: ${campaign.cashback}`);
          console.log(`   URL: ${campaign.url}`);
          console.log(`   発見ページ: ${campaign.pageNumber}`);
        });
        found = true;
        break;
      }
    }
    
    // 2. ショッピングページでも確認
    if (!found) {
      console.log('\n🛒 ショッピングページでの検索開始...');
      
      for (let categoryId = 101; categoryId <= 112 && !found; categoryId++) {
        console.log(`📁 カテゴリ${categoryId}を確認中...`);
        
        for (let pageNum = 1; pageNum <= 30 && !found; pageNum++) {
          const url = pageNum === 1
            ? `https://www.chobirich.com/shopping/shop/${categoryId}`
            : `https://www.chobirich.com/shopping/shop/${categoryId}?page=${pageNum}`;
          
          if (pageNum % 5 === 1) {
            console.log(`  📄 カテゴリ${categoryId} ページ${pageNum}-${Math.min(pageNum + 4, 30)}...`);
          }
          
          const response = await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });
          
          if (response.status() !== 200) {
            break;
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const pageData = await page.evaluate((targetId, categoryId, pageNum) => {
            const campaignLinks = document.querySelectorAll('a[href*="/ad_details/"]');
            const results = [];
            
            campaignLinks.forEach(link => {
              const href = link.href;
              
              if (href.includes(targetId)) {
                const container = link.closest('div, li, article, section');
                let campaignName = link.textContent?.trim() || '';
                
                if (container) {
                  const textContent = container.textContent || '';
                  const lines = textContent.split('\n').filter(line => line.trim());
                  
                  if (lines.length > 0 && lines[0].trim().length > campaignName.length) {
                    campaignName = lines[0].trim();
                  }
                }
                
                results.push({
                  id: targetId,
                  name: campaignName,
                  url: href,
                  category: categoryId,
                  pageNumber: pageNum
                });
              }
            });
            
            return results;
          }, targetId, categoryId, pageNum);
          
          if (pageData.length > 0) {
            console.log(`\n🎯 発見！ショッピングカテゴリ${categoryId} ページ${pageNum}で指定案件を発見:`);
            pageData.forEach(campaign => {
              console.log(`   名前: ${campaign.name}`);
              console.log(`   カテゴリ: ${campaign.category}`);
              console.log(`   ページ: ${campaign.pageNumber}`);
              console.log(`   URL: ${campaign.url}`);
            });
            found = true;
            break;
          }
        }
      }
    }
    
    if (!found) {
      console.log('\n❌ 指定案件（ID: 1840652）が見つかりませんでした');
      console.log('可能性:');
      console.log('1. 案件が削除または非公開になった');
      console.log('2. 検索範囲外（アプリページ50以降、ショッピング30ページ以降）');
      console.log('3. 別のカテゴリに存在する（サービス、金融など）');
      console.log('4. URLが間違っている');
    }
    
  } catch (error) {
    console.error('💥 検索エラー:', error);
  } finally {
    await browser.close();
  }
}

findMissingCampaign().catch(console.error);