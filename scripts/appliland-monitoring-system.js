const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pjjhyzbnnslaauwzknrr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqamh5emJubnNsYWF1d3prbnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5ODg4MzksImV4cCI6MjA2NjU2NDgzOX0.qcrcwNpwX83dCNbhxFaks2E68K_wp2W8urdYwfenDtM';

class ApplilandMonitoringSystem {
  constructor() {
    this.androidUserAgent = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.chobirichPointSiteId = 'f944d469-99a2-4285-8f7c-82027dddbc77';
  }

  async monitorNewApplilandCampaigns() {
    console.log('🔍 アプリランド案件監視システム開始');
    console.log('='.repeat(60));

    let browser;
    try {
      // 1. 既存のアプリランド案件IDを取得
      const { data: existingCampaigns, error: dbError } = await this.supabase
        .from('campaigns')
        .select('campaign_url')
        .ilike('name', '%アプリランド%')
        .eq('is_active', true);

      if (dbError) {
        throw new Error(`データベースエラー: ${dbError.message}`);
      }

      const existingIds = new Set();
      existingCampaigns.forEach(campaign => {
        const match = campaign.campaign_url?.match(/ad_details\/(\d+)/);
        if (match) {
          existingIds.add(match[1]);
        }
      });

      console.log(`📊 既存アプリランド案件: ${existingIds.size}件`);

      // 2. ちょびリッチのアプリランドページを巡回
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });

      const page = await browser.newPage();
      await page.setUserAgent(this.androidUserAgent);
      await page.setViewport({ width: 375, height: 667 });

      // アプリランドの検索ページをチェック
      const searchUrls = [
        'https://www.chobirich.com/smartphone?search_word=アプリランド',
        'https://www.chobirich.com/smartphone?category=1', // アプリカテゴリ
      ];

      const newCampaigns = [];

      for (const searchUrl of searchUrls) {
        console.log(`🔗 チェック中: ${searchUrl.substring(30)}...`);
        
        await page.goto(searchUrl, { 
          waitUntil: 'domcontentloaded',
          timeout: 15000 
        });
        
        await new Promise(resolve => setTimeout(resolve, 2000));

        // ページからアプリランド案件のリンクを抽出
        const campaignLinks = await page.evaluate(() => {
          const links = [];
          document.querySelectorAll('a[href*="/ad_details/"]').forEach(link => {
            const href = link.href;
            const text = link.textContent || '';
            if (text.includes('アプリランド') || link.closest('*').textContent.includes('アプリランド')) {
              const idMatch = href.match(/ad_details\/(\d+)/);
              if (idMatch) {
                links.push({
                  id: idMatch[1],
                  url: href,
                  title: text.trim().substring(0, 100)
                });
              }
            }
          });
          return links;
        });

        console.log(`   発見: ${campaignLinks.length}件のアプリランドリンク`);

        // 新規案件のみをフィルタリング
        for (const campaign of campaignLinks) {
          if (!existingIds.has(campaign.id)) {
            console.log(`🆕 新規案件発見: ID ${campaign.id}`);
            newCampaigns.push(campaign);
          }
        }
      }

      // 3. 新規案件を個別に取得・保存
      if (newCampaigns.length === 0) {
        console.log('✅ 新規アプリランド案件は見つかりませんでした');
        return;
      }

      console.log(`\n🚀 ${newCampaigns.length}件の新規案件を取得開始`);
      
      let successCount = 0;
      for (const newCampaign of newCampaigns) {
        console.log(`\n📍 案件 ${newCampaign.id} を処理中...`);
        
        const result = await this.scrapeSingleCampaign(page, newCampaign.id);
        if (result) {
          successCount++;
          console.log(`✅ 保存完了: ${result.name.substring(0, 50)}...`);
        } else {
          console.log(`❌ 保存失敗: ID ${newCampaign.id}`);
        }
        
        // レート制限回避
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`\n🎉 監視完了: ${successCount}/${newCampaigns.length}件の新規案件を追加`);

      if (successCount > 0) {
        console.log('\n💡 次のステップ:');
        console.log('   node scripts/generate-search-data.js');
      }

    } catch (error) {
      console.error(`💥 監視エラー: ${error.message}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async scrapeSingleCampaign(page, campaignId) {
    try {
      const url = `https://www.chobirich.com/ad_details/${campaignId}/`;
      
      await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });
      
      await new Promise(resolve => setTimeout(resolve, 2000));

      const campaignData = await page.evaluate(() => {
        // 案件名をページタイトルから取得
        let title = '';
        const pageTitle = document.title;
        if (pageTitle && pageTitle.includes('アプリランド')) {
          title = pageTitle.replace(/で貯める.*/, '').trim();
        }

        // 還元率の取得
        let cashback = '';
        const bodyText = document.body.textContent;
        const cashbackPatterns = [
          /最大(\d+(?:,\d{3})*)\s*ポイント/,
          /最大(\d+(?:,\d{3})*)\s*pt/,
          /(\d+(?:,\d{3})*)\s*ポイント/,
          /(\d+(?:,\d{3})*)\s*pt/
        ];
        
        for (const pattern of cashbackPatterns) {
          const match = bodyText.match(pattern);
          if (match) {
            cashback = match[0];
            break;
          }
        }

        return {
          title,
          cashback,
          hasAppliland: bodyText.includes('アプリランド')
        };
      });

      if (!campaignData.title || !campaignData.cashback || !campaignData.hasAppliland) {
        console.log(`   ⚠️  データ不足: ${campaignData.title} / ${campaignData.cashback}`);
        return null;
      }

      // データベースに保存
      const dbData = {
        name: campaignData.title,
        cashback_rate: campaignData.cashback,
        device: 'All',
        campaign_url: url,
        description: '遷移先の「アプリランド」ページをご確認ください',
        category: 'other',
        is_active: true,
        point_site_id: this.chobirichPointSiteId
      };

      const { data, error } = await this.supabase
        .from('campaigns')
        .insert([dbData])
        .select();

      if (error) {
        console.log(`   ❌ DB保存エラー: ${error.message}`);
        return null;
      }

      return data[0];

    } catch (error) {
      console.log(`   💥 案件取得エラー: ${error.message}`);
      return null;
    }
  }

  // 定期実行用のメソッド
  async scheduledMonitoring() {
    console.log(`⏰ 定期監視実行: ${new Date().toLocaleString('ja-JP')}`);
    await this.monitorNewApplilandCampaigns();
    
    // 次回実行時間を設定（24時間後）
    setTimeout(() => {
      this.scheduledMonitoring();
    }, 24 * 60 * 60 * 1000);
  }
}

// 実行方法の選択
if (require.main === module) {
  const monitor = new ApplilandMonitoringSystem();
  
  // 引数で実行方法を制御
  const arg = process.argv[2];
  if (arg === '--scheduled') {
    console.log('📅 定期監視モードで開始');
    monitor.scheduledMonitoring();
  } else {
    console.log('🔍 単発監視モードで実行');
    monitor.monitorNewApplilandCampaigns();
  }
}

module.exports = ApplilandMonitoringSystem;