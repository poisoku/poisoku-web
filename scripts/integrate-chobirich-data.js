const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;

const supabaseUrl = 'https://pjjhyzbnnslaauwzknrr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqamh5emJubnNsYWF1d3prbnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5ODg4MzksImV4cCI6MjA2NjU2NDgzOX0.qcrcwNpwX83dCNbhxFaks2E68K_wp2W8urdYwfenDtM';

class ChobirichDataIntegrator {
  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.chobirichSiteId = null;
  }

  // ちょびリッチのpoint_site_idを取得または作成
  async ensureChobirichSite() {
    console.log('🔍 ちょびリッチサイト情報を確認中...');
    
    // 既存のちょびリッチサイトを検索
    const { data: existingSite, error: searchError } = await this.supabase
      .from('point_sites')
      .select('id')
      .eq('name', 'ちょびリッチ')
      .single();
    
    if (existingSite) {
      this.chobirichSiteId = existingSite.id;
      console.log(`✅ 既存のちょびリッチサイトを発見: ${this.chobirichSiteId}`);
      return;
    }
    
    // ちょびリッチサイトが存在しない場合は作成
    console.log('📝 ちょびリッチサイトを新規作成中...');
    const { data: newSite, error: insertError } = await this.supabase
      .from('point_sites')
      .insert({
        name: 'ちょびリッチ',
        url: 'https://www.chobirich.com',
        category: 'major',
        description: 'ポイント還元率が高く、豊富な案件が揃うポイントサイト',
        is_active: true
      })
      .select('id')
      .single();
    
    if (insertError) {
      throw new Error(`ちょびリッチサイト作成エラー: ${insertError.message}`);
    }
    
    this.chobirichSiteId = newSite.id;
    console.log(`✅ ちょびリッチサイトを作成: ${this.chobirichSiteId}`);
  }

  // JSONファイルを読み込んで統合用データに変換
  async loadAndTransformData() {
    console.log('📂 ちょびリッチデータファイルを読み込み中...');
    
    const files = [
      { path: 'chobirich-shopping-campaigns-complete.json', source: 'shopping' },
      { path: 'chobirich-service-campaigns.json', source: 'service' }
    ];
    
    // アプリ案件ファイルも存在するかチェック
    try {
      await fs.access('chobirich_android_ios_apps_data.json');
      files.push({ path: 'chobirich_android_ios_apps_data.json', source: 'app', type: 'ios' });
    } catch (e) {
      console.log('iOS アプリ案件ファイルが見つかりません');
    }
    
    try {
      await fs.access('chobirich_android_app_campaigns.json');
      files.push({ path: 'chobirich_android_app_campaigns.json', source: 'app', type: 'android' });
    } catch (e) {
      console.log('Android アプリ案件ファイルが見つかりません');
    }
    
    const allCampaigns = [];
    
    for (const file of files) {
      try {
        const data = await fs.readFile(file.path, 'utf8');
        let campaigns;
        
        if (file.path.includes('service')) {
          // サービス案件の場合、JSONの構造を確認
          const jsonData = JSON.parse(data);
          campaigns = jsonData.campaigns || jsonData; // campaignsプロパティがある場合とない場合に対応
        } else if (file.path.includes('android_app_campaigns')) {
          // Android アプリ案件の場合
          const jsonData = JSON.parse(data);
          campaigns = jsonData.app_campaigns || [];
          console.log(`📱 Android app campaigns sample:`, campaigns[0]);
        } else if (file.path.includes('android_ios_apps_data')) {
          // iOS アプリ案件の場合
          const jsonData = JSON.parse(data);
          campaigns = jsonData.apps || jsonData.campaigns || jsonData;
        } else {
          campaigns = JSON.parse(data);
        }
        
        if (!Array.isArray(campaigns)) {
          console.log(`⚠️ ${file.path}: 配列形式ではありません - スキップ`);
          continue;
        }
        
        console.log(`📄 ${file.path}: ${campaigns.length}件の案件を読み込み`);
        
        // 不要案件をフィルタリングしてから変換
        const validCampaigns = campaigns.filter(campaign => this.isValidCampaign(campaign));
        console.log(`🔍 フィルタリング: ${campaigns.length}件 → ${validCampaigns.length}件 (${campaigns.length - validCampaigns.length}件除外)`);
        
        // 統合用フォーマットに変換
        const transformedCampaigns = validCampaigns.map((campaign, index) => ({
          // 既存のcampaignsテーブル構造に合わせる
          name: this.createUniqueName(campaign.name, campaign.id, file.source),
          point_site_id: this.chobirichSiteId,
          cashback_rate: this.formatCashbackRate(campaign),
          device: this.mapDevice(campaign.os || file.type, campaign),
          campaign_url: campaign.url,
          description: this.formatDescription(campaign),
          is_active: true,
          category: this.mapCategory(campaign.category, file.source)
        }));
        
        allCampaigns.push(...transformedCampaigns);
        
      } catch (error) {
        console.log(`⚠️ ${file.path} の読み込みに失敗: ${error.message}`);
      }
    }
    
    console.log(`📊 合計 ${allCampaigns.length}件の案件を変換完了`);
    return allCampaigns;
  }

  // ユニークな案件名を作成
  createUniqueName(name, id, source) {
    const cleanName = this.cleanCampaignName(name);
    const sourcePrefix = {
      'shopping': '[ショップ]',
      'service': '[サービス]',
      'app': '[アプリ]'
    }[source] || '[その他]';
    
    // 案件名が重複を避けるため、ID付きにする
    const idSuffix = id ? `_${String(id).slice(-8)}` : `_${Date.now()}`;
    return `${sourcePrefix}${cleanName}`.substring(0, 240) + idSuffix;
  }

  // 案件名をクリーンアップ
  cleanCampaignName(name) {
    if (!name) return '名前不明';
    
    return name
      .replace(/\s+/g, ' ')  // 複数の空白を1つに
      .replace(/^\s+|\s+$/g, '')  // 前後の空白を削除
      .replace(/\n/g, ' ')  // 改行を空白に
      .substring(0, 200);  // 200文字制限（プレフィックス用に余裕を持たせる）
  }

  // キャッシュバック率をフォーマット
  formatCashbackRate(campaign) {
    if (campaign.cashbackAmount) {
      return campaign.cashbackAmount + 'ポイント';
    }
    if (campaign.cashbackRate) {
      return campaign.cashbackRate;
    }
    return '要確認';
  }

  // デバイス情報をマッピング（案件名からも判定）
  mapDevice(os, campaign) {
    // まず元のOS情報をチェック
    if (os) {
      switch (os) {
        case 'iOS': return 'iOS';
        case 'ios': return 'iOS';
        case 'Android': return 'Android';
        case 'android': return 'Android';
        case '全デバイス': return 'All';
      }
    }
    
    // 案件名からデバイス情報を推測
    if (campaign && campaign.name) {
      const name = campaign.name.toLowerCase();
      
      // Android判定パターン
      if (name.includes('（android）') || 
          name.includes('(android)') || 
          name.includes('android用') ||
          name.includes('android版') ||
          name.includes('android限定')) {
        return 'Android';
      }
      
      // iOS判定パターン  
      if (name.includes('（ios）') || 
          name.includes('(ios)') || 
          name.includes('ios用') ||
          name.includes('ios版') ||
          name.includes('ios限定') ||
          name.includes('iphone') ||
          name.includes('ipad')) {
        return 'iOS';
      }
      
      // スマホ全般を示すパターン
      if (name.includes('スマホ') || 
          name.includes('スマートフォン') ||
          name.includes('携帯')) {
        return 'iOS/Android';
      }
    }
    
    // 判定できない場合はAll
    return 'All';
  }

  // カテゴリをマッピング（既存の制約に合わせる）
  mapCategory(category, source) {
    // 既存の許可されたカテゴリ: shopping, finance, other, travel, entertainment
    if (source === 'shopping') return 'shopping';
    if (source === 'service') return 'finance'; // サービス案件は金融カテゴリにマッピング
    if (source === 'app') return 'entertainment'; // アプリ案件はエンターテイメントにマッピング
    
    // フォールバック
    if (category && category.includes('ショッピング')) return 'shopping';
    if (category && category.includes('旅行')) return 'travel';
    if (category && category.includes('金融')) return 'finance';
    if (category && category.includes('エンタメ')) return 'entertainment';
    
    return 'other';
  }

  // 説明文をフォーマット
  formatDescription(campaign) {
    const parts = [];
    
    if (campaign.description) {
      parts.push(campaign.description);
    }
    
    if (campaign.condition) {
      parts.push(`条件: ${campaign.condition}`);
    }
    
    if (campaign.subCategory) {
      parts.push(`カテゴリ: ${campaign.subCategory}`);
    }
    
    return parts.join(' | ').substring(0, 500) || 'ちょびリッチの案件です';
  }

  // 重複チェック（ちょびリッチの既存案件）
  async removeExistingChobirichCampaigns() {
    console.log('🗑️ 既存のちょびリッチ案件を削除中...');
    
    const { data, error } = await this.supabase
      .from('campaigns')
      .delete()
      .eq('point_site_id', this.chobirichSiteId);
    
    if (error) {
      console.log(`⚠️ 削除エラー: ${error.message}`);
    } else {
      console.log('✅ 既存のちょびリッチ案件を削除完了');
    }
  }

  // データをバッチで挿入
  async insertCampaigns(campaigns) {
    console.log('💾 案件データを挿入中...');
    
    const batchSize = 100;
    let inserted = 0;
    let errors = 0;
    
    for (let i = 0; i < campaigns.length; i += batchSize) {
      const batch = campaigns.slice(i, i + batchSize);
      
      try {
        const { data, error } = await this.supabase
          .from('campaigns')
          .insert(batch);
        
        if (error) {
          console.log(`❌ バッチ ${Math.floor(i/batchSize) + 1} エラー: ${error.message}`);
          errors += batch.length;
        } else {
          inserted += batch.length;
          console.log(`✅ バッチ ${Math.floor(i/batchSize) + 1}: ${batch.length}件挿入`);
        }
      } catch (error) {
        console.log(`❌ バッチ ${Math.floor(i/batchSize) + 1} 例外: ${error.message}`);
        errors += batch.length;
      }
      
      // レート制限を避けるため少し待機
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`📊 挿入完了: ${inserted}件成功, ${errors}件失敗`);
    return { inserted, errors };
  }

  // メイン実行関数
  async run() {
    try {
      console.log('🚀 ちょびリッチデータ統合開始');
      console.log('='.repeat(60));
      
      // 1. ちょびリッチサイト情報を確保
      await this.ensureChobirichSite();
      
      // 2. データを読み込んで変換
      const campaigns = await this.loadAndTransformData();
      
      if (campaigns.length === 0) {
        console.log('❌ 統合するデータがありません');
        return;
      }
      
      // 3. 既存のちょびリッチ案件を削除
      await this.removeExistingChobirichCampaigns();
      
      // 4. 新しいデータを挿入
      const result = await this.insertCampaigns(campaigns);
      
      console.log('\n' + '='.repeat(60));
      console.log('🎉 ちょびリッチデータ統合完了');
      console.log('='.repeat(60));
      console.log(`✅ 統合成功: ${result.inserted}件`);
      console.log(`❌ 統合失敗: ${result.errors}件`);
      console.log(`🏠 ちょびリッチサイトID: ${this.chobirichSiteId}`);
      
    } catch (error) {
      console.error('💥 統合エラー:', error);
    }
  }

  // 案件の有効性を判定（不要案件を除外）
  isValidCampaign(campaign) {
    if (!campaign || !campaign.name) {
      return false;
    }

    const name = campaign.name.toLowerCase();
    
    // 除外パターン（案件ではない特別企画やバナー等）
    const excludePatterns = [
      // 特別企画・キャンペーン
      /大還元際/,
      /キャンペーン/,
      /特集/,
      /イベント/,
      /まとめ/,
      /ランキング/,
      /新着/,
      /おすすめ/,
      /人気/,
      /注目/,
      
      // 不完全なデータ
      /^名前不明/,
      /^案件名不明/,
      /^undefined/,
      /^null/,
      /^\s*$/,
      
      // 一般的でない文字列
      /^test/i,
      /^sample/i,
      /^demo/i,
      
      // 非常に短すぎる名前（2文字以下）
      /^.{0,2}$/,
    ];

    // 除外パターンに一致するかチェック
    for (const pattern of excludePatterns) {
      if (pattern.test(name)) {
        console.log(`🚫 除外: ${campaign.name} (理由: ${pattern})`);
        return false;
      }
    }

    // URLパターンのチェック（有効な案件URLの形式）
    if (campaign.url) {
      const url = campaign.url;
      // ちょびリッチの案件URLは通常 /ad_details/数字/ の形式
      if (url.includes('chobirich.com') && !url.includes('/ad_details/')) {
        console.log(`🚫 除外: ${campaign.name} (理由: 無効なURL形式)`);
        return false;
      }
    }

    // 還元率が明らかに無効な場合
    if (campaign.cashback) {
      const cashback = campaign.cashback.toLowerCase();
      if (cashback.includes('error') || cashback.includes('null') || cashback.includes('undefined')) {
        console.log(`🚫 除外: ${campaign.name} (理由: 無効な還元率)`);
        return false;
      }
    }

    return true;
  }
}

// 実行
(async () => {
  const integrator = new ChobirichDataIntegrator();
  await integrator.run();
})();