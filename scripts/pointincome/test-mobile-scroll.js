const puppeteer = require('puppeteer');

async function testMobileScrollLoading() {
  console.log('📱 ポイントインカム モバイルアプリ案件 スクロール読み込みテスト開始\n');
  
  const browser = await puppeteer.launch({
    headless: false, // デバッグ用に表示
    args: ['--no-sandbox'],
    defaultViewport: { width: 375, height: 812 } // iPhone X サイズ
  });
  
  try {
    const page = await browser.newPage();
    
    // モバイルUser-Agentを設定
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1');
    
    const url = 'https://sp.pointi.jp/list.php?rf=1&n=1';
    console.log(`🌐 URL: ${url}\n`);
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 初期案件数を取得
    let previousCount = 0;
    let currentCount = 0;
    let scrollAttempts = 0;
    const maxScrollAttempts = 10;
    
    console.log('📊 スクロール読み込み開始...\n');
    
    while (scrollAttempts < maxScrollAttempts) {
      // 現在の案件数を取得
      currentCount = await page.evaluate(() => {
        const campaigns = document.querySelectorAll('a[href*="/ad/"]');
        return campaigns.length;
      });
      
      console.log(`📄 スクロール ${scrollAttempts + 1}: ${currentCount}件の案件`);
      
      // 案件数が変わらない場合は終了
      if (scrollAttempts > 0 && currentCount === previousCount) {
        console.log('⚠️ 新しい案件が読み込まれなくなりました - 終了');
        break;
      }
      
      previousCount = currentCount;
      
      // ページの最下部までスクロール
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      
      // 読み込み待機
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 「もっと見る」ボタンがあるかチェック
      const loadMoreButton = await page.$('button[onclick*="more"], .load-more, .btn-more, [data-action="load-more"]');
      if (loadMoreButton) {
        console.log('🔄 「もっと見る」ボタンをクリック...');
        await loadMoreButton.click();
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      scrollAttempts++;
    }
    
    // 最終的な案件リストを取得
    const allCampaigns = await page.evaluate(() => {
      const campaigns = [];
      const campaignElements = document.querySelectorAll('a[href*="/ad/"]');
      
      campaignElements.forEach(element => {
        const campaign = {
          title: '',
          url: element.href,
          osIndicator: ''
        };
        
        // タイトル取得
        const titleElement = element.querySelector('img') || element;
        campaign.title = titleElement.alt || titleElement.textContent || '';
        
        // OS判定
        const text = element.textContent + ' ' + element.className + ' ' + element.innerHTML;
        if (text.match(/android|アンドロイド|google\s*play/i)) {
          campaign.osIndicator = 'Android';
        } else if (text.match(/ios|iphone|ipad|apple|app\s*store/i)) {
          campaign.osIndicator = 'iOS';
        } else {
          campaign.osIndicator = '不明';
        }
        
        if (campaign.title) {
          campaigns.push(campaign);
        }
      });
      
      return campaigns;
    });
    
    console.log('\n📊 最終結果:');
    console.log(`📱 総案件数: ${allCampaigns.length}件`);
    
    // OSごとの集計
    const osCount = { iOS: 0, Android: 0, unknown: 0 };
    allCampaigns.forEach(campaign => {
      if (campaign.osIndicator === 'iOS') osCount.iOS++;
      else if (campaign.osIndicator === 'Android') osCount.Android++;
      else osCount.unknown++;
    });
    
    console.log(`📊 OS別案件数:`);
    console.log(`  iOS: ${osCount.iOS}件`);
    console.log(`  Android: ${osCount.Android}件`);
    console.log(`  不明: ${osCount.unknown}件`);
    
    console.log('\n📝 全案件リスト:');
    allCampaigns.forEach((campaign, index) => {
      console.log(`  ${index + 1}. [${campaign.osIndicator}] ${campaign.title}`);
    });
    
    // スクリーンショットを保存
    await page.screenshot({ path: 'pointincome-mobile-app-scroll.png', fullPage: true });
    console.log('\n📸 スクリーンショット保存: pointincome-mobile-app-scroll.png');
    
    return {
      totalCampaigns: allCampaigns.length,
      iosCount: osCount.iOS,
      androidCount: osCount.Android,
      campaigns: allCampaigns
    };
    
  } catch (error) {
    console.error('❌ エラー:', error);
    return null;
  } finally {
    await browser.close();
  }
}

testMobileScrollLoading();