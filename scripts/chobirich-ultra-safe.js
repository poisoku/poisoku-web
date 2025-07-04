const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class ChobirichUltraSafe {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.campaigns = new Map();
    this.browser = null;
    this.processedCount = 0;
    this.errorCount = 0;
    this.rate429Count = 0;
    
    // 最適化された設定
    this.minDelay = 15000; // 最小15秒間隔
    this.maxDelay = 25000; // 最大25秒間隔
    this.rate429Delay = 120000; // 429エラー時は2分待機
    this.maxConsecutiveErrors = 3; // 連続エラー3回で一時停止
    
    this.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
  }

  async init() {
    console.log('🐌 超安全版スクレイパー起動中...\n');
    console.log('⚠️ 注意: レート制限回避のため、非常にゆっくり実行されます');
    console.log('⏱️ 推定実行時間: 約3-4時間（396件）\n');
    
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

  // 超安全なスクレイピング（単一環境のみ）
  async scrapeUltraSafe(campaignId) {
    let page = null;
    let consecutiveErrors = 0;
    
    while (consecutiveErrors < this.maxConsecutiveErrors) {
      try {
        page = await this.browser.newPage();
        
        // 超タイムアウト設定
        page.setDefaultTimeout(120000); // 2分
        page.setDefaultNavigationTimeout(120000);
        
        await page.setUserAgent(this.userAgent);
        await page.setViewport({ width: 375, height: 812, isMobile: true });
        
        const url = `${this.baseUrl}/ad_details/${campaignId}/`;
        
        // レスポンス監視
        let has429 = false;
        page.on('response', response => {
          if (response.status() === 429) {
            has429 = true;
            console.log(`⚠️ [${campaignId}] 429 Rate Limit detected`);
          }
        });
        
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 120000
        });

        // 429エラーチェック
        if (has429) {
          console.log(`🛑 [${campaignId}] Rate limit - 1分待機中...`);
          await this.delay(this.rate429Delay);
          this.rate429Count++;
          
          if (page) {
            await page.close();
            page = null;
          }
          
          consecutiveErrors++;
          continue; // リトライ
        }

        // 通常待機（延長）
        await this.delay(5000);

        // 軽量データ抽出
        const result = await page.evaluate(() => {
          try {
            // エラーページチェック（テスト版と同じ）
            const title = document.title || '';
            const pageText = document.body.textContent || '';
            
            if (title.includes('403') || title.includes('Forbidden')) {
              return { success: false, error: 'blocked' };
            }
            
            if (pageText.includes('Forbidden') || pageText.includes('アクセスが拒否')) {
              return { success: false, error: 'blocked' };
            }

            const data = {
              id: window.location.pathname.match(/\/ad_details\/(\d+)/)?.[1] || '',
              name: '',
              cashback: '',
              os: 'unknown'
            };

            // タイトル取得（正しいセレクタ）
            const titleSelectors = [
              '.AdDetails__title',
              'h1.AdDetails__title'
            ];
            
            let foundTitle = false;
            for (const selector of titleSelectors) {
              const element = document.querySelector(selector);
              if (element && element.textContent && element.textContent.trim()) {
                data.name = element.textContent.trim();
                foundTitle = true;
                break;
              }
            }
            
            // document.titleからのフォールバック
            if (!foundTitle) {
              const docTitle = document.title;
              if (docTitle && 
                  !docTitle.includes('ちょびリッチ') && 
                  !docTitle.includes('403') &&
                  !docTitle.includes('Error')) {
                data.name = docTitle.split(/[|｜-]/)[0].trim();
              }
            }
            
            const ptElement = document.querySelector('.AdDetails__pt.ItemPtLarge');
            if (ptElement && ptElement.textContent) {
              const text = ptElement.textContent.trim();
              const match = text.match(/(\d+(?:,\d+)?(?:ちょび)?pt|\d+(?:\.\d+)?[%％])/i);
              if (match) {
                data.cashback = match[1].replace('％', '%');
              }
            }

            // 簡易OS判定
            const hasIosElements = pageText.toLowerCase().includes('app store') || 
                                  pageText.toLowerCase().includes('ios') ||
                                  data.name.includes('iOS');
            const hasAndroidElements = pageText.toLowerCase().includes('google play') || 
                                     pageText.toLowerCase().includes('android') ||
                                     data.name.includes('Android');

            if (hasIosElements && hasAndroidElements) {
              data.os = 'both';
            } else if (hasIosElements) {
              data.os = 'ios';
            } else if (hasAndroidElements) {
              data.os = 'android';
            } else {
              // 特別な場合の判定
              if (data.name.includes('多段階')) {
                data.os = 'both';
              } else {
                data.os = 'ios'; // デフォルト（アプリの多くがiOS）
              }
            }

            return { success: true, data };
            
          } catch (error) {
            return { success: false, error: error.message };
          }
        });

        if (page) {
          await page.close();
          page = null;
        }

        return result;

      } catch (error) {
        console.log(`⚠️ [${campaignId}] エラー ${consecutiveErrors + 1}回目: ${error.message}`);
        
        if (page) {
          try {
            await page.close();
          } catch (e) {}
          page = null;
        }
        
        consecutiveErrors++;
        
        if (consecutiveErrors < this.maxConsecutiveErrors) {
          const waitTime = consecutiveErrors * 30000; // 30秒, 60秒, 90秒...
          console.log(`⏸️ [${campaignId}] ${waitTime/1000}秒待機してリトライ...`);
          await this.delay(waitTime);
        }
      }
    }
    
    return { success: false, error: 'max_retries_exceeded' };
  }

  async processUltraSafe(targetInfo) {
    const campaignId = targetInfo.id;
    
    console.log(`🐌 [${campaignId}] 超安全処理開始`);
    
    const result = await this.scrapeUltraSafe(campaignId);
    
    if (!result.success) {
      console.log(`❌ [${campaignId}] 処理失敗: ${result.error}`);
      this.errorCount++;
      return { success: false };
    }
    
    const finalData = result.data;
    const oldCampaign = targetInfo.current;
    let improvements = [];
    
    if (finalData.name && finalData.name.length > 2 && (!oldCampaign.name || oldCampaign.name.length < 3)) {
      improvements.push('名前改善');
    }
    
    if (finalData.cashback && finalData.cashback !== 'なし' && (!oldCampaign.cashback || oldCampaign.cashback === 'なし')) {
      improvements.push('還元率改善');
    }
    
    if (finalData.os !== 'unknown' && (!oldCampaign.os || oldCampaign.os === 'unknown')) {
      improvements.push('OS判定改善');
    }
    
    // データを更新
    this.campaigns.set(campaignId, finalData);
    this.processedCount++;
    
    if (improvements.length > 0) {
      console.log(`✅ ${campaignId}: ${improvements.join(', ')} - "${finalData.name}" [${finalData.os}] ${finalData.cashback}`);
    } else {
      console.log(`📋 ${campaignId}: 変更なし - "${finalData.name}" [${finalData.os}] ${finalData.cashback}`);
    }
    
    return { success: true, improvements };
  }

  async improveUltraSafe() {
    await this.loadExistingData();
    
    const problems = this.identifyProblematicCampaigns();
    console.log(`🎯 改善対象: ${problems.length}件\n`);
    
    if (problems.length === 0) {
      console.log('改善が必要な案件はありません');
      return;
    }
    
    console.log(`=== 超安全版OS改善開始 ===`);
    console.log(`対象: ${problems.length}件\n`);
    
    const startTime = Date.now();
    
    for (let i = 0; i < problems.length; i++) {
      const target = problems[i];
      
      console.log(`\n[${i + 1}/${problems.length}] 処理中: ${target.id}`);
      console.log(`  問題: ${target.issues.join(', ')}`);
      
      await this.processUltraSafe(target);
      
      // 進捗報告
      if ((i + 1) % 10 === 0) {
        const elapsed = Date.now() - startTime;
        const avgTime = elapsed / (i + 1);
        const remainingTime = ((problems.length - i - 1) * avgTime) / 1000 / 60;
        
        console.log(`\n📊 進捗: ${i + 1}/${problems.length} (${(((i + 1) / problems.length) * 100).toFixed(1)}%)`);
        console.log(`⏱️ 残り時間: 約${remainingTime.toFixed(0)}分`);
        console.log(`📈 成功率: ${this.processedCount > 0 ? ((this.processedCount / (this.processedCount + this.errorCount)) * 100).toFixed(1) : 0}%`);
        console.log(`🚫 429エラー: ${this.rate429Count}回\n`);
        
        await this.saveResults();
      }
      
      // 超長い待機時間（レート制限回避）
      const waitTime = this.minDelay + Math.random() * (this.maxDelay - this.minDelay);
      console.log(`⏸️ ${(waitTime/1000).toFixed(1)}秒待機...`);
      await this.delay(waitTime);
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
      rate429_count: this.rate429Count,
      os_breakdown: osBreakdown,
      campaigns: Array.from(this.campaigns.values())
    };

    await fs.writeFile(
      'chobirich_ultra_safe_data.json',
      JSON.stringify(data, null, 2),
      'utf8'
    );
    
    console.log(`💾 [保存] ${this.campaigns.size}件保存 (成功:${this.processedCount}, エラー:${this.errorCount}, 429:${this.rate429Count})`);
  }

  showFinalStats() {
    const osBreakdown = { ios: 0, android: 0, both: 0, unknown: 0 };

    this.campaigns.forEach(campaign => {
      if (campaign.os && osBreakdown.hasOwnProperty(campaign.os)) {
        osBreakdown[campaign.os]++;
      } else {
        osBreakdown.unknown++;
      }
    });

    console.log('\n=== 超安全版改善結果 ===');
    console.log(`総案件数: ${this.campaigns.size}`);
    console.log(`処理成功: ${this.processedCount}`);
    console.log(`エラー数: ${this.errorCount}`);
    console.log(`429エラー: ${this.rate429Count}`);
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
  const scraper = new ChobirichUltraSafe();
  
  try {
    await scraper.init();
    await scraper.improveUltraSafe();
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