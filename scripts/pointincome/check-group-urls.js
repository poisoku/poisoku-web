const puppeteer = require('puppeteer');

async function checkGroupUrls() {
  console.log('🔍 ポイントインカムのグループURLを調査中...\n');
  
  const groupUrls = [
    { id: 65, url: 'https://pointi.jp/list.php?group=65' },
    { id: 152, url: 'https://pointi.jp/list.php?group=152' },
    { id: 154, url: 'https://pointi.jp/list.php?group=154' },
    { id: 148, url: 'https://pointi.jp/list.php?group=148' },
    { id: 147, url: 'https://pointi.jp/list.php?group=147' },
    { id: 151, url: 'https://pointi.jp/list.php?group=151' },
    { id: 155, url: 'https://pointi.jp/list.php?group=155' },
    { id: 153, url: 'https://pointi.jp/list.php?group=153' }
  ];
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    for (const group of groupUrls) {
      console.log(`\n📂 グループID ${group.id} を確認中...`);
      await page.goto(group.url, { waitUntil: 'networkidle2' });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const groupInfo = await page.evaluate(() => {
        const info = {
          title: document.title,
          h1: '',
          breadcrumb: '',
          campaignCount: 0,
          campaignUrls: []
        };
        
        // h1タグを探す
        const h1 = document.querySelector('h1');
        if (h1) {
          info.h1 = h1.textContent.trim();
        }
        
        // パンくずリストを探す
        const breadcrumb = document.querySelector('.breadcrumb, .pankuzu, [class*="bread"]');
        if (breadcrumb) {
          info.breadcrumb = breadcrumb.textContent.trim();
        }
        
        // 案件数をカウント
        const campaignLinks = document.querySelectorAll('.box_ad_inner a[href*="/ad/"]');
        info.campaignCount = campaignLinks.length;
        
        // 最初の3件のURLを取得
        info.campaignUrls = Array.from(campaignLinks)
          .slice(0, 3)
          .map(link => link.href);
        
        return info;
      });
      
      console.log(`  名前: ${groupInfo.h1 || groupInfo.title}`);
      console.log(`  パンくず: ${groupInfo.breadcrumb}`);
      console.log(`  案件数: ${groupInfo.campaignCount}件`);
      
      if (groupInfo.campaignUrls.length > 0) {
        console.log('  案件URL例:');
        groupInfo.campaignUrls.forEach(url => {
          console.log(`    - ${url}`);
        });
      }
    }
    
    console.log('\n✅ 調査完了！');
    
  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await browser.close();
  }
}

// 実行
checkGroupUrls();