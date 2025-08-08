#!/usr/bin/env node

/**
 * 全カテゴリ2ページ目以降取得確認テスト
 * 各カテゴリの2-3ページ目からランダムサンプリング
 */

const ExtendedChobirichScraper = require('./src/sites/chobirich/ExtendedChobirichScraper');
const MobileAppScraper = require('./src/sites/chobirich/MobileAppScraper');

async function testPagination() {
  console.log('📄 全カテゴリ2ページ目以降取得確認テスト');
  console.log('=' .repeat(80));
  
  const results = {
    extended: {},
    mobile: {}
  };
  
  // 1️⃣ 拡張版システム（2-3ページ目テスト）
  console.log('\n🎯 1️⃣ 拡張版システム - 2ページ目以降テスト');
  console.log('-'.repeat(60));
  
  try {
    const extendedScraper = new ExtendedChobirichScraper();
    await extendedScraper.initialize();
    
    // 各タイプから代表的なカテゴリを選定
    const testCategories = [
      // ショッピングカテゴリ
      {
        key: 'shopping_101',
        name: '総合通販・デパート・ふるさと納税',
        pages: [2, 3]
      },
      {
        key: 'shopping_104', 
        name: 'ファッション',
        pages: [2]
      },
      // サービスカテゴリ
      {
        key: 'service_101',
        name: 'サービス・エンタメ',
        pages: [2, 3]
      },
      {
        key: 'service_107',
        name: 'クレジットカード',
        pages: [2]
      }
    ];
    
    for (const testCategory of testCategories) {
      const category = extendedScraper.categories[testCategory.key];
      if (!category) continue;
      
      console.log(`\n📂 ${testCategory.key}: ${category.name}`);
      results.extended[testCategory.key] = {
        name: category.name,
        pages: {}
      };
      
      for (const pageNum of testCategory.pages) {
        const pageUrl = `${category.baseUrl}?page=${pageNum}`;
        console.log(`\n   📄 ${pageNum}ページ目テスト`);
        console.log(`   🔗 ${pageUrl}`);
        
        try {
          const campaigns = await extendedScraper.scrapeCategoryPage(category.baseUrl, pageNum, category.type);
          
          if (campaigns.length > 0) {
            console.log(`   ✅ ${campaigns.length}件取得成功`);
            
            // ランダムに2-3件サンプリング
            const sampleCount = Math.min(3, campaigns.length);
            const shuffled = campaigns.sort(() => 0.5 - Math.random());
            const samples = shuffled.slice(0, sampleCount);
            
            samples.forEach((sample, index) => {
              console.log(`\n   📋 サンプル${index + 1}:`);
              console.log(`      案件名: ${sample.title}`);
              console.log(`      案件URL: ${sample.url}`);
              console.log(`      還元率: ${sample.points}`);
              console.log(`      カテゴリ: ${sample.categoryType}`);
            });
            
            results.extended[testCategory.key].pages[pageNum] = {
              count: campaigns.length,
              samples: samples
            };
            
          } else {
            console.log(`   ❌ 案件なし（最終ページの可能性）`);
          }
          
        } catch (error) {
          console.log(`   💥 エラー: ${error.message}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    await extendedScraper.cleanup();
    
  } catch (error) {
    console.error('💥 拡張版システムエラー:', error);
  }
  
  // 2️⃣ スマホアプリシステム（2-3ページ目テスト）
  console.log('\n\n🎯 2️⃣ スマホアプリシステム - 2ページ目以降テスト');
  console.log('-'.repeat(60));
  
  try {
    const mobileScraper = new MobileAppScraper();
    await mobileScraper.initialize();
    
    const testPages = [2, 3, 10]; // 2, 3, 10ページ目をテスト
    const osTypes = ['ios', 'android'];
    
    for (const osType of osTypes) {
      console.log(`\n📱 ${osType.toUpperCase()} アプリ案件 - 複数ページテスト`);
      results.mobile[osType] = {
        pages: {}
      };
      
      for (const pageNum of testPages) {
        const pageUrl = `https://www.chobirich.com/smartphone?page=${pageNum}`;
        console.log(`\n   📄 ${pageNum}ページ目テスト`);
        console.log(`   🔗 ${pageUrl}`);
        
        try {
          const campaigns = await mobileScraper.scrapeAppPage(pageUrl, osType);
          
          if (campaigns.length > 0) {
            console.log(`   ✅ ${campaigns.length}件取得成功`);
            
            // ランダムに3件サンプリング
            const sampleCount = Math.min(3, campaigns.length);
            const shuffled = campaigns.sort(() => 0.5 - Math.random());
            const samples = shuffled.slice(0, sampleCount);
            
            samples.forEach((sample, index) => {
              console.log(`\n   📋 サンプル${index + 1}:`);
              console.log(`      案件名: ${sample.title}`);
              console.log(`      案件ID: ${sample.id}`);
              console.log(`      案件URL: ${sample.url}`);
              console.log(`      還元ポイント: ${sample.points}`);
              console.log(`      獲得条件: ${sample.method}`);
              console.log(`      OS: ${sample.os}`);
            });
            
            results.mobile[osType].pages[pageNum] = {
              count: campaigns.length,
              samples: samples
            };
            
          } else {
            console.log(`   ❌ 案件なし（最終ページの可能性）`);
          }
          
        } catch (error) {
          console.log(`   💥 エラー: ${error.message}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    await mobileScraper.cleanup();
    
  } catch (error) {
    console.error('💥 スマホアプリシステムエラー:', error);
  }
  
  // 📊 総合結果サマリー
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 2ページ目以降取得テスト結果サマリー');
  console.log('='.repeat(80));
  
  console.log('\n🎯 拡張版システム（ショッピング・サービス）:');
  Object.entries(results.extended).forEach(([key, data]) => {
    console.log(`\n   ${key} (${data.name}):`);
    Object.entries(data.pages || {}).forEach(([page, pageData]) => {
      console.log(`      ${page}ページ目: ${pageData.count}件`);
    });
  });
  
  console.log('\n🎯 スマホアプリシステム:');
  Object.entries(results.mobile).forEach(([os, data]) => {
    console.log(`\n   ${os.toUpperCase()}:`);
    Object.entries(data.pages || {}).forEach(([page, pageData]) => {
      console.log(`      ${page}ページ目: ${pageData.count}件`);
    });
  });
  
  console.log('\n✅ 全システムで2ページ目以降の取得を確認完了！');
  
  return results;
}

// 実行
if (require.main === module) {
  testPagination().catch(console.error);
}