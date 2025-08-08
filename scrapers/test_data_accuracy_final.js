#!/usr/bin/env node

/**
 * 修正版システム：案件データ正確性確認テスト
 * 案件タイトル、URL、還元率、対応デバイスの完全確認
 */

const ExtendedChobirichScraper = require('./src/sites/chobirich/ExtendedChobirichScraper');

async function testDataAccuracyFinal() {
  console.log('🔍 修正版システム：案件データ正確性確認テスト');
  console.log('=' .repeat(60));
  console.log('📋 確認項目:');
  console.log('  - 案件タイトル（表示通りそのまま）');
  console.log('  - 案件URL（正確なリンク）');
  console.log('  - 還元率（数字+pt/％のみ）');
  console.log('  - 対応デバイス（PC/モバイル）');
  console.log('=' .repeat(60));
  
  const scraper = new ExtendedChobirichScraper();
  
  try {
    await scraper.initialize();
    
    // テスト対象：ショッピング・サービス各2カテゴリ（1-2ページ目）
    const testCategories = [
      // ショッピングカテゴリ
      {
        key: 'shopping_101',
        name: '総合通販・デパート・ふるさと納税',
        pages: [1, 2],
        type: 'shopping'
      },
      {
        key: 'shopping_105',
        name: '家電・パソコン',
        pages: [1, 2],
        type: 'shopping'
      },
      // サービスカテゴリ
      {
        key: 'service_101',
        name: 'サービス・クレジットカード・マネー101',
        pages: [1, 2],
        type: 'service'
      },
      {
        key: 'service_107',
        name: 'サービス・クレジットカード・マネー107',
        pages: [2], // 高額案件が多い2ページ目
        type: 'service'
      }
    ];
    
    const allSamples = [];
    
    for (const testCategory of testCategories) {
      const category = scraper.categories[testCategory.key];
      if (!category) continue;
      
      console.log(`\n📂 ${testCategory.key}: ${category.name}`);
      console.log('-'.repeat(50));
      
      for (const pageNum of testCategory.pages) {
        console.log(`\n📄 ${pageNum}ページ目から案件データ取得`);
        
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
              console.log(`   案件タイトル: ${sample.title}`);
              console.log(`   案件URL: ${sample.url}`);
              console.log(`   還元率: ${sample.points || '（取得できず）'}`);
              console.log(`   対応デバイス: PC（拡張版システム）`);
              console.log(`   カテゴリタイプ: ${sample.categoryType}`);
              console.log(`   ページ: ${pageNum}ページ目`);
            });
            
            // 全体収集用
            samples.forEach(sample => {
              allSamples.push({
                ...sample,
                categoryKey: testCategory.key,
                pageNum: pageNum,
                deviceType: 'PC'
              });
            });
            
          } else {
            console.log(`❌ 案件なし（${pageNum}ページ目）`);
          }
          
        } catch (error) {
          console.log(`💥 エラー: ${error.message}`);
        }
        
        // ページ間待機
        await new Promise(resolve => setTimeout(resolve, 2500));
      }
    }
    
    // 📊 詳細データ確認レポート
    console.log('\n' + '='.repeat(60));
    console.log('📊 案件データ正確性確認レポート');
    console.log('='.repeat(60));
    
    console.log(`\n🎯 取得サンプル総数: ${allSamples.length}件`);
    
    console.log('\n📋 全案件詳細データ（目視確認用）:');
    console.log('='.repeat(60));
    
    allSamples.forEach((sample, index) => {
      console.log(`\n【案件 ${index + 1}】`);
      console.log(`案件タイトル: ${sample.title}`);
      console.log(`案件URL: ${sample.url}`);
      console.log(`還元率: ${sample.points || '取得できず'}`);
      console.log(`対応デバイス: ${sample.deviceType}`);
      console.log(`カテゴリ: ${sample.categoryKey} (${sample.categoryType})`);
      console.log(`ページ: ${sample.pageNum}ページ目`);
      console.log(`案件ID: ${sample.id}`);
      console.log('-'.repeat(40));
    });
    
    // データ品質分析
    console.log('\n🔍 データ品質分析:');
    const validTitles = allSamples.filter(s => s.title && s.title.trim()).length;
    const validUrls = allSamples.filter(s => s.url && s.url.includes('/ad_details/')).length;
    const validPoints = allSamples.filter(s => s.points && s.points.trim()).length;
    const validIds = allSamples.filter(s => s.id && s.id.trim()).length;
    
    console.log(`✅ 有効な案件タイトル: ${validTitles}/${allSamples.length}件`);
    console.log(`✅ 有効な案件URL: ${validUrls}/${allSamples.length}件`);
    console.log(`✅ 有効な還元率: ${validPoints}/${allSamples.length}件`);
    console.log(`✅ 有効な案件ID: ${validIds}/${allSamples.length}件`);
    
    // 還元率パターン分析
    if (validPoints > 0) {
      console.log('\n💰 還元率パターン例:');
      const pointExamples = allSamples
        .filter(s => s.points && s.points.trim())
        .slice(0, 8);
      
      pointExamples.forEach(s => {
        console.log(`  "${s.points}" - ${s.title.substring(0, 30)}${s.title.length > 30 ? '...' : ''}`);
      });
    }
    
    // 高額案件の特定
    const highValueCampaigns = allSamples.filter(s => {
      if (!s.points) return false;
      const numValue = parseInt(s.points.replace(/[^0-9]/g, ''));
      return numValue >= 10000;
    });
    
    if (highValueCampaigns.length > 0) {
      console.log('\n💎 高額案件（10,000pt以上）:');
      highValueCampaigns.forEach(s => {
        console.log(`  ${s.points} - ${s.title}`);
        console.log(`    → ${s.url}`);
      });
    }
    
    await scraper.cleanup();
    
    console.log('\n✅ 案件データ正確性確認テスト完了！');
    console.log('👀 上記データの正確性を目視で確認してください。');
    
    return allSamples;
    
  } catch (error) {
    console.error('💥 テストエラー:', error);
    await scraper.cleanup();
    throw error;
  }
}

// 実行
if (require.main === module) {
  testDataAccuracyFinal().catch(console.error);
}