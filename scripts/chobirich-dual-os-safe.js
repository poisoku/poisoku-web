const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class ChobirichDualOSSafe {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.campaigns = new Map();
    this.browser = null;
    this.processedCount = 0;
    this.errorCount = 0;
    this.skipCount = 0;
    
    // 簡素化したUser-Agents
    this.iosUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
    this.androidUserAgent = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36';
  }

  async init() {
    console.log('🛡️ エラー対策版デュアルOSスクレイパー起動中...\n');
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    
    console.log('✅ ブラウザ初期化完了');
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

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

  identifyProblematicCampaigns() {
    const problems = [];
    
    this.campaigns.forEach((campaign, id) => {
      const issues = [];
      
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

  // 安全な単一環境スクレイピング
  async scrapeSafe(campaignId, userAgent, environment) {
    let page = null;
    
    try {
      page = await this.browser.newPage();
      
      // タイムアウト設定
      page.setDefaultTimeout(60000);
      page.setDefaultNavigationTimeout(60000);
      
      // User-Agent設定
      await page.setUserAgent(userAgent);
      await page.setViewport({ 
        width: environment === 'ios' ? 375 : 412, 
        height: environment === 'ios' ? 812 : 915, 
        isMobile: true 
      });
      
      const url = `${this.baseUrl}/ad_details/${campaignId}/`;
      
      // エラー無視設定
      page.on('requestfailed', () => {}); // リクエスト失敗を無視
      page.on('response', response => {
        if (response.status() >= 400) {
          console.log(`⚠️ HTTP ${response.status()} for ${campaignId}`);
        }
      });
      
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      // 待機（ランダム化）
      await this.delay(2000 + Math.random() * 3000);

      // 安全なデータ抽出
      const result = await page.evaluate((env) => {
        try {
          // エラーページチェック
          const pageText = document.body.textContent || '';
          const title = document.title || '';
          
          if (title.includes('403') || 
              pageText.includes('Forbidden') ||
              pageText.includes('アクセスが拒否') ||
              pageText.includes('エラー') ||
              pageText.includes('Error')) {
            return { success: false, error: '403_or_error' };
          }

          const data = {
            id: window.location.pathname.match(/\/ad_details\/(\d+)/)?.[1] || '',
            name: '',
            cashback: '',
            category: 'アプリ',
            url: window.location.href,
            os: env === 'ios' ? 'ios' : 'android',
            environment: env
          };

          // 案件名取得（簡潔版）
          const nameSelectors = ['h1.AdDetails__title', 'h1', '.title'];
          for (const selector of nameSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent && element.textContent.trim().length > 2) {
              data.name = element.textContent.trim();
              break;
            }
          }
          
          // title属性からのフォールバック
          if (!data.name || data.name.length < 3) {
            const titleText = document.title;
            if (titleText && !titleText.includes('ちょびリッチ') && titleText.length > 3) {
              data.name = titleText.split(/[|｜-]/)[0].trim();
            }
          }

          // 還元率取得（簡潔版）
          const ptElement = document.querySelector('.AdDetails__pt.ItemPtLarge');
          if (ptElement && ptElement.textContent) {
            const text = ptElement.textContent.trim();
            const match = text.match(/(\d+(?:,\d+)?(?:ちょび)?pt|\d+(?:\.\d+)?[%％])/i);
            if (match) {
              data.cashback = match[1].replace('％', '%');
            }
          }

          // OS固有要素の検出
          const hasIosElements = pageText.toLowerCase().includes('app store') || 
                                pageText.toLowerCase().includes('ios');
          const hasAndroidElements = pageText.toLowerCase().includes('google play') || 
                                   pageText.toLowerCase().includes('android');

          if (env === 'ios') {
            data.iosSpecific = hasIosElements;
          } else {
            data.androidSpecific = hasAndroidElements;
          }

          return { success: true, data };
          
        } catch (error) {
          return { success: false, error: error.message };
        }
      }, environment);

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

  // 簡素化されたデュアルOS判定
  async processSimpleDualOS(targetInfo) {
    const campaignId = targetInfo.id;
    
    console.log(`🔄 [${campaignId}] 簡素版デュアルOS処理開始`);
    
    // 短い間隔でiOS/Android両方試行
    const iosResult = await this.scrapeSafe(campaignId, this.iosUserAgent, 'ios');
    await this.delay(1000); // 短い間隔
    const androidResult = await this.scrapeSafe(campaignId, this.androidUserAgent, 'android');
    
    let finalData = null;
    let osType = 'unknown';
    let improvements = [];
    
    // 結果の評価（简单化）
    if (iosResult.success && androidResult.success) {
      const iosData = iosResult.data;
      const androidData = androidResult.data;
      
      // iOS/Android固有性判定
      if (iosData.iosSpecific && !androidData.androidSpecific) {
        osType = 'ios';
        finalData = iosData;
      } else if (!iosData.iosSpecific && androidData.androidSpecific) {
        osType = 'android';
        finalData = androidData;
      } else {
        osType = 'both'; // 両方で利用可能
        finalData = iosData; // iOS版を使用
        finalData.os = 'both';
      }
      
    } else if (iosResult.success) {
      finalData = iosResult.data;
      osType = 'ios';
    } else if (androidResult.success) {
      finalData = androidResult.data;
      osType = 'android';
    } else {
      // 両方失敗
      console.log(`❌ [${campaignId}] iOS/Android両方エラー`);
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

  async improveSafeDualOS() {
    await this.loadExistingData();
    
    const problems = this.identifyProblematicCampaigns();
    console.log(`🎯 改善対象: ${problems.length}件\n`);
    
    if (problems.length === 0) {
      console.log('改善が必要な案件はありません');
      return;
    }
    
    console.log(`=== 安全版デュアルOS改善開始 ===`);
    console.log(`対象: ${problems.length}件\n`);
    
    for (let i = 0; i < problems.length; i++) {
      const target = problems[i];
      
      console.log(`\n[${i + 1}/${problems.length}] 処理中: ${target.id}`);
      console.log(`  問題: ${target.issues.join(', ')}`);
      
      const result = await this.processSimpleDualOS(target);
      
      // エラーが続く場合のスキップ機能
      if (!result.success) {
        this.skipCount++;
        if (this.errorCount > 10 && this.errorCount > this.processedCount * 0.3) {
          console.log('\n⚠️ エラー率が高いため、10件ごとに長い休憩を取ります');
          await this.delay(10000);
        }
      }
      
      // 進捗保存（25件ごと）
      if ((i + 1) % 25 === 0) {
        await this.saveResults();
        console.log(`\n💾 [進捗保存] ${i + 1}/${problems.length}件完了\n`);
        await this.delay(5000); // 休憩
      }
      
      // アクセス間隔（ランダム化）
      await this.delay(1500 + Math.random() * 2000);
    }
    
    await this.saveResults();
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async saveResults() {
    const osBreakdown = { ios: 0, android: 0, both: 0, unknown: 0 };

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
      skip_count: this.skipCount,
      os_breakdown: osBreakdown,
      campaigns: Array.from(this.campaigns.values())
    };

    await fs.writeFile(
      'chobirich_dual_os_safe_data.json',
      JSON.stringify(data, null, 2),
      'utf8'
    );
    
    console.log(`💾 [保存] ${this.campaigns.size}件保存 (処理:${this.processedCount}, エラー:${this.errorCount}, スキップ:${this.skipCount})`);
  }

  showFinalStats() {
    const osBreakdown = { ios: 0, android: 0, both: 0, unknown: 0 };
    let withValidName = 0, withCashback = 0;

    this.campaigns.forEach(campaign => {
      if (campaign.os && osBreakdown.hasOwnProperty(campaign.os)) {
        osBreakdown[campaign.os]++;
      } else {
        osBreakdown.unknown++;
      }

      if (campaign.name && campaign.name.length > 2) withValidName++;
      if (campaign.cashback && campaign.cashback !== 'なし') withCashback++;
    });

    console.log('\n=== 安全版デュアルOS改善結果 ===');
    console.log(`総案件数: ${this.campaigns.size}`);
    console.log(`処理成功: ${this.processedCount}`);
    console.log(`エラー数: ${this.errorCount}`);
    console.log(`スキップ数: ${this.skipCount}`);
    console.log(`成功率: ${this.processedCount > 0 ? ((this.processedCount / (this.processedCount + this.errorCount)) * 100).toFixed(1) : 0}%`);
    console.log('\n--- OS別内訳 ---');
    console.log(`📱 iOS専用: ${osBreakdown.ios}件`);
    console.log(`🤖 Android専用: ${osBreakdown.android}件`);
    console.log(`🔄 両OS対応: ${osBreakdown.both}件`);
    console.log(`❓ 不明: ${osBreakdown.unknown}件`);
  }
}

// メイン実行
async function main() {
  const scraper = new ChobirichDualOSSafe();
  
  try {
    await scraper.init();
    await scraper.improveSafeDualOS();
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