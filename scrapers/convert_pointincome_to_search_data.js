#!/usr/bin/env node

/**
 * ポイントインカム案件データをポイ速検索用データに変換
 * Web案件データをsearch-data.json形式に変換
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// UUID代替関数
function generateUUID() {
  return crypto.randomBytes(16).toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}

class PointIncomeToSearchDataConverter {
  constructor() {
    this.inputFile = path.join(__dirname, 'data', 'pointincome', 'pointincome_web_2025-08-08T07-30-20-276Z.json');
    this.outputFile = path.join(__dirname, 'pointincome_search_data_2025-08-08.json');
  }

  async execute() {
    console.log('🔄 ポイントインカム案件データ → ポイ速検索データ変換開始');
    console.log('='.repeat(60));

    try {
      // Step 1: ポイントインカムデータ読み込み
      const pointIncomeData = await this.loadPointIncomeData();
      
      // Step 2: データ変換
      const searchData = await this.convertToSearchFormat(pointIncomeData);
      
      // Step 3: メタデータ生成
      const completeSearchData = await this.generateMetadata(searchData);
      
      // Step 4: ファイル出力
      await this.saveSearchData(completeSearchData);
      
      // Step 5: 完了レポート
      await this.generateReport(pointIncomeData, completeSearchData);
      
      console.log('\n✅ データ変換完了！');

    } catch (error) {
      console.error('💥 変換エラー:', error);
      throw error;
    }
  }

  /**
   * ポイントインカムデータ読み込み
   */
  async loadPointIncomeData() {
    console.log('\n📂 Step 1: ポイントインカムデータ読み込み');
    console.log('-'.repeat(40));

    try {
      const data = await fs.readFile(this.inputFile, 'utf8');
      const pointIncomeData = JSON.parse(data);
      
      console.log(`✅ ポイントインカムデータ読み込み成功`);
      console.log(`   総案件数: ${pointIncomeData.campaigns.length}件`);
      console.log(`   取得日時: ${pointIncomeData.scrape_date}`);
      console.log(`   処理カテゴリ: ${pointIncomeData.stats.categoriesProcessed}個`);
      console.log(`   重複除外: ${pointIncomeData.stats.duplicatesSkipped}件`);
      
      return pointIncomeData;
    } catch (error) {
      console.error('❌ ポイントインカムデータ読み込みエラー:', error.message);
      throw error;
    }
  }

  /**
   * 検索データ形式に変換
   */
  async convertToSearchFormat(pointIncomeData) {
    console.log('\n🔄 Step 2: 検索データ形式に変換');
    console.log('-'.repeat(40));

    const convertedCampaigns = [];
    let successCount = 0;
    let errorCount = 0;

    for (const campaign of pointIncomeData.campaigns) {
      try {
        const searchResult = {
          id: generateUUID(),
          siteName: 'ポイントインカム',
          cashback: this.formatCashback(campaign.points),
          cashbackYen: this.formatCashbackYen(campaign.points),
          device: 'すべて', // Web案件のため
          url: campaign.url,
          lastUpdated: this.formatDate(campaign.timestamp),
          description: campaign.title,
          displayName: campaign.title,
          campaignUrl: campaign.url,
          pointSiteUrl: 'https://pointi.jp',
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
    console.log(`   変換率: ${((successCount / pointIncomeData.campaigns.length) * 100).toFixed(1)}%`);

    return convertedCampaigns;
  }

  /**
   * ポイント表記の統一
   */
  formatCashback(points) {
    if (!points) return '0%';
    
    // 既にパーセント表記の場合はそのまま（正規化済み）
    if (points.includes('%') || points.includes('％')) {
      return points;
    }
    
    // その他の場合もそのまま返す
    return points;
  }

  /**
   * 円表記の統一（10pt=1円で換算済み）
   */
  formatCashbackYen(points) {
    if (!points) return '0%';
    
    // パーセント表記の場合はそのまま
    if (points.includes('%') || points.includes('％')) {
      return points;
    }
    
    // その他の場合もそのまま返す
    return points;
  }

  /**
   * カテゴリ判定
   */
  determineCategory(campaign) {
    const title = campaign.title.toLowerCase();
    const categoryType = campaign.category_type;
    
    // カテゴリタイプがshoppingの場合
    if (categoryType === 'shopping') {
      return 'shopping';
    }
    
    // タイトルからカテゴリ推定
    if (title.includes('ゲーム') || title.includes('エンタメ') || title.includes('動画') || title.includes('音楽')) {
      return 'entertainment';
    }
    
    if (title.includes('旅行') || title.includes('ホテル') || title.includes('航空') || title.includes('宿泊')) {
      return 'travel';
    }
    
    if (title.includes('クレジット') || title.includes('カード') || title.includes('ローン') || title.includes('銀行')) {
      return 'creditcard';
    }
    
    if (title.includes('保険') || title.includes('投資') || title.includes('fx') || title.includes('証券')) {
      return 'money';
    }
    
    if (title.includes('美容') || title.includes('健康') || title.includes('化粧品') || title.includes('サプリ')) {
      return 'beauty';
    }
    
    if (title.includes('通信') || title.includes('回線') || title.includes('プロバイダ') || title.includes('wifi')) {
      return 'telecom';
    }
    
    if (title.includes('転職') || title.includes('求人') || title.includes('派遣') || title.includes('バイト')) {
      return 'job';
    }
    
    if (title.includes('学習') || title.includes('教育') || title.includes('スクール') || title.includes('講座')) {
      return 'education';
    }
    
    // デフォルトはshopping
    return 'shopping';
  }

  /**
   * 検索キーワード生成
   */
  generateSearchKeywords(campaign) {
    const title = campaign.title || '';
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
    
    // パーセント表記の場合は重み付け
    const points = campaign.points || '';
    if (points.includes('%') || points.includes('％')) {
      const percentMatch = points.match(/([\d.]+)/);
      if (percentMatch) {
        const value = parseFloat(percentMatch[1]);
        if (value >= 10) weight += 3;
        else if (value >= 5) weight += 2;
        else if (value >= 1) weight += 1;
      }
    }
    
    // 人気サービス名による重み付け
    const title = campaign.title.toLowerCase();
    if (title.includes('楽天') || title.includes('amazon') || title.includes('yahoo') || 
        title.includes('じゃらん') || title.includes('booking') || title.includes('一休')) {
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
    console.log('\n📊 Step 3: メタデータ生成');
    console.log('-'.repeat(40));

    const categories = {};
    const devices = {};
    const sites = {};
    const popularKeywords = {};
    
    // ポイントインカムは固定値
    let maxCashbackData = {
      amount: '20%',
      site: 'ポイントインカム',
      campaignName: '高還元率案件',
      date: new Date().toLocaleDateString('ja-JP')
    };
    
    let maxPercentValue = 0;

    campaigns.forEach(campaign => {
      // カテゴリ統計
      categories[campaign.category] = (categories[campaign.category] || 0) + 1;
      
      // デバイス統計
      devices[campaign.device] = (devices[campaign.device] || 0) + 1;
      
      // サイト統計
      sites[campaign.siteName] = (sites[campaign.siteName] || 0) + 1;
      
      // 最高パーセント検索
      const cashback = campaign.cashback || '0%';
      const percentMatch = cashback.match(/([\d.]+)%/);
      if (percentMatch) {
        const value = parseFloat(percentMatch[1]);
        if (value > maxPercentValue) {
          maxPercentValue = value;
          maxCashbackData = {
            amount: `${value}%`,
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
    console.log(`   最高還元率: ${maxCashbackData.amount} (${maxCashbackData.campaignName})`);

    return {
      campaigns,
      metadata
    };
  }

  /**
   * 検索データ保存
   */
  async saveSearchData(searchData) {
    console.log('\n💾 Step 4: 検索データ保存');
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
  async generateReport(pointIncomeData, searchData) {
    console.log('\n📋 Step 5: 変換完了レポート');
    console.log('='.repeat(60));
    
    console.log('🎯 ポイントインカムデータ → 検索データ変換結果:');
    console.log(`   元データ: ${pointIncomeData.campaigns.length}件`);
    console.log(`   変換済み: ${searchData.campaigns.length}件`);
    console.log(`   変換率: ${((searchData.campaigns.length / pointIncomeData.campaigns.length) * 100).toFixed(1)}%`);
    
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
    
    console.log('\n💰 最高還元率案件:');
    console.log(`   ${searchData.metadata.maxCashbackData.amount} - ${searchData.metadata.maxCashbackData.campaignName}`);
    
    console.log('\n🚀 ポイ速検索テスト準備完了:');
    console.log('   1. 生成されたJSONファイルを確認');
    console.log('   2. ポイ速の検索システムに統合');
    console.log('   3. ポイントインカム案件の検索機能をテスト');
  }
}

// 実行
async function main() {
  const converter = new PointIncomeToSearchDataConverter();
  
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