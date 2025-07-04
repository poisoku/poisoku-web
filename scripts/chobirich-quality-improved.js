const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class ChobirichQualityImproved {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.campaigns = new Map();
    this.browser = null;
    this.improvedCount = 0;
    this.totalToImprove = 0;
  }

  async init() {
    console.log('データ品質改善スクレイパー起動中...\n');
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process'
      ]
    });
    
    console.log('ブラウザ初期化完了');
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  // 既存データと改善対象を読み込み
  async loadDataAndTargets() {
    try {
      // 既存の詳細データを読み込み
      const detailData = JSON.parse(await fs.readFile('chobirich_android_ios_apps_data.json', 'utf8'));
      detailData.campaigns.forEach(campaign => {
        this.campaigns.set(campaign.id, campaign);
      });
      console.log(`既存データ: ${this.campaigns.size}件`);
      
      // IDリストを読み込み
      const idData = JSON.parse(await fs.readFile('chobirich_all_ids.json', 'utf8'));
      this.allCampaignIds = new Map(idData.campaigns.map(c => [c.id, c]));
      console.log(`IDリスト: ${this.allCampaignIds.size}件`);
      
    } catch (error) {
      console.log('データ読み込みエラー:', error.message);
      throw error;
    }
  }

  // 改善が必要な案件を特定
  identifyImprovementTargets() {
    const targets = [];
    
    this.campaigns.forEach((campaign, id) => {
      let needsImprovement = false;
      const issues = [];
      
      // 案件名が空白または短すぎる
      if (!campaign.name || campaign.name.trim() === '' || campaign.name.length < 3) {
        needsImprovement = true;
        issues.push('empty_name');
      }
      
      // 還元率が取得できていない
      if (!campaign.cashback || campaign.cashback === '' || campaign.cashback === 'なし') {
        needsImprovement = true;
        issues.push('no_cashback');
      }
      
      // OSが不明
      if (!campaign.os || campaign.os === 'unknown') {
        needsImprovement = true;
        issues.push('unknown_os');
      }
      
      // エラーデータ
      if (campaign.error || (campaign.name && campaign.name.includes('403'))) {
        needsImprovement = true;
        issues.push('error_data');
      }
      
      if (needsImprovement) {
        const originalInfo = this.allCampaignIds.get(id);
        targets.push({
          id: id,
          issues: issues,
          current: campaign,
          original: originalInfo
        });
      }
    });
    
    console.log(`改善対象: ${targets.length}件`);
    return targets;
  }

  // 強化された案件詳細取得
  async scrapeEnhancedCampaignDetail(targetInfo) {
    const campaignId = targetInfo.id;
    let page = null;
    
    try {
      page = await this.browser.newPage();
      
      // 最適化されたユーザーエージェント（より多くの情報を取得）
      const userAgents = [
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36'
      ];
      
      const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
      await page.setUserAgent(userAgent);
      
      // ビューポート設定
      if (userAgent.includes('Android')) {
        await page.setViewport({ width: 412, height: 915, isMobile: true });
      } else {
        await page.setViewport({ width: 375, height: 812, isMobile: true });
      }

      const url = `${this.baseUrl}/ad_details/${campaignId}/`;
      
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 90000
      });

      // ページ読み込み後の待機
      await this.delay(3000);

      // 強化されたデータ抽出
      const enhancedData = await page.evaluate(() => {
        try {
        const data = {
          id: window.location.pathname.match(/\/ad_details\/(\d+)/)?.[1],
          name: '',
          cashback: '',
          category: 'アプリ',
          url: window.location.href,
          conditions: {},
          os: 'unknown',
          debug: {
            selectors_tried: [],
            all_text_content: '',
            title_attempts: [],
            cashback_attempts: []
          }
        };

        // 403エラーチェック
        const is403 = document.title.includes('403') || 
                     document.body.textContent.includes('Forbidden') ||
                     document.body.textContent.includes('アクセスが拒否されました');
        
        if (is403) {
          return { is403: true, error: '403 Forbidden' };
        }

        // デバッグ用：ページの全テキストを取得（最初の1000文字）
        data.debug.all_text_content = document.body.textContent.substring(0, 1000);

        // 案件名の強化された取得
        const titleSelectors = [
          'h1.AdDetails__title',
          'h1[class*="title"]',
          'h1[class*="Title"]',
          '.title h1',
          '.campaign-title',
          '.ad-title',
          'h1',
          'h2.title',
          '[class*="campaign"] h1',
          '[class*="ad"] h1'
        ];
        
        for (const selector of titleSelectors) {
          try {
            const element = document.querySelector(selector);
            if (element) {
              const text = element.textContent.trim();
              data.debug.title_attempts.push({ selector, text: text.substring(0, 100) });
              
              if (text && text.length > 2 && !text.includes('ちょびリッチ') && !text.includes('403')) {
                data.name = text;
                break;
              }
            }
          } catch (e) {
            data.debug.title_attempts.push({ selector, error: e.message });
          }
        }

        // 案件名が取得できない場合の代替手段
        if (!data.name || data.name.length < 3) {
          // ページタイトルから抽出
          const pageTitle = document.title;
          if (pageTitle && !pageTitle.includes('403') && !pageTitle.includes('ちょびリッチ')) {
            const titleParts = pageTitle.split(/[|｜-]/).map(part => part.trim());
            for (const part of titleParts) {
              if (part.length > 3 && !part.includes('ちょびリッチ')) {
                data.name = part;
                data.debug.title_attempts.push({ selector: 'document.title', text: part });
                break;
              }
            }
          }
          
          // メタ情報から抽出
          const metaDescription = document.querySelector('meta[name="description"]');
          if (metaDescription && !data.name) {
            const description = metaDescription.getAttribute('content');
            if (description && description.length > 10) {
              const words = description.split(/\s+/).slice(0, 5).join(' ');
              if (words.length > 3) {
                data.name = words;
                data.debug.title_attempts.push({ selector: 'meta[description]', text: words });
              }
            }
          }
        }

        // 還元率の強化された取得
        const cashbackSelectors = [
          '.AdDetails__pt.ItemPtLarge',
          '.AdDetails__pt',
          '[class*="pt"][class*="Large"]',
          '[class*="point"][class*="Large"]',
          '[class*="reward"]',
          '[class*="cashback"]',
          '[class*="rate"]',
          '.campaign-rate',
          '.point-rate',
          '[class*="price"]',
          '[class*="amount"]'
        ];
        
        for (const selector of cashbackSelectors) {
          try {
            const elements = document.querySelectorAll(selector);
            elements.forEach((element, index) => {
              if (element && !element.className.includes('Recommend') && 
                  !element.className.includes('SideCol') && 
                  !element.className.includes('recommend')) {
                
                const text = element.textContent.trim().replace(/\s+/g, ' ');
                data.debug.cashback_attempts.push({ 
                  selector: `${selector}[${index}]`, 
                  text: text.substring(0, 50),
                  className: element.className 
                });
                
                // ポイント/パーセンテージのマッチング（より厳密）
                const patterns = [
                  /(\d+(?:,\d+)?(?:ちょび)?pt)/i,
                  /(\d+(?:\.\d+)?[%％])/i,
                  /(\d+(?:,\d+)?)ポイント/i,
                  /(\d+(?:,\d+)?)円相当/i,
                  /(\d+(?:,\d+)?)円/i
                ];
                
                for (const pattern of patterns) {
                  const match = text.match(pattern);
                  if (match && !data.cashback) {
                    let cashbackValue = match[1];
                    
                    // 正規化
                    if (cashbackValue.includes('ポイント')) {
                      cashbackValue = cashbackValue.replace('ポイント', 'pt');
                    }
                    if (cashbackValue.includes('％')) {
                      cashbackValue = cashbackValue.replace('％', '%');
                    }
                    
                    // 妥当性チェック（あまりに大きな値は除外）
                    const numValue = parseInt(cashbackValue.replace(/[^\d]/g, ''));
                    if (numValue <= 1000000) { // 100万pt以下
                      data.cashback = cashbackValue;
                      data.debug.cashback_attempts.push({ 
                        selector: `${selector}[${index}] - SELECTED`, 
                        text: cashbackValue,
                        pattern: pattern.source
                      });
                      break;
                    }
                  }
                }
                
                if (data.cashback) return;
              }
            });
            
            if (data.cashback) return;
          } catch (e) {
            data.debug.cashback_attempts.push({ selector, error: e.message });
          }
        }

        // 還元率が見つからない場合の代替手段
        if (!data.cashback || data.cashback === 'なし') {
          // ページ全体から数値パターンを検索
          const bodyText = document.body.textContent;
          const globalPatterns = [
            /(\d{1,6}(?:,\d+)?(?:ちょび)?pt)/gi,
            /(\d{1,3}(?:\.\d+)?[%％])/gi
          ];
          
          for (const pattern of globalPatterns) {
            const matches = bodyText.match(pattern);
            if (matches && matches.length > 0) {
              // 最も頻出する値を選択
              const frequency = {};
              matches.forEach(match => {
                const clean = match.replace('％', '%');
                frequency[clean] = (frequency[clean] || 0) + 1;
              });
              
              const mostFrequent = Object.keys(frequency).reduce((a, b) => 
                frequency[a] > frequency[b] ? a : b
              );
              
              const numValue = parseInt(mostFrequent.replace(/[^\d]/g, ''));
              if (numValue > 0 && numValue <= 100000) {
                data.cashback = mostFrequent;
                data.debug.cashback_attempts.push({ 
                  selector: 'global_search', 
                  text: mostFrequent,
                  frequency: frequency[mostFrequent]
                });
                return;
              }
            }
          }
        }

        // OS判定の強化
        const fullText = document.body.textContent.toLowerCase();
        
        if (data.name.includes('iOS') || data.name.includes('iPhone') || 
            fullText.includes('app store') || fullText.includes('ios')) {
          data.os = 'ios';
        } else if (data.name.includes('Android') || data.name.includes('アンドロイド') || 
                   fullText.includes('google play') || fullText.includes('android')) {
          data.os = 'android';
        } else if (data.name.includes('多段階') || data.name.includes('両OS') ||
                   (fullText.includes('ios') && fullText.includes('android'))) {
          data.os = 'both';
        }

        // 条件情報の取得
        const conditionSelectors = ['dt', 'dd', 'th', 'td', '.condition', '.requirement'];
        let currentLabel = '';
        
        conditionSelectors.forEach(selector => {
          document.querySelectorAll(selector).forEach(el => {
            const text = el.textContent.trim();
            if (text.includes('獲得方法')) {
              currentLabel = 'method';
            } else if (text.includes('予定明細')) {
              currentLabel = 'pending';
            } else if (text.includes('加算日')) {
              currentLabel = 'creditDate';
            } else if (currentLabel && text && text.length > 3) {
              if (!data.conditions[currentLabel]) {
                data.conditions[currentLabel] = text;
              }
              currentLabel = '';
            }
          });
        });

        return { is403: false, data };
        
        } catch (error) {
          return { is403: false, error: error.message, data: null };
        }
      });

      if (enhancedData.is403) {
        console.log(`❌ 403エラー (${campaignId})`);
        return { success: false, error: '403' };
      }

      if (enhancedData.error || !enhancedData.data) {
        console.log(`❌ 評価エラー (${campaignId}): ${enhancedData.error || 'データ取得失敗'}`);
        return { success: false, error: enhancedData.error || 'evaluation_failed' };
      }

      const campaign = enhancedData.data;
      
      // 元のデータと比較して改善度を測定
      const oldCampaign = targetInfo.current;
      let improvements = [];
      
      if (campaign.name && campaign.name.length > 2 && (!oldCampaign.name || oldCampaign.name.length < 3)) {
        improvements.push(`名前: "${oldCampaign.name || '空白'}" → "${campaign.name}"`);
      }
      
      if (campaign.cashback && campaign.cashback !== 'なし' && (!oldCampaign.cashback || oldCampaign.cashback === 'なし')) {
        improvements.push(`還元率: "${oldCampaign.cashback || '空白'}" → "${campaign.cashback}"`);
      }
      
      if (campaign.os && campaign.os !== 'unknown' && (!oldCampaign.os || oldCampaign.os === 'unknown')) {
        improvements.push(`OS: "${oldCampaign.os || 'unknown'}" → "${campaign.os}"`);
      }

      // データを更新
      this.campaigns.set(campaignId, campaign);
      this.improvedCount++;

      if (improvements.length > 0) {
        console.log(`✅ ${campaignId}: ${improvements.join(', ')}`);
      } else {
        console.log(`📋 ${campaignId}: データ再取得（変更なし）`);
      }

      return { success: true, improvements };

    } catch (error) {
      console.error(`❌ エラー (${campaignId}):`, error.message);
      return { success: false, error: error.message };
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  // メイン処理
  async improveDataQuality() {
    await this.loadDataAndTargets();
    
    const targets = this.identifyImprovementTargets();
    this.totalToImprove = targets.length;
    
    if (targets.length === 0) {
      console.log('改善が必要な案件はありません');
      return;
    }
    
    console.log(`\n=== データ品質改善開始 ===`);
    console.log(`対象: ${targets.length}件\n`);
    
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      
      console.log(`[${i + 1}/${targets.length}] 処理中: ${target.id}`);
      console.log(`  問題: ${target.issues.join(', ')}`);
      
      await this.scrapeEnhancedCampaignDetail(target);
      
      // 進捗保存（10件ごと）
      if ((i + 1) % 10 === 0) {
        await this.saveResults();
        console.log(`\n[進捗保存] ${i + 1}/${targets.length}件完了\n`);
      }
      
      // アクセス間隔
      await this.delay(4000);
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
      os_breakdown: {
        ios: 0,
        android: 0,
        both: 0,
        unknown: 0
      },
      campaigns: Array.from(this.campaigns.values())
    };

    data.campaigns.forEach(campaign => {
      if (campaign.os) {
        data.os_breakdown[campaign.os]++;
      }
    });

    await fs.writeFile(
      'chobirich_android_ios_apps_data.json',
      JSON.stringify(data, null, 2),
      'utf8'
    );
    
    console.log(`[保存] ${this.campaigns.size}件のデータを保存`);
  }

  showFinalStats() {
    const stats = {
      total: this.campaigns.size,
      withValidName: 0,
      withCashback: 0,
      withKnownOS: 0,
      fullyComplete: 0
    };

    this.campaigns.forEach(campaign => {
      if (campaign.name && campaign.name.length > 2) stats.withValidName++;
      if (campaign.cashback && campaign.cashback !== 'なし') stats.withCashback++;
      if (campaign.os && campaign.os !== 'unknown') stats.withKnownOS++;
      
      if (campaign.name && campaign.name.length > 2 && 
          campaign.cashback && campaign.cashback !== 'なし' &&
          campaign.os && campaign.os !== 'unknown') {
        stats.fullyComplete++;
      }
    });

    console.log('\n=== データ品質改善結果 ===');
    console.log(`総案件数: ${stats.total}`);
    console.log(`有効な案件名: ${stats.withValidName}件 (${(stats.withValidName/stats.total*100).toFixed(1)}%)`);
    console.log(`還元率あり: ${stats.withCashback}件 (${(stats.withCashback/stats.total*100).toFixed(1)}%)`);
    console.log(`OS判定済み: ${stats.withKnownOS}件 (${(stats.withKnownOS/stats.total*100).toFixed(1)}%)`);
    console.log(`完全なデータ: ${stats.fullyComplete}件 (${(stats.fullyComplete/stats.total*100).toFixed(1)}%)`);
    console.log(`改善処理数: ${this.improvedCount}件`);
  }
}

// メイン実行
async function main() {
  const scraper = new ChobirichQualityImproved();
  
  try {
    await scraper.init();
    await scraper.improveDataQuality();
    scraper.showFinalStats();
    
  } catch (error) {
    console.error('エラー:', error);
    await scraper.saveResults();
  } finally {
    await scraper.close();
    console.log('\n完了！');
  }
}

main().catch(console.error);