const puppeteer = require('puppeteer');

async function analyzeProblematicCampaigns() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    // 問題のある案件を調査
    const problematicCampaigns = [
      { id: '1701350', name: 'ANAのふるさと納税', wrongValue: '120,000pt' },
      { id: '1729087', name: 'ふるさと納税 ふるラボ', wrongValue: '10,000pt' },
      { id: '1752831', name: 'ダイソーネットストア', wrongValue: '1,000pt' }
    ];

    for (const campaign of problematicCampaigns) {
      console.log(`\n=== ${campaign.name} (ID: ${campaign.id}) ===`);
      console.log(`現在の誤った取得値: ${campaign.wrongValue}`);
      
      const page = await browser.newPage();
      await page.goto(`https://www.chobirich.com/ad_details/${campaign.id}/`, {
        waitUntil: 'networkidle2'
      });

      const analysis = await page.evaluate(() => {
        const result = {
          pageTitle: document.title,
          allCashbackElements: []
        };

        // AdDetailsエリア内のすべての還元率要素を詳細分析
        const mainContent = document.querySelector('.AdDetails') || document.body;
        
        mainContent.querySelectorAll('*').forEach(el => {
          const text = el.textContent?.trim() || '';
          const rect = el.getBoundingClientRect();
          
          if (/^\d+(?:\.\d+)?%$/.test(text) || /^\d+(?:,\d+)?(?:ちょび)?pt$/.test(text)) {
            const fontSize = parseInt(window.getComputedStyle(el).fontSize);
            const isVisible = rect.width > 0 && rect.height > 0;
            
            if (isVisible) {
              result.allCashbackElements.push({
                text: text,
                fontSize: fontSize,
                className: el.className,
                tagName: el.tagName,
                // 詳細な分類
                isAdDetails: el.className.includes('AdDetails'),
                isSideCol: el.className.includes('SideCol'),
                isMaximumPt: el.className.includes('maximumPt'),
                isRecommend: el.className.includes('Recommend'),
                isItemPt: el.className.includes('item_pt'),
                // 親要素の情報
                parentClass: el.parentElement?.className || '',
                // 位置情報
                top: Math.round(rect.top),
                left: Math.round(rect.left),
                // テキストの前後を確認
                fullContext: el.parentElement?.textContent?.trim().substring(0, 100) || ''
              });
            }
          }
        });

        // フォントサイズでソート
        result.allCashbackElements.sort((a, b) => b.fontSize - a.fontSize);

        return result;
      });

      console.log(`ページタイトル: ${analysis.pageTitle}`);
      console.log('\n=== 全還元率要素（フォントサイズ順） ===');
      
      analysis.allCashbackElements.forEach((el, i) => {
        console.log(`${i + 1}. "${el.text}" - ${el.fontSize}px`);
        console.log(`   クラス: ${el.className}`);
        console.log(`   タグ: ${el.tagName}`);
        console.log(`   AdDetails: ${el.isAdDetails}, SideCol: ${el.isSideCol}`);
        console.log(`   位置: (${el.left}, ${el.top})`);
        console.log(`   コンテキスト: ${el.fullContext.substring(0, 50)}...`);
        console.log('');
      });

      // 正しい還元率を推測
      const correctCashback = analysis.allCashbackElements.find(el => 
        el.isAdDetails && el.className.includes('ItemPtLarge')
      ) || analysis.allCashbackElements.find(el => 
        el.isAdDetails && !el.isSideCol
      ) || analysis.allCashbackElements.find(el => 
        !el.isSideCol && !el.isMaximumPt && el.fontSize >= 20
      );

      if (correctCashback) {
        console.log(`🎯 推奨される正しい還元率: "${correctCashback.text}"`);
      }

      await page.close();
    }

    // 正しく取得できている案件も1つ確認
    console.log(`\n\n=== 参考: 正しく取得できている案件（楽天市場） ===`);
    const page = await browser.newPage();
    await page.goto('https://www.chobirich.com/ad_details/36796/', {
      waitUntil: 'networkidle2'
    });

    const correctAnalysis = await page.evaluate(() => {
      const result = { allCashbackElements: [] };
      
      const mainContent = document.querySelector('.AdDetails') || document.body;
      
      mainContent.querySelectorAll('*').forEach(el => {
        const text = el.textContent?.trim() || '';
        const rect = el.getBoundingClientRect();
        
        if (/^\d+(?:\.\d+)?%$/.test(text) || /^\d+(?:,\d+)?(?:ちょび)?pt$/.test(text)) {
          const fontSize = parseInt(window.getComputedStyle(el).fontSize);
          const isVisible = rect.width > 0 && rect.height > 0;
          
          if (isVisible) {
            result.allCashbackElements.push({
              text: text,
              fontSize: fontSize,
              className: el.className,
              isAdDetails: el.className.includes('AdDetails')
            });
          }
        }
      });
      
      result.allCashbackElements.sort((a, b) => b.fontSize - a.fontSize);
      return result;
    });

    console.log('楽天市場の還元率要素（上位3件）:');
    correctAnalysis.allCashbackElements.slice(0, 3).forEach((el, i) => {
      console.log(`${i + 1}. "${el.text}" - ${el.fontSize}px (${el.className})`);
    });

    await page.close();

  } finally {
    await browser.close();
  }
}

analyzeProblematicCampaigns().catch(console.error);