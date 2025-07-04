const https = require('https');
const fs = require('fs').promises;

class ChobirichScraper {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.campaigns = new Map(); // 重複防止用
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive'
    };
  }

  // HTTPリクエストを送信
  async fetch(path) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'www.chobirich.com',
        path: path,
        method: 'GET',
        headers: this.headers
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data }));
      });
      
      req.on('error', reject);
      req.end();
    });
  }

  // 案件詳細ページから情報を抽出
  extractCampaignDetails(html, campaignId) {
    const campaign = {
      id: campaignId,
      name: '',
      cashback: '',
      category: '',
      description: '',
      url: `${this.baseUrl}/ad_details/${campaignId}/`
    };

    // タイトルを抽出
    const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
    if (titleMatch) {
      campaign.name = titleMatch[1].trim();
    }

    // ポイント数を抽出（複数パターン対応）
    const pointPatterns = [
      /(\d+(?:,\d+)?)\s*ちょびpt/i,
      /(\d+(?:,\d+)?)\s*pt/i,
      /(\d+(?:,\d+)?)\s*ポイント/i,
      /(\d+(?:\.\d+)?)\s*%/
    ];

    for (const pattern of pointPatterns) {
      const match = html.match(pattern);
      if (match) {
        campaign.cashback = match[0];
        break;
      }
    }

    // 説明文を抽出
    const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
    if (descMatch) {
      campaign.description = descMatch[1];
    }

    return campaign;
  }

  // カテゴリーページから案件IDを抽出
  extractCampaignIds(html) {
    const ids = new Set();
    
    // 案件詳細へのリンクパターン
    const patterns = [
      /href="\/ad_details\/(\d+)\//g,
      /href="[^"]*\/ad_details\/(\d+)[^"]*"/g,
      /campaign[_-]?id['":\s]+(\d+)/g
    ];

    patterns.forEach(pattern => {
      const matches = html.matchAll(pattern);
      for (const match of matches) {
        ids.add(match[1]);
      }
    });

    return Array.from(ids);
  }

  // ショッピングカテゴリーをスクレイピング
  async scrapeShoppingCategory(startId = 101, endId = 110) {
    console.log(`ショッピングカテゴリー ${startId}～${endId} をスクレイピング開始...`);
    
    for (let i = startId; i <= endId; i++) {
      const path = `/shopping/shop/${i}/`;
      console.log(`\nカテゴリーページ取得: ${path}`);
      
      try {
        const response = await this.fetch(path);
        
        if (response.status === 200) {
          const campaignIds = this.extractCampaignIds(response.data);
          console.log(`見つかった案件ID: ${campaignIds.length}件`);
          
          // 各案件の詳細を取得
          for (const id of campaignIds) {
            if (!this.campaigns.has(id)) {
              await this.delay(1000); // 1秒待機
              await this.scrapeCampaignDetail(id);
            }
          }
        } else if (response.status === 404) {
          console.log(`カテゴリー ${i} は存在しません`);
        } else {
          console.log(`エラー: ステータス ${response.status}`);
        }
      } catch (error) {
        console.error(`カテゴリー ${i} の取得エラー:`, error.message);
      }
      
      await this.delay(2000); // 2秒待機
    }
  }

  // 案件詳細をスクレイピング
  async scrapeCampaignDetail(campaignId) {
    const path = `/ad_details/${campaignId}/`;
    console.log(`案件詳細取得: ${campaignId}`);
    
    try {
      const response = await this.fetch(path);
      
      if (response.status === 200) {
        const campaign = this.extractCampaignDetails(response.data, campaignId);
        this.campaigns.set(campaignId, campaign);
        console.log(`✓ ${campaign.name} - ${campaign.cashback}`);
      } else {
        console.log(`案件 ${campaignId} の取得失敗: ステータス ${response.status}`);
      }
    } catch (error) {
      console.error(`案件 ${campaignId} の取得エラー:`, error.message);
    }
  }

  // 指定した案件IDを直接スクレイピング（テスト用）
  async testSingleCampaign(campaignId) {
    console.log(`\nテスト: 案件ID ${campaignId} の詳細を取得`);
    await this.scrapeCampaignDetail(campaignId);
    
    const campaign = this.campaigns.get(String(campaignId));
    if (campaign) {
      console.log('\n取得したデータ:');
      console.log(JSON.stringify(campaign, null, 2));
    }
  }

  // 待機処理
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 結果を保存
  async saveResults() {
    const data = {
      scraped_at: new Date().toISOString(),
      total_campaigns: this.campaigns.size,
      campaigns: Array.from(this.campaigns.values())
    };

    await fs.writeFile(
      'chobirich_campaigns.json',
      JSON.stringify(data, null, 2),
      'utf8'
    );
    
    console.log(`\n結果を chobirich_campaigns.json に保存しました`);
    console.log(`合計 ${this.campaigns.size} 件の案件を取得`);
  }
}

// 実行
async function main() {
  const scraper = new ChobirichScraper();
  
  // まず楽天市場（ID: 36796）でテスト
  await scraper.testSingleCampaign(36796);
  
  // 問題なければショッピングカテゴリーをスクレイピング
  console.log('\n\n=== ショッピングカテゴリーのスクレイピング開始 ===');
  await scraper.scrapeShoppingCategory(101, 105); // まず5ページ分
  
  // 結果を保存
  await scraper.saveResults();
}

main().catch(console.error);