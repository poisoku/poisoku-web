const puppeteer = require('puppeteer');

async function debugPaginationUrls() {
  console.log('🔍 ページネーションURL構造のデバッグ\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox'],
    defaultViewport: { width: 1920, height: 1080 }
  });
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // ファッションカテゴリでテスト
    const groupId = 152;
    console.log(`📂 ファッショングループ (ID: ${groupId}) で URL 構造をテスト\n`);
    
    // 1ページ目
    console.log('📄 1ページ目をテスト');
    await page.goto(`https://pointi.jp/list.php?group=${groupId}`, { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const page1Info = await page.evaluate(() => {
      const campaigns = document.querySelectorAll('.box_ad_inner a[href*="/ad/"]');
      const firstCampaign = campaigns[0]?.href || '';
      const lastCampaign = campaigns[campaigns.length - 1]?.href || '';
      
      const pagerLinks = document.querySelectorAll('.pager a');
      const pagerInfo = [];
      
      for (let link of pagerLinks) {
        pagerInfo.push({
          text: link.textContent.trim(),
          href: link.href,
          onclick: link.onclick ? 'has onclick' : 'no onclick'
        });
      }
      
      return {
        campaignCount: campaigns.length,
        firstCampaign,
        lastCampaign,
        pagerInfo,
        currentUrl: window.location.href
      };
    });
    
    console.log(`  URL: ${page1Info.currentUrl}`);
    console.log(`  案件数: ${page1Info.campaignCount}`);
    console.log(`  最初の案件: ${page1Info.firstCampaign}`);
    console.log(`  最後の案件: ${page1Info.lastCampaign}`);
    console.log('  ページャー情報:');
    page1Info.pagerInfo.forEach(p => {
      console.log(`    「${p.text}」 → ${p.href} (${p.onclick})`);
    });
    
    // 2ページ目（URLパラメータ指定）
    console.log('\n📄 2ページ目をテスト（URLパラメータ）');
    await page.goto(`https://pointi.jp/list.php?group=${groupId}&page=2`, { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const page2Info = await page.evaluate(() => {
      const campaigns = document.querySelectorAll('.box_ad_inner a[href*="/ad/"]');
      const firstCampaign = campaigns[0]?.href || '';
      const lastCampaign = campaigns[campaigns.length - 1]?.href || '';
      
      return {
        campaignCount: campaigns.length,
        firstCampaign,
        lastCampaign,
        currentUrl: window.location.href
      };
    });
    
    console.log(`  URL: ${page2Info.currentUrl}`);
    console.log(`  案件数: ${page2Info.campaignCount}`);
    console.log(`  最初の案件: ${page2Info.firstCampaign}`);
    console.log(`  最後の案件: ${page2Info.lastCampaign}`);
    
    // 同じ内容かチェック
    const sameContent = page1Info.lastCampaign === page2Info.lastCampaign;
    console.log(`  1ページ目と同じ内容？ ${sameContent ? 'はい' : 'いいえ'}`);
    
    // 3ページ目もテスト
    console.log('\n📄 3ページ目をテスト');
    await page.goto(`https://pointi.jp/list.php?group=${groupId}&page=3`, { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const page3Info = await page.evaluate(() => {
      const campaigns = document.querySelectorAll('.box_ad_inner a[href*="/ad/"]');
      return {
        campaignCount: campaigns.length,
        firstCampaign: campaigns[0]?.href || '',
        lastCampaign: campaigns[campaigns.length - 1]?.href || '',
        currentUrl: window.location.href
      };
    });
    
    console.log(`  URL: ${page3Info.currentUrl}`);
    console.log(`  案件数: ${page3Info.campaignCount}`);
    console.log(`  最初の案件: ${page3Info.firstCampaign}`);
    console.log(`  最後の案件: ${page3Info.lastCampaign}`);
    
    console.log('\n📊 比較結果:');
    console.log(`  1ページ目と2ページ目が同じ: ${page1Info.lastCampaign === page2Info.lastCampaign}`);
    console.log(`  2ページ目と3ページ目が同じ: ${page2Info.lastCampaign === page3Info.lastCampaign}`);
    console.log(`  1ページ目と3ページ目が同じ: ${page1Info.lastCampaign === page3Info.lastCampaign}`);
    
  } catch (error) {
    console.error('❌ デバッグエラー:', error);
  } finally {
    await browser.close();
  }
}

debugPaginationUrls();