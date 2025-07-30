const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;

// 環境変数を.env.localから読み込む
require('dotenv').config({ path: '.env.local' });

/**
 * Android案件の統合処理
 */
class AndroidCampaignIntegrator {
  constructor() {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      throw new Error('Supabase環境変数が設定されていません');
    }
    
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    
    this.stats = {
      processed: 0,
      inserted: 0,
      updated: 0,
      errors: 0
    };
  }

  cleanCampaignName(name) {
    // 改行、タブ、余分な空白を削除
    return name
      .replace(/\n/g, ' ')
      .replace(/\t/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  extractCampaignTitle(fullName) {
    // ポイント情報と獲得条件を除外してタイトルのみ抽出
    const match = fullName.match(/^([^0-9]+?)(?:\s+\d+pt|\s+最大\d+pt|\s+新規)/);
    if (match) {
      return match[1].trim();
    }
    
    // 「（Android）」までをタイトルとする
    const androidMatch = fullName.match(/^(.+?（Android）)/);
    if (androidMatch) {
      return androidMatch[1].trim();
    }
    
    return fullName.split(' ')[0].trim();
  }

  async loadAndroidCampaigns() {
    console.log('📚 Android案件データ読み込み中...');
    
    const data = JSON.parse(await fs.readFile('chobirich_quick_android_campaigns.json', 'utf8'));
    console.log(`✅ ${data.total_android_campaigns}件のAndroid案件を読み込み`);
    
    // データクリーンアップ
    const cleanedCampaigns = data.campaigns.map(campaign => {
      const cleanedName = this.cleanCampaignName(campaign.name);
      const title = this.extractCampaignTitle(cleanedName);
      
      return {
        id: campaign.id,
        name: title,
        url: campaign.url,
        cashback: campaign.cashback,
        device: 'android',
        fullText: cleanedName
      };
    });
    
    return cleanedCampaigns;
  }

  async getSiteId() {
    const { data, error } = await this.supabase
      .from('sites')
      .select('id')
      .eq('name', 'ちょびリッチ')
      .single();
    
    if (error) throw error;
    return data.id;
  }

  async processCampaigns(campaigns, siteId) {
    console.log('\\n🔄 Android案件の処理開始');
    
    for (const campaign of campaigns) {
      try {
        // 既存チェック
        const { data: existing } = await this.supabase
          .from('campaigns')
          .select('id, device')
          .eq('external_id', campaign.id)
          .eq('site_id', siteId)
          .single();
        
        if (existing) {
          // 既存の場合、deviceをandroidに更新
          if (existing.device !== 'android') {
            const { error } = await this.supabase
              .from('campaigns')
              .update({ 
                device: 'android',
                updated_at: new Date().toISOString()
              })
              .eq('id', existing.id);
            
            if (!error) {
              console.log(`✅ 更新 [${campaign.id}] ${campaign.name} -> Android`);
              this.stats.updated++;
            }
          }
        } else {
          // 新規挿入
          const insertData = {
            external_id: campaign.id,
            name: campaign.name,
            url: campaign.url,
            cashback: campaign.cashback,
            category: 'アプリ',
            site_id: siteId,
            device: 'android',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          const { error } = await this.supabase
            .from('campaigns')
            .insert([insertData]);
          
          if (!error) {
            console.log(`✅ 挿入 [${campaign.id}] ${campaign.name}`);
            this.stats.inserted++;
          }
        }
        
        this.stats.processed++;
        
      } catch (error) {
        console.error(`❌ エラー [${campaign.id}]: ${error.message}`);
        this.stats.errors++;
      }
    }
  }

  async updateSearchData() {
    console.log('\\n🔍 検索データ更新中...');
    
    // generate-search-data.jsを実行
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    
    try {
      await execAsync('node scripts/generate-search-data.js');
      console.log('✅ 検索データ更新完了');
    } catch (error) {
      console.error('❌ 検索データ更新エラー:', error);
    }
  }

  showReport() {
    console.log('\\n' + '='.repeat(60));
    console.log('📊 Android案件統合完了レポート');
    console.log('='.repeat(60));
    console.log(`処理数: ${this.stats.processed}件`);
    console.log(`新規挿入: ${this.stats.inserted}件`);
    console.log(`既存更新: ${this.stats.updated}件`);
    console.log(`エラー: ${this.stats.errors}件`);
    console.log('\\n🎯 Android案件がポイ速の検索結果に表示されるようになりました！');
  }

  async run() {
    console.log('🚀 Android案件統合処理開始\\n');
    
    try {
      // 1. Android案件読み込み
      const campaigns = await this.loadAndroidCampaigns();
      
      // 2. サイトID取得
      const siteId = await this.getSiteId();
      console.log(`✅ ちょびリッチサイトID: ${siteId}`);
      
      // 3. キャンペーン処理
      await this.processCampaigns(campaigns, siteId);
      
      // 4. 検索データ更新
      await this.updateSearchData();
      
      // 5. レポート表示
      this.showReport();
      
    } catch (error) {
      console.error('💥 統合処理エラー:', error);
    }
  }
}

// 実行
(async () => {
  const integrator = new AndroidCampaignIntegrator();
  await integrator.run();
})();