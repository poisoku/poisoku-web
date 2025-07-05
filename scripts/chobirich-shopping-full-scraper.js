const puppeteer = require('puppeteer');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

// ショッピングカテゴリ全案件スクレイパー
class ShoppingFullScraper {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.browser = null;
    this.iosUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
    this.allCampaigns = [];
    this.uniqueCampaignIds = new Set();
    this.pageContentHashes = new Map();
    this.checkpointFile = 'shopping-checkpoint.json';
    this.outputFile = 'chobirich-shopping-campaigns.json';
  }

  async init() {
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  }

  // チェックポイントの読み込み
  async loadCheckpoint() {
    try {
      const data = await fs.readFile(this.checkpointFile, 'utf8');
      const checkpoint = JSON.parse(data);
      this.allCampaigns = checkpoint.campaigns || [];
      this.uniqueCampaignIds = new Set(checkpoint.uniqueIds || []);
      console.log(`✅ チェックポイント読み込み: ${this.allCampaigns.length}件の既存案件`);
      return checkpoint.lastCategory || 101;
    } catch (error) {
      console.log('📝 新規実行開始');
      return 101;
    }
  }

  // チェックポイントの保存
  async saveCheckpoint(categoryId) {
    const checkpoint = {
      campaigns: this.allCampaigns,
      uniqueIds: Array.from(this.uniqueCampaignIds),
      lastCategory: categoryId,
      savedAt: new Date().toISOString()
    };
    await fs.writeFile(this.checkpointFile, JSON.stringify(checkpoint, null, 2));
    console.log(`💾 チェックポイント保存: カテゴリ${categoryId}まで完了`);
  }

  // コンテンツハッシュ作成
  createContentHash(campaigns) {
    const contentString = campaigns.map(campaign => 
      `${campaign.name}|${campaign.url}|${campaign.cashback}`
    ).sort().join('||');
    
    return crypto.createHash('md5').update(contentString).digest('hex');
  }

  // ページから案件情報を取得
  async scrapePage(categoryId, pageNum) {
    const page = await this.browser.newPage();
    
    try {
      await page.setUserAgent(this.iosUserAgent);
      
      // リソース最適化
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const resourceType = request.resourceType();
        if (['image', 'stylesheet', 'font'].includes(resourceType)) {
          request.abort();
        } else {
          request.continue();
        }
      });
      
      const url = pageNum === 1 
        ? `${this.baseUrl}/shopping/shop/${categoryId}`
        : `${this.baseUrl}/shopping/shop/${categoryId}?page=${pageNum}`;
      
      console.log(`📄 取得中: ${url}`);
      
      const response = await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });
      
      if (response.status() !== 200) {
        console.log(`  ❌ ステータス ${response.status()}`);
        return { valid: false, campaigns: [] };
      }
      
      const pageData = await page.evaluate((categoryId) => {
        const bodyText = document.body.innerText;
        
        // 空ページチェック
        const emptyPageMessages = [
          '現在、掲載している商品が存在しません。',
          '商品が存在しません',
          '該当する商品がありません'
        ];
        
        const hasEmptyMessage = emptyPageMessages.some(msg => bodyText.includes(msg));
        if (hasEmptyMessage) {
          return { hasEmptyMessage: true, campaigns: [] };
        }
        
        // 案件データ抽出
        const campaignLinks = document.querySelectorAll('a[href*="/ad_details/"]');
        const campaigns = [];
        
        campaignLinks.forEach(link => {
          const href = link.href;
          
          // IDの抽出
          let campaignId = null;
          const directMatch = href.match(/\/ad_details\/(\d+)/);
          const redirectMatch = href.match(/\/ad_details\/redirect\/(\d+)/);
          
          if (directMatch) {
            campaignId = directMatch[1];
          } else if (redirectMatch) {
            campaignId = redirectMatch[1];
          }
          
          if (campaignId) {
            // 案件情報を取得
            const container = link.closest('div, li, article, section');
            let campaignName = link.textContent?.trim() || '';
            let cashbackRate = '';
            let cashbackAmount = '';
            let description = '';
            
            if (container) {
              const textContent = container.textContent || '';
              const lines = textContent.split('\n').filter(line => line.trim());
              
              // 案件名の改善
              if (lines.length > 0) {
                // ランク別ポイント増量などのプレフィックスを除去
                let nameCandidate = lines[0].trim();
                if (nameCandidate.includes('ランク別ポイント増量')) {
                  nameCandidate = nameCandidate.replace(/.*ランク別ポイント増量/, '').trim();
                }
                if (nameCandidate && nameCandidate.length > campaignName.length) {
                  campaignName = nameCandidate;
                }
              }
              
              // キャッシュバック情報を探す
              const percentMatch = textContent.match(/(\d+(?:\.\d+)?)[%％]/);
              if (percentMatch) {
                cashbackRate = percentMatch[1] + '%';
              }
              
              // ポイント数を探す
              const pointMatch = textContent.match(/(\d+(?:,\d{3})*)[pP]|(\d+(?:,\d{3})*)ポイント/);
              if (pointMatch) {
                cashbackAmount = pointMatch[1] || pointMatch[2];
              }
              
              // 説明文を探す（2行目以降）
              if (lines.length > 1) {
                description = lines.slice(1, 3).join(' ').trim();
              }
            }
            
            if (campaignName && campaignName.length > 2) {
              campaigns.push({
                id: campaignId,
                name: campaignName,
                url: href,
                cashbackRate: cashbackRate,
                cashbackAmount: cashbackAmount,
                description: description,
                category: 'ショッピング',
                subCategory: `カテゴリ${String(categoryId).padStart(3, '0')}`,
                os: '全デバイス'
              });
            }
          }
        });
        
        return {
          hasEmptyMessage: hasEmptyMessage,
          campaigns: campaigns
        };
      }, categoryId);
      
      if (pageData.hasEmptyMessage) {
        console.log(`  ❌ 空ページメッセージ検出`);
        return { valid: false, campaigns: [] };
      }
      
      // コンテンツハッシュチェック
      const contentHash = this.createContentHash(pageData.campaigns);
      const duplicatePageNum = this.pageContentHashes.get(contentHash);
      if (duplicatePageNum) {
        console.log(`  ❌ ページ${duplicatePageNum}と重複`);
        return { valid: false, campaigns: [], duplicate: true };
      }
      
      this.pageContentHashes.set(contentHash, pageNum);
      
      console.log(`  ✅ ${pageData.campaigns.length}件の案件を取得`);
      return { valid: true, campaigns: pageData.campaigns };
      
    } catch (error) {
      console.log(`  ❌ エラー: ${error.message.substring(0, 50)}`);
      return { valid: false, campaigns: [] };
    } finally {
      await page.close();
    }
  }

  // カテゴリの全ページを取得
  async scrapeCategory(categoryId) {
    console.log(`\n📂 カテゴリ${categoryId}の取得開始...`);
    
    this.pageContentHashes.clear();
    const categoryCampaigns = [];
    let pageNum = 1;
    let consecutiveInvalid = 0;
    const maxConsecutiveInvalid = 2;
    const maxPages = 30;
    
    while (pageNum <= maxPages && consecutiveInvalid < maxConsecutiveInvalid) {
      const result = await this.scrapePage(categoryId, pageNum);
      
      if (result.valid) {
        // 新規案件のみ追加
        for (const campaign of result.campaigns) {
          if (!this.uniqueCampaignIds.has(campaign.id)) {
            this.uniqueCampaignIds.add(campaign.id);
            this.allCampaigns.push(campaign);
            categoryCampaigns.push(campaign);
          }
        }
        consecutiveInvalid = 0;
      } else {
        consecutiveInvalid++;
        
        if (result.duplicate) {
          console.log(`  🛑 重複コンテンツにより終了`);
          break;
        }
        
        if (consecutiveInvalid >= maxConsecutiveInvalid) {
          console.log(`  🛑 連続${maxConsecutiveInvalid}回無効のため終了`);
          break;
        }
      }
      
      pageNum++;
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    console.log(`📊 カテゴリ${categoryId}: ${categoryCampaigns.length}件の新規案件`);
    return categoryCampaigns;
  }

  async run() {
    await this.init();
    
    // チェックポイント読み込み
    const startCategory = await this.loadCheckpoint();
    
    // 101-112のカテゴリ（チェックポイントから再開）
    const categories = [];
    for (let i = startCategory; i <= 112; i++) {
      categories.push(i);
    }
    
    console.log('🔍 ショッピングカテゴリ案件取得開始');
    console.log(`📋 対象カテゴリ: ${categories.join(', ')}`);
    console.log('='.repeat(60));
    
    const startTime = Date.now();
    
    for (const categoryId of categories) {
      await this.scrapeCategory(categoryId);
      await this.saveCheckpoint(categoryId);
      
      // カテゴリ間の間隔
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // 最終結果を保存
    await fs.writeFile(this.outputFile, JSON.stringify(this.allCampaigns, null, 2));
    
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    // 結果まとめ
    console.log('\n' + '='.repeat(60));
    console.log('📊 取得完了！');
    console.log('='.repeat(60));
    console.log(`✅ 総案件数: ${this.allCampaigns.length}件`);
    console.log(`⏱️ 処理時間: ${duration}秒`);
    
    // カテゴリ別集計
    const categoryStats = {};
    this.allCampaigns.forEach(campaign => {
      const cat = campaign.subCategory;
      categoryStats[cat] = (categoryStats[cat] || 0) + 1;
    });
    
    console.log('\n📋 カテゴリ別案件数:');
    Object.keys(categoryStats).sort().forEach(cat => {
      console.log(`  ${cat}: ${categoryStats[cat]}件`);
    });
    
    console.log(`\n💾 データ保存先: ${this.outputFile}`);
    
    if (this.browser) {
      await this.browser.close();
    }
    
    // チェックポイントファイルを削除
    try {
      await fs.unlink(this.checkpointFile);
      console.log('🗑️ チェックポイントファイルを削除しました');
    } catch (error) {
      // ファイルがない場合は無視
    }
  }
}

// 実行
(async () => {
  const scraper = new ShoppingFullScraper();
  await scraper.run();
})();