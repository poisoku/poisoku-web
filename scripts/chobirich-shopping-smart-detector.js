const puppeteer = require('puppeteer');
const crypto = require('crypto');

// 改良されたショッピングページ検出（実際のコンテンツ重複を検出）
class SmartShoppingDetector {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.browser = null;
    this.iosUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
    this.pageContentHashes = new Map(); // ページ内容のハッシュを保存
  }

  async init() {
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  }

  // ページの実際の案件コンテンツを抽出してハッシュ化
  createContentHash(campaigns) {
    const contentString = campaigns.map(campaign => 
      `${campaign.name}|${campaign.url}|${campaign.cashback}`
    ).sort().join('||');
    
    return crypto.createHash('md5').update(contentString).digest('hex');
  }

  async checkPageContent(categoryId, pageNum) {
    const page = await this.browser.newPage();
    
    try {
      await page.setUserAgent(this.iosUserAgent);
      
      const url = pageNum === 1 
        ? `${this.baseUrl}/shopping/shop/${categoryId}`
        : `${this.baseUrl}/shopping/shop/${categoryId}?page=${pageNum}`;
      
      console.log(`🔍 チェック中: ${url}`);
      
      const response = await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 12000 
      });
      
      if (response.status() !== 200) {
        console.log(`  ❌ ページ${pageNum}: ステータス ${response.status()}`);
        return { valid: false, reason: `status_${response.status()}` };
      }
      
      const pageData = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        
        // 明確な空ページメッセージをチェック
        const emptyPageMessages = [
          '現在、掲載している商品が存在しません。',
          '商品が存在しません',
          '該当する商品がありません',
          '表示できる商品がありません'
        ];
        
        const hasEmptyMessage = emptyPageMessages.some(msg => bodyText.includes(msg));
        
        // 実際の案件データを抽出（redirect リンクも含む）
        const campaignLinks = document.querySelectorAll('a[href*="/ad_details/"]');
        const campaigns = [];
        
        campaignLinks.forEach(link => {
          const href = link.href;
          
          // 直接リンクとリダイレクトリンクの両方を処理
          let campaignId = null;
          const directMatch = href.match(/\/ad_details\/(\d+)/);
          const redirectMatch = href.match(/\/ad_details\/redirect\/(\d+)/);
          
          if (directMatch) {
            campaignId = directMatch[1];
          } else if (redirectMatch) {
            campaignId = redirectMatch[1];
          }
          
          if (campaignId) {
            // 案件名とキャッシュバック率を取得
            const container = link.closest('div, li, article, section');
            let campaignName = link.textContent?.trim() || '';
            let cashbackRate = '';
            
            if (container) {
              const textContent = container.textContent || '';
              const lines = textContent.split('\n').filter(line => line.trim());
              
              // より良い案件名を探す
              if (!campaignName || campaignName.length < 3) {
                for (const line of lines) {
                  if (line.trim().length > 3) {
                    campaignName = line.trim();
                    break;
                  }
                }
              }
              
              // パーセンテージを探す
              const percentMatch = textContent.match(/(\d+(?:\.\d+)?%)/);
              if (percentMatch) {
                cashbackRate = percentMatch[1];
              }
            }
            
            if (campaignName && campaignName.length > 2) {
              campaigns.push({
                id: campaignId,
                name: campaignName,
                url: href,
                cashback: cashbackRate
              });
            }
          }
        });
        
        // 次のページへのリンクを確認
        const nextPageNum = parseInt(window.location.search.match(/page=(\d+)/)?.[1] || '1') + 1;
        const nextPageLink = document.querySelector(`a[href*="page=${nextPageNum}"]`);
        
        return {
          hasEmptyMessage: hasEmptyMessage,
          campaigns: campaigns,
          campaignCount: campaigns.length,
          uniqueCampaignCount: [...new Set(campaigns.map(c => c.id))].length,
          hasNextPageLink: !!nextPageLink,
          bodyTextLength: bodyText.length,
          contentSample: bodyText.substring(0, 200)
        };
      });
      
      // 空ページメッセージがある場合
      if (pageData.hasEmptyMessage) {
        console.log(`  ❌ ページ${pageNum}: 空ページメッセージ検出`);
        return { valid: false, reason: 'empty_page_message' };
      }
      
      // 実際の案件が取得できない場合
      if (pageData.uniqueCampaignCount === 0) {
        console.log(`  ❌ ページ${pageNum}: 案件データなし`);
        return { valid: false, reason: 'no_campaign_data' };
      }
      
      // コンテンツハッシュを作成
      const contentHash = this.createContentHash(pageData.campaigns);
      
      // 同じコンテンツの重複をチェック
      const duplicatePageNum = this.pageContentHashes.get(contentHash);
      if (duplicatePageNum) {
        console.log(`  ❌ ページ${pageNum}: ページ${duplicatePageNum}と同じコンテンツ`);
        return { valid: false, reason: 'duplicate_content', duplicateOf: duplicatePageNum };
      }
      
      // 有効なページとして記録
      this.pageContentHashes.set(contentHash, pageNum);
      
      console.log(`  ✅ ページ${pageNum}: ${pageData.uniqueCampaignCount}件の固有案件`);
      return { 
        valid: true, 
        url: url, 
        campaignCount: pageData.uniqueCampaignCount,
        categoryId: categoryId,
        pageNum: pageNum,
        contentHash: contentHash,
        hasNextPageLink: pageData.hasNextPageLink
      };
      
    } catch (error) {
      console.log(`  ❌ ページ${pageNum}: エラー ${error.message.substring(0, 50)}`);
      return { valid: false, reason: 'error', error: error.message };
    } finally {
      await page.close();
    }
  }

  async detectValidPagesForCategory(categoryId) {
    console.log(`\n📋 カテゴリ${categoryId}の有効ページ検出中（重複除去）...`);
    
    // カテゴリごとにハッシュマップをリセット
    this.pageContentHashes.clear();
    
    const validPages = [];
    let pageNum = 1;
    let consecutiveInvalid = 0;
    const maxConsecutiveInvalid = 2;
    const maxPages = 20;
    
    while (pageNum <= maxPages && consecutiveInvalid < maxConsecutiveInvalid) {
      const result = await this.checkPageContent(categoryId, pageNum);
      
      if (result.valid) {
        validPages.push(result);
        consecutiveInvalid = 0;
      } else {
        consecutiveInvalid++;
        
        // 重複コンテンツの場合は早期終了
        if (result.reason === 'duplicate_content') {
          console.log(`  🛑 重複コンテンツにより終了`);
          break;
        }
        
        // 空ページメッセージの場合も早期終了
        if (result.reason === 'empty_page_message') {
          console.log(`  🛑 空ページメッセージにより終了`);
          break;
        }
        
        console.log(`  📊 連続無効: ${consecutiveInvalid}回`);
        
        if (consecutiveInvalid >= maxConsecutiveInvalid) {
          console.log(`  🛑 連続${maxConsecutiveInvalid}回無効のため終了`);
          break;
        }
      }
      
      pageNum++;
      
      // 間隔を空ける
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    console.log(`📊 カテゴリ${categoryId}: ${validPages.length}ページが有効`);
    return validPages;
  }

  async run() {
    await this.init();
    
    // 101-112のカテゴリのみチェック
    const categories = [101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112];
    
    console.log('🔍 ショッピングカテゴリ101-112のスマート検出開始');
    console.log('（重複コンテンツと空ページメッセージを検出）');
    console.log('='.repeat(60));
    
    const allValidPages = [];
    
    for (const categoryId of categories) {
      const pages = await this.detectValidPagesForCategory(categoryId);
      allValidPages.push(...pages);
      
      // カテゴリ間の間隔
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // 結果まとめ
    console.log('\n' + '='.repeat(60));
    console.log('📊 スマート検出結果まとめ');
    console.log('='.repeat(60));
    
    const categoryGroups = {};
    allValidPages.forEach(page => {
      if (!categoryGroups[page.categoryId]) {
        categoryGroups[page.categoryId] = [];
      }
      categoryGroups[page.categoryId].push(page);
    });
    
    console.log(`✅ 実際にユニークな案件があるページ総数: ${allValidPages.length}ページ`);
    console.log(`📂 有効なカテゴリ数: ${Object.keys(categoryGroups).length}カテゴリ`);
    
    console.log('\n📋 カテゴリ別有効ページ数:');
    Object.keys(categoryGroups).sort((a, b) => parseInt(a) - parseInt(b)).forEach(categoryId => {
      const pages = categoryGroups[categoryId];
      console.log(`  カテゴリ${categoryId}: ${pages.length}ページ`);
    });
    
    console.log('\n📋 実際に案件があるURL一覧:');
    allValidPages.forEach(page => {
      console.log(`${page.url} (${page.campaignCount}件)`);
    });
    
    if (this.browser) {
      await this.browser.close();
    }
    
    return allValidPages;
  }
}

// 実行
(async () => {
  const detector = new SmartShoppingDetector();
  await detector.run();
})();