#!/usr/bin/env node

/**
 * 全スクレイピングデータ統合スクリプト
 * ちょびリッチ・ポイントインカムの最新データを統合してsearch-data.jsonを生成
 */

const fs = require('fs').promises;
const path = require('path');

class AllDataIntegrator {
  constructor() {
    this.outputFile = path.join(__dirname, '..', 'public', 'search-data.json');
    this.backupFile = path.join(__dirname, '..', 'public', `search-data-backup-${Date.now()}.json`);
    this.campaigns = [];
    this.stats = {
      chobirich: { web: 0, ios: 0, android: 0 },
      pointincome: { web: 0, ios: 0, android: 0, pc: 0 },
      total: 0,
      errors: []
    };
  }

  async execute() {
    console.log('🔄 全スクレイピングデータ統合開始');
    console.log('='.repeat(70));

    try {
      // Step 1: 既存データバックアップ
      await this.backupExistingData();

      // Step 2: ちょびリッチデータ読み込み
      await this.loadChobirichData();

      // Step 3: ポイントインカムデータ読み込み
      await this.loadPointIncomeData();

      // Step 4: データ統合・変換
      const searchData = await this.createSearchData();

      // Step 5: ファイル保存
      await this.saveSearchData(searchData);

      // Step 6: レポート出力
      this.generateReport();

      console.log('\n✅ データ統合完了！');
      console.log(`📁 出力ファイル: ${this.outputFile}`);

    } catch (error) {
      console.error('❌ データ統合エラー:', error);
      process.exit(1);
    }
  }

  async backupExistingData() {
    try {
      const exists = await fs.access(this.outputFile).then(() => true).catch(() => false);
      if (exists) {
        await fs.copyFile(this.outputFile, this.backupFile);
        console.log(`📦 既存データバックアップ完了: ${path.basename(this.backupFile)}`);
      }
    } catch (error) {
      console.log('💡 既存データなし（新規作成）');
    }
  }

  async loadChobirichData() {
    console.log('\n📥 ちょびリッチデータ読み込み中...');
    
    // 最新のちょびリッチデータファイルを探す
    const dataDir = path.join(__dirname, '..', 'scrapers', 'data');
    const scrapersDir = path.join(__dirname, '..', 'scrapers');
    const files = await fs.readdir(dataDir);
    const scrapersFiles = await fs.readdir(scrapersDir);
    
    // 通常案件データ
    const v3Files = files.filter(f => f.includes('chobirich_complete_v3_') && f.endsWith('.json'));
    if (v3Files.length > 0) {
      const latestV3 = v3Files.sort().pop();
      const v3Data = JSON.parse(await fs.readFile(path.join(dataDir, latestV3), 'utf8'));
      
      if (v3Data.campaigns && Array.isArray(v3Data.campaigns)) {
        v3Data.campaigns.forEach(campaign => {
          this.campaigns.push(this.convertChobirichCampaign(campaign));
          this.stats.chobirich.web++;
        });
        console.log(`  ✅ 通常案件: ${v3Data.campaigns.length}件`);
      }
    }

    // アプリ案件データ
    const appFiles = scrapersFiles.filter(f => f.includes('chobirich_mobile_app_campaigns_combined_') && f.endsWith('.json'));
    if (appFiles.length > 0) {
      const latestApp = appFiles.sort().pop();
      const appData = JSON.parse(await fs.readFile(path.join(scrapersDir, latestApp), 'utf8'));
      
      if (appData.campaigns && Array.isArray(appData.campaigns)) {
        appData.campaigns.forEach(campaign => {
          const deviceType = campaign.os?.toLowerCase() || 'unknown';
          this.campaigns.push(this.convertChobirichCampaign({ ...campaign, device: deviceType }));
          
          if (deviceType === 'ios') {
            this.stats.chobirich.ios++;
          } else if (deviceType === 'android') {
            this.stats.chobirich.android++;
          }
        });
        
        console.log(`  ✅ アプリ案件: iOS ${this.stats.chobirich.ios}件, Android ${this.stats.chobirich.android}件`);
      }
    } else {
      console.log('  📱 アプリ案件: データ待機中...');
    }
  }

