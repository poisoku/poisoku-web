const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;

// Supabase設定
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase環境変数が設定されていません');
  console.log('以下の環境変数を設定してください:');
  console.log('- NEXT_PUBLIC_SUPABASE_URL');
  console.log('- NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

class ChobirichImporter {
  constructor() {
    this.pointSiteId = null;
    this.importedCount = 0;
    this.errorCount = 0;
    this.skippedCount = 0;
  }

  async init() {
    console.log('🚀 ちょびリッチデータ インポート開始\n');
    
    // ちょびリッチポイントサイトを確保
    await this.ensurePointSite();
  }

  async ensurePointSite() {
    console.log('📍 ちょびリッチポイントサイトを確認中...');
    
    // 既存のちょびリッチを検索
    const { data: existing, error: searchError } = await supabase
      .from('point_sites')
      .select('id')
      .eq('name', 'ちょびリッチ')
      .single();

    if (existing) {
      this.pointSiteId = existing.id;
      console.log(`✅ 既存のちょびリッチを使用: ${this.pointSiteId}`);
      return;
    }

    // 新規作成
    const { data: newSite, error: insertError } = await supabase
      .from('point_sites')
      .insert({
        name: 'ちょびリッチ',
        url: 'https://www.chobirich.com/',
        category: 'major',
        description: 'スマホアプリ案件が豊富なポイントサイト',
        is_active: true
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('❌ ちょびリッチポイントサイト作成エラー:', insertError);
      throw insertError;
    }

    this.pointSiteId = newSite.id;
    console.log(`✅ ちょびリッチポイントサイト作成: ${this.pointSiteId}`);
  }

  async loadChobirichData() {
    try {
      console.log('📂 ちょびリッチデータを読み込み中...');
      
      // 最新のデータファイルを読み込み
      const dataFiles = [
        'chobirich_dual_os_improved_data.json',
        'chobirich_android_ios_apps_data.json'
      ];

      let data = null;
      for (const filename of dataFiles) {
        try {
          const fileContent = await fs.readFile(filename, 'utf8');
          data = JSON.parse(fileContent);
          console.log(`📄 データファイル読み込み: ${filename} (${data.campaigns?.length || 0}件)`);
          break;
        } catch (err) {
          console.log(`⚠️ ${filename} が見つかりません`);
        }
      }

      if (!data || !data.campaigns) {
        throw new Error('有効なちょびリッチデータファイルが見つかりません');
      }

      return data.campaigns;
    } catch (error) {
      console.error('❌ データ読み込みエラー:', error.message);
      throw error;
    }
  }

  // device値を正規化
  normalizeDevice(campaign) {
    if (!campaign.os) {
      return 'All'; // デフォルト値
    }

    switch (campaign.os.toLowerCase()) {
      case 'ios':
        return 'iOS';
      case 'android':
        return 'Android';
      case 'both':
        return 'iOS/Android';
      default:
        return 'All';
    }
  }

  // 案件データを変換
  transformCampaign(campaign) {
    return {
      name: campaign.name || `案件ID: ${campaign.id}`,
      point_site_id: this.pointSiteId,
      cashback_rate: campaign.cashback || 'なし',
      device: this.normalizeDevice(campaign),
      campaign_url: campaign.url || null,
      description: campaign.name || null,
      is_active: true
    };
  }

  async importCampaigns(campaigns) {
    console.log(`\n📥 ${campaigns.length}件の案件をインポート開始...\n`);

    // バッチサイズ
    const batchSize = 50;
    
    for (let i = 0; i < campaigns.length; i += batchSize) {
      const batch = campaigns.slice(i, i + batchSize);
      
      console.log(`[${Math.floor(i/batchSize) + 1}/${Math.ceil(campaigns.length/batchSize)}] ${batch.length}件処理中...`);
      
      const transformedBatch = batch.map(campaign => this.transformCampaign(campaign));
      
      // 重複チェック付きでインポート
      const { data, error } = await supabase
        .from('campaigns')
        .upsert(transformedBatch, {
          onConflict: 'name,point_site_id,device',
          ignoreDuplicates: false
        })
        .select('id');

      if (error) {
        console.error(`❌ バッチ${Math.floor(i/batchSize) + 1}エラー:`, error);
        this.errorCount += batch.length;
        continue;
      }

      const insertedCount = data?.length || 0;
      this.importedCount += insertedCount;
      this.skippedCount += (batch.length - insertedCount);
      
      console.log(`✅ ${insertedCount}件インポート完了 (スキップ: ${batch.length - insertedCount}件)`);
      
      // API制限回避のための待機
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  showStats() {
    console.log('\n=== インポート結果 ===');
    console.log(`📊 インポート件数: ${this.importedCount}件`);
    console.log(`⏭️ スキップ件数: ${this.skippedCount}件 (重複)`);
    console.log(`❌ エラー件数: ${this.errorCount}件`);
    console.log(`✅ 成功率: ${this.importedCount > 0 ? ((this.importedCount / (this.importedCount + this.errorCount)) * 100).toFixed(1) : 0}%`);
  }

  async run() {
    try {
      await this.init();
      
      const campaigns = await this.loadChobirichData();
      await this.importCampaigns(campaigns);
      
      this.showStats();
      
    } catch (error) {
      console.error('❌ インポート処理エラー:', error);
      throw error;
    }
  }
}

// メイン実行
async function main() {
  const importer = new ChobirichImporter();
  
  try {
    await importer.run();
    console.log('\n🎉 インポート完了！');
  } catch (error) {
    console.error('\n💥 インポート失敗:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);