#!/usr/bin/env node

/**
 * 正しいモバイル版セレクタのテスト
 */

const puppeteer = require('puppeteer');

async function testCorrectSelectors() {
  console.log('🧪 モバイル版正しいセレクタテスト');
  console.log('='.repeat(60));
  
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox'] 
  });
  
  try {
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
    await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
    
    await page.goto('https://pointi.jp/list.php?category=161', { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 案件抽出テスト
    const campaignData = await page.evaluate(() => {
      const campaigns = [];
      
      // 候補1: .title を持つ要素の親コンテナを案件要素とする
      const titleElements = document.querySelectorAll('.title');
      
      console.log('Title elements found:', titleElements.length);
      
      titleElements.forEach((titleEl, index) => {
        const campaign = {};
        
        // タイトル取得
        campaign.title = titleEl.textContent.trim();
        
        // 親要素を辿って案件コンテナを特定
        let container = titleEl.parentElement;
        while (container && !container.classList.contains('box01') && container.tagName !== 'BODY') {
          container = container.parentElement;
        }
        
        if (container) {
          // ポイント情報を検索
          const pointEl = container.querySelector('.point, .point2');
          if (pointEl) {
            campaign.points = pointEl.textContent.trim();
          }
          
          // リンク情報を検索
          const linkEl = container.querySelector('a[href*=\"/ad/\"], a[href*=\"ad_details\"]');
          if (linkEl) {
            campaign.url = linkEl.href;
            // ID抽出
            const idMatch = linkEl.href.match(/\/ad\/(\d+)\/|ad_details\/(\d+)/);
            campaign.id = idMatch ? (idMatch[1] || idMatch[2]) : null;
          }
          
          // カテゴリアイコン
          const cateEl = container.querySelector('.cate_icon');
          if (cateEl) {
            campaign.category = cateEl.textContent.trim();
          }
          
          campaigns.push(campaign);
        }
      });
      
      // 候補2: .box01 を直接案件コンテナとする
      const boxElements = document.querySelectorAll('.box01');
      console.log('Box01 elements found:', boxElements.length);
      
      const boxCampaigns = [];
      boxElements.forEach((boxEl, index) => {
        const campaign = {};
        
        // タイトル
        const titleEl = boxEl.querySelector('.title');
        if (titleEl) {
          campaign.title = titleEl.textContent.trim();
        }
        
        // ポイント
        const pointEl = boxEl.querySelector('.point, .point2');
        if (pointEl) {
          campaign.points = pointEl.textContent.trim();
        }
        
        // リンク
        const linkEl = boxEl.querySelector('a[href*=\"/ad/\"], a[href*=\"ad_details\"]');
        if (linkEl) {
          campaign.url = linkEl.href;
          const idMatch = linkEl.href.match(/\/ad\/(\d+)\/|ad_details\/(\d+)/);
          campaign.id = idMatch ? (idMatch[1] || idMatch[2]) : null;
        }
        
        // カテゴリ
        const cateEl = boxEl.querySelector('.cate_icon');
        if (cateEl) {
          campaign.category = cateEl.textContent.trim();
        }
        
        if (campaign.title) {
          boxCampaigns.push(campaign);
        }
      });
      
      return {
        titleMethod: campaigns,
        boxMethod: boxCampaigns,
        totalTitleElements: titleElements.length,
        totalBoxElements: boxElements.length
      };
    });
    
    console.log('📊 抽出結果:');
    console.log(`   .title要素: ${campaignData.totalTitleElements}個`);
    console.log(`   .box01要素: ${campaignData.totalBoxElements}個`);
    
    console.log('\\n🎯 タイトル方式で抽出された案件:');
    campaignData.titleMethod.forEach((campaign, i) => {
      console.log(`   ${i + 1}. ${campaign.title}`);
      console.log(`      ポイント: ${campaign.points || 'なし'}`);
      console.log(`      URL: ${campaign.url || 'なし'}`);
      console.log(`      ID: ${campaign.id || 'なし'}`);
    });
    
    console.log('\\n📦 box01方式で抽出された案件:');
    campaignData.boxMethod.forEach((campaign, i) => {
      console.log(`   ${i + 1}. ${campaign.title}`);
      console.log(`      ポイント: ${campaign.points || 'なし'}`);
      console.log(`      URL: ${campaign.url || 'なし'}`);
      console.log(`      ID: ${campaign.id || 'なし'}`);
    });
    
    // スクロールしてAJAX読み込みをテスト
    console.log('\\n🔄 スクロールテスト...');
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const afterScrollData = await page.evaluate(() => {
      const boxElements = document.querySelectorAll('.box01');
      return {
        boxCount: boxElements.length,
        newCampaigns: Array.from(boxElements).slice(-3).map(boxEl => {
          const titleEl = boxEl.querySelector('.title');
          return titleEl ? titleEl.textContent.trim() : '';
        }).filter(Boolean)
      };
    });
    
    console.log('\\n📜 スクロール後:');
    console.log(`   .box01要素: ${afterScrollData.boxCount}個`);
    console.log(`   新しい案件例:`);
    afterScrollData.newCampaigns.forEach((title, i) => {
      console.log(`     ${i + 1}. ${title}`);
    });
    
    const increaseCount = afterScrollData.boxCount - campaignData.totalBoxElements;
    if (increaseCount > 0) {
      console.log(`\\n🎉 スクロールで${increaseCount}個の新しい案件が読み込まれました！`);
    } else {
      console.log('\\n❌ スクロールで新しい案件は読み込まれませんでした');
    }
    
    console.log('\\n手動確認のため15秒間ブラウザを開いておきます...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await browser.close();
  }
}

testCorrectSelectors();