  async loadPointIncomeData() {
    console.log('\n📥 ポイントインカムデータ読み込み中...');
    
    const dataDir = path.join(__dirname, '..', 'scrapers', 'data', 'pointincome');
    
    try {
      // 通常案件（最新のwebデータ）
      const webFiles = await fs.readdir(dataDir);
      const latestWeb = webFiles
        .filter(f => f.includes('pointincome_web_') && f.endsWith('.json'))
        .sort()
        .pop();
      
      if (latestWeb) {
        const webData = JSON.parse(await fs.readFile(path.join(dataDir, latestWeb), 'utf8'));
        if (webData.campaigns) {
          webData.campaigns.forEach(campaign => {
            this.campaigns.push(this.convertPointIncomeCampaign(campaign, 'web'));
            this.stats.pointincome.web++;
          });
          console.log(`  ✅ 通常案件: ${webData.campaigns.length}件`);
        }
      }

      // アプリ案件
      const appFiles = webFiles.filter(f => f.includes('pointincome_app_full_combined_') && f.endsWith('.json'));
      if (appFiles.length > 0) {
        const latestApp = appFiles.sort().pop();
        const appData = JSON.parse(await fs.readFile(path.join(dataDir, latestApp), 'utf8'));
        
        // campaigns配列から直接取得（新しいフォーマット対応）
        if (appData.campaigns && Array.isArray(appData.campaigns)) {
          appData.campaigns.forEach(campaign => {
            const deviceType = campaign.device?.toLowerCase() || 'unknown';
            this.campaigns.push(this.convertPointIncomeCampaign(campaign, deviceType));
            
            if (deviceType === 'ios') {
              this.stats.pointincome.ios++;
            } else if (deviceType === 'android') {
              this.stats.pointincome.android++;
            }
          });
        } else if (appData.ios_campaigns || appData.android_campaigns) {
          // 旧フォーマット対応
          if (appData.ios_campaigns) {
            appData.ios_campaigns.forEach(campaign => {
              this.campaigns.push(this.convertPointIncomeCampaign(campaign, 'ios'));
              this.stats.pointincome.ios++;
            });
          }
          
          if (appData.android_campaigns) {
            appData.android_campaigns.forEach(campaign => {
              this.campaigns.push(this.convertPointIncomeCampaign(campaign, 'android'));
              this.stats.pointincome.android++;
            });
          }
        }
        
        console.log(`  ✅ アプリ案件: iOS ${this.stats.pointincome.ios}件, Android ${this.stats.pointincome.android}件`);
      }

      // PC限定案件
      const pcFiles = webFiles.filter(f => f.includes('pointincome_pc_only_campaigns_') && f.endsWith('.json'));
      if (pcFiles.length > 0) {
        const latestPC = pcFiles.sort().pop();
        const pcData = JSON.parse(await fs.readFile(path.join(dataDir, latestPC), 'utf8'));
        
        if (pcData.campaigns) {
          pcData.campaigns.forEach(campaign => {
            this.campaigns.push(this.convertPointIncomeCampaign(campaign, 'pc'));
            this.stats.pointincome.pc++;
          });
          console.log(`  ✅ PC限定案件: ${pcData.campaigns.length}件`);
        }
      }

    } catch (error) {
      console.error('  ⚠️ ポイントインカムデータ読み込みエラー:', error.message);
      this.stats.errors.push({ site: 'pointincome', error: error.message });
    }
  }

