const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;

const supabaseUrl = 'https://pjjhyzbnnslaauwzknrr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqamh5emJubnNsYWF1d3prbnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5ODg4MzksImV4cCI6MjA2NjU2NDgzOX0.qcrcwNpwX83dCNbhxFaks2E68K_wp2W8urdYwfenDtM';

const supabase = createClient(supabaseUrl, supabaseKey);

class PointIncomeDataIntegrator {
  constructor() {
    this.siteName = 'ポイントインカム';
    this.conversionRate = 10; // 10ポイント = 1円
    this.processedCount = 0;
    this.errorCount = 0;
    this.pointSiteId = null;
  }
  
  // カテゴリをマッピング
  mapCategory(category) {
    // 許可されたカテゴリ: shopping, finance, other, travel, entertainment
    if (category.includes('ショッピング') || category.includes('EC') || category.includes('ファッション') || category.includes('グルメ')) {
      return 'shopping';
    }
    if (category.includes('金融') || category.includes('クレジット') || category.includes('口座') || category.includes('FX')) {
      return 'finance';
    }
    if (category.includes('旅行') || category.includes('ホテル')) {
      return 'travel';
    }
    if (category.includes('アプリ') || category.includes('ゲーム') || category.includes('エンタメ')) {
      return 'entertainment';
    }
    return 'other';
  }

  // ポイントインカムのcashback値を正規化
  normalizeCashback(campaign) {
    // 円表記を優先
    if (campaign.cashbackYen) {
      return campaign.cashbackYen.substring(0, 50);
    }
    
    // パーセント表記
    if (campaign.cashback && campaign.cashback.includes('%')) {
      // 複数行の場合は最初の%表記を抽出
      const percentMatch = campaign.cashback.match(/(\d+(?:\.\d+)?%)/);
      if (percentMatch) {
        return percentMatch[1];
      }
    }
    
    // ポイント表記の場合は円に変換
    if (campaign.cashback && campaign.cashback.includes('ポイント')) {
      const pointMatch = campaign.cashback.match(/(\d+)ポイント/);
      if (pointMatch) {
        const points = parseInt(pointMatch[1]);
        const yen = Math.floor(points / this.conversionRate);
        return `${yen}円`;
      }
    }
    
    // 複雑なcashback値の処理（例: "61%還元\n11,000pt"）
    if (campaign.cashback && campaign.cashback.includes('pt')) {
      const ptMatch = campaign.cashback.match(/(\d{1,3}(?:,\d{3})*)\s*pt/);
      if (ptMatch) {
        const points = parseInt(ptMatch[1].replace(/,/g, ''));
        const yen = Math.floor(points / this.conversionRate);
        return `${yen}円`;
      }
    }
    
    return (campaign.cashback || '不明').substring(0, 50);
  }

  // 案件名をクリーンアップ
  cleanupTitle(title) {
    if (!title) return '不明';
    
    // 不要な文字を削除
    return title
      .replace(/【.*?】/g, '') // 【】内を削除
      .replace(/\s+/g, ' ')    // 連続スペースを単一スペースに
      .trim();
  }

  async deleteExistingData() {
    console.log(`🗑️ 既存の${this.siteName}データを削除中...`);
    
    try {
      // まずポイントインカムのpoint_site_idを取得
      const { data: siteData, error: siteError } = await supabase
        .from('point_sites')
        .select('id')
        .eq('name', this.siteName)
        .single();
      
      if (siteError) {
        console.error('サイトID取得エラー:', siteError);
        return false;
      }
      
      this.pointSiteId = siteData.id;
      
      // 既存のキャンペーンを削除
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('point_site_id', this.pointSiteId);
      
      if (error) {
        console.error('削除エラー:', error);
        return false;
      }
      
      console.log('✅ 既存データの削除完了');
      return true;
    } catch (error) {
      console.error('削除中にエラー:', error);
      return false;
    }
  }

  async insertCampaigns(campaigns) {
    console.log(`\n📥 ${campaigns.length}件の案件をデータベースに挿入中...`);
    
    const supabaseData = campaigns.map(campaign => ({
      name: campaign.title,
      point_site_id: this.pointSiteId,
      cashback_rate: this.normalizeCashback(campaign),
      device: campaign.device || 'All',
      campaign_url: campaign.campaignUrl || campaign.url,
      description: campaign.title,
      is_active: true,
      category: this.mapCategory(campaign.category || 'その他')
    }));

    // バッチで挿入（100件ずつ）
    const batchSize = 100;
    for (let i = 0; i < supabaseData.length; i += batchSize) {
      const batch = supabaseData.slice(i, i + batchSize);
      
      try {
        const { error } = await supabase
          .from('campaigns')
          .insert(batch);
        
        if (error) {
          console.error(`❌ バッチ挿入エラー (${i}-${i + batch.length}):`, error);
          this.errorCount += batch.length;
        } else {
          this.processedCount += batch.length;
          console.log(`✅ ${this.processedCount}/${campaigns.length}件完了`);
        }
      } catch (error) {
        console.error(`❌ 挿入エラー:`, error);
        this.errorCount += batch.length;
      }
    }
  }

  async processFile(filename) {
    try {
      console.log(`\n📂 ファイル処理開始: ${filename}`);
      
      // JSONファイルを読み込み
      const jsonData = await fs.readFile(filename, 'utf8');
      const data = JSON.parse(jsonData);
      
      console.log(`📊 データ概要:`);
      console.log(`  - サイト名: ${data.siteName}`);
      console.log(`  - 案件数: ${data.campaigns.length}`);
      console.log(`  - スクレイピング日時: ${data.scrapedAt}`);
      
      // 既存データを削除
      await this.deleteExistingData();
      
      // 新規データを挿入
      await this.insertCampaigns(data.campaigns);
      
      console.log(`\n✅ 処理完了`);
      console.log(`  - 成功: ${this.processedCount}件`);
      console.log(`  - エラー: ${this.errorCount}件`);
      
    } catch (error) {
      console.error('❌ ファイル処理エラー:', error);
    }
  }

  async updateSearchData() {
    console.log('\n🔍 検索データを更新中...');
    
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      await execAsync('node scripts/generate-search-data.js');
      console.log('✅ 検索データの更新完了');
      
    } catch (error) {
      console.error('❌ 検索データ更新エラー:', error);
    }
  }
}

// 実行
(async () => {
  const integrator = new PointIncomeDataIntegrator();
  
  // 引数からファイル名を取得（デフォルトはテスト結果）
  const filename = process.argv[2] || 'scripts/pointincome/pointincome_unified_test_results.json';
  
  await integrator.processFile(filename);
  await integrator.updateSearchData();
  
  console.log('\n🎉 ポイントインカムデータの統合が完了しました！');
  console.log('📍 https://poisoku.jp/search で検索してみてください');
})();