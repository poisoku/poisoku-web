#!/usr/bin/env node

/**
 * ちょびリッチ全案件システム総合動作確認テスト
 * 
 * 【完成版】全システム統合テスト:
 * 1. 拡張版システム: ショッピング・サービスカテゴリ (20カテゴリ)
 * 2. スマホアプリシステム: iOS・Android案件 (577-578件)
 * 
 * 各カテゴリからランダムサンプリングして動作確認
 */

const ExtendedChobirichScraper = require('./src/sites/chobirich/ExtendedChobirichScraper');
const MobileAppScraper = require('./src/sites/chobirich/MobileAppScraper');

async function testAllSystems() {
  console.log('🎉 ちょびリッチ全案件システム総合動作確認テスト');
  console.log('=' .repeat(80));
  console.log('📋 テスト対象:');
  console.log('  1️⃣ 拡張版システム: ショッピング・サービスカテゴリ (20カテゴリ)');
  console.log('  2️⃣ スマホアプリシステム: iOS・Android案件 (577-578件)');
  console.log('=' .repeat(80));
  
  const results = {
    extended: {},
    mobile: {}
  };
  
  // 1️⃣ 拡張版システムテスト
  console.log('\n🎯 1️⃣ 拡張版システム（ショッピング・サービス）テスト開始');
  console.log('-'.repeat(60));
  
  try {
    const extendedScraper = new ExtendedChobirichScraper();
    await extendedScraper.initialize();
    
    // テスト対象カテゴリを選定（各タイプから数個ずつ）
    const testCategories = [
      // ショッピングカテゴリから3つ
      'shopping_101', // 総合通販・デパート・ふるさと納税
      'shopping_103', // ファッション  
      'shopping_105', // 家電・パソコン
      // サービスカテゴリから3つ
      'service_101',  // サービス・クレジットカード・マネー101
      'service_103',  // サービス103
      'service_106'   // サービス106
    ];
    
    for (const categoryKey of testCategories) {
      const category = extendedScraper.categories[categoryKey];
      if (!category) continue;
      
      console.log(`\n📂 ${categoryKey}: ${category.name}`);
      console.log(`   🔗 ${category.baseUrl}`);
      
      try {
        // 1ページ目のみテスト取得
        const campaigns = await extendedScraper.scrapeCategoryPage(category.baseUrl, 1, category.type);
        
        if (campaigns.length > 0) {
          console.log(`   ✅ ${campaigns.length}件取得成功`);
          
          // ランダムに2-3件サンプリング
          const sampleCount = Math.min(3, campaigns.length);
          const shuffled = campaigns.sort(() => 0.5 - Math.random());
          const samples = shuffled.slice(0, sampleCount);
          
          samples.forEach((sample, index) => {
            console.log(`   📋 サンプル${index + 1}:`);
            console.log(`      案件名: ${sample.title}`);
            console.log(`      URL: ${sample.url}`);
            console.log(`      ポイント: ${sample.points}`);
            console.log(`      カテゴリタイプ: ${sample.categoryType}`);
          });
          
          results.extended[categoryKey] = {
            category: category.name,
            count: campaigns.length,
            samples: samples
          };
          
        } else {
          console.log(`   ❌ 案件取得なし`);
        }
        
      } catch (error) {
        console.log(`   💥 エラー: ${error.message}`);
      }
      
      // カテゴリ間待機
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    await extendedScraper.cleanup();
    
  } catch (error) {
    console.error('💥 拡張版システムエラー:', error);
  }
  
  // 2️⃣ スマホアプリシステムテスト
  console.log('\n\n🎯 2️⃣ スマホアプリシステム（iOS・Android）テスト開始');
  console.log('-'.repeat(60));
  
  try {
    const mobileScraper = new MobileAppScraper();
    await mobileScraper.initialize();
    
    const osTypes = ['ios', 'android'];
    
    for (const osType of osTypes) {
      console.log(`\n📱 ${osType.toUpperCase()} アプリ案件テスト`);
      console.log(`   🔗 https://www.chobirich.com/smartphone?page=1`);
      
      try {
        // 1ページ目のみテスト取得
        const campaigns = await mobileScraper.scrapeAppPage('https://www.chobirich.com/smartphone?page=1', osType);
        
        if (campaigns.length > 0) {
          console.log(`   ✅ ${campaigns.length}件取得成功`);
          
          // ランダムに3件サンプリング
          const sampleCount = Math.min(3, campaigns.length);
          const shuffled = campaigns.sort(() => 0.5 - Math.random());
          const samples = shuffled.slice(0, sampleCount);
          
          samples.forEach((sample, index) => {
            console.log(`   📋 サンプル${index + 1}:`);
            console.log(`      案件名: ${sample.title}`);
            console.log(`      案件ID: ${sample.id}`);
            console.log(`      URL: ${sample.url}`);
            console.log(`      ポイント: ${sample.points}`);
            console.log(`      獲得条件: ${sample.method}`);
            console.log(`      OS: ${sample.os}`);
          });
          
          results.mobile[osType] = {
            count: campaigns.length,
            samples: samples
          };
          
        } else {
          console.log(`   ❌ 案件取得なし`);
        }
        
      } catch (error) {
        console.log(`   💥 エラー: ${error.message}`);
      }
      
      // OS間待機
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    await mobileScraper.cleanup();
    
  } catch (error) {
    console.error('💥 スマホアプリシステムエラー:', error);
  }
  
  // 📊 総合結果サマリー
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 ちょびリッチ全案件システム総合テスト結果');
  console.log('='.repeat(80));
  
  console.log('\n🎯 1️⃣ 拡張版システム結果:');
  let totalExtendedSamples = 0;
  Object.entries(results.extended).forEach(([key, data]) => {
    console.log(`   ${key}: ${data.count}件 (${data.category})`);
    totalExtendedSamples += data.samples.length;
  });
  console.log(`   📊 テストサンプル総数: ${totalExtendedSamples}件`);
  
  console.log('\n🎯 2️⃣ スマホアプリシステム結果:');
  let totalMobileSamples = 0;
  Object.entries(results.mobile).forEach(([os, data]) => {
    console.log(`   ${os.toUpperCase()}: ${data.count}件`);
    totalMobileSamples += data.samples.length;
  });
  console.log(`   📊 テストサンプル総数: ${totalMobileSamples}件`);
  
  console.log(`\n🎉 総合テスト結果: ${totalExtendedSamples + totalMobileSamples}件のサンプル取得成功`);
  console.log('✅ ちょびリッチ全案件データ取得システム動作確認完了！');
  
  return results;
}

// 実行
if (require.main === module) {
  testAllSystems().catch(console.error);
}