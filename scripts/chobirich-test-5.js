const puppeteer = require('puppeteer');
const fs = require('fs').promises;

// 5件限定のテスト版
class ChobirichTest5 {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.campaigns = new Map();
    this.browser = null;
    this.processedCount = 0;
    this.errorCount = 0;
    
    // 人間らしいアクセス設定
    this.delay = 45000; // 45秒間隔
    this.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
  }

  async init() {
    console.log('🧪 5件限定テスト版起動中...\n');
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    console.log('✅ ブラウザ初期化完了');
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async loadTestData() {
    try {
      const data = JSON.parse(await fs.readFile('chobirich_android_ios_apps_data.json', 'utf8'));
      
      // 問題のある案件から5件だけ選択
      const problematic = data.campaigns.filter(c => 
        !c.os || c.os === 'unknown' || !c.name || c.name.length < 3
      ).slice(0, 5);
      
      console.log(`📋 テスト対象: ${problematic.length}件`);
      return problematic;
      
    } catch (error) {
      console.error('❌ データ読み込みエラー:', error.message);
      throw error;
    }
  }

  async testScrape(campaignId) {
    let page = null;
    
    try {
      console.log(`🔍 [${campaignId}] テスト開始`);
      
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
          
          if (title.includes('403') || 
              pageText.includes('Forbidden') ||
              pageText.includes('アクセスが拒否')) {
            return { success: false, error: 'blocked' };
          }
          
          const data = {
            id: window.location.pathname.match(/\/ad_details\/(\d+)/)?.[1] || '',
            name: '',
            cashback: '',
            status: 'accessible'
          };
          
          // 詳細な情報取得（正しいセレクタ）
          const titleSelectors = [
            '.AdDetails__title',
            'h1.AdDetails__title'
          ];
          
          let foundTitle = false;
          for (const selector of titleSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
              data.name = element.textContent.trim();
              data.titleSelector = selector;
              foundTitle = true;
              break;
            }
          }
          
          // titleタグからもフォールバック
          if (!foundTitle) {
            const docTitle = document.title;
            if (docTitle && !docTitle.includes('ちょびリッチ') && !docTitle.includes('403')) {
              data.name = docTitle.split(/[|｜-]/)[0].trim();
              data.titleSelector = 'document.title';
            }
          }
          
          const ptElement = document.querySelector('.AdDetails__pt.ItemPtLarge');
          if (ptElement) {
            const text = ptElement.textContent.trim();
            const match = text.match(/(\d+(?:,\d+)?(?:ちょび)?pt|\d+(?:\.\d+)?[%％])/i);
            if (match) {
              data.cashback = match[1].replace('％', '%');
            }
          }
          
          // デバッグ情報を追加
          data.debug = {
            documentTitle: document.title,
            h1Count: document.querySelectorAll('h1').length,
            ptElementExists: !!ptElement
          };
          
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

  async runTest() {
    await this.init();
    
    const testCampaigns = await this.loadTestData();
    
    console.log(`\n=== 5件限定アクセステスト開始 ===`);
    console.log(`⏱️ 推定時間: 約4分（45秒間隔）\n`);
    
    for (let i = 0; i < testCampaigns.length; i++) {
      const campaign = testCampaigns[i];
      
      console.log(`\n[${i + 1}/5] 処理中: ${campaign.id}`);
      
      const result = await this.testScrape(campaign.id);
      
      if (result.success) {
        console.log(`✅ [${campaign.id}] 成功: "${result.data.name}" ${result.data.cashback}`);
        console.log(`   セレクタ: ${result.data.titleSelector || 'なし'}`);
        console.log(`   デバッグ: タイトル="${result.data.debug.documentTitle}", H1数=${result.data.debug.h1Count}`);
        this.processedCount++;
      } else {
        console.log(`❌ [${campaign.id}] エラー: ${result.error}`);
        this.errorCount++;
        
        if (result.error === 'blocked') {
          console.log('🚫 ブロックされている可能性があります');
          break;
        }
      }
      
      // 最後の処理でなければ待機
      if (i < testCampaigns.length - 1) {
        console.log(`⏸️ 45秒待機中...`);
        await new Promise(resolve => setTimeout(resolve, this.delay));
      }
    }
    
    console.log('\n=== テスト結果 ===');
    console.log(`成功: ${this.processedCount}件`);
    console.log(`エラー: ${this.errorCount}件`);
    console.log(`成功率: ${this.processedCount > 0 ? ((this.processedCount / (this.processedCount + this.errorCount)) * 100).toFixed(1) : 0}%`);
    
    if (this.processedCount > 0) {
      console.log('\n✅ アクセス可能です - 本格的なスクレイピングを続行できます');
    } else {
      console.log('\n❌ アクセス不可 - 時間を置いて再試行することを推奨します');
    }
  }
}

// 実行
async function main() {
  const tester = new ChobirichTest5();
  
  try {
    await tester.runTest();
  } catch (error) {
    console.error('❌ テストエラー:', error);
  } finally {
    await tester.close();
    console.log('\n🎉 テスト完了');
  }
}

main().catch(console.error);