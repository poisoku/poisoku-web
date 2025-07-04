const puppeteer = require('puppeteer');
const fs = require('fs').promises;

// 本格版：テスト版ベースで全件処理
class ChobirichProduction {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.campaigns = new Map();
    this.browser = null;
    this.processedCount = 0;
    this.errorCount = 0;
    
    // テスト版で成功した設定
    this.delay = 20000; // 20秒間隔
    this.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
  }

  async init() {
    console.log('🚀 本格版スクレイパー起動中...\n');
    console.log('⏱️ 推定実行時間: 約2-3時間（396件）\n');
    
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
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
      const data = JSON.parse(await fs.readFile('chobirich_android_ios_apps_data.json', 'utf8'));
      
      // 問題のある案件を特定
      const problematic = data.campaigns.filter(c => 
        !c.os || c.os === 'unknown' || !c.name || c.name.length < 3
      );
      
      console.log(`📋 改善対象: ${problematic.length}件`);
      return problematic;
      
    } catch (error) {
      console.error('❌ データ読み込みエラー:', error.message);
      throw error;
    }
  }

  async improveData(campaignId) {
    let page = null;
    
    try {
      page = await this.browser.newPage();
      await page.setUserAgent(this.userAgent);
      await page.setViewport({ width: 375, height: 812, isMobile: true });
      
      const url = `${this.baseUrl}/ad_details/${campaignId}/`;
      
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      // 3秒待機
      await new Promise(resolve => setTimeout(resolve, 3000));

      const result = await page.evaluate(() => {
        try {
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
          
          // 案件名取得（テスト版と同じ）
          const titleSelectors = ['.AdDetails__title', 'h1.AdDetails__title'];
          
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
          
          // 還元率取得
          const ptElement = document.querySelector('.AdDetails__pt.ItemPtLarge');
          if (ptElement) {
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
            data.os = 'ios'; // デフォルト（アプリの多くがiOS）
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
        } catch (e) {}
      }
    }
  }

  async run() {
    await this.init();
    
    const campaigns = await this.loadExistingData();
    
    console.log(`\n=== 本格版データ改善開始 ===`);
    console.log(`対象: ${campaigns.length}件\n`);
    
    const improvedData = [];
    
    for (let i = 0; i < campaigns.length; i++) {
      const campaign = campaigns[i];
      
      console.log(`\n[${i + 1}/${campaigns.length}] 処理中: ${campaign.id}`);
      
      const result = await this.improveData(campaign.id);
      
      if (result.success) {
        const data = result.data;
        console.log(`✅ [${campaign.id}] 成功: "${data.name}" [${data.os}] ${data.cashback || 'なし'}`);
        improvedData.push(data);
        this.processedCount++;
      } else {
        console.log(`❌ [${campaign.id}] エラー: ${result.error}`);
        this.errorCount++;
        
        if (result.error === 'blocked') {
          console.log('🚫 ブロックされた可能性 - 長時間待機');
          await new Promise(resolve => setTimeout(resolve, 60000)); // 1分待機
        }
      }
      
      // 進捗保存（50件ごと）
      if ((i + 1) % 50 === 0) {
        await this.saveResults(improvedData);
        console.log(`\n💾 [進捗保存] ${i + 1}/${campaigns.length}件完了\n`);
      }
      
      // 最後の処理でなければ待機
      if (i < campaigns.length - 1) {
        console.log(`⏸️ 20秒待機中...`);
        await new Promise(resolve => setTimeout(resolve, this.delay));
      }
    }
    
    await this.saveResults(improvedData);
    
    console.log('\n=== 改善結果 ===');
    console.log(`処理成功: ${this.processedCount}件`);
    console.log(`エラー数: ${this.errorCount}件`);
    console.log(`成功率: ${this.processedCount > 0 ? ((this.processedCount / (this.processedCount + this.errorCount)) * 100).toFixed(1) : 0}%`);
  }

  async saveResults(improvedData) {
    const osBreakdown = { ios: 0, android: 0, both: 0, unknown: 0 };

    improvedData.forEach(campaign => {
      if (campaign.os && osBreakdown.hasOwnProperty(campaign.os)) {
        osBreakdown[campaign.os]++;
      } else {
        osBreakdown.unknown++;
      }
    });

    const data = {
      scraped_at: new Date().toISOString(),
      total_campaigns: improvedData.length,
      processed_count: this.processedCount,
      error_count: this.errorCount,
      os_breakdown: osBreakdown,
      campaigns: improvedData
    };

    await fs.writeFile(
      'chobirich_production_improved.json',
      JSON.stringify(data, null, 2),
      'utf8'
    );
    
    console.log(`💾 [保存] ${improvedData.length}件保存`);
  }
}

// 実行
async function main() {
  const scraper = new ChobirichProduction();
  
  try {
    await scraper.run();
    console.log('\n🎉 完了！');
  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await scraper.close();
  }
}

main().catch(console.error);