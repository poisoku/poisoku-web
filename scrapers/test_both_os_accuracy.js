#!/usr/bin/env node

/**
 * 【完成版】Android/iOS両環境での案件データ正確性確認テスト
 * スマホアプリスクレイピングシステムの動作確認用
 * 1-2ページ目からランダムに案件を取得して正確性を検証
 */

const MobileAppScraper = require('./src/sites/chobirich/MobileAppScraper');

async function testBothOSAccuracy() {
  console.log('🔍 Android/iOS両環境 案件データ正確性確認テスト');
  console.log('=' .repeat(60));
  
  const scraper = new MobileAppScraper();
  
  try {
    await scraper.initialize();
    
    const osTypes = ['android', 'ios'];
    const testPages = [1, 2];
    const results = {};
    
    for (const osType of osTypes) {
      console.log(`\n\n${'='.repeat(60)}`);
      console.log(`📱 ${osType.toUpperCase()} 環境でのテスト`);
      console.log('='.repeat(60));
      
      results[osType] = [];
      
      for (const page of testPages) {
        const pageUrl = `https://www.chobirich.com/smartphone?page=${page}`;
        
        console.log(`\n📄 ${page}ページ目から${osType.toUpperCase()}案件サンプル取得`);
        console.log(`🔗 URL: ${pageUrl}`);
        console.log('-'.repeat(50));
        
        const campaigns = await scraper.scrapeAppPage(pageUrl, osType);
        
        if (campaigns.length > 0) {
          console.log(`✅ ${campaigns.length}件の${osType.toUpperCase()}案件を取得`);
          
          // ランダムに3件を選択
          const sampleCount = Math.min(3, campaigns.length);
          const shuffled = campaigns.sort(() => 0.5 - Math.random());
          const samples = shuffled.slice(0, sampleCount);
          
          samples.forEach((sample, index) => {
            console.log(`\n📋 サンプル${index + 1}:`);
            console.log(`   案件名: ${sample.title}`);
            console.log(`   案件ID: ${sample.id}`);
            console.log(`   案件URL: ${sample.url}`);
            console.log(`   ポイント: ${sample.points}`);
            console.log(`   獲得条件: ${sample.method}`);
            console.log(`   OS: ${sample.os}`);
          });
          
          results[osType].push(...samples);
          
        } else {
          console.log(`❌ ${page}ページ目: ${osType.toUpperCase()}案件なし`);
        }
        
        // ページ間の待機
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    // 総合サマリー
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 両OS環境テスト結果サマリー');
    console.log('='.repeat(60));
    
    console.log('\n📱 Android環境:');
    console.log(`   取得サンプル数: ${results.android.length}件`);
    if (results.android.length > 0) {
      console.log('   高ポイント案件:');
      const androidHighPoint = results.android
        .filter(c => parseInt(c.points.replace(/[^\d]/g, '')) >= 1000)
        .sort((a, b) => parseInt(b.points.replace(/[^\d]/g, '')) - parseInt(a.points.replace(/[^\d]/g, '')))
        .slice(0, 3);
      androidHighPoint.forEach(c => {
        console.log(`     - ${c.title}: ${c.points}`);
      });
    }
    
    console.log('\n📱 iOS環境:');
    console.log(`   取得サンプル数: ${results.ios.length}件`);
    if (results.ios.length > 0) {
      console.log('   高ポイント案件:');
      const iosHighPoint = results.ios
        .filter(c => parseInt(c.points.replace(/[^\d]/g, '')) >= 1000)
        .sort((a, b) => parseInt(b.points.replace(/[^\d]/g, '')) - parseInt(a.points.replace(/[^\d]/g, '')))
        .slice(0, 3);
      iosHighPoint.forEach(c => {
        console.log(`     - ${c.title}: ${c.points}`);
      });
    }
    
    // 同一案件の比較（もしあれば）
    const commonTitles = [];
    results.android.forEach(androidCampaign => {
      const found = results.ios.find(iosCampaign => 
        iosCampaign.title.includes(androidCampaign.title.split('（')[0]) ||
        androidCampaign.title.includes(iosCampaign.title.split('（')[0])
      );
      if (found) {
        commonTitles.push({
          android: androidCampaign,
          ios: found
        });
      }
    });
    
    if (commonTitles.length > 0) {
      console.log('\n🔄 両OSで共通の案件:');
      commonTitles.forEach(common => {
        console.log(`   ${common.android.title.split('（')[0]}:`);
        console.log(`     Android: ${common.android.points} (ID: ${common.android.id})`);
        console.log(`     iOS: ${common.ios.points} (ID: ${common.ios.id})`);
      });
    }
    
    return results;
    
  } catch (error) {
    console.error('💥 テストエラー:', error);
    throw error;
  } finally {
    await scraper.cleanup();
  }
}

// 実行
if (require.main === module) {
  testBothOSAccuracy().catch(console.error);
}