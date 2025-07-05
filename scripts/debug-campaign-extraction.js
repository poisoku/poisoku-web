const puppeteer = require('puppeteer');

async function debugCampaignExtraction() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
  
  const url = 'https://www.chobirich.com/shopping/shop/101';
  console.log(`キャンペーン抽出デバッグ: ${url}`);
  
  const response = await page.goto(url, { 
    waitUntil: 'domcontentloaded',
    timeout: 12000 
  });
  
  console.log(`ステータス: ${response.status()}`);
  
  const campaignData = await page.evaluate(() => {
    const bodyText = document.body.innerText;
    
    // ad_detailsリンクを探す
    const campaignLinks = document.querySelectorAll('a[href*="/ad_details/"]');
    console.log(`リンク数: ${campaignLinks.length}`);
    
    const campaigns = [];
    const linkInfo = [];
    
    campaignLinks.forEach((link, index) => {
      const href = link.href;
      const campaignId = href.match(/\/ad_details\/(\d+)/);
      
      // リンクの詳細情報を取得
      const linkText = link.textContent?.trim() || '';
      const linkHTML = link.innerHTML;
      
      // 親コンテナを探す
      const container = link.closest('div, li, article, section');
      let containerText = '';
      let containerHTML = '';
      
      if (container) {
        containerText = container.textContent?.trim() || '';
        containerHTML = container.innerHTML;
      }
      
      linkInfo.push({
        index: index,
        href: href,
        campaignId: campaignId ? campaignId[1] : null,
        linkText: linkText,
        linkHTML: linkHTML.substring(0, 200),
        containerText: containerText.substring(0, 300),
        containerHTML: containerHTML.substring(0, 500)
      });
      
      if (campaignId) {
        // 案件名とキャッシュバック率を取得
        let campaignName = '';
        let cashbackRate = '';
        
        if (container) {
          const textContent = container.textContent || '';
          const lines = textContent.split('\n').filter(line => line.trim());
          
          // 最初の非空行を案件名として使用
          for (const line of lines) {
            if (line.trim().length > 3) {
              campaignName = line.trim();
              break;
            }
          }
          
          // パーセンテージを探す
          const percentMatch = textContent.match(/(\d+(?:\.\d+)?%)/);
          if (percentMatch) {
            cashbackRate = percentMatch[1];
          }
        }
        
        if (campaignName && campaignName.length > 3) {
          campaigns.push({
            id: campaignId[1],
            name: campaignName,
            url: href,
            cashback: cashbackRate
          });
        }
      }
    });
    
    return {
      totalLinks: campaignLinks.length,
      campaigns: campaigns,
      campaignCount: campaigns.length,
      linkInfo: linkInfo.slice(0, 10), // 最初の10件のみ
      bodyTextSample: bodyText.substring(0, 500)
    };
  });
  
  console.log('\n=== キャンペーン抽出結果 ===');
  console.log(`総リンク数: ${campaignData.totalLinks}`);
  console.log(`抽出された案件数: ${campaignData.campaignCount}`);
  
  console.log('\n=== 抽出された案件 ===');
  campaignData.campaigns.forEach((campaign, i) => {
    console.log(`${i+1}. ID: ${campaign.id}`);
    console.log(`   名前: ${campaign.name}`);
    console.log(`   還元率: ${campaign.cashback}`);
    console.log(`   URL: ${campaign.url}`);
    console.log('');
  });
  
  console.log('\n=== リンク詳細情報（最初の10件） ===');
  campaignData.linkInfo.forEach((info, i) => {
    console.log(`${i+1}. リンク詳細:`);
    console.log(`   href: ${info.href}`);
    console.log(`   ID: ${info.campaignId}`);
    console.log(`   リンクテキスト: ${info.linkText}`);
    console.log(`   コンテナテキスト: ${info.containerText}`);
    console.log(`   HTML: ${info.linkHTML}`);
    console.log('---');
  });
  
  console.log('\n=== ページ内容サンプル ===');
  console.log(campaignData.bodyTextSample);
  
  await browser.close();
}

debugCampaignExtraction().catch(console.error);