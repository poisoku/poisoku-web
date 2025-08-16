#!/usr/bin/env node

/**
 * 全案件取得テスト（フィルタリングなし）
 * アプリカテゴリの全案件を確認
 */

const puppeteer = require('puppeteer');

async function testAllCampaigns() {
  console.log('🔍 全案件取得テスト（フィルタリングなし）開始...');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // モバイル設定
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1');
    await page.setViewport({
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      isLandscape: false
    });
    
    const targetUrl = 'https://pc.moppy.jp/category/list.php?parent_category=4&child_category=52&af_sorter=1&page=1';
    console.log(`📱 アクセス中: ${targetUrl}`);
    
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 全タイトル要素を取得（フィルタリングなし）
    const allCampaigns = await page.evaluate(() => {
      const campaigns = [];
      const titleElements = document.querySelectorAll('h3.a-list__item__title');
      
      console.log(`発見されたタイトル要素: ${titleElements.length}件`);
      
      titleElements.forEach((titleEl, index) => {
        try {
          const title = titleEl.textContent?.trim() || '';
          if (!title || title.length < 3) return;
          
          // 親要素からリンクとポイント情報を探す
          let container = titleEl.parentElement;
          let linkElement = null;
          let url = '';
          let points = 'ポイント不明';
          
          // 複数レベルの親要素を探索
          for (let level = 0; level < 5; level++) {
            if (!container) break;
            
            // リンク要素を探す
            linkElement = container.querySelector('a[href*="site_id"], a[href*="/ad"], a[href*="detail.php"]');
            if (linkElement) {
              url = linkElement.href;
              break;
            }
            
            container = container.parentElement;
          }
          
          // URLが見つからない場合はスキップ
          if (!url || !url.includes('moppy.jp')) {
            return;
          }
          
          // ポイント情報取得
          if (container) {
            const containerText = container.textContent || '';
            
            // モッピー特有のポイント表記パターン
            const pointPatterns = [
              /(\d{1,3}(?:,\d{3})*)\s*P(?:t)?/i,
              /(\d{1,3}(?:,\d{3})*)\s*ポイント/i,
              /(\d{1,2}(?:\.\d+)?)\s*%/i,
              /(\d{1,3}(?:,\d{3})*)\s*円/i
            ];
            
            for (const pattern of pointPatterns) {
              const match = containerText.match(pattern);
              if (match) {
                points = match[1] + (containerText.includes('%') ? '%' : 
                                   containerText.includes('円') ? '円' : 
                                   containerText.includes('ポイント') ? 'ポイント' : 'P');
                break;
              }
            }
          }
          
          // アプリキーワードの判定（分析用）
          const appKeywords = [
            'アプリ', 'インストール', '新規アプリ', 'ダウンロード',
            '初回起動', 'LINE', 'ライン', 'iOS', 'Android',
            'アプリ版', 'モバイルアプリ', 'スマホアプリ'
          ];
          
          const hasAppKeyword = appKeywords.some(keyword => 
            title.toLowerCase().includes(keyword.toLowerCase())
          );
          
          campaigns.push({
            index: index + 1,
            title: title,
            url: url,
            points: points,
            hasAppKeyword: hasAppKeyword,
            isLikelyApp: title.includes('アプリ') || title.includes('インストール') || 
                        title.includes('iOS') || title.includes('Android') ||
                        title.includes('起動') || title.includes('ダウンロード')
          });
          
        } catch (error) {
          console.error('案件抽出エラー:', error);
        }
      });
      
      return campaigns;
    });
    
    console.log('\n📊 全案件分析結果:');
    console.log(`📋 総案件数: ${allCampaigns.length}件`);
    
    const withAppKeyword = allCampaigns.filter(c => c.hasAppKeyword);
    const likelyAppCampaigns = allCampaigns.filter(c => c.isLikelyApp);
    
    console.log(`📱 明確なアプリキーワード: ${withAppKeyword.length}件`);
    console.log(`🤔 アプリ可能性案件: ${likelyAppCampaigns.length}件`);
    console.log(`🌐 その他案件: ${allCampaigns.length - likelyAppCampaigns.length}件`);
    
    console.log('\n📋 全案件一覧（最初の20件）:');
    allCampaigns.slice(0, 20).forEach(campaign => {
      const appFlag = campaign.hasAppKeyword ? '📱' : 
                     campaign.isLikelyApp ? '🤔' : '🌐';
      console.log(`${appFlag} ${campaign.index}. ${campaign.title} [${campaign.points}]`);
    });
    
    console.log('\n🤔 アプリ可能性案件（キーワードなしだが、アプリカテゴリなので対象の可能性）:');
    const nonKeywordButPossible = allCampaigns.filter(c => !c.hasAppKeyword && !c.isLikelyApp);
    nonKeywordButPossible.slice(0, 10).forEach(campaign => {
      console.log(`  🤔 ${campaign.title} [${campaign.points}]`);
    });
    
    if (allCampaigns.length >= 25) {
      console.log('\n🎯 結論:');
      console.log(`ユーザーの指摘は正しいです！`);
      console.log(`アプリカテゴリ（child_category=52）なので、全${allCampaigns.length}件がアプリ案件の可能性が高い`);
      console.log(`現在のフィルタリング（${withAppKeyword.length}件）は過度に制限している`);
    }
    
    return allCampaigns;
    
  } catch (error) {
    console.error('💥 テストエラー:', error);
  } finally {
    await browser.close();
  }
}

// 実行
testAllCampaigns().catch(console.error);