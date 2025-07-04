const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class ChobirichDualOSScraper {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.campaigns = new Map();
    this.browser = null;
    this.processedCount = 0;
    this.errorCount = 0;
    
    // iOS User-Agents
    this.iosUserAgents = [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 15_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.5 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
    ];
    
    // Android User-Agents
    this.androidUserAgents = [
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
      'Mozilla/5.0 (Linux; Android 12; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36',
      'Mozilla/5.0 (Linux; Android 11; OnePlus 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36'
    ];
  }

  async init() {
    console.log('🚀 デュアルOS品質改善スクレイパー起動中...\n');
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run'
      ]
    });
    
    console.log('✅ ブラウザ初期化完了');
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  // 既存データを読み込み
  async loadExistingData() {
    try {
      const detailData = JSON.parse(await fs.readFile('chobirich_android_ios_apps_data.json', 'utf8'));
      detailData.campaigns.forEach(campaign => {
        this.campaigns.set(campaign.id, campaign);
      });
      console.log(`📂 既存データ読み込み: ${this.campaigns.size}件`);
      
      const idData = JSON.parse(await fs.readFile('chobirich_all_ids.json', 'utf8'));
      this.allCampaignIds = new Map(idData.campaigns.map(c => [c.id, c]));
      console.log(`📋 IDリスト読み込み: ${this.allCampaignIds.size}件`);
      
    } catch (error) {
      console.log('❌ データ読み込みエラー:', error.message);
      throw error;
    }
  }

  // 問題のある案件を特定
  identifyProblematicCampaigns() {
    const problems = [];
    
    this.campaigns.forEach((campaign, id) => {
      const issues = [];
      
      // OS判定が不十分、または案件名・還元率に問題がある案件を対象
      if (!campaign.os || campaign.os === 'unknown') {
        issues.push('unknown_os');
      }
      
      if (!campaign.name || campaign.name.trim() === '' || campaign.name.length < 3) {
        issues.push('empty_name');
      }
      
      if (!campaign.cashback || campaign.cashback === 'なし') {
        issues.push('no_cashback');
      }
      
      if (issues.length > 0) {
        const originalInfo = this.allCampaignIds.get(id);
        problems.push({
          id: id,
          issues: issues,
          current: campaign,
          original: originalInfo
        });
      }
    });
    
    return problems;
  }

  // iOS環境でスクレイピング（エラー対策強化版）
  async scrapeWithIOS(campaignId) {
    let page = null;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        page = await this.browser.newPage();
        
        // リクエストヘッダー設定
        await page.setExtraHTTPHeaders({
          'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        });
        
        // iOS User-Agent設定
        const userAgent = this.iosUserAgents[Math.floor(Math.random() * this.iosUserAgents.length)];
        await page.setUserAgent(userAgent);
        await page.setViewport({ width: 375, height: 812, isMobile: true });
        
        const url = `${this.baseUrl}/ad_details/${campaignId}/`;
        
        // タイムアウト延長とエラーハンドリング
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 45000
        });

        // より長い待機時間
        await this.delay(3000 + Math.random() * 2000);

        // iOS環境でのデータ抽出
        const result = await page.evaluate(() => {
          try {
            // 403/エラーチェック
            const is403 = document.title.includes('403') || 
                         document.body.textContent.includes('Forbidden') ||
                         document.body.textContent.includes('アクセスが拒否されました') ||
                         document.body.textContent.includes('Error') ||
                         document.querySelector('.error') !== null;
            
            if (is403) {
              return { success: false, error: '403' };
            }

          const data = {
            id: window.location.pathname.match(/\/ad_details\/(\d+)/)?.[1] || '',
            name: '',
            cashback: '',
            category: 'アプリ',
            url: window.location.href,
            os: 'ios', // iOS環境で取得
            environment: 'ios'
          };

          // 案件名取得
          const titleSelectors = [
            'h1.AdDetails__title',
            'h1',
            'title'
          ];
          
          for (const selector of titleSelectors) {
            try {
              if (selector === 'title') {
                const titleText = document.title;
                if (titleText && !titleText.includes('403') && !titleText.includes('ちょびリッチ')) {
                  data.name = titleText.split(/[|｜-]/)[0].trim();
                  break;
                }
              } else {
                const element = document.querySelector(selector);
                if (element) {
                  const text = element.textContent.trim();
                  if (text && text.length > 2 && !text.includes('ちょびリッチ') && !text.includes('403')) {
                    data.name = text;
                    break;
                  }
                }
              }
            } catch (e) {
              // エラーは無視
            }
          }

          // 還元率取得
          try {
            const ptElement = document.querySelector('.AdDetails__pt.ItemPtLarge');
            if (ptElement) {
              const text = ptElement.textContent.trim().replace(/\s+/g, ' ');
              
              const patterns = [
                /(\d+(?:,\d+)?(?:ちょび)?pt)/i,
                /(\d+(?:\.\d+)?[%％])/i,
                /(\d+(?:,\d+)?)ポイント/i
              ];
              
              for (const pattern of patterns) {
                const match = text.match(pattern);
                if (match) {
                  data.cashback = match[1].replace('％', '%').replace('ポイント', 'pt');
                  break;
                }
              }
            }
          } catch (e) {
            // エラーは無視
          }

          // iOS固有要素の検出
          const pageText = document.body.textContent.toLowerCase();
          if (pageText.includes('app store') || 
              pageText.includes('ios') || 
              pageText.includes('iphone') || 
              pageText.includes('ipad')) {
            data.iosSpecific = true;
          }

          return { success: true, data };
          
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      return result;

    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (e) {
          // ページクローズエラーは無視
        }
      }
    }
  }

  // Android環境でスクレイピング
  async scrapeWithAndroid(campaignId) {
    let page = null;
    
    try {
      page = await this.browser.newPage();
      
      // Android User-Agent設定
      const userAgent = this.androidUserAgents[Math.floor(Math.random() * this.androidUserAgents.length)];
      await page.setUserAgent(userAgent);
      await page.setViewport({ width: 412, height: 915, isMobile: true });
      
      const url = `${this.baseUrl}/ad_details/${campaignId}/`;
      
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      await this.delay(2000);

      // Android環境でのデータ抽出
      const result = await page.evaluate(() => {
        try {
          // 403チェック
          const is403 = document.title.includes('403') || 
                       document.body.textContent.includes('Forbidden');
          
          if (is403) {
            return { success: false, error: '403' };
          }

          const data = {
            id: window.location.pathname.match(/\/ad_details\/(\d+)/)?.[1] || '',
            name: '',
            cashback: '',
            category: 'アプリ',
            url: window.location.href,
            os: 'android', // Android環境で取得
            environment: 'android'
          };

          // 案件名取得（iOS版と同じロジック）
          const titleSelectors = [
            'h1.AdDetails__title',
            'h1',
            'title'
          ];
          
          for (const selector of titleSelectors) {
            try {
              if (selector === 'title') {
                const titleText = document.title;
                if (titleText && !titleText.includes('403') && !titleText.includes('ちょびリッチ')) {
                  data.name = titleText.split(/[|｜-]/)[0].trim();
                  break;
                }
              } else {
                const element = document.querySelector(selector);
                if (element) {
                  const text = element.textContent.trim();
                  if (text && text.length > 2 && !text.includes('ちょびリッチ') && !text.includes('403')) {
                    data.name = text;
                    break;
                  }
                }
              }
            } catch (e) {
              // エラーは無視
            }
          }

          // 還元率取得
          try {
            const ptElement = document.querySelector('.AdDetails__pt.ItemPtLarge');
            if (ptElement) {
              const text = ptElement.textContent.trim().replace(/\s+/g, ' ');
              
              const patterns = [
                /(\d+(?:,\d+)?(?:ちょび)?pt)/i,
                /(\d+(?:\.\d+)?[%％])/i,
                /(\d+(?:,\d+)?)ポイント/i
              ];
              
              for (const pattern of patterns) {
                const match = text.match(pattern);
                if (match) {
                  data.cashback = match[1].replace('％', '%').replace('ポイント', 'pt');
                  break;
                }
              }
            }
          } catch (e) {
            // エラーは無視
          }

          // Android固有要素の検出
          const pageText = document.body.textContent.toLowerCase();
          if (pageText.includes('google play') || 
              pageText.includes('android') || 
              pageText.includes('アンドロイド')) {
            data.androidSpecific = true;
          }

          return { success: true, data };
          
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      return result;

    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (e) {
          // ページクローズエラーは無視
        }
      }
    }
  }

  // デュアルOS スクレイピング（iOS + Android）
  async scrapeDualOS(targetInfo) {
    const campaignId = targetInfo.id;
    
    console.log(`🔄 [${campaignId}] iOS/Android両環境でスクレイピング開始`);
    
    // iOS環境でスクレイピング
    const iosResult = await this.scrapeWithIOS(campaignId);
    await this.delay(1000);
    
    // Android環境でスクレイピング
    const androidResult = await this.scrapeWithAndroid(campaignId);
    
    // 結果を統合
    let finalData = null;
    let osType = 'unknown';
    let improvements = [];
    
    if (iosResult.success && androidResult.success) {
      const iosData = iosResult.data;
      const androidData = androidResult.data;
      
      // iOS/Android両方で取得できた場合の判定
      if (iosData.iosSpecific && androidData.androidSpecific) {
        osType = 'both';
        finalData = iosData; // iOS版をベースに使用
        finalData.os = 'both';
      } else if (iosData.iosSpecific && !androidData.androidSpecific) {
        osType = 'ios';
        finalData = iosData;
      } else if (!iosData.iosSpecific && androidData.androidSpecific) {
        osType = 'android';
        finalData = androidData;
      } else {
        // どちらも固有要素なし → 一般的な案件として扱う
        osType = 'both';
        finalData = iosData; // iOS版をベースに使用
        finalData.os = 'both';
      }
      
      console.log(`✅ [${campaignId}] 判定結果: ${osType}`);
      
    } else if (iosResult.success) {
      finalData = iosResult.data;
      finalData.os = 'ios';
      osType = 'ios';
      console.log(`📱 [${campaignId}] iOS版のみ取得成功`);
      
    } else if (androidResult.success) {
      finalData = androidResult.data;
      finalData.os = 'android';
      osType = 'android';
      console.log(`🤖 [${campaignId}] Android版のみ取得成功`);
      
    } else {
      console.log(`❌ [${campaignId}] iOS/Android両方でエラー`);
      this.errorCount++;
      return { success: false };
    }
    
    // 既存データとの比較
    const oldCampaign = targetInfo.current;
    
    if (finalData.name && finalData.name.length > 2 && (!oldCampaign.name || oldCampaign.name.length < 3)) {
      improvements.push('名前改善');
    }
    
    if (finalData.cashback && finalData.cashback !== 'なし' && (!oldCampaign.cashback || oldCampaign.cashback === 'なし')) {
      improvements.push('還元率改善');
    }
    
    if (osType !== 'unknown' && (!oldCampaign.os || oldCampaign.os === 'unknown')) {
      improvements.push('OS判定改善');
    }
    
    // データを更新
    this.campaigns.set(campaignId, finalData);
    this.processedCount++;
    
    if (improvements.length > 0) {
      console.log(`✅ ${campaignId}: ${improvements.join(', ')} - "${finalData.name}" [${osType}] ${finalData.cashback}`);
    } else {
      console.log(`📋 ${campaignId}: 変更なし - "${finalData.name}" [${osType}] ${finalData.cashback}`);
    }
    
    return { success: true, improvements, osType };
  }

  // メイン処理
  async improveDualOSData() {
    await this.loadExistingData();
    
    const problems = this.identifyProblematicCampaigns();
    console.log(`🎯 改善対象: ${problems.length}件\n`);
    
    if (problems.length === 0) {
      console.log('改善が必要な案件はありません');
      return;
    }
    
    console.log(`=== デュアルOS品質改善開始 ===`);
    console.log(`対象: ${problems.length}件\n`);
    
    for (let i = 0; i < problems.length; i++) {
      const target = problems[i];
      
      console.log(`\n[${i + 1}/${problems.length}] 処理中: ${target.id}`);
      console.log(`  問題: ${target.issues.join(', ')}`);
      
      await this.scrapeDualOS(target);
      
      // 進捗保存（20件ごと）
      if ((i + 1) % 20 === 0) {
        await this.saveResults();
        console.log(`\n💾 [進捗保存] ${i + 1}/${problems.length}件完了\n`);
        await this.delay(5000); // 休憩
      }
      
      // アクセス間隔
      await this.delay(3000);
    }
    
    await this.saveResults();
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async saveResults() {
    const osBreakdown = {
      ios: 0,
      android: 0,
      both: 0,
      unknown: 0
    };

    this.campaigns.forEach(campaign => {
      if (campaign.os && osBreakdown.hasOwnProperty(campaign.os)) {
        osBreakdown[campaign.os]++;
      } else {
        osBreakdown.unknown++;
      }
    });

    const data = {
      scraped_at: new Date().toISOString(),
      total_campaigns: this.campaigns.size,
      processed_count: this.processedCount,
      error_count: this.errorCount,
      os_breakdown: osBreakdown,
      campaigns: Array.from(this.campaigns.values())
    };

    await fs.writeFile(
      'chobirich_dual_os_improved_data.json',
      JSON.stringify(data, null, 2),
      'utf8'
    );
    
    console.log(`💾 [保存] ${this.campaigns.size}件保存 (処理:${this.processedCount}, エラー:${this.errorCount})`);
  }

  showFinalStats() {
    const osBreakdown = {
      ios: 0,
      android: 0,
      both: 0,
      unknown: 0
    };

    let withValidName = 0;
    let withCashback = 0;

    this.campaigns.forEach(campaign => {
      if (campaign.os && osBreakdown.hasOwnProperty(campaign.os)) {
        osBreakdown[campaign.os]++;
      } else {
        osBreakdown.unknown++;
      }

      if (campaign.name && campaign.name.length > 2) withValidName++;
      if (campaign.cashback && campaign.cashback !== 'なし') withCashback++;
    });

    console.log('\n=== デュアルOS品質改善結果 ===');
    console.log(`総案件数: ${this.campaigns.size}`);
    console.log(`処理案件数: ${this.processedCount}`);
    console.log(`エラー数: ${this.errorCount}`);
    console.log(`成功率: ${this.processedCount > 0 ? ((this.processedCount - this.errorCount) / this.processedCount * 100).toFixed(1) : 0}%`);
    console.log('\n--- OS別内訳 ---');
    console.log(`📱 iOS専用: ${osBreakdown.ios}件`);
    console.log(`🤖 Android専用: ${osBreakdown.android}件`);
    console.log(`🔄 両OS対応: ${osBreakdown.both}件`);
    console.log(`❓ 不明: ${osBreakdown.unknown}件`);
    console.log('\n--- データ品質 ---');
    console.log(`有効な案件名: ${withValidName}件 (${(withValidName/this.campaigns.size*100).toFixed(1)}%)`);
    console.log(`還元率あり: ${withCashback}件 (${(withCashback/this.campaigns.size*100).toFixed(1)}%)`);
  }
}

// メイン実行
async function main() {
  const scraper = new ChobirichDualOSScraper();
  
  try {
    await scraper.init();
    await scraper.improveDualOSData();
    scraper.showFinalStats();
    
  } catch (error) {
    console.error('❌ エラー:', error);
    await scraper.saveResults();
  } finally {
    await scraper.close();
    console.log('\n🎉 完了！');
  }
}

main().catch(console.error);