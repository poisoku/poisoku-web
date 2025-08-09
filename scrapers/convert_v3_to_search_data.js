#!/usr/bin/env node

/**
 * v3システム案件データをポイ速検索用データに変換・統合
 * 3,644件の最新データをsearch-data.json形式に変換
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// UUID代替関数
function generateUUID() {
  return crypto.randomBytes(16).toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}

class V3ToSearchDataConverter {
  constructor() {
    this.v3DataFile = path.join(__dirname, 'data', 'chobirich_production_complete_v3.json');
    this.outputFile = path.join(__dirname, '..', 'public', 'search-data.json');
    this.backupFile = path.join(__dirname, '..', 'public', 'search-data-backup.json');
  }

  async execute() {
    console.log('🔄 v3案件データ → ポイ速検索データ変換開始');
    console.log('='.repeat(60));

    try {
      // Step 1: v3データ読み込み
      const v3Data = await this.loadV3Data();
      
      // Step 2: 既存検索データのバックアップ
      await this.backupExistingData();
      
      // Step 3: データ変換
      const searchData = await this.convertToSearchFormat(v3Data);
      
      // Step 4: メタデータ生成
      const completeSearchData = await this.generateMetadata(searchData);
      
      // Step 5: ファイル出力
      await this.saveSearchData(completeSearchData);
      
      // Step 6: 完了レポート
      await this.generateReport(v3Data, completeSearchData);
      
      console.log('\n✅ データ変換・統合完了！');
      console.log('ポイ速での検索テストが可能になりました。');

    } catch (error) {
      console.error('💥 変換エラー:', error);
      throw error;
    }
  }

  /**
   * v3データ読み込み
   */
  async loadV3Data() {
    console.log('\n📂 Step 1: v3データ読み込み');
    console.log('-'.repeat(40));

    try {
      const data = await fs.readFile(this.v3DataFile, 'utf8');
      const v3Data = JSON.parse(data);
      
      console.log(`✅ v3データ読み込み成功`);
      console.log(`   総案件数: ${v3Data.totalCampaigns}件`);
      console.log(`   Web案件: ${v3Data.systemInfo.webCampaigns}件`);
      console.log(`   iOS案件: ${v3Data.systemInfo.iosCampaigns}件`);
      console.log(`   Android案件: ${v3Data.systemInfo.androidCampaigns}件`);
      console.log(`   最終更新: ${v3Data.lastUpdated}`);
      
      return v3Data;
    } catch (error) {
      console.error('❌ v3データ読み込みエラー:', error.message);
      throw error;
    }
  }

  /**
   * 既存データバックアップ
   */
  async backupExistingData() {
    console.log('\n💾 Step 2: 既存データバックアップ');
    console.log('-'.repeat(40));

    try {
      const existingData = await fs.readFile(this.outputFile, 'utf8');
      await fs.writeFile(this.backupFile, existingData);
      console.log('✅ 既存データをバックアップ済み');
    } catch (error) {
      console.log('⚠️ 既存データなし（新規作成）');
    }
  }

  /**
   * 検索データ形式に変換
   */
  async convertToSearchFormat(v3Data) {
    console.log('\n🔄 Step 3: 検索データ形式に変換');
    console.log('-'.repeat(40));

    const convertedCampaigns = [];
    let successCount = 0;
    let errorCount = 0;

    for (const campaign of v3Data.campaigns) {
      try {
        const searchResult = {
          id: generateUUID(),
          siteName: 'ちょびリッチ',
          cashback: this.formatCashback(campaign.points),
          cashbackYen: this.convertToYen(campaign.points),
          device: this.determineDevice(campaign),
          url: campaign.url,
          lastUpdated: this.formatDate(v3Data.lastUpdated),
          description: campaign.title || campaign.name,
          displayName: campaign.title || campaign.name,
          campaignUrl: campaign.url,
          pointSiteUrl: 'https://chobirich.com',
          category: this.determineCategory(campaign),
          searchKeywords: this.generateSearchKeywords(campaign),
          searchWeight: this.calculateSearchWeight(campaign)
        };

        convertedCampaigns.push(searchResult);
        successCount++;

      } catch (error) {
        console.log(`   ⚠️ 案件変換エラー (${campaign.id}): ${error.message}`);
        errorCount++;
      }
    }

    console.log(`✅ データ変換完了`);
    console.log(`   成功: ${successCount}件`);
    console.log(`   エラー: ${errorCount}件`);
    console.log(`   変換率: ${((successCount / v3Data.campaigns.length) * 100).toFixed(1)}%`);

    return convertedCampaigns;
  }

  /**
   * ポイント表記の統一
   */
  formatCashback(points) {
    if (!points) return '0pt';
    
    // 既にpt表記の場合はそのまま
    if (points.includes('pt')) {
      return points;
    }
    
    // %表記の場合はそのまま
    if (points.includes('%') || points.includes('％')) {
      return points;
    }
    
    // 数値のみの場合はpt付与
    const numMatch = points.match(/([\d,]+)/);
    if (numMatch) {
      return `${numMatch[1]}pt`;
    }
    
    return points;
  }

  /**
   * 円換算値計算
   */
  convertToYen(points) {
    if (!points) return '0円';
    
    // %表記の場合はそのまま
    if (points.includes('%') || points.includes('％')) {
      return points;
    }
    
    // pt表記から円換算 (1pt = 0.5円)
    const ptMatch = points.match(/([\d,]+)pt/);
    if (ptMatch) {
      const ptValue = parseInt(ptMatch[1].replace(/,/g, ''));
      const yenValue = Math.floor(ptValue * 0.5);
      return `${yenValue.toLocaleString()}円`;
    }
    
    // 数値のみの場合
    const numMatch = points.match(/([\d,]+)/);
    if (numMatch) {
      const ptValue = parseInt(numMatch[1].replace(/,/g, ''));
      const yenValue = Math.floor(ptValue * 0.5);
      return `${yenValue.toLocaleString()}円`;
    }
    
    return points;
  }

  /**
   * デバイス判定
   */
  determineDevice(campaign) {
    const title = (campaign.title || campaign.name || '').toLowerCase();
    const platform = (campaign.platform || '').toLowerCase();
    
    if (platform === 'ios' || title.includes('ios') || title.includes('iphone') || title.includes('ipad')) {
      return 'iOS';
    }
    
    if (platform === 'android' || title.includes('android')) {
      return 'Android';
    }
    
    if (title.includes('アプリ') && !title.includes('ios') && !title.includes('android')) {
      return 'iOS/Android';
    }
    
    return 'All';
  }

  /**
   * カテゴリ判定
   */
  determineCategory(campaign) {
    const title = (campaign.title || campaign.name || '').toLowerCase();
    const categoryType = campaign.categoryType;
    
    if (title.includes('アプリ') || campaign.platform) {
      return 'app';
    }
    
    if (categoryType === 'shopping') {
      return 'shopping';
    }
    
    if (categoryType === 'service') {
      return 'money';
    }
    
    // タイトルからカテゴリ推定
    if (title.includes('ショッピング') || title.includes('楽天') || title.includes('amazon')) {
      return 'shopping';
    }
    
    if (title.includes('ゲーム') || title.includes('エンタメ')) {
      return 'entertainment';
    }
    
    if (title.includes('旅行') || title.includes('ホテル')) {
      return 'travel';
    }
    
    if (title.includes('クレジット') || title.includes('カード')) {
      return 'creditcard';
    }
    
    return 'shopping';
  }

  /**
   * 検索キーワード生成
   */
  generateSearchKeywords(campaign) {
    const title = campaign.title || campaign.name || '';
    return title.toLowerCase()
      .replace(/[（）()【】\[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 検索重み計算
   */
  calculateSearchWeight(campaign) {
    let weight = 1;
    
    // 高還元率ボーナス
    const points = campaign.points || '';
    const numMatch = points.match(/(\d+)/);
    if (numMatch) {
      const value = parseInt(numMatch[1]);
      if (value >= 1000) weight += 3;
      else if (value >= 500) weight += 2;
      else if (value >= 100) weight += 1;
    }
    
    // %表記ボーナス
    if (points.includes('%') || points.includes('％')) {
      weight += 2;
    }
    
    return weight;
  }

  /**
   * 日付フォーマット
   */
  formatDate(isoDate) {
    const date = new Date(isoDate);
    return date.toLocaleString('ja-JP');
  }

  /**
   * メタデータ生成
   */
  async generateMetadata(campaigns) {
    console.log('\n📊 Step 4: メタデータ生成');
    console.log('-'.repeat(40));

    const categories = {};
    const devices = {};
    const sites = {};
    const popularKeywords = {};
    
    let maxCashbackData = {
      amount: '0円',
      site: 'ちょびリッチ',
      campaignName: '',
      date: new Date().toLocaleDateString('ja-JP')
    };
    
    let maxValue = 0;

    campaigns.forEach(campaign => {
      // カテゴリ統計
      categories[campaign.category] = (categories[campaign.category] || 0) + 1;
      
      // デバイス統計
      devices[campaign.device] = (devices[campaign.device] || 0) + 1;
      
      // サイト統計
      sites[campaign.siteName] = (sites[campaign.siteName] || 0) + 1;
      
      // 最高額検索
      const cashbackYen = campaign.cashbackYen || '0円';
      const yenMatch = cashbackYen.match(/(\d+)/);
      if (yenMatch) {
        const value = parseInt(yenMatch[1]);
        if (value > maxValue) {
          maxValue = value;
          maxCashbackData = {
            amount: cashbackYen,
            site: campaign.siteName,
            campaignName: campaign.description,
            date: new Date().toLocaleDateString('ja-JP')
          };
        }
      }
      
      // 人気キーワード
      const keywords = campaign.searchKeywords.split(' ');
      keywords.forEach(keyword => {
        if (keyword.length >= 2) {
          popularKeywords[keyword] = (popularKeywords[keyword] || 0) + 1;
        }
      });
    });

    // 人気キーワードをソート
    const sortedKeywords = Object.entries(popularKeywords)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20)
      .map(([keyword, count]) => ({ keyword, count }));

    const metadata = {
      totalCampaigns: campaigns.length,
      lastUpdated: new Date().toISOString(),
      categories,
      devices,
      sites,
      maxCashbackData,
      popularKeywords: sortedKeywords
    };

    console.log('✅ メタデータ生成完了');
    console.log(`   カテゴリ数: ${Object.keys(categories).length}`);
    console.log(`   デバイスタイプ: ${Object.keys(devices).length}`);
    console.log(`   人気キーワード: ${sortedKeywords.length}個`);
    console.log(`   最高額: ${maxCashbackData.amount} (${maxCashbackData.campaignName})`);

    return {
      campaigns,
      metadata
    };
  }

  /**
   * 検索データ保存
   */
  async saveSearchData(searchData) {
    console.log('\n💾 Step 5: 検索データ保存');
    console.log('-'.repeat(40));

    try {
      const jsonData = JSON.stringify(searchData, null, 2);
      await fs.writeFile(this.outputFile, jsonData);
      
      console.log('✅ 検索データ保存完了');
      console.log(`   ファイル: ${path.basename(this.outputFile)}`);
      console.log(`   サイズ: ${(jsonData.length / 1024 / 1024).toFixed(2)}MB`);
      
    } catch (error) {
      console.error('❌ 保存エラー:', error.message);
      throw error;
    }
  }

  /**
   * 完了レポート生成
   */
  async generateReport(v3Data, searchData) {
    console.log('\n📋 Step 6: 変換完了レポート');
    console.log('='.repeat(60));
    
    console.log('🎯 v3データ → 検索データ変換結果:');
    console.log(`   元データ: ${v3Data.totalCampaigns}件`);
    console.log(`   変換済み: ${searchData.campaigns.length}件`);
    console.log(`   変換率: ${((searchData.campaigns.length / v3Data.totalCampaigns) * 100).toFixed(1)}%`);
    
    console.log('\n📊 カテゴリ別内訳:');
    Object.entries(searchData.metadata.categories)
      .sort(([,a], [,b]) => b - a)
      .forEach(([category, count]) => {
        console.log(`   ${category}: ${count}件`);
      });
    
    console.log('\n📱 デバイス別内訳:');
    Object.entries(searchData.metadata.devices)
      .sort(([,a], [,b]) => b - a)
      .forEach(([device, count]) => {
        console.log(`   ${device}: ${count}件`);
      });
    
    console.log('\n🔥 人気キーワード Top 10:');
    searchData.metadata.popularKeywords.slice(0, 10).forEach((item, i) => {
      console.log(`   ${i+1}. ${item.keyword} (${item.count}件)`);
    });
    
    console.log('\n💰 最高額案件:');
    console.log(`   ${searchData.metadata.maxCashbackData.amount} - ${searchData.metadata.maxCashbackData.campaignName}`);
    
    console.log('\n🚀 ポイ速検索テスト準備完了:');
    console.log('   1. https://poisoku.jp/ にアクセス');
    console.log('   2. 検索ボックスで任意のキーワードを検索');
    console.log('   3. 新しい案件データが表示されることを確認');
    console.log('   4. デバイスフィルター（iOS/Android/PC）の動作確認');
  }
}

// 実行
async function main() {
  const converter = new V3ToSearchDataConverter();
  
  try {
    await converter.execute();
    process.exit(0);
  } catch (error) {
    console.error('💥 実行失敗:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}