const puppeteer = require('puppeteer');

async function testMobileAppScraper() {
  console.log('📱 ポイントインカム モバイルアプリ案件テスト開始\n');
  
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
    console.log(`🌐 URL: ${url}`);
    console.log(`📱 User-Agent: iPhone\n`);
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // ページ情報を取得
    const pageInfo = await page.evaluate(() => {
      const info = {
        title: document.title,
        url: window.location.href,
        campaigns: [],
        osTypes: new Set()
      };
      
      // 案件要素を探す（複数パターンに対応）
      const campaignSelectors = [
        '.box_ad_inner a',
        '.campaign-list a',
        '.app-list a',
        'a[href*="/ad/"]',
        '.list-item a'
      ];
      
      let campaignElements = [];
      for (const selector of campaignSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          campaignElements = elements;
          break;
        }
      }
      
      // 各案件の情報を取得
      campaignElements.forEach(element => {
        const campaign = {
          title: '',
          url: element.href,
          osIndicator: ''
        };
        
        // タイトル取得
        const titleElement = element.querySelector('img') || element;
        campaign.title = titleElement.alt || titleElement.textContent || '';
        
        // OS判定（タイトル、クラス名、画像などから）
        const text = element.textContent + ' ' + element.className + ' ' + element.innerHTML;
        if (text.match(/android|アンドロイド|google\s*play/i)) {
          campaign.osIndicator = 'Android';
          info.osTypes.add('Android');
        } else if (text.match(/ios|iphone|ipad|apple|app\s*store/i)) {
          campaign.osIndicator = 'iOS';
          info.osTypes.add('iOS');
        } else {
          // アイコンやバッジで判定
          const hasAndroidIcon = element.querySelector('[src*="android"], [src*="google"], .android-icon');
          const hasIOSIcon = element.querySelector('[src*="apple"], [src*="ios"], .ios-icon');
          
          if (hasAndroidIcon) {
            campaign.osIndicator = 'Android';
            info.osTypes.add('Android');
          } else if (hasIOSIcon) {
            campaign.osIndicator = 'iOS';
            info.osTypes.add('iOS');
          } else {
            campaign.osIndicator = '不明';
          }
        }
        
        if (campaign.title || campaign.url) {
          info.campaigns.push(campaign);
        }
      });
      
      // 要素構造を確認
      info.debugInfo = {
        bodyClasses: document.body.className,
        mainContainerExists: !!document.querySelector('.main-container, .content, #content'),
        totalLinks: document.querySelectorAll('a').length,
        campaignLinksFound: campaignElements.length
      };
      
      return info;
    });
    
    console.log(`📄 ページタイトル: ${pageInfo.title}`);
    console.log(`🔗 実際のURL: ${pageInfo.url}`);
    console.log(`📊 発見した案件数: ${pageInfo.campaigns.length}件`);
    console.log(`📱 検出されたOS: ${Array.from(pageInfo.osTypes).join(', ') || 'なし'}\n`);
    
    console.log('🔍 案件詳細（最初の10件）:');
    pageInfo.campaigns.slice(0, 10).forEach((campaign, index) => {
      console.log(`  ${index + 1}. ${campaign.title || '(タイトルなし)'}`);
      console.log(`     OS: ${campaign.osIndicator}`);
      console.log(`     URL: ${campaign.url}\n`);
    });
    
    console.log('🐛 デバッグ情報:');
    console.log(`  Body classes: ${pageInfo.debugInfo.bodyClasses}`);
    console.log(`  メインコンテナ: ${pageInfo.debugInfo.mainContainerExists ? 'あり' : 'なし'}`);
    console.log(`  全リンク数: ${pageInfo.debugInfo.totalLinks}`);
    console.log(`  案件リンク数: ${pageInfo.debugInfo.campaignLinksFound}`);
    
    // Android User-Agentでも試す
    console.log('\n\n📱 Android User-Agentでテスト...\n');
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36');
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const androidPageInfo = await page.evaluate(() => {
      const campaigns = [];
      const campaignElements = document.querySelectorAll('.box_ad_inner a, a[href*="/ad/"], .campaign-list a');
      
      campaignElements.forEach(element => {
        campaigns.push({
          title: element.querySelector('img')?.alt || element.textContent || '',
          visible: true
        });
      });
      
      return {
        campaignCount: campaigns.length,
        firstFewTitles: campaigns.slice(0, 5).map(c => c.title)
      };
    });
    
    console.log(`📊 Android UAでの案件数: ${androidPageInfo.campaignCount}件`);
    console.log(`📝 最初の案件: ${androidPageInfo.firstFewTitles.join(', ')}`);
    
    // スクリーンショットを保存
    await page.screenshot({ path: 'pointincome-mobile-app-page.png', fullPage: true });
    console.log('\n📸 スクリーンショット保存: pointincome-mobile-app-page.png');
    
  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await browser.close();
  }
}

testMobileAppScraper();