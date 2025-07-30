const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;

/**
 * デュアル環境データの統合処理
 * iOS・Android両環境で取得したアプリ案件をデータベースに統合
 */
class DualEnvironmentDataIntegrator {
  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    
    this.stats = {
      processed: 0,
      inserted: 0,
      updated: 0,
      errors: 0,
      iosSpecific: 0,
      androidSpecific: 0,
      bothPlatforms: 0
    };
  }

  async loadDualEnvironmentData() {
    console.log('📚 デュアル環境データ読み込み開始');
    
    const dataFiles = [
      'chobirich_dual_os_improved_data.json',
      'chobirich_android_app_campaigns.json',
      'chobirich_all_app_campaigns.json'
    ];
    
    let allCampaigns = [];
    
    for (const file of dataFiles) {
      try {
        const data = JSON.parse(await fs.readFile(file, 'utf8'));
        console.log(`📄 ${file}: ${data.campaigns?.length || data.app_campaigns?.length || data.length}件`);
        
        if (data.campaigns) {
          allCampaigns.push(...data.campaigns);
        } else if (data.app_campaigns) {
          allCampaigns.push(...data.app_campaigns);
        } else if (Array.isArray(data)) {
          allCampaigns.push(...data);
        }
      } catch (error) {
        console.log(`⚠️ ${file}読み込みスキップ: ${error.message}`);
      }
    }
    
    console.log(`📊 総データ数: ${allCampaigns.length}件`);
    return allCampaigns;
  }

  async processAndInsertCampaigns(campaigns) {
    console.log('\\n🔄 キャンペーンデータ処理・統合開始');
    
    const batchSize = 50;
    const totalBatches = Math.ceil(campaigns.length / batchSize);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * batchSize;
      const end = Math.min(start + batchSize, campaigns.length);
      const batch = campaigns.slice(start, end);
      
      console.log(`\\n📦 バッチ ${batchIndex + 1}/${totalBatches} (${batch.length}件)`);
      
      await this.processBatch(batch);
      
      // バッチ間で少し待機
      if (batchIndex < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  async processBatch(campaigns) {
    for (const campaign of campaigns) {
      try {
        await this.processSingleCampaign(campaign);
        this.stats.processed++;
      } catch (error) {
        console.error(`❌ キャンペーン処理エラー [${campaign.id}]: ${error.message}`);
        this.stats.errors++;
      }
    }
  }

  async processSingleCampaign(campaign) {
    // データ正規化
    const normalizedCampaign = this.normalizeCampaignData(campaign);
    
    // 既存データチェック
    const existingCampaign = await this.findExistingCampaign(normalizedCampaign);
    
    if (existingCampaign) {
      // 更新処理
      await this.updateExistingCampaign(existingCampaign, normalizedCampaign);
    } else {
      // 新規挿入処理
      await this.insertNewCampaign(normalizedCampaign);
    }
  }

  normalizeCampaignData(campaign) {
    return {
      id: campaign.id?.toString(),
      name: campaign.name || '',
      url: campaign.url || `https://www.chobirich.com/ad_details/${campaign.id}/`,
      cashback: this.normalizeCashback(campaign.cashback || campaign.pt || ''),
      category: 'アプリ',
      site: 'chobirich',
      device: this.normalizeDeviceInfo(campaign),
      environment: campaign.environment || this.inferEnvironment(campaign),
      method: campaign.method || campaign.conditions?.method || '',
      scraped_at: campaign.timestamp || new Date().toISOString()
    };
  }

  normalizeCashback(cashback) {
    if (!cashback || cashback === '不明' || cashback === 'なし') {
      return null;
    }
    
    // ポイント形式の正規化
    const cleaned = cashback.toString()
      .replace(/,/g, '')
      .replace(/ちょび/g, '')
      .replace(/ポイント/g, 'pt')
      .trim();
    
    return cleaned;
  }

  normalizeDeviceInfo(campaign) {
    // OS情報の統合・正規化
    if (campaign.os) {
      return campaign.os;
    }
    
    if (campaign.device) {
      return campaign.device;
    }
    
    // 環境やキーワードから推測
    const name = (campaign.name || '').toLowerCase();
    if (name.includes('ios') || name.includes('iphone')) {
      return 'ios';
    } else if (name.includes('android')) {
      return 'android';
    }
    
    return 'all';
  }

  inferEnvironment(campaign) {
    if (campaign.environment) {
      return campaign.environment;
    }
    
    if (campaign.iosSpecific) {
      return 'ios';
    }
    
    if (campaign.androidSpecific) {
      return 'android';
    }
    
    return 'unified';
  }

  async findExistingCampaign(campaign) {
    const { data, error } = await this.supabase
      .from('campaigns')
      .select('*')
      .eq('external_id', campaign.id)
      .eq('site', 'chobirich')
      .single();
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    return data;
  }

  async updateExistingCampaign(existing, newData) {
    // 重要フィールドの更新チェック
    const updates = {};
    
    if (existing.name !== newData.name && newData.name) {
      updates.name = newData.name;
    }
    
    if (existing.cashback !== newData.cashback && newData.cashback) {
      updates.cashback = newData.cashback;
    }
    
    if (existing.device !== newData.device && newData.device !== 'all') {
      updates.device = newData.device;
    }
    
    if (existing.method !== newData.method && newData.method) {
      updates.method = newData.method;
    }
    
    // 環境情報の追加・更新
    if (newData.environment && (!existing.environment || existing.environment === 'unified')) {
      updates.environment = newData.environment;
    }
    
    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      
      const { error } = await this.supabase
        .from('campaigns')
        .update(updates)
        .eq('id', existing.id);
      
      if (error) throw error;
      
      console.log(`✅ 更新 [${newData.id}] ${newData.name.substring(0, 50)}... - ${newData.device}`);
      this.stats.updated++;
    }
  }

  async insertNewCampaign(campaign) {
    const insertData = {
      external_id: campaign.id,
      name: campaign.name,
      url: campaign.url,
      cashback: campaign.cashback,
      category: campaign.category,
      site: campaign.site,
      device: campaign.device,
      environment: campaign.environment,
      method: campaign.method,
      scraped_at: campaign.scraped_at,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { error } = await this.supabase
      .from('campaigns')
      .insert([insertData]);
    
    if (error) throw error;
    
    console.log(`✅ 挿入 [${campaign.id}] ${campaign.name.substring(0, 50)}... - ${campaign.device}`);
    this.stats.inserted++;
    
    // デバイス統計更新
    if (campaign.device === 'ios') {
      this.stats.iosSpecific++;
    } else if (campaign.device === 'android') {
      this.stats.androidSpecific++;
    } else if (campaign.device === 'both') {
      this.stats.bothPlatforms++;
    }
  }

  async updateSearchData() {
    console.log('\\n🔍 検索データ更新開始');
    
    try {
      // 最新のキャンペーンデータを取得
      const { data: campaigns, error } = await this.supabase
        .from('campaigns')
        .select('*')
        .eq('site', 'chobirich')
        .eq('category', 'アプリ')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      console.log(`📊 取得したキャンペーン数: ${campaigns.length}件`);
      
      // 検索データ形式に変換
      const searchData = campaigns.map(campaign => ({
        id: campaign.external_id,
        name: campaign.name,
        cashback: campaign.cashback || '',
        category: campaign.category,
        site: campaign.site,
        device: campaign.device,
        environment: campaign.environment,
        url: campaign.url
      }));
      
      // 検索データファイル更新
      await fs.writeFile(
        'public/search-data.json',
        JSON.stringify(searchData, null, 2)
      );
      
      // 検索インデックス更新
      const searchIndex = searchData.map(item => ({
        id: item.id,
        name: item.name,
        keywords: this.generateSearchKeywords(item)
      }));
      
      await fs.writeFile(
        'public/search-index.json',
        JSON.stringify(searchIndex, null, 2)
      );
      
      console.log('✅ 検索データ更新完了');
      
    } catch (error) {
      console.error('❌ 検索データ更新エラー:', error);
    }
  }

  generateSearchKeywords(campaign) {
    const keywords = [];
    
    // 基本情報
    keywords.push(campaign.name);
    if (campaign.cashback) keywords.push(campaign.cashback);
    keywords.push(campaign.site);
    keywords.push(campaign.category);
    
    // デバイス情報
    if (campaign.device) {
      keywords.push(campaign.device);
      if (campaign.device === 'ios') {
        keywords.push('iPhone', 'iPad', 'App Store');
      } else if (campaign.device === 'android') {
        keywords.push('Android', 'Google Play');
      }
    }
    
    // 環境情報
    if (campaign.environment) {
      keywords.push(campaign.environment);
    }
    
    return keywords.join(' ').toLowerCase();
  }

  showFinalReport() {
    console.log('\\n' + '='.repeat(80));
    console.log('📊 デュアル環境データ統合完了レポート');
    console.log('='.repeat(80));
    
    console.log(`\\n📈 処理統計:`);
    console.log(`  総処理数: ${this.stats.processed}件`);
    console.log(`  新規挿入: ${this.stats.inserted}件`);
    console.log(`  既存更新: ${this.stats.updated}件`);
    console.log(`  エラー: ${this.stats.errors}件`);
    
    console.log(`\\n📱 デバイス別統計:`);
    console.log(`  iOS専用: ${this.stats.iosSpecific}件`);
    console.log(`  Android専用: ${this.stats.androidSpecific}件`);
    console.log(`  両対応: ${this.stats.bothPlatforms}件`);
    
    const successRate = ((this.stats.processed - this.stats.errors) / this.stats.processed * 100).toFixed(1);
    console.log(`\\n✅ 成功率: ${successRate}%`);
    
    console.log('\\n次のステップ:');
    console.log('1. ポイ速アプリでAndroid案件の表示確認');
    console.log('2. iOS・Android固有案件の検索結果確認');  
    console.log('3. デュアル環境スクレイピングの定期実行設定');
    
    console.log('\\n🎯 デュアル環境システム構築完了！');
  }

  async run() {
    console.log('🚀 デュアル環境データ統合システム開始\\n');
    console.log('='.repeat(80));
    console.log('目的: iOS・Android両環境で取得したアプリ案件をデータベースに統合');
    console.log('効果: Android専用案件の検索結果表示、iOS固有案件の充実化');
    console.log('='.repeat(80));
    
    try {
      // 1. データ読み込み
      const campaigns = await this.loadDualEnvironmentData();
      
      if (campaigns.length === 0) {
        console.log('⚠️ 統合対象データが見つかりません');
        return;
      }
      
      // 2. データベース統合
      await this.processAndInsertCampaigns(campaigns);
      
      // 3. 検索データ更新
      await this.updateSearchData();
      
      // 4. 最終レポート
      this.showFinalReport();
      
    } catch (error) {
      console.error('💥 統合処理エラー:', error);
    }
  }
}

// 実行
(async () => {
  const integrator = new DualEnvironmentDataIntegrator();
  await integrator.run();
})();