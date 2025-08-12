#!/usr/bin/env node

const puppeteer = require('puppeteer');

/**
 * 確認されたセレクタで「次の10件を表示」ボタンクリックの最終テスト
 */
async function testFinalButtonClick() {
  console.log('🔍 最終ボタンクリックテスト');
  console.log('='.repeat(70));
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 390, height: 844 }
  });
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15');
    
    const url = 'https://sp.pointi.jp/pts_app.php?cat_no=285&sort=&sub=4';
    console.log(`📱 URL: ${url}\n`);
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 初期案件数と詳細情報
    const initialInfo = await page.evaluate(() => {
      const campaigns = document.querySelectorAll('.box01');
      const button = document.querySelector('#load_sites_cnr_round');
      
      return {
        campaignCount: campaigns.length,
        firstCampaignTitle: campaigns[0]?.textContent.trim().substring(0, 50) || 'なし',
        lastCampaignTitle: campaigns[campaigns.length - 1]?.textContent.trim().substring(0, 50) || 'なし',
        buttonExists: !!button,
        buttonVisible: button ? button.getBoundingClientRect().height > 0 : false,
        buttonText: button ? button.textContent.trim() : 'なし'
      };
    });
    
    console.log(`📊 初期状態:`);
    console.log(`  案件数: ${initialInfo.campaignCount}件`);
    console.log(`  最初の案件: ${initialInfo.firstCampaignTitle}...`);
    console.log(`  最後の案件: ${initialInfo.lastCampaignTitle}...`);
    console.log(`  ボタン存在: ${initialInfo.buttonExists}`);
    console.log(`  ボタン表示: ${initialInfo.buttonVisible}`);
    console.log(`  ボタンテキスト: ${initialInfo.buttonText}\n`);
    
    let totalClicks = 0;
    let totalCampaigns = initialInfo.campaignCount;
    const maxClicks = 5;
    
    while (totalClicks < maxClicks) {
      console.log(`🖱️ クリック試行 ${totalClicks + 1}:`);
      
      // ページ最下部までスクロール
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 確認されたセレクタでボタンクリック
      const clickResult = await page.evaluate(() => {
        const button = document.querySelector('#load_sites_cnr_round');
        if (button) {
          const rect = button.getBoundingClientRect();
          const computedStyle = window.getComputedStyle(button);
          
          const info = {
            found: true,
            visible: rect.height > 0 && rect.width > 0,
            display: computedStyle.display,
            visibility: computedStyle.visibility,
            rect: {
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height
            },
            text: button.textContent.trim(),
            clicked: false
          };
          
          // クリック実行
          try {
            button.click();
            info.clicked = true;
          } catch (e) {
            info.error = e.message;
          }
          
          return info;
        }
        return { found: false };
      });
      
      if (clickResult.found) {
        console.log(`  ✅ ボタン発見:`);
        console.log(`    表示: ${clickResult.visible} (${clickResult.rect.width}x${clickResult.rect.height})`);
        console.log(`    テキスト: "${clickResult.text}"`);
        console.log(`    クリック: ${clickResult.clicked ? '成功' : '失敗'}`);
        
        if (clickResult.clicked) {
          // 読み込み待機
          console.log(`  ⏳ 読み込み待機中...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // 案件数の変化を確認
          const afterClickInfo = await page.evaluate(() => {
            const campaigns = document.querySelectorAll('.box01');
            return {
              campaignCount: campaigns.length,
              firstCampaignTitle: campaigns[0]?.textContent.trim().substring(0, 50) || 'なし',
              lastCampaignTitle: campaigns[campaigns.length - 1]?.textContent.trim().substring(0, 50) || 'なし'
            };
          });
          
          console.log(`  📊 クリック後:`);
          console.log(`    案件数: ${totalCampaigns}件 → ${afterClickInfo.campaignCount}件`);
          console.log(`    最後の案件: ${afterClickInfo.lastCampaignTitle}...`);
          
          if (afterClickInfo.campaignCount > totalCampaigns) {
            const addedCount = afterClickInfo.campaignCount - totalCampaigns;
            console.log(`  ✅ ${addedCount}件の新規案件を読み込みました\n`);
            totalCampaigns = afterClickInfo.campaignCount;
            totalClicks++;
          } else {
            console.log(`  ⚠️ 案件数が変わりませんでした - 全データ取得完了の可能性\n`);
            break;
          }
        } else {
          console.log(`  ❌ クリックに失敗しました: ${clickResult.error || '不明'}\n`);
          break;
        }
      } else {
        console.log(`  ❌ ボタンが見つかりませんでした\n`);
        break;
      }
    }
    
    // 最終結果
    console.log(`📊 最終結果:`);
    console.log(`  成功クリック数: ${totalClicks}回`);
    console.log(`  総案件数: ${totalCampaigns}件`);
    console.log(`  増加案件数: ${totalCampaigns - initialInfo.campaignCount}件`);
    
    // 最終状態の案件一覧を少し表示
    const finalCampaigns = await page.evaluate(() => {
      const campaigns = document.querySelectorAll('.box01');
      const titles = [];
      for (let i = 0; i < Math.min(5, campaigns.length); i++) {
        const title = campaigns[i].querySelector('.title, h3, h4, strong');
        if (title) {
          titles.push(title.textContent.trim());
        }
      }
      return titles;
    });
    
    console.log(`\n📋 取得案件例 (最初の5件):`);
    finalCampaigns.forEach((title, index) => {
      console.log(`  ${index + 1}. ${title}`);
    });
    
    // 10秒待機（確認用）
    console.log('\n⏸️ 10秒後に終了します...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
  } finally {
    await browser.close();
    console.log('\n✅ テスト完了');
  }
}

// 実行
testFinalButtonClick().catch(console.error);