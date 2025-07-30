const puppeteer = require('puppeteer');
const fs = require('fs').promises;

async function checkMissingCampaigns() {
  console.log('🔍 未取得案件の特定開始\n');
  
  // 既存データ読み込み
  const existingData = JSON.parse(await fs.readFile('chobirich_all_app_campaigns.json', 'utf8'));
  const existingIds = new Set(existingData.app_campaigns.map(c => c.id));
  console.log(`📚 既存案件: ${existingIds.size}件\n`);
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    const iosUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
    await page.setUserAgent(iosUserAgent);
    
    const allCampaigns = [];
    const missingCampaigns = [];
    
    // 全ページをスキャン
    for (let pageNum = 1; pageNum <= 22; pageNum++) {
      const url = pageNum === 1 
        ? 'https://www.chobirich.com/smartphone?sort=point'
        : `https://www.chobirich.com/smartphone?sort=point&page=${pageNum}`;
      
      console.log(`📄 ページ ${pageNum} チェック中...`);
      
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const campaigns = await page.evaluate(() => {
        const links = document.querySelectorAll('a[href*="/ad_details/"]');
        const results = [];
        
        links.forEach(link => {
          const href = link.href;
          const id = href.match(/\/ad_details\/(\d+)/)?.[1];
          if (!id) return;
          
          const title = link.innerText || '';
          const parent = link.closest('.campaign-item, [class*="item"], li, div');
          const parentText = parent ? parent.innerText : '';
          
          // ポイント情報を探す
          const pointMatch = parentText.match(/(\d+(?:,\d+)?)\s*(?:ポイント|pt|円|%)/i);
          const cashback = pointMatch ? pointMatch[0] : '';
          
          results.push({
            id: id,
            url: href,
            title: title.trim(),
            cashback: cashback,
            fullText: parentText.substring(0, 200)
          });
        });
        
        return results;
      });
      
      // アプリ案件の判定
      campaigns.forEach(campaign => {
        const isApp = isAppCampaign(campaign.title, campaign.fullText);
        if (isApp) {
          allCampaigns.push(campaign);
          
          if (!existingIds.has(campaign.id)) {
            missingCampaigns.push(campaign);
            console.log(`  🆕 未取得: [${campaign.id}] ${campaign.title}`);
          }
        }
      });
    }
    
    // 結果表示
    console.log('\n📊 === 分析結果 ===');
    console.log(`総アプリ案件数: ${allCampaigns.length}件`);
    console.log(`取得済み: ${existingIds.size}件`);
    console.log(`未取得: ${missingCampaigns.length}件`);
    
    if (missingCampaigns.length > 0) {
      console.log('\n🔍 未取得案件の詳細:');
      missingCampaigns.forEach(campaign => {
        console.log(`\nID: ${campaign.id}`);
        console.log(`タイトル: ${campaign.title}`);
        console.log(`URL: ${campaign.url}`);
        console.log(`キャッシュバック: ${campaign.cashback}`);
        console.log(`詳細: ${campaign.fullText}`);
      });
      
      // ファイルに保存
      await fs.writeFile(
        'chobirich_missing_campaigns.json',
        JSON.stringify({ missing: missingCampaigns, timestamp: new Date().toISOString() }, null, 2)
      );
      console.log('\n💾 未取得案件を chobirich_missing_campaigns.json に保存しました');
    }
    
  } finally {
    await browser.close();
  }
}

function isAppCampaign(title, text) {
  const appKeywords = [
    'アプリ', 'app', 'インストール', 'ダウンロード',
    'ゲーム', 'game', 'レベル', 'level', 'クリア',
    'iOS', 'iPhone', 'iPad', 'Android', 'アンドロイド',
    'Google Play', 'App Store', 'プレイ', 'play',
    'チュートリアル', 'アプリランド', 'アプリdeちょ'
  ];
  
  const combined = (title + ' ' + text).toLowerCase();
  return appKeywords.some(keyword => combined.includes(keyword.toLowerCase()));
}

// 実行
checkMissingCampaigns().catch(console.error);