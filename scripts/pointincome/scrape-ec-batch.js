const puppeteer = require('puppeteer');
const fs = require('fs').promises;

async function scrapeECBatch() {
  console.log('🛒 EC・ネットショッピング（10件バッチ）スクレイピング開始\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (['image', 'font', 'stylesheet'].includes(request.resourceType())) {
        request.abort();
      } else {
        request.continue();
      }
    });
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    const results = [];
    
    // EC・ネットショッピンググループにアクセス
    console.log('📂 EC・ネットショッピンググループにアクセス...');
    await page.goto('https://pointi.jp/list.php?group=65', { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 案件リンクを取得（最初の10件）
    const campaignLinks = await page.$$eval('.box_ad_inner a[href*="/ad/"]', links => {
      return links.slice(0, 10).map(link => ({
        url: link.href,
        title: link.querySelector('img') ? link.querySelector('img').alt : ''
      }));
    });
    
    console.log(`📊 ${campaignLinks.length}件の案件を処理開始\n`);
    
    // 各案件の詳細を取得
    for (let i = 0; i < campaignLinks.length; i++) {
      const campaign = campaignLinks[i];
      console.log(`[${i + 1}/${campaignLinks.length}] ${campaign.url}`);
      
      try {
        await page.goto(campaign.url, { waitUntil: 'networkidle2' });
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const detail = await page.evaluate(() => {
          const data = {
            title: '',
            cashback: '',
            yenText: ''
          };
          
          const h2 = document.querySelector('h2');
          if (h2) data.title = h2.textContent.trim();
          
          const percentEl = document.querySelector('.ad_pt.red.bold');
          if (percentEl) data.cashback = percentEl.textContent.trim();
          
          const yenEl = document.querySelector('.pt_yen.bold');
          if (yenEl) data.yenText = yenEl.textContent.trim();
          
          return data;
        });
        
        const idMatch = campaign.url.match(/\/ad\/(\d+)/);
        let cashbackYen = null;
        
        if (detail.yenText) {
          const yenMatch = detail.yenText.match(/(\d{1,3}(?:,\d{3})*)円分/);
          if (yenMatch) {
            cashbackYen = yenMatch[1].replace(/,/g, '') + '円';
          }
        }
        
        const result = {
          id: `pi_${idMatch ? idMatch[1] : Date.now()}`,
          title: detail.title || campaign.title || '不明',
          url: campaign.url,
          campaignUrl: campaign.url,
          pointSiteUrl: 'https://pointi.jp',
          cashback: detail.cashback,
          cashbackYen: cashbackYen,
          lastUpdated: new Date().toLocaleString('ja-JP'),
          siteName: 'ポイントインカム',
          searchKeywords: (detail.title || '').toLowerCase(),
          searchWeight: 1,
          category: 'EC・ネットショッピング',
          categoryType: 'group',
          device: 'PC'
        };
        
        results.push(result);
        console.log(`  ✅ ${detail.title}`);
        console.log(`     還元: ${detail.cashback || cashbackYen || '不明'}\n`);
        
      } catch (error) {
        console.log(`  ❌ エラー: ${error.message}\n`);
      }
    }
    
    // 結果を保存
    const data = {
      siteName: 'ポイントインカム',
      scrapedAt: new Date().toISOString(),
      summary: {
        total_campaigns: results.length,
        category: 'EC・ネットショッピング',
        batchSize: 10
      },
      campaigns: results
    };
    
    await fs.writeFile(
      'pointincome_ec_batch.json',
      JSON.stringify(data, null, 2),
      'utf8'
    );
    
    console.log('✅ スクレイピング完了！');
    console.log(`📊 取得件数: ${results.length}件`);
    console.log('💾 保存先: pointincome_ec_batch.json');
    
  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await browser.close();
  }
}

// 実行
scrapeECBatch();