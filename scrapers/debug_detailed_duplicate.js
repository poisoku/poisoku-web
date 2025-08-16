#!/usr/bin/env node

/**
 * 重複除去の超詳細分析
 * どの段階で18件が除外されているかを特定
 */

const puppeteer = require('puppeteer');

async function debugDetailedDuplicate() {
  console.log('🔍 重複除去の超詳細分析開始...');
  
  // シミュレーション用のダミーデータで重複除去ロジックをテスト
  const mockCampaigns = [
    // 同じタイトル、異なるOS
    { title: 'ローソン（初回起動）_iOS', device: 'iOS', osType: 'ios', url: 'url1' },
    { title: 'ローソン（初回起動）_Android', device: 'Android', osType: 'android', url: 'url2' },
    
    // 完全に異なる案件
    { title: 'Pontaアプリ（ポンタ）', device: 'iOS', osType: 'ios', url: 'url3' },
    { title: 'Pontaアプリ（ポンタ）', device: 'Android', osType: 'android', url: 'url4' },
    
    // 完全に同じ案件（重複）
    { title: 'TikTok（動画視聴）', device: 'iOS', osType: 'ios', url: 'url5' },
    { title: 'TikTok（動画視聴）', device: 'iOS', osType: 'ios', url: 'url5' }, // 同じURL
  ];
  
  console.log('\n📋 テストデータ:');
  mockCampaigns.forEach((c, i) => {
    console.log(`${i+1}. ${c.title} [${c.device}] ${c.osType} ${c.url}`);
  });
  
  // 現在の重複除去ロジックをテスト
  console.log('\n🔧 現在の重複除去ロジックをテスト...');
  
  const filtered = removeDuplicates(mockCampaigns);
  
  console.log('\n📊 フィルター結果:');
  filtered.forEach((c, i) => {
    console.log(`${i+1}. ${c.title} [${c.device}] ${c.osType} ${c.url}`);
  });
  
  console.log(`\n入力: ${mockCampaigns.length}件 → 出力: ${filtered.length}件`);
  
  // 実際のデータで詳細分析
  console.log('\n🔍 実際のスクレイピングデータの段階別確認...');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // iOS User-Agent設定
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1');
    await page.setViewport({
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      isLandscape: false
    });
    
    // 1ページだけテスト
    const url = 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=52&af_sorter=1&page=1';
    
    console.log('\n📱 iOS 1ページ目のテスト...');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const iosCampaigns = await extractCampaigns(page, 'ios');
    console.log(`iOS: ${iosCampaigns.length}件取得`);
    
    console.log('\n📱 Android 1ページ目のテスト...');
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const androidCampaigns = await extractCampaigns(page, 'android');
    console.log(`Android: ${androidCampaigns.length}件取得`);
    
    console.log('\n🔗 統合・重複除去テスト...');
    const combined = [...iosCampaigns, ...androidCampaigns];
    console.log(`統合前: ${combined.length}件`);
    
    const deduped = removeDuplicates(combined);
    console.log(`重複除去後: ${deduped.length}件`);
    
    const iosFiltered = deduped.filter(c => c.osType === 'ios');
    const androidFiltered = deduped.filter(c => c.osType === 'android');
    
    console.log(`iOS残存: ${iosFiltered.length}件`);
    console.log(`Android残存: ${androidFiltered.length}件`);
    
    // 除外された案件を特定
    console.log('\n🔍 除外された案件:');
    const excludedAndroid = androidCampaigns.filter(ac => 
      !deduped.some(dc => dc.url === ac.url)
    );
    
    console.log(`除外されたAndroid案件: ${excludedAndroid.length}件`);
    excludedAndroid.slice(0, 5).forEach((c, i) => {
      console.log(`${i+1}. ${c.title} [${c.device}]`);
    });
    
  } catch (error) {
    console.error('💥 テストエラー:', error);
  } finally {
    await browser.close();
  }
}

// 重複除去ロジック（現在の実装をコピー）
function removeDuplicates(campaigns) {
  const seen = new Set();
  const titleOSMap = new Map();
  
  return campaigns.filter(campaign => {
    // URL完全一致の場合は重複
    if (seen.has(campaign.url)) {
      return false;
    }
    
    // タイトルベースの重複チェック（iOS/Android版は別案件として扱う）
    const cleanTitle = campaign.title.replace(/[_（\(](iOS|Android|iPhone)[）\)]*$/i, '').trim();
    const titleOSKey = `${cleanTitle}_${campaign.device}`;
    
    // 同じタイトル+デバイスの組み合わせが既にある場合は除外
    if (titleOSMap.has(titleOSKey)) {
      return false;
    }
    
    // iOS/Android版は別々に保持
    titleOSMap.set(titleOSKey, campaign);
    seen.add(campaign.url);
    return true;
  });
}

// 案件抽出ロジック（簡略版）
async function extractCampaigns(page, osType) {
  return await page.evaluate((osType) => {
    const campaigns = [];
    const titleElements = document.querySelectorAll('h3.a-list__item__title');
    
    titleElements.forEach((titleEl, index) => {
      const title = titleEl.textContent?.trim() || '';
      if (!title || title.length < 3) return;
      
      let container = titleEl.parentElement;
      let url = '';
      
      for (let level = 0; level < 5; level++) {
        if (!container) break;
        const linkElement = container.querySelector('a[href*="site_id"]');
        if (linkElement) {
          url = linkElement.href;
          break;
        }
        container = container.parentElement;
      }
      
      if (!url || !url.includes('moppy.jp')) return;
      
      let deviceType;
      if (osType === 'ios') {
        deviceType = 'iOS';
      } else if (osType === 'android') {
        deviceType = 'Android';
      }
      
      const siteIdMatch = url.match(/site_id=(\d+)/);
      const siteId = siteIdMatch ? siteIdMatch[1] : `unknown_${Date.now()}_${index}`;
      
      campaigns.push({
        id: `moppy_app_${siteId}`,
        title: title,
        url: url,
        device: deviceType,
        osType: osType
      });
    });
    
    return campaigns;
  }, osType);
}

// 実行
debugDetailedDuplicate().catch(console.error);