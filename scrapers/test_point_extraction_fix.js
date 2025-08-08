#!/usr/bin/env node

/**
 * 修正版ポイント抽出システムの動作確認テスト
 * ランダムサンプリング（2ページ目含む）で正確性を検証
 */

const ExtendedChobirichScraper = require('./src/sites/chobirich/ExtendedChobirichScraper');

async function testPointExtractionFix() {
  console.log('🔧 修正版ポイント抽出システム動作確認テスト');
  console.log('=' .repeat(60));
  console.log('🎯 テスト内容:');
  console.log('  - 正規表現ベースの「数字+pt/％」抽出');
  console.log('  - 想定外テキスト完全除去');
  console.log('  - 2ページ目含む案件サンプリング');
  console.log('=' .repeat(60));
  
  const scraper = new ExtendedChobirichScraper();
  
  try {
    await scraper.initialize();
    
    // テスト対象カテゴリ（ショッピング・サービス両方）
    const testCategories = [
      // ショッピングカテゴリ
      {
        key: 'shopping_101',
        name: '総合通販・デパート・ふるさと納税',
        pages: [1, 2]
      },
      {
        key: 'shopping_104',
        name: 'ショッピング104',  
        pages: [1, 2]
      },
      // サービスカテゴリ
      {
        key: 'service_101',
        name: 'サービス・クレジットカード・マネー101',
        pages: [1, 2]
      },
      {
        key: 'service_107',
        name: 'サービス・クレジットカード・マネー107',
        pages: [2] // 2ページ目のみテスト
      }
    ];
    
    const allSamples = [];
    
    for (const testCategory of testCategories) {
      const category = scraper.categories[testCategory.key];
      if (!category) continue;
      
      console.log(`\n📂 ${testCategory.key}: ${category.name}`);
      console.log('-'.repeat(50));
      
      for (const pageNum of testCategory.pages) {
        console.log(`\n📄 ${pageNum}ページ目テスト`);
        const pageUrl = pageNum === 1 ? 
          category.baseUrl : 
          `${category.baseUrl}?page=${pageNum}`;
        
        console.log(`🔗 ${pageUrl}`);
        
        try {
          const campaigns = await scraper.scrapeCategoryPage(
            category.baseUrl, 
            pageNum,
            category.type
          );
          
          if (campaigns.length > 0) {
            console.log(`✅ ${campaigns.length}件取得成功`);
            
            // ランダムに3件サンプリング
            const sampleCount = Math.min(3, campaigns.length);
            const shuffled = campaigns.sort(() => 0.5 - Math.random());
            const samples = shuffled.slice(0, sampleCount);
            
            samples.forEach((sample, index) => {
              console.log(`\n📋 サンプル${index + 1}:`);
              console.log(`   案件名: ${sample.title}`);
              console.log(`   案件URL: ${sample.url}`);
              console.log(`   還元率: ${sample.points}`);
              console.log(`   カテゴリ: ${sample.categoryType}`);
              console.log(`   ページ: ${pageNum}ページ目`);
            });
            
            // 全体収集用
            samples.forEach(sample => {
              allSamples.push({
                ...sample,
                categoryKey: testCategory.key,
                pageNum: pageNum
              });
            });
            
          } else {
            console.log(`❌ 案件なし（${pageNum}ページ目）`);
          }
          
        } catch (error) {
          console.log(`💥 エラー: ${error.message}`);
        }
        
        // ページ間待機
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // 📊 総合サマリー
    console.log('\n' + '='.repeat(60));
    console.log('📊 修正版ポイント抽出システム テスト結果');
    console.log('='.repeat(60));
    
    console.log(`\n🎯 取得サンプル総数: ${allSamples.length}件`);
    
    console.log('\n📋 すべてのサンプル一覧:');
    allSamples.forEach((sample, index) => {
      console.log(`\n${index + 1}. ${sample.title}`);
      console.log(`   URL: ${sample.url}`);
      console.log(`   還元率: ${sample.points}`);
      console.log(`   カテゴリ: ${sample.categoryKey} (${sample.pageNum}ページ目)`);
    });
    
    // ポイント抽出品質チェック
    console.log('\n🔍 ポイント抽出品質分析:');
    const validPoints = allSamples.filter(s => s.points && s.points.trim());
    const invalidPoints = allSamples.filter(s => !s.points || !s.points.trim());
    
    console.log(`✅ 有効なポイント値: ${validPoints.length}件`);
    console.log(`❌ 無効なポイント値: ${invalidPoints.length}件`);
    
    if (validPoints.length > 0) {
      console.log('\n✅ 有効ポイント値の例:');
      validPoints.slice(0, 5).forEach(s => {
        console.log(`   "${s.points}" - ${s.title.substring(0, 30)}...`);
      });
    }
    
    if (invalidPoints.length > 0) {
      console.log('\n❌ 無効ポイント値の案件:');
      invalidPoints.forEach(s => {
        console.log(`   "${s.points}" - ${s.title.substring(0, 30)}...`);
      });
    }
    
    await scraper.cleanup();
    
    console.log('\n✅ 修正版ポイント抽出システムテスト完了！');
    return allSamples;
    
  } catch (error) {
    console.error('💥 テストエラー:', error);
    await scraper.cleanup();
    throw error;
  }
}

// 実行
if (require.main === module) {
  testPointExtractionFix().catch(console.error);
}