const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class ChobirichSafeQuality {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.campaigns = new Map();
    this.browser = null;
    this.improvedCount = 0;
    this.errorCount = 0;
  }

  async init() {
    console.log('安全版データ品質改善スクレイパー起動中...\n');
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
    
    console.log('ブラウザ初期化完了');
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
      console.log(`既存データ: ${this.campaigns.size}件`);
      
      const idData = JSON.parse(await fs.readFile('chobirich_all_ids.json', 'utf8'));
      this.allCampaignIds = new Map(idData.campaigns.map(c => [c.id, c]));
      console.log(`IDリスト: ${this.allCampaignIds.size}件`);
      
    } catch (error) {
      console.log('データ読み込みエラー:', error.message);
      throw error;
    }
  }

  // 問題のある案件を特定（安全版）
  identifyProblematicCampaigns() {
    const problems = [];
    
    this.campaigns.forEach((campaign, id) => {
      const issues = [];
      
      // 案件名が空白または短すぎる
      if (!campaign.name || campaign.name.trim() === '' || campaign.name.length < 3) {
        issues.push('empty_name');
      }
      
      // OSが不明
      if (!campaign.os || campaign.os === 'unknown') {
        issues.push('unknown_os');
      }
      
      // 還元率が「なし」
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

  // 簡単な案件取得（エラー対策強化）
  async scrapeSimpleCampaign(targetInfo) {
    const campaignId = targetInfo.id;
    let page = null;
    
    try {
      page = await this.browser.newPage();
      
      // シンプルなユーザーエージェント
      await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
      await page.setViewport({ width: 375, height: 812, isMobile: true });

      const url = `${this.baseUrl}/ad_details/${campaignId}/`;
      
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      await this.delay(2000);

      // 安全なデータ抽出
      const result = await page.evaluate(() => {
        try {
          // 基本的な403チェック
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
            os: 'unknown'
          };

          // 案件名取得（シンプル版）
          const titleSelectors = [
            'h1.AdDetails__title',
            'h1',
            'title'
          ];
          
          for (const selector of titleSelectors) {
            try {
              let element = null;
              
              if (selector === 'title') {
                const titleText = document.title;
                if (titleText && !titleText.includes('403') && !titleText.includes('ちょびリッチ')) {
                  data.name = titleText.split(/[|｜-]/)[0].trim();
                  break;
                }
              } else {
                element = document.querySelector(selector);
                if (element) {
                  const text = element.textContent.trim();
                  if (text && text.length > 2 && !text.includes('ちょびリッチ') && !text.includes('403')) {
                    data.name = text;
                    break;
                  }
                }
              }
            } catch (e) {
              // エラーは無視して次のセレクタへ
            }
          }

          // 還元率取得（シンプル版）
          try {
            const ptElement = document.querySelector('.AdDetails__pt.ItemPtLarge');
            if (ptElement) {
              const text = ptElement.textContent.trim().replace(/\s+/g, ' ');
              
              // シンプルなパターンマッチング
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

          // OS判定（シンプル版）
          try {
            const pageText = document.body.textContent.toLowerCase();
            
            if (data.name.includes('iOS') || data.name.includes('iPhone') || pageText.includes('app store')) {
              data.os = 'ios';
            } else if (data.name.includes('Android') || data.name.includes('アンドロイド') || pageText.includes('google play')) {
              data.os = 'android';
            } else if (data.name.includes('多段階')) {
              data.os = 'both';
            }
          } catch (e) {
            // エラーは無視
          }

          return { success: true, data };
          
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      if (!result.success) {
        console.log(`❌ ${result.error || 'エラー'} (${campaignId})`);
        this.errorCount++;
        return { success: false, error: result.error };
      }

      const campaign = result.data;
      const oldCampaign = targetInfo.current;
      let improvements = [];
      
      // 改善度をチェック
      if (campaign.name && campaign.name.length > 2 && (!oldCampaign.name || oldCampaign.name.length < 3)) {
        improvements.push(`名前改善`);
      }
      
      if (campaign.cashback && campaign.cashback !== 'なし' && (!oldCampaign.cashback || oldCampaign.cashback === 'なし')) {
        improvements.push(`還元率改善`);
      }
      
      if (campaign.os && campaign.os !== 'unknown' && (!oldCampaign.os || oldCampaign.os === 'unknown')) {
        improvements.push(`OS判定改善`);
      }

      // データを更新
      this.campaigns.set(campaignId, campaign);
      this.improvedCount++;

      if (improvements.length > 0) {
        console.log(`✅ ${campaignId}: ${improvements.join(', ')} - "${campaign.name}" [${campaign.os}] ${campaign.cashback}`);
      } else {
        console.log(`📋 ${campaignId}: 変更なし - "${campaign.name}" [${campaign.os}] ${campaign.cashback}`);
      }

      return { success: true, improvements };

    } catch (error) {
      console.error(`❌ 予期しないエラー (${campaignId}):`, error.message);
      this.errorCount++;
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

  // メイン処理（少数ずつテスト）
  async improveLimitedData(maxItems = 999) {
    await this.loadExistingData();
    
    const problems = this.identifyProblematicCampaigns();
    console.log(`問題のある案件: ${problems.length}件`);
    
    // 最初のN件のみ処理
    const targets = problems.slice(0, maxItems);
    console.log(`\n=== 改善テスト開始 (${targets.length}件) ===\n`);
    
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      
      console.log(`[${i + 1}/${targets.length}] ${target.id} (問題: ${target.issues.join(', ')})`);
      
      await this.scrapeSimpleCampaign(target);
      
      // 10件ごとに保存と休憩
      if ((i + 1) % 10 === 0) {
        await this.saveResults();
        console.log(`\n[進捗] ${i + 1}/${targets.length}件完了 - 5秒休憩\n`);
        await this.delay(5000);
      }
      
      // 基本的なアクセス間隔
      await this.delay(2000);
    }
    
    await this.saveResults();
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async saveResults() {
    const data = {
      scraped_at: new Date().toISOString(),
      total_campaigns: this.campaigns.size,
      improved_count: this.improvedCount,
      error_count: this.errorCount,
      campaigns: Array.from(this.campaigns.values())
    };

    await fs.writeFile(
      'chobirich_android_ios_apps_data.json',
      JSON.stringify(data, null, 2),
      'utf8'
    );
    
    console.log(`[保存] ${this.campaigns.size}件保存 (改善:${this.improvedCount}, エラー:${this.errorCount})`);
  }

  showStats() {
    console.log('\n=== 改善結果 ===');
    console.log(`処理件数: ${this.improvedCount}`);
    console.log(`エラー件数: ${this.errorCount}`);
    console.log(`成功率: ${this.improvedCount > 0 ? ((this.improvedCount - this.errorCount) / this.improvedCount * 100).toFixed(1) : 0}%`);
  }
}

// メイン実行
async function main() {
  const scraper = new ChobirichSafeQuality();
  
  try {
    await scraper.init();
    
    // 全件実行
    await scraper.improveLimitedData(999);
    
    scraper.showStats();
    
  } catch (error) {
    console.error('エラー:', error);
    await scraper.saveResults();
  } finally {
    await scraper.close();
    console.log('\n完了！');
  }
}

main().catch(console.error);