  convertChobirichCampaign(campaign) {
    // 還元率の正規化
    let cashbackValue = 0;
    let cashbackUnit = 'pt';
    
    if (campaign.points) {
      const match = campaign.points.match(/([0-9,]+)(pt|%|％|円)/);
      if (match) {
        cashbackValue = parseInt(match[1].replace(/,/g, ''));
        cashbackUnit = match[2].replace('％', '%');
      }
    }

    // デバイス情報を検索システム形式に変換
    let deviceForSearch = 'All';
    const deviceLower = (campaign.device || campaign.os || 'すべて').toLowerCase();
    if (deviceLower === 'ios') deviceForSearch = 'iOS';
    else if (deviceLower === 'android') deviceForSearch = 'Android';
    else if (deviceLower === 'pc') deviceForSearch = 'PC';

    return {
      // 統合データ用フィールド
      id: `chobirich_${campaign.id}`,
      title: campaign.title || campaign.name,
      site: 'ちょびリッチ',
      siteId: 'chobirich',
      url: campaign.url,
      cashback: campaign.points || '不明',
      cashbackValue,
      cashbackUnit,
      category: this.mapCategory(campaign.categoryType),
      device: this.mapDevice(campaign.device || campaign.os || 'すべて'),
      imageUrl: campaign.imageUrl || null,
      description: campaign.description || campaign.title || '',
      conditions: campaign.method || '',
      lastUpdated: campaign.scrapedAt || campaign.timestamp || new Date().toISOString(),
      
      // 検索システム用フィールド
      siteName: 'ちょびリッチ',
      device: deviceForSearch,
      displayName: campaign.title || campaign.name,
      campaignUrl: campaign.url,
      pointSiteUrl: 'https://www.chobirich.com/',
      searchKeywords: `${campaign.title || ''} ${campaign.name || ''} ちょびリッチ`.toLowerCase(),
      searchWeight: 1.0
    };
  }

  convertPointIncomeCampaign(campaign, type) {
    // 還元率の正規化
    let cashbackValue = 0;
    let cashbackUnit = '円';
    
    if (campaign.points) {
      const match = campaign.points.match(/([0-9,]+)(円|%)/);
      if (match) {
        cashbackValue = parseInt(match[1].replace(/,/g, ''));
        cashbackUnit = match[2];
      }
    }

    // デバイス判定
    let deviceForSearch = 'All';
    if (type === 'ios') deviceForSearch = 'iOS';
    else if (type === 'android') deviceForSearch = 'Android';
    else if (type === 'pc') deviceForSearch = 'PC';
    else if (campaign.device) {
      const deviceLower = campaign.device.toLowerCase();
      if (deviceLower === 'ios') deviceForSearch = 'iOS';
      else if (deviceLower === 'android') deviceForSearch = 'Android';
      else if (deviceLower === 'pc') deviceForSearch = 'PC';
    }

    return {
      // 統合データ用フィールド
      id: `pointincome_${campaign.id}`,
      title: campaign.title || campaign.name,
      site: 'ポイントインカム',
      siteId: 'pointincome',
      url: campaign.url,
      cashback: campaign.points || '不明',
      cashbackValue,
      cashbackUnit,
      category: this.mapPointIncomeCategory(campaign.category_type),
      device: this.mapDevice(type === 'ios' ? 'ios' : type === 'android' ? 'android' : type === 'pc' ? 'pc' : 'すべて'),
      imageUrl: campaign.imageUrl || null,
      description: campaign.description || campaign.title || '',
      conditions: campaign.conditions || '',
      lastUpdated: campaign.timestamp || new Date().toISOString(),
      
      // 検索システム用フィールド
      siteName: 'ポイントインカム',
      device: deviceForSearch,
      displayName: campaign.title || campaign.name,
      campaignUrl: campaign.url,
      pointSiteUrl: 'https://pointi.jp/',
      searchKeywords: `${campaign.title || ''} ${campaign.name || ''} ポイントインカム`.toLowerCase(),
      searchWeight: 1.0
    };
  }

  mapCategory(categoryType) {
    const categoryMap = {
      'shopping': 'ショッピング',
      'service': 'サービス',
      'app': 'アプリ'
    };
    return categoryMap[categoryType] || 'その他';
  }

  mapPointIncomeCategory(categoryType) {
    if (!categoryType) return 'その他';
    
    if (categoryType.includes('shopping')) return 'ショッピング';
    if (categoryType.includes('service')) return 'サービス';
    if (categoryType.includes('app')) return 'アプリ';
    if (categoryType === 'pc_only') return 'PCゲーム';
    
    return 'その他';
  }

