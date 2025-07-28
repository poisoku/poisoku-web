const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class PointIncomeAppDualPlatformScraper {
  constructor() {
    this.baseUrl = 'https://sp.pointi.jp/list.php?cat_no=68';
    this.browser = null;
    this.iosAppCampaigns = [];
    this.androidAppCampaigns = [];
    
    // 設定
    this.rateLimitMs = 2000; // 2秒間隔
    this.pageTimeoutMs = 30000;
    this.maxRetries = 3;
    this.scrollPauseMs = 3000; // スクロール後の待機時間
    
    // 出力ファイル
    this.outputFile = 'pointincome_app_campaigns_dual_platform.json';
    
    // UserAgent設定
    this.userAgents = {
      ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    };
  }

  async init() {
    console.log('📱 ポイントインカム アプリ案件デュアルプラットフォーム対応スクレイピング開始');
    console.log(`🎯 対象URL: ${this.baseUrl}`);
    console.log('⚙️ 取得方法: iOS・Android環境別々でスクレイピング');
    console.log('📊 分類方法: 取得環境に基づいて自動分類');
    console.log('🔄 無限スクロール対応: 全案件を自動取得');
    console.log('='.repeat(80));
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async setupPage(platform) {
    const page = await this.browser.newPage();
    
    // プラットフォーム別ビューポート設定
    if (platform === 'ios') {
      await page.setViewport({ 
        width: 375, 
        height: 812,
        isMobile: true,
        hasTouch: true
      });
      await page.setUserAgent(this.userAgents.ios);
    } else {
      await page.setViewport({ 
        width: 412, 
        height: 892,
        isMobile: true,
        hasTouch: true
      });
      await page.setUserAgent(this.userAgents.android);
    }
    
    return page;
  }

  createCampaignData(rawCampaign, platform) {
    return {
      id: `pi_app_${rawCampaign.id}_${platform}`,
      title: rawCampaign.title,
      url: rawCampaign.url,
      cashback: rawCampaign.cashback,
      device: platform === 'ios' ? 'iOS' : 'Android',
      originalTitle: rawCampaign.title,
      platform: platform,
      scrapedAt: new Date().toISOString()
    };
  }

  async scrapeInfiniteScrollForPlatform(platform) {
    const page = await this.setupPage(platform);
    let campaigns = [];
    let noChangeCount = 0;
    let lastCount = 0;
    
    try {
      console.log(`\n📱 ${platform.toUpperCase()}環境でスクレイピング開始...`);
      
      await page.goto(this.baseUrl, { 
        waitUntil: 'networkidle2',
        timeout: this.pageTimeoutMs 
      });
      
      await this.sleep(3000); // 初期読み込み待機
      
      // 無限スクロールでコンテンツを全て読み込む
      while (noChangeCount < 5) { // 5回連続で変化がなければ終了
        console.log(`    🔄 ${platform.toUpperCase()} スクロール実行中... (変化なし回数: ${noChangeCount}/5)`);
        
        // 現在の案件数を取得
        const currentCount = await page.evaluate(() => {
          return document.querySelectorAll('a[href*="/ad/"]').length;
        });
        
        console.log(`      📊 現在の案件リンク数: ${currentCount}件 (前回: ${lastCount}件)`);
        
        // ページの最下部までスクロール（段階的実行）
        await page.evaluate(() => {
          // 段階的にスクロール
          const scrollHeight = document.body.scrollHeight;
          const viewportHeight = window.innerHeight;
          const scrollSteps = 5;
          const stepSize = scrollHeight / scrollSteps;
          
          for (let i = 1; i <= scrollSteps; i++) {
            setTimeout(() => {
              window.scrollTo(0, stepSize * i);
            }, i * 200);
          }
          
          // 最終的に最下部へ
          setTimeout(() => {
            window.scrollTo(0, document.body.scrollHeight);
          }, scrollSteps * 200 + 500);
        });
        
        // スクロール後の読み込み待機
        await this.sleep(this.scrollPauseMs);
        
        // さらに最下部確認
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        await this.sleep(2000);
        
        // 新しいコンテンツがロードされたかチェック
        const newCount = await page.evaluate(() => {
          return document.querySelectorAll('a[href*="/ad/"]').length;
        });
        
        if (newCount > currentCount) {
          console.log(`      ✅ 新しいコンテンツが読み込まれました (+${newCount - currentCount}件)`);
          noChangeCount = 0; // リセット
        } else {
          console.log(`      ⚠️ 新しいコンテンツが読み込まれませんでした`);
          noChangeCount++;
        }
        
        lastCount = newCount;
        
        // 安全制限
        if (newCount > 1000) {
          console.log(`      🛑 安全のため終了します (${newCount}件取得)`);
          break;
        }
      }
      
      console.log(`    📋 ${platform.toUpperCase()} スクロール完了 - 全案件データを抽出中...`);
      
      // 全ての案件データを一括取得
      const allPageCampaigns = await page.evaluate(() => {
        const results = [];
        const seenIds = new Set(); // 重複チェック用
        
        // アプリ案件のリンクを探す
        const links = document.querySelectorAll('a[href*="/ad/"]');
        
        links.forEach(link => {
          const container = link.closest('li, div, article, tr');
          
          if (container) {
            const campaign = {
              url: link.href,
              title: '',
              cashback: '',
              id: ''
            };
            
            // ID抽出
            const urlMatch = link.href.match(/\/ad\/(\d+)\//);
            if (urlMatch) {
              campaign.id = urlMatch[1];
              
              // 重複チェック
              if (seenIds.has(campaign.id)) {
                return; // 重複の場合はスキップ
              }
              seenIds.add(campaign.id);
            }
            
            // タイトル取得
            const titleEl = container.querySelector('h3, h4, .title, .campaign-name') || link;
            campaign.title = titleEl.textContent.trim();
            
            // 還元率取得
            const text = container.textContent;
            
            // ポイント表記を優先
            const ptMatch = text.match(/(\d{1,3}(?:,\d{3})*)\s*pt/);
            if (ptMatch) {
              campaign.cashback = ptMatch[0];
            } else {
              // パーセント表記
              const percentMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
              if (percentMatch) {
                campaign.cashback = percentMatch[0];
              }
            }
            
            // 有効な案件のみ追加
            if (campaign.title && campaign.url && campaign.id) {
              results.push(campaign);
            }
          }
        });
        
        return results;
      });
      
      console.log(`    📊 ${platform.toUpperCase()}環境で取得した案件数: ${allPageCampaigns.length}件`);
      
      // プラットフォーム専用データに変換
      for (const rawCampaign of allPageCampaigns) {
        const campaignData = this.createCampaignData(rawCampaign, platform);
        campaigns.push(campaignData);
      }
      
      // サンプル表示
      if (campaigns.length > 0) {
        console.log(`    📋 ${platform.toUpperCase()}環境取得サンプル（最初の5件）:`);
        campaigns.slice(0, 5).forEach((campaign, i) => {
          console.log(`      ${i+1}. "${campaign.title}" - ${campaign.cashback}`);
        });
      }
      
    } finally {
      await page.close();
    }
    
    return campaigns;
  }

  async mergeAndDeduplicateResults() {
    console.log('\n🔄 iOS・Android結果のマージと重複処理...');
    
    const allCampaigns = [];
    const seenCampaigns = new Map(); // タイトルベースでの重複管理
    
    // iOS案件を処理
    for (const campaign of this.iosAppCampaigns) {
      const key = campaign.title.toLowerCase().trim();
      if (!seenCampaigns.has(key)) {
        seenCampaigns.set(key, []);
      }
      seenCampaigns.get(key).push(campaign);
    }
    
    // Android案件を処理
    for (const campaign of this.androidAppCampaigns) {
      const key = campaign.title.toLowerCase().trim();
      if (!seenCampaigns.has(key)) {
        seenCampaigns.set(key, []);
      }
      seenCampaigns.get(key).push(campaign);
    }
    
    // 重複分析と最終リスト作成
    for (const [title, campaigns] of seenCampaigns) {
      const iosCampaigns = campaigns.filter(c => c.device === 'iOS');
      const androidCampaigns = campaigns.filter(c => c.device === 'Android');
      
      if (iosCampaigns.length > 0 && androidCampaigns.length > 0) {
        // 両プラットフォームで発見 → 両方追加
        allCampaigns.push(...iosCampaigns);
        allCampaigns.push(...androidCampaigns);
      } else if (iosCampaigns.length > 0) {
        // iOS専用
        allCampaigns.push(...iosCampaigns);
      } else if (androidCampaigns.length > 0) {
        // Android専用
        allCampaigns.push(...androidCampaigns);
      }
    }
    
    console.log(`    📊 マージ結果:`);
    console.log(`      - iOS専用案件: ${this.iosAppCampaigns.length}件`);
    console.log(`      - Android専用案件: ${this.androidAppCampaigns.length}件`);
    console.log(`      - 最終案件数: ${allCampaigns.length}件`);
    console.log(`      - ユニーク案件数: ${seenCampaigns.size}件`);
    
    return allCampaigns;
  }

  async saveResults(campaigns) {
    // デバイス別統計
    const deviceStats = {
      iOS: campaigns.filter(c => c.device === 'iOS').length,
      Android: campaigns.filter(c => c.device === 'Android').length
    };
    
    const outputData = {
      siteName: 'ポイントインカム',
      scrapingType: 'dual-platform-app-campaigns',
      scrapedAt: new Date().toISOString(),
      sourceUrl: this.baseUrl,
      scrapingStrategy: {
        method: 'separate_ios_android_environments',
        classification: 'platform_based_automatic'
      },
      summary: {
        totalCampaigns: campaigns.length,
        deviceBreakdown: deviceStats,
        platformSpecificCounts: {
          iosEnvironmentFound: this.iosAppCampaigns.length,
          androidEnvironmentFound: this.androidAppCampaigns.length
        }
      },
      campaigns: campaigns
    };
    
    await fs.writeFile(this.outputFile, JSON.stringify(outputData, null, 2));
    
    console.log(`\n💾 結果保存: ${this.outputFile}`);
    console.log(`📊 最終統計:`);
    console.log(`  - 総アプリ案件: ${campaigns.length}件`);
    console.log(`  - iOS案件: ${deviceStats.iOS}件`);
    console.log(`  - Android案件: ${deviceStats.Android}件`);
    console.log(`  - iOS環境取得: ${this.iosAppCampaigns.length}件`);
    console.log(`  - Android環境取得: ${this.androidAppCampaigns.length}件`);
    
    return campaigns;
  }

  async run() {
    try {
      await this.init();
      
      // iOS環境でスクレイピング
      console.log('\n🍎 iOS環境でのスクレイピング開始...');
      this.iosAppCampaigns = await this.scrapeInfiniteScrollForPlatform('ios');
      
      await this.sleep(3000); // プラットフォーム間の待機
      
      // Android環境でスクレイピング
      console.log('\n🤖 Android環境でのスクレイピング開始...');
      this.androidAppCampaigns = await this.scrapeInfiniteScrollForPlatform('android');
      
      // 結果のマージと重複処理
      const finalCampaigns = await this.mergeAndDeduplicateResults();
      
      // 結果保存
      console.log('\n📊 データ処理中...');
      await this.saveResults(finalCampaigns);
      
      console.log('\n' + '='.repeat(80));
      console.log('🎉 ポイントインカム デュアルプラットフォーム アプリ案件スクレイピング完了！');
      console.log(`📱 取得案件数: ${finalCampaigns.length}件`);
      console.log(`📁 出力ファイル: ${this.outputFile}`);
      
      // サンプルデータ表示
      if (finalCampaigns.length > 0) {
        console.log('\n📋 取得例（最初の10件）:');
        finalCampaigns.slice(0, 10).forEach((campaign, i) => {
          console.log(`\n${i + 1}. ${campaign.title}`);
          console.log(`   URL: ${campaign.url}`);
          console.log(`   還元: ${campaign.cashback || '不明'}`);
          console.log(`   デバイス: ${campaign.device}`);
          console.log(`   取得環境: ${campaign.platform.toUpperCase()}`);
        });
        
        // 三國志 真戦の確認
        const shinsenCampaigns = finalCampaigns.filter(c => 
          c.title.includes('三國志') && c.title.includes('真戦')
        );
        
        if (shinsenCampaigns.length > 0) {
          console.log('\n🎯 三國志 真戦関連案件:');
          shinsenCampaigns.forEach(campaign => {
            console.log(`  ✅ ${campaign.title} (${campaign.device}) - ${campaign.cashback}`);
          });
        } else {
          console.log('\n⚠️ 三國志 真戦関連案件は見つかりませんでした');
        }
      }
      
    } catch (error) {
      console.error('❌ エラー:', error);
      throw error;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

// 実行
if (require.main === module) {
  (async () => {
    const scraper = new PointIncomeAppDualPlatformScraper();
    await scraper.run();
  })();
}

module.exports = PointIncomeAppDualPlatformScraper;