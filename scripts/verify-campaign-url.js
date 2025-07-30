const puppeteer = require('puppeteer');

/**
 * 指定URLが実際に存在し、アクセス可能かを確認
 */
async function verifyCampaignUrl() {
  console.log('🌐 案件URL検証開始\n');
  
  const targetUrl = 'https://www.chobirich.com/ad_details/1840652/';
  console.log(`🎯 対象URL: ${targetUrl}`);
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // iOS User Agent設定
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
  
  try {
    console.log('\n📡 URLへアクセス中...');
    
    const response = await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    console.log(`📊 HTTPステータス: ${response.status()}`);
    
    if (response.status() === 200) {
      console.log('✅ ページへのアクセス成功');
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // ページ内容を解析
      const pageInfo = await page.evaluate(() => {
        const title = document.title;
        const bodyText = document.body.innerText;
        
        // 案件情報の抽出を試行
        let campaignName = '';
        let cashback = '';
        let device = '';
        let description = '';
        
        // タイトルから案件名を抽出
        if (title && title !== 'ちょびリッチ') {
          campaignName = title;
        }
        
        // ページ内容から案件情報を抽出
        const lines = bodyText.split('\n').filter(line => line.trim());
        
        // 還元率・ポイントを探す
        const pointMatch = bodyText.match(/(\d+(?:,\d{3})*)\s*(?:pt|ポイント)/i);
        if (pointMatch) {
          cashback = pointMatch[1] + 'pt';
        }
        
        const percentMatch = bodyText.match(/(\d+(?:\.\d+)?)\s*%/);
        if (percentMatch && !cashback) {
          cashback = percentMatch[1] + '%';
        }
        
        // デバイス情報を探す
        if (bodyText.includes('iOS') || bodyText.includes('iPhone')) {
          device = 'iOS';
        } else if (bodyText.includes('Android')) {
          device = 'Android';
        } else {
          device = 'All';
        }
        
        // 案件名を探す（タイトルが取れない場合）
        if (!campaignName) {
          const possibleNames = lines.filter(line => 
            line.length > 5 && line.length < 100 && 
            !line.includes('ポイント') && 
            !line.includes('円') &&
            !line.includes('％')
          );
          
          if (possibleNames.length > 0) {
            campaignName = possibleNames[0];
          }
        }
        
        return {
          title,
          campaignName,
          cashback,
          device,
          bodyTextSample: bodyText.substring(0, 500),
          totalTextLength: bodyText.length,
          isValidCampaign: bodyText.includes('広告') || bodyText.includes('案件') || bodyText.includes('ポイント')
        };
      });
      
      console.log('\n📋 ページ情報:');
      console.log(`   タイトル: ${pageInfo.title}`);
      console.log(`   案件名: ${pageInfo.campaignName || '不明'}`);
      console.log(`   還元: ${pageInfo.cashback || '不明'}`);
      console.log(`   デバイス: ${pageInfo.device}`);
      console.log(`   有効案件: ${pageInfo.isValidCampaign ? 'はい' : 'いいえ'}`);
      console.log(`   テキスト長: ${pageInfo.totalTextLength}文字`);
      
      console.log('\n📄 ページ内容サンプル:');
      console.log(pageInfo.bodyTextSample);
      
      if (pageInfo.isValidCampaign) {
        console.log('\n✅ 有効な案件ページです');
        console.log('この案件がスクレイピングされていない理由:');
        console.log('1. スクレイピング範囲外（中規模版は25ページまで）');
        console.log('2. 最近追加された案件');
        console.log('3. 特殊なページ構造');
      } else {
        console.log('\n⚠️ 案件情報が不完全または無効なページです');
      }
      
    } else if (response.status() === 404) {
      console.log('❌ ページが見つかりません（404）');
      console.log('この案件は削除されたか、URLが間違っています');
    } else if (response.status() === 403) {
      console.log('❌ アクセス拒否（403）');
      console.log('User Agentまたはアクセス権限の問題の可能性があります');
    } else {
      console.log(`❌ 予期しないステータス: ${response.status()}`);
    }
    
  } catch (error) {
    console.error('💥 検証エラー:', error.message);
    
    if (error.message.includes('timeout')) {
      console.log('⏰ タイムアウト: ページの読み込みに時間がかかりすぎました');
    } else if (error.message.includes('net::ERR_NAME_NOT_RESOLVED')) {
      console.log('🌐 DNS解決エラー: URLが無効な可能性があります');
    }
  } finally {
    await browser.close();
  }
}

verifyCampaignUrl().catch(console.error);