  mapDevice(device) {
    if (!device) return 'すべて';
    const deviceLower = device.toLowerCase();
    
    if (deviceLower === 'ios') return 'iOS 🍎';
    if (deviceLower === 'android') return 'Android 🤖';
    if (deviceLower === 'pc') return 'PC 💻';
    
    return 'すべて 🌐';
  }

  async createSearchData() {
    this.stats.total = this.campaigns.length;
    
    // メタデータ作成（検索システム用）
    const categories = {};
    const devices = {};
    const sites = {};
    
    this.campaigns.forEach(campaign => {
      // カテゴリ統計
      const cat = campaign.category || 'その他';
      categories[cat] = (categories[cat] || 0) + 1;
      
      // デバイス統計
      const dev = campaign.device || 'All';
      devices[dev] = (devices[dev] || 0) + 1;
      
      // サイト統計
      const site = campaign.siteName || campaign.site;
      sites[site] = (sites[site] || 0) + 1;
    });
    
    return {
      // 統合データ形式
      version: '3.0',
      generated: new Date().toISOString(),
      stats: {
        total: this.stats.total,
        sites: {
          chobirich: {
            total: this.stats.chobirich.web + this.stats.chobirich.ios + this.stats.chobirich.android,
            web: this.stats.chobirich.web,
            ios: this.stats.chobirich.ios,
            android: this.stats.chobirich.android
          },
          pointincome: {
            total: this.stats.pointincome.web + this.stats.pointincome.ios + this.stats.pointincome.android + this.stats.pointincome.pc,
            web: this.stats.pointincome.web,
            ios: this.stats.pointincome.ios,
            android: this.stats.pointincome.android,
            pc: this.stats.pointincome.pc
          }
        }
      },
      // 検索システム用形式
      campaigns: this.campaigns,
      metadata: {
        totalCampaigns: this.stats.total,
        lastUpdated: new Date().toISOString(),
        categories,
        devices,
        sites,
        popularKeywords: [
          { keyword: '楽天', count: 100 },
          { keyword: 'Yahoo', count: 80 },
          { keyword: 'Amazon', count: 70 }
        ]
      }
    };
  }

  async saveSearchData(data) {
    await fs.writeFile(
      this.outputFile,
      JSON.stringify(data, null, 2),
      'utf8'
    );
  }

  generateReport() {
    console.log('\n' + '='.repeat(70));
    console.log('📊 データ統合完了レポート');
    console.log('='.repeat(70));
    
    console.log('\n【ちょびリッチ】');
    console.log(`  通常案件: ${this.stats.chobirich.web}件`);
    console.log(`  iOSアプリ: ${this.stats.chobirich.ios}件`);
    console.log(`  Androidアプリ: ${this.stats.chobirich.android}件`);
    console.log(`  小計: ${this.stats.chobirich.web + this.stats.chobirich.ios + this.stats.chobirich.android}件`);
    
    console.log('\n【ポイントインカム】');
    console.log(`  通常案件: ${this.stats.pointincome.web}件`);
    console.log(`  iOSアプリ: ${this.stats.pointincome.ios}件`);
    console.log(`  Androidアプリ: ${this.stats.pointincome.android}件`);
    console.log(`  PC限定: ${this.stats.pointincome.pc}件`);
    console.log(`  小計: ${this.stats.pointincome.web + this.stats.pointincome.ios + this.stats.pointincome.android + this.stats.pointincome.pc}件`);
    
    console.log('\n【総計】');
    console.log(`  全案件数: ${this.stats.total}件`);
    
    if (this.stats.errors.length > 0) {
      console.log('\n⚠️ エラー:');
      this.stats.errors.forEach(err => {
        console.log(`  - ${err.site}: ${err.error}`);
      });
    }
  }
}

// 実行
if (require.main === module) {
  const integrator = new AllDataIntegrator();
  integrator.execute();
}

module.exports = AllDataIntegrator;