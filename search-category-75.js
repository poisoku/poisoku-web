#!/usr/bin/env node

const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: false, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  console.log('🔍 カテゴリ75（体験・トライアル）深度調査');
  await page.goto('https://pointi.jp/list.php?category=75', { waitUntil: 'networkidle2' });
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  let found = false;
  let pageNum = 1;
  
  while (!found && pageNum <= 10) {
    console.log(`\n📄 ページ${pageNum}を調査中...`);
    
    const pageInfo = await page.evaluate(() => {
      const campaigns = Array.from(document.querySelectorAll('.box_ad'));
      const titles = campaigns.map(el => {
        const titleEl = el.querySelector('.title_list');
        const linkEl = el.querySelector('a[href*="./ad/"]');
        return {
          title: titleEl ? titleEl.textContent.trim() : '',
          url: linkEl ? linkEl.href : '',
          id: linkEl && linkEl.href.match(/\/ad\/(\d+)\//) ? linkEl.href.match(/\/ad\/(\d+)\//)[1] : null
        };
      });
      
      const hasInuNeko = titles.some(campaign => 
        campaign.title.includes('いぬのきもち') || campaign.title.includes('ねこのきもち') || campaign.id === '12069'
      );
      
      const inuNekoInfo = titles.find(campaign => 
        campaign.title.includes('いぬのきもち') || campaign.title.includes('ねこのきもち') || campaign.id === '12069'
      );
      
      const pageLinks = Array.from(document.querySelectorAll('a[onclick*="tab_select"]'));
      const nextButton = pageLinks.find(link => 
        link.textContent.trim().includes('次へ')
      );
      
      return {
        totalCampaigns: campaigns.length,
        hasInuNeko: hasInuNeko,
        inuNekoInfo: inuNekoInfo,
        allCampaigns: titles,
        hasNextPage: !!nextButton,
        nextOnclick: nextButton ? nextButton.getAttribute('onclick') : null
      };
    });
    
    console.log(`   案件数: ${pageInfo.totalCampaigns}件`);
    console.log(`   いぬねこ発見: ${pageInfo.hasInuNeko ? '✅' : '❌'}`);
    
    if (pageInfo.hasInuNeko) {
      console.log('\n🎉 発見！');
      console.log('   タイトル:', pageInfo.inuNekoInfo.title);
      console.log('   URL:', pageInfo.inuNekoInfo.url);
      console.log('   ID:', pageInfo.inuNekoInfo.id);
      found = true;
      break;
    }
    
    // ID 12069が直接あるかチェック
    const has12069 = pageInfo.allCampaigns.some(c => c.id === '12069');
    if (has12069) {
      const campaign12069 = pageInfo.allCampaigns.find(c => c.id === '12069');
      console.log('\n🎯 ID 12069 発見！');
      console.log('   タイトル:', campaign12069.title);
      console.log('   URL:', campaign12069.url);
      found = true;
      break;
    }
    
    // いくつかの案件タイトルを表示（デバッグ用）
    if (pageInfo.totalCampaigns > 0) {
      console.log('   最初の3件:');
      pageInfo.allCampaigns.slice(0, 3).forEach((c, i) => {
        console.log(`     ${i+1}. ${c.title} (ID: ${c.id})`);
      });
    }
    
    // 次のページへ移動
    if (pageInfo.hasNextPage && pageNum < 10) {
      const paramMatch = pageInfo.nextOnclick.match(/tab_select\('([^']+)',\s*(\d+),\s*(\d+),\s*(\d+)\)/);
      if (paramMatch) {
        console.log(`     → ページ${pageNum + 1}へ移動...`);
        
        const beforeCampaigns = pageInfo.totalCampaigns;
        
        await page.evaluate((tab, p2, p3, p4) => {
          console.log(`tab_select実行: ('${tab}', ${p2}, ${p3}, ${p4})`);
          window.tab_select(tab, p2, p3, p4);
        }, paramMatch[1], parseInt(paramMatch[2]), parseInt(paramMatch[3]), parseInt(paramMatch[4]));
        
        await new Promise(resolve => setTimeout(resolve, 8000));
        
        // ページ遷移が成功したかチェック
        const afterInfo = await page.evaluate(() => {
          const campaigns = document.querySelectorAll('.box_ad');
          return {
            count: campaigns.length,
            firstTitle: campaigns[0] ? campaigns[0].querySelector('.title_list')?.textContent?.trim() : null
          };
        });
        
        if (afterInfo.count === 0) {
          console.log('     ❌ ページ遷移失敗（0件表示）');
          break;
        } else if (afterInfo.count === beforeCampaigns) {
          console.log('     ⚠️ 案件数が変わらず（ページ遷移していない可能性）');
        } else {
          console.log(`     ✅ ページ遷移成功 (${beforeCampaigns} → ${afterInfo.count}件)`);
        }
        
        pageNum++;
      } else {
        console.log('     ❌ 次ページパラメータ解析失敗');
        break;
      }
    } else {
      console.log('     ℹ️ 最終ページに到達');
      break;
    }
  }
  
  if (!found) {
    console.log('\n❌ カテゴリ75では「いぬのきもち・ねこのきもち」(ID: 12069)が見つかりませんでした');
  }
  
  console.log('\n手動確認のため10秒間ブラウザを開いておきます...');
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  await browser.close();
})();