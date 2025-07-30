const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pjjhyzbnnslaauwzknrr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqamh5emJubnNsYWF1d3prbnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5ODg4MzksImV4cCI6MjA2NjU2NDgzOX0.qcrcwNpwX83dCNbhxFaks2E68K_wp2W8urdYwfenDtM';

class MissingCampaignScraper {
  constructor() {
    this.androidUserAgent = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async scrapeCampaign(campaignId) {
    let browser;
    try {
      console.log(`🚀 ID ${campaignId}の案件を取得開始`);
      console.log('='.repeat(60));

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

      const url = `https://www.chobirich.com/ad_details/${campaignId}/`;
      console.log(`🔗 URL: ${url}`);

      const response = await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });

      if (!response || response.status() !== 200) {
        throw new Error(`HTTP ${response?.status() || 'unknown'}: ページの読み込みに失敗`);
      }

      // ページが完全に読み込まれるまで待機
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 案件データの抽出
      const campaignData = await page.evaluate(() => {
        // 案件名の取得（より詳細に探す）
        let title = '';
        const titleSelectors = [
          'h1',
          '.campaign-title', 
          '[data-campaign-name]',
          '.ad-title',
          'h2'
        ];
        
        for (const selector of titleSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim()) {
            title = element.textContent.trim();
            break;
          }
        }
        
        // ページタイトルからも取得を試行
        if (!title || title.length < 10 || title === 'みんなでボーナスキャッチについて') {
          const pageTitle = document.title;
          if (pageTitle && pageTitle.includes('マフィア')) {
            // "マフィア・シティ-極道風雲（アプリランド）で貯める / ポイントサイトちょびリッチ"
            title = pageTitle.replace(/で貯める.*/, '').trim();
          }
        }
        
        // それでも取得できない場合はボディテキストから抽出
        if (!title || title.length < 10) {
          const bodyText = document.body.textContent;
          const mafiaMatch = bodyText.match(/マフィア[・\-\s]*シティ[^\\n]*(?:アプリランド)?[^\\n]*/);
          if (mafiaMatch) {
            title = mafiaMatch[0].trim();
          }
        }
        
        // 還元率の取得（複数パターンを試行）
        let cashback = '';
        const cashbackPatterns = [
          /最大(\d+(?:,\d{3})*)\s*ポイント/,
          /最大(\d+(?:,\d{3})*)\s*pt/,
          /(\d+(?:,\d{3})*)\s*ポイント/,
          /(\d+(?:,\d{3})*)\s*pt/
        ];
        
        const bodyText = document.body.textContent;
        for (const pattern of cashbackPatterns) {
          const match = bodyText.match(pattern);
          if (match) {
            cashback = match[0];
            break;
          }
        }
        
        // 獲得条件の取得
        let method = '遷移先の「アプリランド」ページをご確認ください';
        const methodKeywords = ['StepUpミッション', 'アプリランド', '獲得方法'];
        const lines = bodyText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        
        for (const line of lines) {
          for (const keyword of methodKeywords) {
            if (line.includes(keyword) && line.length > 10 && line.length < 200) {
              method = line;
              break;
            }
          }
          if (method !== '遷移先の「アプリランド」ページをご確認ください') break;
        }
        
        // デバイス判定
         let device = 'All';
        if (title.includes('iOS') || title.includes('iPhone')) {
          device = 'iOS';
        } else if (title.includes('Android')) {
          device = 'Android';
        }
        
        // カテゴリ判定
        let category = 'other';
        if (title.includes('アプリ') || bodyText.includes('アプリインストール')) {
          category = 'other';
        }
        
        return {
          title,
          cashback,
          method: method.substring(0, 500), // 長すぎる場合は切り詰め
          device,
          category,
          hasAppland: bodyText.includes('アプリランド'),
          bodyText: bodyText.substring(0, 1000) // デバッグ用
        };
      });

      console.log('📊 取得データ:');
      console.log(`  名前: ${campaignData.title}`);
      console.log(`  還元率: ${campaignData.cashback}`);
      console.log(`  獲得条件: ${campaignData.method.substring(0, 100)}...`);
      console.log(`  デバイス: ${campaignData.device}`);
      console.log(`  カテゴリ: ${campaignData.category}`);
      console.log(`  アプリランド: ${campaignData.hasAppland ? 'あり' : 'なし'}`);

      if (!campaignData.title || !campaignData.cashback) {
        console.log('⚠️  重要データが不足しています');
        console.log('ページテキスト（先頭1000文字）:');
        console.log(campaignData.bodyText);
        return null;
      }

      // データベースに保存
      const dbData = {
        name: campaignData.title,
        cashback_rate: campaignData.cashback,
        device: campaignData.device,
        campaign_url: url,
        description: campaignData.method,
        category: campaignData.category,
        is_active: true,
        point_site_id: 'f944d469-99a2-4285-8f7c-82027dddbc77' // ちょびリッチのID
      };

      console.log('\n💾 データベースに保存中...');
      const { data, error } = await this.supabase
        .from('campaigns')
        .insert([dbData])
        .select();

      if (error) {
        console.error('❌ データベース保存エラー:', error);
        return null;
      }

      console.log('✅ データベースに保存完了');
      console.log(`📝 保存されたID: ${data[0]?.id}`);
      
      return data[0];

    } catch (error) {
      console.error(`💥 エラー: ${error.message}`);
      return null;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}

// 実行
(async () => {
  const scraper = new MissingCampaignScraper();
  const result = await scraper.scrapeCampaign('1840652');
  
  if (result) {
    console.log('\n🎉 取得成功！');
    console.log('次に検索データを再生成してください：');
    console.log('node scripts/generate-search-data.js');
  } else {
    console.log('\n❌ 取得失敗');
  }
})();